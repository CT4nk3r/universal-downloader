//! Local yt-dlp/ffmpeg sidecar adapter (J1.8).
//!
//! This module exposes the same conceptual API as the FastAPI server
//! (`packages/shared-types/openapi.yaml`) but driven by the
//! `binaries/yt-dlp` and `binaries/ffmpeg` Tauri sidecars. The React
//! layer talks to it through `apps/desktop/src/lib/sidecar-client.ts`,
//! which mirrors `@universal-downloader/api-client::createApiClient`.
//!
//! Tauri command names registered by `commands.rs`:
//!
//!   sidecar_probe          (url) -> ProbeResult
//!   sidecar_create_job     (CreateJobRequest) -> Job
//!   sidecar_get_job        (id)  -> Job
//!   sidecar_list_jobs      (status?, limit?) -> JobList
//!   sidecar_cancel_job     (id)  -> ()
//!   sidecar_open_job_file  (id)  -> PathBuf
//!
//! Tauri event channel: `ud://job-event` — payload is a `JobEvent` matching
//! the OpenAPI `JobEvent` discriminated union.
//!
//! ## Preset → yt-dlp format selector mapping (must match J1.3)
//!
//! ```text
//! QualityPreset | yt-dlp format selector
//! --------------+-----------------------------------------------
//! best          | bestvideo*+bestaudio/best
//! p2160         | bv*[height<=2160]+ba/b[height<=2160]
//! p1440         | bv*[height<=1440]+ba/b[height<=1440]
//! p1080         | bv*[height<=1080]+ba/b[height<=1080]
//! p720          | bv*[height<=720]+ba/b[height<=720]
//! p480          | bv*[height<=480]+ba/b[height<=480]
//! audio_mp3     | bestaudio/best                    (+ -x --audio-format mp3)
//! audio_m4a     | bestaudio[ext=m4a]/bestaudio/best (+ -x --audio-format m4a)
//! ```
//!
//! When `container` is `mp4|webm|mkv` for a height-capped preset:
//!   `bv*[height<=H][ext=C]+ba[ext=m4a] / bv*[height<=H]+ba / b[height<=H]`

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::Arc;

use chrono::{DateTime, Utc};
use regex::Regex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, BufReader};
use tokio::process::{Child, Command};
use tokio::sync::Mutex;
use uuid::Uuid;

use crate::error::{SidecarError, SidecarResult};

