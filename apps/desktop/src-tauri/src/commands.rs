//! Tauri command handlers exposed to the JS frontend via `invoke()`.
//!
//! # Surface (J1.7 — menu/shell only)
//!   * [`open_in_folder`]       — reveal a path in the OS file manager
//!   * [`pick_download_folder`] — show a native directory-picker dialog
//!   * [`quit_app`]             — gracefully exit the application
//!
//! # Surface (J1.8 — sidecar/job commands, see [`crate::sidecar`])
//!   * [`sidecar_probe`]         (url) -> ProbeResult
//!   * [`sidecar_create_job`]    (CreateJobRequest) -> Job
//!   * [`sidecar_get_job`]       (id) -> Job
//!   * [`sidecar_list_jobs`]     (status?, limit?) -> JobList
//!   * [`sidecar_cancel_job`]    (id) -> ()
//!   * [`sidecar_open_job_file`] (id) -> PathBuf
//!
//! Job lifecycle events are emitted on the `ud://job-event` channel
//! (see [`crate::sidecar::JOB_EVENT_CHANNEL`]).

use std::path::PathBuf;
use std::sync::Arc;

use serde::Serialize;
use tauri::{AppHandle, Runtime, State};
use uuid::Uuid;

use crate::error::SidecarResult;
use crate::sidecar::{self, CreateJobRequest, Job, JobList, JobStore, ProbeResult};

#[derive(Debug, thiserror::Error, Serialize)]
pub enum CommandError {
    #[error("io error: {0}")]
    Io(String),
    #[error("dialog cancelled")]
    Cancelled,
    #[error("{0}")]
    Other(String),
}

impl From<std::io::Error> for CommandError {
    fn from(e: std::io::Error) -> Self {
        CommandError::Io(e.to_string())
    }
}

// ---------------------------------------------------------------------------
// J1.7 — shell/menu commands (unchanged)
// ---------------------------------------------------------------------------

/// Reveal `path` in the host OS file manager (Explorer / Finder / xdg-open).
#[tauri::command]
pub async fn open_in_folder<R: Runtime>(
    app: AppHandle<R>,
    path: String,
) -> Result<(), CommandError> {
    use tauri_plugin_shell::ShellExt;
    app.shell()
        .open(path, None)
        .map_err(|e| CommandError::Other(e.to_string()))
}

/// Show a native folder-picker. Returns the selected absolute path, or
/// [`CommandError::Cancelled`] if the user dismissed the dialog.
#[tauri::command]
pub async fn pick_download_folder<R: Runtime>(
    app: AppHandle<R>,
) -> Result<String, CommandError> {
    use tauri_plugin_dialog::DialogExt;
    let (tx, rx) = tokio::sync::oneshot::channel();
    app.dialog().file().pick_folder(move |maybe_path| {
        let _ = tx.send(maybe_path);
    });
    match rx.await.map_err(|e| CommandError::Other(e.to_string()))? {
        Some(p) => Ok(p.to_string()),
        None => Err(CommandError::Cancelled),
    }
}

/// Gracefully exit the app.
#[tauri::command]
pub async fn quit_app<R: Runtime>(app: AppHandle<R>) -> Result<(), CommandError> {
    app.exit(0);
    Ok(())
}

// ---------------------------------------------------------------------------
// J1.8 — sidecar adapter commands
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn sidecar_probe(app: AppHandle, url: String) -> SidecarResult<ProbeResult> {
    sidecar::probe(app, url).await
}

#[tauri::command]
pub async fn sidecar_create_job(
    app: AppHandle,
    store: State<'_, Arc<JobStore>>,
    req: CreateJobRequest,
) -> SidecarResult<Job> {
    sidecar::create_job(app, store.inner().clone(), req).await
}

#[tauri::command]
pub async fn sidecar_get_job(
    store: State<'_, Arc<JobStore>>,
    id: Uuid,
) -> SidecarResult<Job> {
    sidecar::get_job(store.inner().clone(), id).await
}

#[tauri::command]
pub async fn sidecar_list_jobs(
    store: State<'_, Arc<JobStore>>,
    status: Option<String>,
    limit: Option<u32>,
) -> SidecarResult<JobList> {
    sidecar::list_jobs(store.inner().clone(), status, limit).await
}

#[tauri::command]
pub async fn sidecar_cancel_job(
    app: AppHandle,
    store: State<'_, Arc<JobStore>>,
    id: Uuid,
) -> SidecarResult<()> {
    sidecar::cancel_job(store.inner().clone(), app, id).await
}

#[tauri::command]
pub async fn sidecar_open_job_file(
    store: State<'_, Arc<JobStore>>,
    id: Uuid,
) -> SidecarResult<PathBuf> {
    sidecar::open_job_file(store.inner().clone(), id).await
}

// ---------------------------------------------------------------------------
// Aggregate handler macro (used by `lib.rs` / `main.rs`)
// ---------------------------------------------------------------------------

/// Aggregate `invoke_handler` for the whole app. The concrete (un-nameable)
/// closure type returned by `tauri::generate_handler!` is inlined at the
/// call-site via this macro.
///
/// `lib.rs`/`main.rs` is responsible for registering the [`JobStore`] in
/// managed state before the Tauri runtime starts dispatching commands:
///
/// ```ignore
/// let data_dir = app.path().app_local_data_dir().unwrap();
/// app.manage(std::sync::Arc::new(crate::sidecar::JobStore::new(data_dir)));
/// ```
#[macro_export]
macro_rules! register_handlers {
    () => {
        ::tauri::generate_handler![
            // J1.7
            $crate::commands::open_in_folder,
            $crate::commands::pick_download_folder,
            $crate::commands::quit_app,
            // J1.8 — sidecar adapter
            $crate::commands::sidecar_probe,
            $crate::commands::sidecar_create_job,
            $crate::commands::sidecar_get_job,
            $crate::commands::sidecar_list_jobs,
            $crate::commands::sidecar_cancel_job,
            $crate::commands::sidecar_open_job_file,
        ]
    };
}

pub use register_handlers;

/// Names of all sidecar commands registered by [`register_handlers!`].
/// Convenience constant for tests / docs.
#[doc(hidden)]
pub const SIDECAR_COMMAND_NAMES: &[&str] = &[
    "sidecar_probe",
    "sidecar_create_job",
    "sidecar_get_job",
    "sidecar_list_jobs",
    "sidecar_cancel_job",
    "sidecar_open_job_file",
];
