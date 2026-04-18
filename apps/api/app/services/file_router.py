"""HTTP route for streaming finalized job artifacts with Range support.

This module exposes a self-contained :class:`fastapi.APIRouter` that J1.1
mounts at ``/v1/jobs/{id}/file``. The route:

* Looks up the job row (404 if missing).
* Refuses to serve unless ``status == "ready"`` (409).
* Honors the ``Range: bytes=start-end`` header per RFC 7233, returning
  ``200`` for full reads and ``206`` for partial reads with a correct
  ``Content-Range`` header.
* Authenticates either a ``Authorization: Bearer <UD_API_KEY>`` header
  **or** a short-lived signed URL pair ``?token=...&exp=...`` produced
  by :mod:`app.services.signed_urls` — useful for ``<video src=...>``
  and one-click browser downloads where headers can't be set.

Streaming is performed by an async generator backed by ``aiofiles`` so
large files do not block the event loop.
"""

from __future__ import annotations

import hmac
import re
from typing import Final
from uuid import UUID

from fastapi import APIRouter, Header, Query, Request, status
from fastapi.responses import StreamingResponse
from sqlmodel import select

from app.errors import (
    JobNotFoundError,
    JobNotReadyError,
    UnauthorizedError,
)
from app.settings import get_settings

from . import signed_urls
from .db import JobRow, session_scope
from .file_store import LocalFileStore

# Single shared ``LocalFileStore`` is fine — all state lives on disk.
_store: Final[LocalFileStore] = LocalFileStore()

# RFC 7233: ``Range: bytes=<start>-<end>`` (either bound optional).
_RANGE_RE: Final[re.Pattern[str]] = re.compile(
    r"^bytes=(?P<start>\d*)-(?P<end>\d*)$",
    re.IGNORECASE,
)

router = APIRouter(tags=["files"])


# ---------------------------------------------------------------------------
# Auth — Bearer header OR signed query string
# ---------------------------------------------------------------------------


def _check_bearer(request: Request) -> bool:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        return False
    parts = auth.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return False
    expected = get_settings().API_KEY.encode("utf-8")
    return hmac.compare_digest(parts[1].strip().encode("utf-8"), expected)


def _authorize(
    request: Request,
    job_id: UUID,
    token: str | None,
    exp: int | None,
) -> None:
    """Allow request if Bearer matches OR signed (token, exp) verifies."""
    if _check_bearer(request):
        return
    if token and exp and signed_urls.verify(job_id, token, exp):
        return
    raise UnauthorizedError("Missing or invalid credentials for file download")


# ---------------------------------------------------------------------------
# Range parsing
# ---------------------------------------------------------------------------


def _parse_range(header: str | None, size: int) -> tuple[int, int] | None:
    """Return ``(start, end)`` inclusive, or ``None`` for a full-body read.

    Raises :class:`ValueError` for syntactically valid but unsatisfiable
    ranges so the caller can return ``416``.
    """
    if not header:
        return None
    m = _RANGE_RE.match(header.strip())
    if not m:
        return None  # malformed — fall back to full body (lenient)
    raw_start, raw_end = m.group("start"), m.group("end")

    if raw_start == "" and raw_end == "":
        return None
    if size == 0:
        # Any range against an empty file is unsatisfiable.
        raise ValueError("range not satisfiable for empty file")

    if raw_start == "":
        # Suffix range: last N bytes.
        suffix = int(raw_end)
        if suffix == 0:
            raise ValueError("zero-length suffix range")
        start = max(0, size - suffix)
        end = size - 1
    else:
        start = int(raw_start)
        end = int(raw_end) if raw_end != "" else size - 1
        end = min(end, size - 1)

    if start > end or start >= size:
        raise ValueError(f"unsatisfiable range {start}-{end} for size {size}")
    return start, end


# ---------------------------------------------------------------------------
# DB lookup
# ---------------------------------------------------------------------------


async def _load_job(job_id: UUID) -> JobRow:
    async with session_scope() as session:
        row = (
            await session.execute(select(JobRow).where(JobRow.id == job_id))
        ).scalar_one_or_none()
    if row is None:
        raise JobNotFoundError(f"Job {job_id} not found")
    return row


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------