// =============================================================================
// Schema mirrors (subset of OpenAPI types we actually use locally)
// =============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum JobStatus {
    Queued,
    Probing,
    Downloading,
    Postprocessing,
    Ready,
    Failed,
    Cancelled,
    Expired,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct JobProgress {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub downloaded_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub total_bytes: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub speed_bps: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub eta_seconds: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_index: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fragment_count: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SubtitleOptions {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub languages: Vec<String>,
    #[serde(default)]
    pub embed: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct TimeRange {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub start_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_seconds: Option<f64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateJobRequest {
    pub url: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub preset: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub format_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub container: Option<String>,
    #[serde(default)]
    pub audio_only: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub subtitles: Option<SubtitleOptions>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub time_range: Option<TimeRange>,
    #[serde(default)]
    pub embed_thumbnail: bool,
    #[serde(default = "default_true")]
    pub embed_metadata: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filename_template: Option<String>,
}

fn default_true() -> bool {
    true
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobFile {
    pub filename: String,
    pub size_bytes: u64,
    pub mime_type: String,
    pub sha256: String,
    pub download_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JobErrorInfo {
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Job {
    pub id: Uuid,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub site: Option<String>,
    pub status: JobStatus,
    #[serde(default)]
    pub progress: JobProgress,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub thumbnail_url: Option<String>,
    pub request: CreateJobRequest,
    pub created_at: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub expires_at: Option<DateTime<Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub file: Option<JobFile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JobErrorInfo>,
}

#[derive(Debug, Clone, Serialize)]
pub struct JobList {
    pub items: Vec<Job>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Format {
    pub format_id: String,
    pub ext: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resolution: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub fps: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vcodec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub acodec: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub abr: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub vbr: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filesize: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub filesize_approx: Option<u64>,
    pub has_audio: bool,
    pub has_video: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct Thumbnail {
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub width: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub height: Option<u32>,
}

#[derive(Debug, Clone, Serialize)]
pub struct ProbeResult {
    pub site: String,
    pub id: String,
    pub title: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub uploader: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub channel: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration_seconds: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub upload_date: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub view_count: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub like_count: Option<u64>,
    pub webpage_url: String,
    pub thumbnails: Vec<Thumbnail>,
    pub formats: Vec<Format>,
    pub is_live: bool,
    pub age_limit: u32,
}

// JobEvent (discriminated union, mirrors openapi.yaml)
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum JobEvent {
    Progress {
        job_id: Uuid,
        progress: JobProgress,
    },
    Status {
        job_id: Uuid,
        status: JobStatus,
    },
    Done {
        job_id: Uuid,
        file: JobFile,
    },
    Error {
        job_id: Uuid,
        error: JobErrorInfo,
    },
}

pub const JOB_EVENT_CHANNEL: &str = "ud://job-event";

// =============================================================================
// JobStore
// =============================================================================

/// Per-job runtime state: persisted record + handle to the running child.
struct JobRow {
    job: Job,
    child: Option<Arc<Mutex<Option<Child>>>>,
    cancelled: bool,
}

/// In-memory job registry. Mounted as Tauri managed state.
pub struct JobStore {
    inner: Mutex<HashMap<Uuid, JobRow>>,
    data_dir: PathBuf,
}

impl JobStore {
    pub fn new(data_dir: PathBuf) -> Self {
        Self {
            inner: Mutex::new(HashMap::new()),
            data_dir,
        }
    }

    pub fn data_dir(&self) -> &Path {
        &self.data_dir
    }

    fn job_dir(&self, id: Uuid) -> PathBuf {
        self.data_dir.join("jobs").join(id.to_string())
    }
}

// =============================================================================
// Site detection (must accept the same set as the FastAPI server)
// =============================================================================

const SUPPORTED_SITES: &[&str] = &["youtube", "x", "facebook", "reddit"];

fn detect_site(url: &str) -> Option<String> {
    let parsed = url::Url::parse(url).ok()?;
    let host = parsed.host_str()?.to_ascii_lowercase();
    let host = host.trim_start_matches("www.").to_string();
    if host.contains("youtube.com") || host == "youtu.be" || host.contains("music.youtube.com") {
        Some("youtube".into())
    } else if host == "x.com" || host == "twitter.com" || host.ends_with(".x.com") {
        Some("x".into())
    } else if host.contains("facebook.com") || host == "fb.watch" {
        Some("facebook".into())
    } else if host.contains("reddit.com") || host == "redd.it" {
        Some("reddit".into())
    } else {
        None
    }
}

fn site_or_err(url: &str) -> SidecarResult<String> {
    let site = detect_site(url)
        .ok_or_else(|| SidecarError::UnsupportedSite(format!("unsupported site: {}", url)))?;
    if !SUPPORTED_SITES.contains(&site.as_str()) {
        return Err(SidecarError::UnsupportedSite(site));
    }
    Ok(site)
}

// =============================================================================
// Sidecar process resolution
// =============================================================================

/// Resolve the path to a bundled sidecar binary by name.
///
/// Tauri's bundler installs sidecars next to the main executable on
/// release builds and exposes them via `app.path().resource_dir()`. In
/// `tauri dev` we additionally fall back to the `binaries/` directory and
/// `which` on PATH so devs without the fetch script can still iterate.
fn resolve_sidecar(app: &AppHandle, name: &str) -> SidecarResult<PathBuf> {
    if let Ok(resource_dir) = app.path().resource_dir() {
        let exe = if cfg!(windows) {
            resource_dir.join(format!("{}.exe", name))
        } else {
            resource_dir.join(name)
        };
        if exe.exists() {
            return Ok(exe);
        }
    }
    if let Ok(cwd) = std::env::current_dir() {
        let candidate = if cfg!(windows) {
            cwd.join("binaries").join(format!("{}.exe", name))
        } else {
            cwd.join("binaries").join(name)
        };
        if candidate.exists() {
            return Ok(candidate);
        }
    }
    Ok(which::which(name)?)
}

// =============================================================================
// Format selector — must match J1.3 (apps/api/app/services/format_helpers.py)
// =============================================================================

const AUDIO_PRESETS: &[&str] = &["audio_mp3", "audio_m4a"];

fn resolve_format_selector(req: &CreateJobRequest) -> String {
    if let Some(fmt) = &req.format_id {
        return fmt.clone();
    }

    let mut preset: &str = req.preset.as_deref().unwrap_or("best");
    if req.audio_only && !AUDIO_PRESETS.contains(&preset) {
        preset = "audio_mp3";
    }

    match preset {
        "audio_mp3" => "bestaudio/best".into(),
        "audio_m4a" => "bestaudio[ext=m4a]/bestaudio/best".into(),
        "best" => "bestvideo*+bestaudio/best".into(),
        p => {
            let height = match p {
                "p2160" => 2160,
                "p1440" => 1440,
                "p1080" => 1080,
                "p720" => 720,
                "p480" => 480,
                _ => return "bestvideo*+bestaudio/best".into(),
            };
            let cont = req.container.as_deref();
            if matches!(cont, Some("mp4") | Some("webm") | Some("mkv")) {
                let c = cont.unwrap();
                format!(
                    "bv*[height<={h}][ext={c}]+ba[ext=m4a]/bv*[height<={h}]+ba/b[height<={h}]",
                    h = height,
                    c = c,
                )
            } else {
                format!("bv*[height<={h}]+ba/b[height<={h}]", h = height)
            }
        }
    }
}

fn audio_codec_for(req: &CreateJobRequest) -> Option<&'static str> {
    match req.preset.as_deref() {
        Some("audio_mp3") => Some("mp3"),
        Some("audio_m4a") => Some("m4a"),
        _ if req.audio_only => match req.container.as_deref() {
            Some("mp3") => Some("mp3"),
            Some("m4a") => Some("m4a"),
            Some("opus") => Some("opus"),
            _ => Some("mp3"),
        },
        _ => None,
    }
}

fn merge_container_for(req: &CreateJobRequest) -> &'static str {
    if audio_codec_for(req).is_some() {
        return "mp4";
    }
    match req.container.as_deref() {
        Some("mp4") => "mp4",
        Some("webm") => "webm",
        Some("mkv") => "mkv",
        _ => "mp4",
    }
}

// =============================================================================
// Probe
// =============================================================================

pub async fn probe(app: AppHandle, url: String) -> SidecarResult<ProbeResult> {
    let site = site_or_err(&url)?;
    let bin = resolve_sidecar(&app, "yt-dlp")?;

    tracing::info!(target: "ud::sidecar", url = %url, "probe");

    let output = Command::new(&bin)
        .arg("--dump-single-json")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--skip-download")
        .arg(&url)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .output()
        .await
        .map_err(SidecarError::Io)?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();
        return Err(SidecarError::UpstreamError(stderr.trim().to_string()));
    }

    let raw: serde_json::Value = serde_json::from_slice(&output.stdout)?;
    Ok(normalize_probe(&raw, site))
}

fn normalize_probe(raw: &serde_json::Value, site: String) -> ProbeResult {
    let formats = raw
        .get("formats")
        .and_then(|v| v.as_array())
        .map(|arr| arr.iter().filter_map(normalize_format).collect())
        .unwrap_or_default();

    let mut thumbnails: Vec<Thumbnail> = raw
        .get("thumbnails")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|t| {
                    let url = t.get("url").and_then(|v| v.as_str())?;
                    Some(Thumbnail {
                        url: url.to_string(),
                        width: t.get("width").and_then(|v| v.as_u64()).map(|n| n as u32),
                        height: t.get("height").and_then(|v| v.as_u64()).map(|n| n as u32),
                    })
                })
                .collect()
        })
        .unwrap_or_default();

    if thumbnails.is_empty() {
        if let Some(url) = raw.get("thumbnail").and_then(|v| v.as_str()) {
            thumbnails.push(Thumbnail {
                url: url.to_string(),
                width: None,
                height: None,
            });
        }
    }

    ProbeResult {
        site,
        id: raw
            .get("id")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        title: raw
            .get("title")
            .and_then(|v| v.as_str())
            .unwrap_or_default()
            .to_string(),
        description: raw.get("description").and_then(|v| v.as_str()).map(String::from),
        uploader: raw.get("uploader").and_then(|v| v.as_str()).map(String::from),
        channel: raw.get("channel").and_then(|v| v.as_str()).map(String::from),
        duration_seconds: raw.get("duration").and_then(|v| v.as_f64()),
        upload_date: raw.get("upload_date").and_then(|v| v.as_str()).map(String::from),
        view_count: raw.get("view_count").and_then(|v| v.as_u64()),
        like_count: raw.get("like_count").and_then(|v| v.as_u64()),
        webpage_url: raw
            .get("webpage_url")
            .and_then(|v| v.as_str())
            .or_else(|| raw.get("original_url").and_then(|v| v.as_str()))
            .unwrap_or_default()
            .to_string(),
        thumbnails,
        formats,
        is_live: raw.get("is_live").and_then(|v| v.as_bool()).unwrap_or(false),
        age_limit: raw
            .get("age_limit")
            .and_then(|v| v.as_u64())
            .map(|n| n as u32)
            .unwrap_or(0),
    }
}

fn normalize_format(raw: &serde_json::Value) -> Option<Format> {
    let format_id = raw.get("format_id")?.as_str()?.to_string();
    let ext = raw.get("ext").and_then(|v| v.as_str()).unwrap_or_default().to_string();

    let vcodec = raw.get("vcodec").and_then(|v| v.as_str()).map(String::from);
    let acodec = raw.get("acodec").and_then(|v| v.as_str()).map(String::from);
    let has_video = vcodec.as_deref().map(|c| c != "none").unwrap_or(false);
    let has_audio = acodec.as_deref().map(|c| c != "none").unwrap_or(false);

    let width = raw.get("width").and_then(|v| v.as_u64()).map(|n| n as u32);
    let height = raw.get("height").and_then(|v| v.as_u64()).map(|n| n as u32);
    let resolution = raw
        .get("resolution")
        .and_then(|v| v.as_str())
        .map(String::from)
        .or_else(|| width.zip(height).map(|(w, h)| format!("{}x{}", w, h)));

    Some(Format {
        format_id,
        ext,
        resolution,
        height,
        width,
        fps: raw.get("fps").and_then(|v| v.as_f64()),
        vcodec: if has_video { vcodec } else { None },
        acodec: if has_audio { acodec } else { None },
        abr: raw.get("abr").and_then(|v| v.as_f64()),
        vbr: raw.get("vbr").and_then(|v| v.as_f64()),
        filesize: raw.get("filesize").and_then(|v| v.as_u64()),
        filesize_approx: raw.get("filesize_approx").and_then(|v| v.as_u64()),
        has_audio,
        has_video,
        note: raw.get("format_note").and_then(|v| v.as_str()).map(String::from),
    })
}

// =============================================================================
// create_job
// =============================================================================

pub async fn create_job(
    app: AppHandle,
    store: Arc<JobStore>,
    req: CreateJobRequest,
) -> SidecarResult<Job> {
    if req.url.trim().is_empty() {
        return Err(SidecarError::BadRequest("url is required".into()));
    }
    let site = site_or_err(&req.url)?;
    let bin = resolve_sidecar(&app, "yt-dlp")?;
    let ffmpeg = resolve_sidecar(&app, "ffmpeg").ok();

    let id = Uuid::new_v4();
    let now = Utc::now();
    let job = Job {
        id,
        url: req.url.clone(),
        site: Some(site),
        status: JobStatus::Queued,
        progress: JobProgress::default(),
        title: None,
        thumbnail_url: None,
        request: req.clone(),
        created_at: now,
        started_at: None,
        finished_at: None,
        expires_at: None,
        file: None,
        error: None,
    };

    let job_dir = store.job_dir(id);
    tokio::fs::create_dir_all(&job_dir).await?;

    {
        let mut guard = store.inner.lock().await;
        guard.insert(
            id,
            JobRow {
                job: job.clone(),
                child: None,
                cancelled: false,
            },
        );
    }

    // Spawn the worker.
    let store_bg = store.clone();
    let app_bg = app.clone();
    let req_bg = req.clone();
    let bin_bg = bin.clone();
    let ffmpeg_bg = ffmpeg.clone();
    let job_dir_bg = job_dir.clone();
    tokio::spawn(async move {
        if let Err(err) =
            run_job(app_bg.clone(), store_bg.clone(), id, req_bg, bin_bg, ffmpeg_bg, job_dir_bg).await
        {
            tracing::error!(target: "ud::sidecar", job = %id, error = %err, "job failed");
            let info = JobErrorInfo {
                code: err.code().to_string(),
                message: err.to_string(),
            };
            {
                let mut guard = store_bg.inner.lock().await;
                if let Some(row) = guard.get_mut(&id) {
                    if !matches!(err, SidecarError::Cancelled) {
                        row.job.status = JobStatus::Failed;
                    }
                    row.job.error = Some(info.clone());
                    row.job.finished_at = Some(Utc::now());
                }
            }
            if !matches!(err, SidecarError::Cancelled) {
                let _ = app_bg.emit(
                    JOB_EVENT_CHANNEL,
                    JobEvent::Error { job_id: id, error: info },
                );
            }
        }
    });

    Ok(job)
}

#[allow(clippy::too_many_arguments)]
async fn run_job(
    app: AppHandle,
    store: Arc<JobStore>,
    id: Uuid,
    req: CreateJobRequest,
    bin: PathBuf,
    ffmpeg: Option<PathBuf>,
    job_dir: PathBuf,
) -> SidecarResult<()> {
    set_status(&app, &store, id, JobStatus::Downloading).await;

    let mut cmd = Command::new(&bin);
    cmd.arg("--newline")
        .arg("--no-warnings")
        .arg("--no-playlist")
        .arg("--restrict-filenames")
        .arg("--retries").arg("3")
        .arg("--fragment-retries").arg("3")
        .arg("--concurrent-fragments").arg("4");

    cmd.arg("--format").arg(resolve_format_selector(&req));
    cmd.arg("--merge-output-format").arg(merge_container_for(&req));

    let template = req
        .filename_template
        .clone()
        .unwrap_or_else(|| "%(title).200B [%(id)s].%(ext)s".into());
    cmd.arg("-o").arg(job_dir.join(&template));

    cmd.arg("--progress-template").arg(
        "PROG:%(progress.downloaded_bytes)s/%(progress.total_bytes)s/%(progress.speed)s/%(progress.eta)s",
    );

    if let Some(ff) = ffmpeg.as_ref() {
        if let Some(parent) = ff.parent() {
            cmd.arg("--ffmpeg-location").arg(parent);
        }
    }

    if let Some(codec) = audio_codec_for(&req) {
        cmd.arg("-x").arg("--audio-format").arg(codec);
        cmd.arg("--audio-quality").arg("0");
    }

    if req.embed_metadata {
        cmd.arg("--embed-metadata");
    }
    if req.embed_thumbnail {
        cmd.arg("--embed-thumbnail").arg("--write-thumbnail");
    }

    if let Some(subs) = req.subtitles.as_ref() {
        if subs.enabled && audio_codec_for(&req).is_none() {
            cmd.arg("--write-subs");
            let langs = if subs.languages.is_empty() {
                "en".to_string()
            } else {
                subs.languages.join(",")
            };
            cmd.arg("--sub-langs").arg(langs);
            if subs.embed {
                cmd.arg("--embed-subs");
            }
        }
    }

    if let Some(tr) = req.time_range.as_ref() {
        if tr.start_seconds.is_some() || tr.end_seconds.is_some() {
            let start = tr.start_seconds.unwrap_or(0.0);
            let end = tr
                .end_seconds
                .map(|e| format!("{:.3}", e))
                .unwrap_or_else(|| "inf".into());
            cmd.arg("--download-sections")
                .arg(format!("*{:.3}-{}", start, end));
            cmd.arg("--force-keyframes-at-cuts");
        }
    }

    cmd.arg("--print").arg("after_move:filepath:%(filepath)s");
    cmd.arg(&req.url);

    cmd.stdout(Stdio::piped()).stderr(Stdio::piped());

    let mut child = cmd.spawn().map_err(SidecarError::Io)?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| SidecarError::Internal("yt-dlp stdout missing".into()))?;
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| SidecarError::Internal("yt-dlp stderr missing".into()))?;

    let child_arc: Arc<Mutex<Option<Child>>> = Arc::new(Mutex::new(Some(child)));
    {
        let mut guard = store.inner.lock().await;
        if let Some(row) = guard.get_mut(&id) {
            row.job.started_at = Some(Utc::now());
            row.child = Some(child_arc.clone());
        }
    }

    // Drain stderr into the trace log.
    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(l)) = lines.next_line().await {
            tracing::warn!(target: "ud::sidecar::ytdlp", "{}", l);
        }
    });

    let prog_re = Regex::new(r"^PROG:([^/]*)/([^/]*)/([^/]*)/([^/]*)$").unwrap();
    let after_re = Regex::new(r"^after_move:filepath:(.+)$").unwrap();
    let mut output_path: Option<PathBuf> = None;

    let mut reader = BufReader::new(stdout).lines();
    while let Ok(Some(line)) = reader.next_line().await {
        if let Some(caps) = prog_re.captures(&line) {
            let downloaded = parse_opt_u64(&caps[1]);
            let total = parse_opt_u64(&caps[2]);
            let speed = parse_opt_f64(&caps[3]);
            let eta = parse_opt_u64(&caps[4]);
            let percent = match (downloaded, total) {
                (Some(d), Some(t)) if t > 0 => {
                    Some(((d as f64) / (t as f64) * 100.0).clamp(0.0, 100.0))
                }
                _ => None,
            };
            let progress = JobProgress {
                percent,
                downloaded_bytes: downloaded,
                total_bytes: total,
                speed_bps: speed,
                eta_seconds: eta,
                fragment_index: None,
                fragment_count: None,
            };
            update_progress(&app, &store, id, progress.clone()).await;
        } else if let Some(caps) = after_re.captures(&line) {
            output_path = Some(PathBuf::from(caps[1].trim()));
        } else {
            tracing::debug!(target: "ud::sidecar::ytdlp", "{}", line);
        }
    }

    let status = {
        let mut slot = child_arc.lock().await;
        if let Some(mut child) = slot.take() {
            child.wait().await.map_err(SidecarError::Io)?
        } else {
            return Err(SidecarError::Cancelled);
        }
    };

    {
        let guard = store.inner.lock().await;
        if let Some(row) = guard.get(&id) {
            if row.cancelled {
                return Err(SidecarError::Cancelled);
            }
        }
    }

    if !status.success() {
        return Err(SidecarError::UpstreamError(format!(
            "yt-dlp exited with {}",
            status
        )));
    }

    set_status(&app, &store, id, JobStatus::Postprocessing).await;

    let output = match output_path {
        Some(p) if p.exists() => p,
        _ => find_newest_file(&job_dir)?,
    };

    let meta = tokio::fs::metadata(&output).await?;
    let mime = mime_guess::from_path(&output)
        .first_or_octet_stream()
        .essence_str()
        .to_string();
    let sha = sha256_file(&output).await?;

    let file = JobFile {
        filename: output
            .file_name()
            .map(|s| s.to_string_lossy().to_string())
            .unwrap_or_else(|| "unknown".into()),
        size_bytes: meta.len(),
        mime_type: mime,
        sha256: sha,
        download_url: format!("ud-file://{}", id),
    };

    {
        let mut guard = store.inner.lock().await;
        if let Some(row) = guard.get_mut(&id) {
            row.job.file = Some(file.clone());
            row.job.status = JobStatus::Ready;
            row.job.progress.percent = Some(100.0);
            row.job.finished_at = Some(Utc::now());
            row.child = None;
        }
    }

    let _ = app.emit(
        JOB_EVENT_CHANNEL,
        JobEvent::Status {
            job_id: id,
            status: JobStatus::Ready,
        },
    );
    let _ = app.emit(JOB_EVENT_CHANNEL, JobEvent::Done { job_id: id, file });

    Ok(())
}

