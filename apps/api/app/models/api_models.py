"""Hand-written pydantic v2 models mirroring the OpenAPI schemas.

These exist so the API can boot before `pnpm codegen` produces `generated.py`.
Keep field names aligned with `packages/shared-types/openapi.yaml`.
"""

from __future__ import annotations

from datetime import datetime
from enum import Enum
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field

# ---------------------------------------------------------------------------
# Enums
# ---------------------------------------------------------------------------


class SiteId(str, Enum):
    youtube = "youtube"
    x = "x"
    facebook = "facebook"
    reddit = "reddit"


class QualityPreset(str, Enum):
    best = "best"
    p2160 = "p2160"
    p1440 = "p1440"
    p1080 = "p1080"
    p720 = "p720"
    p480 = "p480"
    audio_mp3 = "audio_mp3"
    audio_m4a = "audio_m4a"


class Container(str, Enum):
    mp4 = "mp4"
    webm = "webm"
    mkv = "mkv"
    m4a = "m4a"
    mp3 = "mp3"
    opus = "opus"


class JobStatus(str, Enum):
    queued = "queued"
    probing = "probing"
    downloading = "downloading"
    postprocessing = "postprocessing"
    ready = "ready"
    failed = "failed"
    cancelled = "cancelled"
    expired = "expired"


# ---------------------------------------------------------------------------
# Base
# ---------------------------------------------------------------------------


class _Model(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)


# ---------------------------------------------------------------------------
# Meta
# ---------------------------------------------------------------------------


class Health(_Model):
    status: Literal["ok"] = "ok"
    version: str
    ytdlp_version: str | None = None
    ffmpeg_version: str | None = None
    uptime_seconds: int | None = None


class SiteCapabilities(_Model):
    video: bool = False
    audio: bool = False
    subtitles: bool = False
    live: bool = False
    playlists: bool = False


class Site(_Model):
    id: SiteId
    name: str
    domains: list[str] = Field(default_factory=list)
    capabilities: SiteCapabilities


# ---------------------------------------------------------------------------
# Probe
# ---------------------------------------------------------------------------


class ProbeRequest(_Model):
    url: str


class Format(_Model):
    format_id: str
    ext: str
    resolution: str | None = None
    height: int | None = None
    width: int | None = None
    fps: float | None = None
    vcodec: str | None = None
    acodec: str | None = None
    abr: float | None = None
    vbr: float | None = None
    filesize: int | None = None
    filesize_approx: int | None = None
    has_audio: bool = False
    has_video: bool = False
    note: str | None = None


class Thumbnail(_Model):
    url: str
    width: int | None = None
    height: int | None = None


class ProbeResult(_Model):
    site: SiteId
    id: str
    title: str
    description: str | None = None
    uploader: str | None = None
    channel: str | None = None
    duration_seconds: float | None = None
    upload_date: str | None = None
    view_count: int | None = None
    like_count: int | None = None
    webpage_url: str | None = None
    thumbnails: list[Thumbnail] = Field(default_factory=list)
    formats: list[Format] = Field(default_factory=list)
    is_live: bool = False
    age_limit: int = 0


# ---------------------------------------------------------------------------
# Jobs
# ---------------------------------------------------------------------------


class TimeRange(_Model):
    start_seconds: float | None = Field(default=None, ge=0)
    end_seconds: float | None = Field(default=None, ge=0)


class SubtitleOptions(_Model):
    enabled: bool = False
    languages: list[str] = Field(default_factory=lambda: ["en"])
    embed: bool = True


class CreateJobRequest(_Model):
    url: str
    preset: QualityPreset | None = None
    format_id: str | None = None
    container: Container | None = None
    audio_only: bool = False
    subtitles: SubtitleOptions | None = None
    time_range: TimeRange | None = None
    embed_thumbnail: bool = False
    embed_metadata: bool = True
    filename_template: str | None = None


class JobProgress(_Model):
    percent: float | None = Field(default=None, ge=0, le=100)
    downloaded_bytes: int | None = None
    total_bytes: int | None = None
    speed_bps: float | None = None
    eta_seconds: int | None = None
    fragment_index: int | None = None
    fragment_count: int | None = None


class JobFile(_Model):
    filename: str
    size_bytes: int
    mime_type: str | None = None
    sha256: str | None = None
    download_url: str


class JobErrorInfo(_Model):
    code: str
    message: str


class Job(_Model):
    id: str
    url: str
    site: SiteId | None = None
    status: JobStatus
    progress: JobProgress | None = None
    title: str | None = None
    thumbnail_url: str | None = None
    request: CreateJobRequest | None = None
    created_at: datetime
    started_at: datetime | None = None
    finished_at: datetime | None = None
    expires_at: datetime | None = None
    file: JobFile | None = None
    error: JobErrorInfo | None = None


class JobList(_Model):
    items: list[Job]
    next_cursor: str | None = None


# ---------------------------------------------------------------------------
# SSE events
# ---------------------------------------------------------------------------


class JobEventProgress(_Model):
    type: Literal["progress"] = "progress"
    job_id: str
    progress: JobProgress


class JobEventStatus(_Model):
    type: Literal["status"] = "status"
    job_id: str
    status: JobStatus


class JobEventDone(_Model):
    type: Literal["done"] = "done"
    job_id: str
    file: JobFile


class JobEventError(_Model):
    type: Literal["error"] = "error"
    job_id: str
    error: JobErrorInfo


JobEvent = JobEventProgress | JobEventStatus | JobEventDone | JobEventError


# ---------------------------------------------------------------------------
# Errors
# ---------------------------------------------------------------------------


class ErrorBody(_Model):
    code: str
    message: str
    details: dict[str, Any] | None = None


class Error(_Model):
    error: ErrorBody


__all__ = [
    "SiteId",
    "QualityPreset",
    "Container",
    "JobStatus",
    "Health",
    "SiteCapabilities",
    "Site",
    "ProbeRequest",
    "Format",
    "Thumbnail",
    "ProbeResult",
    "TimeRange",
    "SubtitleOptions",
    "CreateJobRequest",
    "JobProgress",
    "JobFile",
    "JobErrorInfo",
    "Job",
    "JobList",
    "JobEventProgress",
    "JobEventStatus",
    "JobEventDone",
    "JobEventError",
    "JobEvent",
    "ErrorBody",
    "Error",
]
