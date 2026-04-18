"""Local-disk implementation of the ``FileStore`` protocol.

Layout
------
``{settings.DATA_DIR}/jobs/{job_id}/``
    ``<filename>``   The actual artifact (moved/renamed in from ``src``).
    ``meta.json``    JSON-encoded :class:`FileMeta` (without ``path``).

All public methods are coroutines so callers can ``await`` them inside
FastAPI request handlers without blocking the event loop. Heavy filesystem
work (hashing, rename, rmtree) is offloaded via ``asyncio.to_thread``.
"""

from __future__ import annotations

import asyncio
import hashlib
import json
import mimetypes
import shutil
from collections.abc import AsyncIterator
from pathlib import Path
from uuid import UUID

import aiofiles

from app.settings import get_settings

from .file_models import FileMeta

# 64 KiB is a sweet spot for both range streaming and sha256 throughput.
_CHUNK: int = 64 * 1024

# Extension overrides where ``mimetypes`` is unreliable across platforms.
_MIME_OVERRIDES: dict[str, str] = {
    ".mkv": "video/x-matroska",
    ".webm": "video/webm",
    ".m4a": "audio/mp4",
    ".opus": "audio/ogg",
}


def _guess_mime(filename: str) -> str:
    """Return a MIME type for ``filename`` with overrides for A/V formats."""
    suffix = Path(filename).suffix.lower()
    if suffix in _MIME_OVERRIDES:
        return _MIME_OVERRIDES[suffix]
    guessed, _ = mimetypes.guess_type(filename)
    return guessed or "application/octet-stream"


def _sha256_file(path: Path) -> tuple[str, int]:
    """Synchronously hash ``path`` and return ``(hex_digest, size_bytes)``."""
    hasher = hashlib.sha256()
    size = 0
    with path.open("rb") as fh:
        while True:
            chunk = fh.read(_CHUNK)
            if not chunk:
                break
            hasher.update(chunk)
            size += len(chunk)
    return hasher.hexdigest(), size


class LocalFileStore:
    """Filesystem-backed ``FileStore``.

    Parameters
    ----------
    root:
        Optional override for the storage root. Defaults to
        ``settings.DATA_DIR``.
    """

    def __init__(self, root: Path | None = None) -> None:
        self._root: Path = (root or get_settings().DATA_DIR).resolve()

    # ------------------------------------------------------------------ paths
    def _job_dir(self, job_id: UUID) -> Path:
        return self._root / "jobs" / str(job_id)

    def _meta_path(self, job_id: UUID) -> Path:
        return self._job_dir(job_id) / "meta.json"

    # --------------------------------------------------------------- finalize
    async def finalize(self, job_id: UUID, src: Path) -> FileMeta:
        """Move ``src`` into the job directory and persist ``meta.json``."""
        src = Path(src)
        if not src.is_file():
            raise FileNotFoundError(f"finalize source missing: {src}")

        job_dir = self._job_dir(job_id)
        await asyncio.to_thread(job_dir.mkdir, parents=True, exist_ok=True)

        filename = src.name
        dest = job_dir / filename

        # If src is already in place (worker wrote directly into job_dir),
        # skip the move; otherwise perform an atomic rename when possible
        # and fall back to copy+unlink across filesystems.
        if src.resolve() != dest.resolve():

            def _move() -> None:
                try:
                    src.replace(dest)
                except OSError:
                    shutil.copy2(src, dest)
                    src.unlink(missing_ok=True)

            await asyncio.to_thread(_move)

        sha256, size_bytes = await asyncio.to_thread(_sha256_file, dest)
        mime_type = _guess_mime(filename)

        meta = FileMeta(
            filename=filename,
            size_bytes=size_bytes,
            mime_type=mime_type,
            sha256=sha256,
            path=dest,
        )

        payload = json.dumps(
            {
                "filename": meta.filename,
                "size_bytes": meta.size_bytes,
                "mime_type": meta.mime_type,
                "sha256": meta.sha256,
            },
            indent=2,
        )
        async with aiofiles.open(self._meta_path(job_id), "w", encoding="utf-8") as fh:
            await fh.write(payload)

        return meta

    # ------------------------------------------------------------------ delete
    async def delete(self, job_id: UUID) -> None:
        """Recursively remove the job directory. Idempotent."""
        job_dir = self._job_dir(job_id)
        await asyncio.to_thread(shutil.rmtree, job_dir, ignore_errors=True)

    # --------------------------------------------------------------- read meta
    async def get_meta(self, job_id: UUID) -> FileMeta | None:
        """Load :class:`FileMeta` for ``job_id``, or ``None`` if absent."""
        meta_path = self._meta_path(job_id)
        if not await asyncio.to_thread(meta_path.is_file):
            return None
        async with aiofiles.open(meta_path, encoding="utf-8") as fh:
            data = json.loads(await fh.read())
        path = self._job_dir(job_id) / data["filename"]
        if not await asyncio.to_thread(path.is_file):
            return None
        return FileMeta(
            filename=data["filename"],
            size_bytes=int(data["size_bytes"]),
            mime_type=data["mime_type"],
            sha256=data["sha256"],
            path=path,
        )

    # ------------------------------------------------------------ open_range
    async def open_range(
        self,
        job_id: UUID,
        start: int | None,
        end: int | None,
    ) -> tuple[AsyncIterator[bytes], FileMeta]:
        """Return an async byte iterator + metadata for an HTTP Range read.

        ``start`` and ``end`` are **inclusive** byte offsets following
        RFC 7233. ``None`` for either bound means "from the beginning" /
        "until EOF" respectively.
        """
        meta = await self.get_meta(job_id)
        if meta is None:
            raise FileNotFoundError(f"no stored file for job {job_id}")

        size = meta.size_bytes
        lo = 0 if start is None else max(0, start)
        hi = size - 1 if end is None else min(size - 1, end)
        if size == 0:
            lo, hi = 0, -1  # zero-length file -> empty stream
        elif lo > hi:
            raise ValueError(f"invalid range: {lo}-{hi} for size {size}")

        path = meta.path

        async def _iter() -> AsyncIterator[bytes]:
            if hi < lo:
                return
            remaining = hi - lo + 1
            async with aiofiles.open(path, "rb") as fh:
                if lo:
                    await fh.seek(lo)
                while remaining > 0:
                    chunk = await fh.read(min(_CHUNK, remaining))
                    if not chunk:
                        break
                    remaining -= len(chunk)
                    yield chunk

        return _iter(), meta