fn parse_opt_u64(s: &str) -> Option<u64> {
    let s = s.trim();
    if s.is_empty() || s == "NA" || s == "None" {
        return None;
    }
    s.parse::<f64>().ok().map(|f| f as u64)
}

fn parse_opt_f64(s: &str) -> Option<f64> {
    let s = s.trim();
    if s.is_empty() || s == "NA" || s == "None" {
        return None;
    }
    s.parse::<f64>().ok()
}

fn find_newest_file(dir: &Path) -> SidecarResult<PathBuf> {
    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in std::fs::read_dir(dir)? {
        let entry = entry?;
        if entry.file_type()?.is_file() {
            let meta = entry.metadata()?;
            let mtime = meta.modified().unwrap_or(std::time::UNIX_EPOCH);
            if newest.as_ref().map_or(true, |(t, _)| mtime > *t) {
                newest = Some((mtime, entry.path()));
            }
        }
    }
    newest
        .map(|(_, p)| p)
        .ok_or_else(|| SidecarError::UpstreamError("no output file produced".into()))
}

async fn sha256_file(path: &Path) -> SidecarResult<String> {
    use tokio::io::AsyncReadExt;
    let mut f = tokio::fs::File::open(path).await?;
    let mut hasher = Sha256::new();
    let mut buf = vec![0u8; 64 * 1024];
    loop {
        let n = f.read(&mut buf).await?;
        if n == 0 {
            break;
        }
        hasher.update(&buf[..n]);
    }
    Ok(format!("{:x}", hasher.finalize()))
}

