"""High-level orchestration for download jobs.

The :class:`JobEngine` owns the lifecycle of a ``Job`` row in the database
and bridges to the arq worker queue + SSE pub/sub bus. HTTP routers should
depend on the singleton :data:`engine` exposed at the bottom of this module.

Cross-job protocols
-------------------
``YtdlpAdapter`` (J1.3) and ``FileStore`` (J1.4) are described as PEP 544
:class:`~typing.Protocol` types here so this module stays decoupled from
their concrete implementations. Sibling jobs MUST satisfy these signatures::

    class YtdlpAdapter(Protocol):
        async def probe(self, url: str) -> ProbeResult: ...
        async def download(
            self,
            job: Job,
            progress_cb: Callable[[JobProgress], Awaitable[None]],
        ) -> Path: ...

    class FileStore(Protocol):
        async def finalize(self, job_id: UUID, src: Path) -> FileMeta: ...
        async def delete(self, job_id: UUID) -> None: ...
        async def open_range(
            self,
            job_id: UUID,
            start: int | None,
            end: int | None,
        ) -> tuple[AsyncIterator[bytes], FileMeta]: ...
"""

from __future__ import annotations

import base64
import contextlib
import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from datetime import UTC, datetime, timedelta
from pathlib import Path
from typing import Any, Protocol, runtime_checkable
from uuid import UUID, uuid4

from sqlalchemy import select

from app.errors import JobNotFoundError
from app.models import (
    CreateJobRequest,
    Job,
    JobEventDone,
    JobEventError,
    JobEventProgress,
    JobEventStatus,
    JobFile,
    JobList,
    JobProgress,
    JobStatus,
)
from app.settings import get_settings

from .db import JobRow, get_session_factory, row_to_dict
from .file_models import FileMeta
from .sse_bus import bus as _default_bus
from .sse_bus import channel_for
from .state_machine import (
    CANCELLED,
    PROBING,
    QUEUED,
    READY,
    assert_transition,
    is_terminal,
)

log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Protocols implemented by sibling jobs
# ---------------------------------------------------------------------------


@runtime_checkable
class YtdlpAdapter(Protocol):
    """Contract for the yt-dlp wrapper owned by J1.3."""

    async def probe(self, url: str) -> Any:  # ProbeResult — typed in app.models
        ...

    async def download(
        self,
        job: Job,
        progress_cb: Callable[[JobProgress], Awaitable[None]],
    ) -> Path: ...


@runtime_checkable
class FileStore(Protocol):
    """Contract for the artifact storage layer owned by J1.4."""

    async def finalize(self, job_id: UUID, src: Path) -> FileMeta: ...

    async def delete(self, job_id: UUID) -> None: ...

    async def open_range(
        self,
        job_id: UUID,
        start: int | None,
        end: int | None,
    ) -> tuple[AsyncIterator[bytes], FileMeta]: ...


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _utcnow() -> datetime:
    return datetime.now(UTC)


def _coerce_uuid(job_id: Any) -> UUID:
    """Coerce ``job_id`` to UUID or raise :class:`JobNotFoundError`.

    Callers frequently receive path parameters as ``str``; passing a
    non-UUID string into SQLAlchemy's ``Uuid`` column type triggers
    ``AttributeError: 'str' object has no attribute 'hex'``. Surface those
    as a 404 instead of a 500.
    """
    if isinstance(job_id, UUID):
        return job_id
    try:
        return UUID(str(job_id))
    except (ValueError, AttributeError, TypeError) as exc:
        raise JobNotFoundError(f"job {job_id!r} not found") from exc


def _encode_cursor(created_at: datetime, job_id: UUID) -> str:
    raw = json.dumps({"t": created_at.isoformat(), "id": str(job_id)}).encode()
    return base64.urlsafe_b64encode(raw).decode().rstrip("=")


def _decode_cursor(cursor: str) -> tuple[datetime, UUID] | None:
    try:
        padded = cursor + "=" * (-len(cursor) % 4)
        data = json.loads(base64.urlsafe_b64decode(padded.encode()).decode())
        return datetime.fromisoformat(data["t"]), UUID(data["id"])
    except Exception:
        return None


def _row_to_job(row: JobRow) -> Job:
    return Job.model_validate(row_to_dict(row))


def _event_to_dict(event: Any) -> dict[str, Any]:
    if hasattr(event, "model_dump"):
        dumped: dict[str, Any] = event.model_dump(mode="json")
        return dumped
    if isinstance(event, dict):
        return event
    raise TypeError(f"Unsupported event type: {type(event)!r}")