@router.get(
    "",
    summary="Download the finalized artifact for a job",
    response_class=StreamingResponse,
    responses={
        200: {"description": "Full file body."},
        206: {"description": "Partial content for a satisfied Range request."},
        401: {"description": "Missing or invalid credentials."},
        404: {"description": "Job or stored file not found."},
        409: {"description": "Job is not in the ``ready`` state."},
        416: {"description": "Range not satisfiable."},
    },
)
async def download_file(
    request: Request,
    id: UUID,
    range_header: str | None = Header(default=None, alias="Range"),
    token: str | None = Query(default=None, description="HMAC token (signed URL auth)."),
    exp: int | None = Query(default=None, description="Token expiry, unix seconds."),
) -> StreamingResponse:
    """Stream the artifact for ``id`` as a full or partial body."""
    _authorize(request, id, token, exp)

    row = await _load_job(id)
    if row.status != "ready":
        raise JobNotReadyError(f"Job {id} status is {row.status!r}, not 'ready'")

    meta = await _store.get_meta(id)
    if meta is None:
        # Row says ready but bytes are gone (TTL janitor, manual rm, etc.).
        raise JobNotFoundError(f"No stored file for job {id}")

    size = meta.size_bytes

    try:
        rng = _parse_range(range_header, size)
    except ValueError:
        # 416 + Content-Range: bytes */<size> per RFC 7233 §4.4.
        return StreamingResponse(
            iter(()),
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={
                "Content-Range": f"bytes */{size}",
                "Accept-Ranges": "bytes",
            },
            media_type=meta.mime_type,
        )

    common_headers: dict[str, str] = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'attachment; filename="{meta.filename}"',
        "X-Content-SHA256": meta.sha256,
    }

    if rng is None:
        # Full body.
        gen, _ = await _store.open_range(id, None, None)
        common_headers["Content-Length"] = str(size)
        return StreamingResponse(
            gen,
            status_code=status.HTTP_200_OK,
            media_type=meta.mime_type,
            headers=common_headers,
        )

    # Partial body.
    start, end = rng
    gen, _ = await _store.open_range(id, start, end)
    length = end - start + 1
    common_headers["Content-Length"] = str(length)
    common_headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    return StreamingResponse(
        gen,
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type=meta.mime_type,
        headers=common_headers,
    )


async def serve_job_file(request: Request, job: object) -> StreamingResponse:
    """Thin wrapper reused by ``routers.jobs`` to stream a ready job's file.

    ``routers.jobs`` has already validated job existence and ``ready`` state,
    so this helper focuses on Range parsing + streaming. Auth is delegated
    to the API-level Bearer middleware (the signed-URL flow goes through
    :func:`download_file` directly).
    """
    job_id_raw = getattr(job, "id", None)
    if job_id_raw is None:
        raise JobNotFoundError("Job missing id")
    job_id = job_id_raw if isinstance(job_id_raw, UUID) else UUID(str(job_id_raw))

    range_header = request.headers.get("range") or request.headers.get("Range")

    meta = await _store.get_meta(job_id)
    if meta is None:
        raise JobNotFoundError(f"No stored file for job {job_id}")

    size = meta.size_bytes
    try:
        rng = _parse_range(range_header, size)
    except ValueError:
        return StreamingResponse(
            iter(()),
            status_code=status.HTTP_416_REQUESTED_RANGE_NOT_SATISFIABLE,
            headers={"Content-Range": f"bytes */{size}", "Accept-Ranges": "bytes"},
            media_type=meta.mime_type,
        )

    common_headers: dict[str, str] = {
        "Accept-Ranges": "bytes",
        "Content-Disposition": f'attachment; filename="{meta.filename}"',
        "X-Content-SHA256": meta.sha256,
    }

    if rng is None:
        gen, _ = await _store.open_range(job_id, None, None)
        common_headers["Content-Length"] = str(size)
        return StreamingResponse(
            gen,
            status_code=status.HTTP_200_OK,
            media_type=meta.mime_type,
            headers=common_headers,
        )

    start, end = rng
    gen, _ = await _store.open_range(job_id, start, end)
    common_headers["Content-Length"] = str(end - start + 1)
    common_headers["Content-Range"] = f"bytes {start}-{end}/{size}"
    return StreamingResponse(
        gen,
        status_code=status.HTTP_206_PARTIAL_CONTENT,
        media_type=meta.mime_type,
        headers=common_headers,
    )