async fn set_status(app: &AppHandle, store: &Arc<JobStore>, id: Uuid, status: JobStatus) {
    {
        let mut guard = store.inner.lock().await;
        if let Some(row) = guard.get_mut(&id) {
            row.job.status = status.clone();
        }
    }
    let _ = app.emit(
        JOB_EVENT_CHANNEL,
        JobEvent::Status { job_id: id, status },
    );
}

async fn update_progress(app: &AppHandle, store: &Arc<JobStore>, id: Uuid, progress: JobProgress) {
    {
        let mut guard = store.inner.lock().await;
        if let Some(row) = guard.get_mut(&id) {
            row.job.progress = progress.clone();
        }
    }
    let _ = app.emit(
        JOB_EVENT_CHANNEL,
        JobEvent::Progress {
            job_id: id,
            progress,
        },
    );
}

// =============================================================================
// Read-side accessors
// =============================================================================

pub async fn get_job(store: Arc<JobStore>, id: Uuid) -> SidecarResult<Job> {
    let guard = store.inner.lock().await;
    guard
        .get(&id)
        .map(|r| r.job.clone())
        .ok_or_else(|| SidecarError::NotFound(format!("job {} not found", id)))
}

pub async fn list_jobs(
    store: Arc<JobStore>,
    status: Option<String>,
    limit: Option<u32>,
) -> SidecarResult<JobList> {
    let guard = store.inner.lock().await;
    let mut items: Vec<Job> = guard
        .values()
        .map(|r| r.job.clone())
        .filter(|j| match &status {
            Some(s) => {
                serde_json::to_value(&j.status)
                    .ok()
                    .and_then(|v| v.as_str().map(String::from))
                    == Some(s.clone())
            }
            None => true,
        })
        .collect();
    items.sort_by(|a, b| b.created_at.cmp(&a.created_at));
    if let Some(lim) = limit {
        items.truncate(lim as usize);
    }
    Ok(JobList {
        items,
        next_cursor: None,
    })
}

