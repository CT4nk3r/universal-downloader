//! Error types for the local sidecar adapter (J1.8).
//!
//! These mirror the FastAPI server's error envelope so the React layer can
//! treat both transports uniformly. `Serialize` is implemented as a flat
//! `{ code, message, details? }` envelope — Tauri's `invoke()` rejection
//! payload is exposed to JS as that JSON object.

use serde::{Serialize, Serializer};
use std::io;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum SidecarError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("upstream yt-dlp/ffmpeg failure: {0}")]
    UpstreamError(String),

    #[error("unsupported site: {0}")]
    UnsupportedSite(String),

    #[error("sidecar binary not found: {0}")]
    SidecarMissing(String),

    #[error("job was cancelled")]
    Cancelled,

    #[error("io error: {0}")]
    Io(#[from] io::Error),

    #[error("json error: {0}")]
    Json(#[from] serde_json::Error),

    #[error("internal error: {0}")]
    Internal(String),
}

impl SidecarError {
    pub fn code(&self) -> &'static str {
        match self {
            SidecarError::NotFound(_) => "not_found",
            SidecarError::BadRequest(_) => "bad_request",
            SidecarError::UpstreamError(_) => "upstream_error",
            SidecarError::UnsupportedSite(_) => "unsupported_site",
            SidecarError::SidecarMissing(_) => "sidecar_missing",
            SidecarError::Cancelled => "cancelled",
            SidecarError::Io(_) => "io_error",
            SidecarError::Json(_) => "json_error",
            SidecarError::Internal(_) => "internal_error",
        }
    }
}

impl Serialize for SidecarError {
    fn serialize<S: Serializer>(&self, ser: S) -> Result<S::Ok, S::Error> {
        use serde::ser::SerializeMap;
        let mut m = ser.serialize_map(Some(2))?;
        m.serialize_entry("code", self.code())?;
        m.serialize_entry("message", &self.to_string())?;
        m.end()
    }
}

impl From<tauri::Error> for SidecarError {
    fn from(e: tauri::Error) -> Self {
        SidecarError::Internal(e.to_string())
    }
}

impl From<which::Error> for SidecarError {
    fn from(e: which::Error) -> Self {
        SidecarError::SidecarMissing(e.to_string())
    }
}

pub type SidecarResult<T> = Result<T, SidecarError>;
