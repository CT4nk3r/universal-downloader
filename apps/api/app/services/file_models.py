"""Shared data classes for the file storage subsystem."""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path


@dataclass(slots=True)
class FileMeta:
    """Metadata describing a finalized artifact on disk.

    Attributes
    ----------
    filename:
        The user-visible filename (basename only, no directory components).
    size_bytes:
        Total size of the artifact in bytes.
    mime_type:
        Best-effort MIME type, with overrides for common A/V containers.
    sha256:
        Hex-encoded SHA-256 of the artifact contents.
    path:
        Absolute path to the artifact on the local filesystem.
    """

    filename: str
    size_bytes: int
    mime_type: str
    sha256: str
    path: Path