pub async fn cancel_job(store: Arc<JobStore>, app: AppHandle, id: Uuid) -> SidecarResult<()> {
    let child = {
        let mut guard = store.inner.lock().await;
        let row = guard
            .get_mut(&id)
            .ok_or_else(|| SidecarError::NotFound(format!("job {} not found", id)))?;
        row.cancelled = true;
        row.job.status = JobStatus::Cancelled;
        row.job.finished_at = Some(Utc::now());
        row.child.clone()
    };
    if let Some(child_arc) = child {
        let mut slot = child_arc.lock().await;
        if let Some(mut child) = slot.take() {
            let _ = child.start_kill();
            let _ = child.wait().await;
        }
    }
    let _ = app.emit(
        JOB_EVENT_CHANNEL,
        JobEvent::Status {
            job_id: id,
            status: JobStatus::Cancelled,
        },
    );
    Ok(())
}

pub async fn open_job_file(store: Arc<JobStore>, id: Uuid) -> SidecarResult<PathBuf> {
    let guard = store.inner.lock().await;
    let row = guard
        .get(&id)
        .ok_or_else(|| SidecarError::NotFound(format!("job {} not found", id)))?;
    let file = row
        .job
        .file
        .as_ref()
        .ok_or_else(|| SidecarError::BadRequest("job has no file yet".into()))?;
    let path = store.job_dir(id).join(&file.filename);
    if !path.exists() {
        return Err(SidecarError::NotFound(format!(
            "file missing on disk: {}",
            path.display()
        )));
    }
    Ok(path)
}