def _dict_to_event(payload: dict[str, Any]) -> Any:
    """Best-effort parse of a raw bus payload into a typed JobEvent variant."""
    kind = payload.get("type")
    try:
        if kind == "progress":
            return JobEventProgress.model_validate(payload)
        if kind == "status":
            return JobEventStatus.model_validate(payload)
        if kind == "done":
            return JobEventDone.model_validate(payload)
        if kind == "error":
            return JobEventError.model_validate(payload)
    except Exception as exc:
        log.warning("job_engine: failed to parse event %r (%s)", payload, exc)
    return payload


# ---------------------------------------------------------------------------
# JobEngine
# ---------------------------------------------------------------------------


_QUEUE_NAME = "ud:queue"
_TASK_NAME = "run_download"


class JobEngine:
    """Persistence + queue + pub/sub orchestration for download jobs."""

    def __init__(self, sse_bus: Any | None = None) -> None:
        self._bus = sse_bus or _default_bus
        self._pool: Any | None = None  # arq.connections.ArqRedis

    # -- arq pool (lazy) ------------------------------------------------
    async def _ensure_pool(self) -> Any | None:
        if self._pool is not None:
            return self._pool
        try:
            from arq import create_pool
            from arq.connections import RedisSettings
        except Exception as exc:  # pragma: no cover
            log.warning("job_engine: arq unavailable (%s)", exc)
            return None
        try:
            settings = RedisSettings.from_dsn(get_settings().REDIS_URL)
            self._pool = await create_pool(settings)
        except Exception as exc:
            log.warning("job_engine: failed to connect to arq redis (%s)", exc)
            self._pool = None
        return self._pool

    async def close(self) -> None:
        if self._pool is not None:
            with contextlib.suppress(Exception):  # pragma: no cover
                await self._pool.close()
            self._pool = None

    # -- create ---------------------------------------------------------
    async def create_job(self, req: CreateJobRequest) -> Job:
        """Persist a new job in ``queued`` and enqueue it on the worker queue."""
        settings = get_settings()
        job_id = uuid4()
        now = _utcnow()
        expires = now + timedelta(hours=settings.JOB_TTL_HOURS)

        row = JobRow(
            id=job_id,
            url=str(req.url),
            site=None,
            status=QUEUED,
            progress={},
            request=req.model_dump(mode="json"),
            created_at=now,
            expires_at=expires,
        )

        factory = get_session_factory()
        async with factory() as session:
            session.add(row)
            await session.commit()
            await session.refresh(row)

        pool = await self._ensure_pool()
        if pool is not None:
            try:
                await pool.enqueue_job(
                    _TASK_NAME,
                    str(job_id),
                    _job_id=str(job_id),
                    _queue_name=_QUEUE_NAME,
                )
            except Exception as exc:
                log.warning("job_engine: enqueue failed for %s (%s)", job_id, exc)

        job = _row_to_job(row)
        await self.publish_event(JobEventStatus(job_id=str(job_id), status=JobStatus(QUEUED)))
        return job

    # -- get ------------------------------------------------------------
    async def get_job(self, job_id: UUID | str) -> Job:
        uid = _coerce_uuid(job_id)
        factory = get_session_factory()
        async with factory() as session:
            row = await session.get(JobRow, uid)
            if row is None:
                raise JobNotFoundError(f"job {uid} not found")
            return _row_to_job(row)

    # -- list -----------------------------------------------------------
    async def list_jobs(
        self,
        status: JobStatus | str | None,
        limit: int,
        cursor: str | None,
    ) -> JobList:
        limit = max(1, min(int(limit), 200))
        factory = get_session_factory()

        stmt = select(JobRow).order_by(JobRow.created_at.desc(), JobRow.id.desc())  # type: ignore[attr-defined]
        if status is not None:
            value = getattr(status, "value", status)
            stmt = stmt.where(JobRow.status == value)  # type: ignore[arg-type]

        if cursor:
            decoded = _decode_cursor(cursor)
            if decoded is not None:
                cur_t, cur_id = decoded
                stmt = stmt.where(
                    (JobRow.created_at < cur_t)  # type: ignore[arg-type]
                    | ((JobRow.created_at == cur_t) & (JobRow.id < cur_id))
                )

        stmt = stmt.limit(limit + 1)

        async with factory() as session:
            result = await session.execute(stmt)
            rows = list(result.scalars().all())

        next_cursor: str | None = None
        if len(rows) > limit:
            tail = rows[limit - 1]
            rows = rows[:limit]
            next_cursor = _encode_cursor(tail.created_at, tail.id)

        return JobList(items=[_row_to_job(r) for r in rows], next_cursor=next_cursor)

    # -- cancel ---------------------------------------------------------
    async def cancel_job(self, job_id: UUID | str) -> None:
        """Mark job cancelled (terminal) and best-effort abort the arq task."""
        uid = _coerce_uuid(job_id)
        factory = get_session_factory()
        async with factory() as session:
            row = await session.get(JobRow, uid)
            if row is None:
                raise JobNotFoundError(f"job {uid} not found")
            if is_terminal(row.status):
                return
            assert_transition(row.status, CANCELLED)
            row.status = CANCELLED
            row.finished_at = _utcnow()
            session.add(row)
            await session.commit()

        # Best-effort abort of in-flight worker task.
        pool = await self._ensure_pool()
        if pool is not None:
            try:
                await pool.abort_job(str(uid))
            except Exception as exc:
                log.debug("job_engine: abort_job %s failed (%s)", uid, exc)

        await self.publish_event(JobEventStatus(job_id=str(uid), status=JobStatus(CANCELLED)))

    # -- delete ---------------------------------------------------------
    async def delete_job(self, job_id: UUID | str) -> bool:
        """Cancel (if active) and report whether the job existed.

        Returns ``True`` if a job with this id was found (regardless of
        whether it was already terminal), ``False`` otherwise. Invalid
        UUIDs return ``False`` so the HTTP layer surfaces a 404.
        """
        try:
            await self.cancel_job(job_id)
        except JobNotFoundError:
            return False
        return True

    # -- pub/sub --------------------------------------------------------
    async def publish_event(self, event: Any) -> None:
        """Publish a typed ``JobEvent`` (or dict) to subscribers of its job."""
        payload = _event_to_dict(event)
        job_id = payload.get("job_id")
        if not job_id:
            raise ValueError("event missing 'job_id'")
        await self._bus.publish(channel_for(str(job_id)), payload)

    async def subscribe(self, job_id: UUID) -> AsyncIterator[Any]:
        """Yield successive ``JobEvent``s for ``job_id`` until the consumer exits."""
        async for raw in self._bus.subscribe(channel_for(str(job_id))):
            evt = _dict_to_event(raw if isinstance(raw, dict) else {})
            yield evt
            # Auto-terminate the stream once we've seen a terminal event.
            kind = raw.get("type") if isinstance(raw, dict) else None
            if kind in {"done", "error"}:
                break
            if kind == "status" and raw.get("status") in {READY, "failed", CANCELLED, "expired"}:
                break

    # -- status updates (used by worker) -------------------------------
    async def update_status(
        self,
        job_id: UUID,
        new_status: str,
        *,
        error: dict[str, Any] | None = None,
        file: JobFile | dict[str, Any] | None = None,
    ) -> Job:
        """Persist a status change and publish a status event.

        Used by :mod:`app.services.worker`. Caller is responsible for valid
        transitions; this method enforces them via the state machine.
        """
        factory = get_session_factory()
        async with factory() as session:
            row = await session.get(JobRow, job_id)
            if row is None:
                raise JobNotFoundError(f"job {job_id} not found")
            assert_transition(row.status, new_status)
            row.status = new_status
            now = _utcnow()
            if new_status == PROBING and row.started_at is None:
                row.started_at = now
            if is_terminal(new_status):
                row.finished_at = now
            if error is not None:
                row.error = error
            if file is not None:
                row.file = file.model_dump(mode="json") if hasattr(file, "model_dump") else file
            session.add(row)
            await session.commit()
            await session.refresh(row)
            job = _row_to_job(row)

        await self.publish_event(JobEventStatus(job_id=str(job_id), status=JobStatus(new_status)))
        return job

    async def update_progress(self, job_id: UUID, progress: JobProgress) -> None:
        """Persist a progress snapshot and publish a progress event."""
        factory = get_session_factory()
        payload = progress.model_dump(mode="json")
        async with factory() as session:
            row = await session.get(JobRow, job_id)
            if row is None:
                return
            row.progress = payload
            session.add(row)
            await session.commit()
        await self.publish_event(JobEventProgress(job_id=str(job_id), progress=progress))


# Module-level singleton — routers use this directly.
engine = JobEngine()
