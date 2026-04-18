"""arq worker definition.

Run with::

    arq app.services.worker.WorkerSettings

Tasks
-----
* :func:`run_download` — full job lifecycle (probe → download → finalize).
* :func:`cleanup_expired` — cron-driven sweep, delegated to
  :mod:`app.services.cleanup`.
"""

from __future__ import annotations

import logging
from typing import Any
from uuid import UUID

from app.models import (  # type: ignore[attr-defined]
    JobEventDone,
    JobEventError,
    JobErrorInfo,
    JobFile,
    JobProgress,
)
from app.settings import get_settings

from .cleanup import cleanup_expired
from .db import get_session_factory, init_db, JobRow
from .job_engine import engine
from .state_machine import (
    DOWNLOADING,
    FAILED,
    POSTPROCESSING,
    PROBING,
    READY,
    is_terminal,
)

log = logging.getLogger(__name__)

_QUEUE_NAME = "ud:queue"


# ---------------------------------------------------------------------------
# Adapter / store loaders (sibling jobs)
# ---------------------------------------------------------------------------


def _load_ytdlp_adapter() -> Any:
    """Import the J1.3 yt-dlp adapter lazily so the worker boots in isolation."""
    from . import ytdlp_adapter as mod  # type: ignore[import-not-found]

    # Prefer a module-level singleton named ``adapter``; fall back to a
    # class named ``YtdlpAdapter``.
    if hasattr(mod, "adapter"):
        return mod.adapter
    if hasattr(mod, "YtdlpAdapter"):
        return mod.YtdlpAdapter()  # type: ignore[call-arg]
    raise RuntimeError("ytdlp_adapter module exposes neither `adapter` nor `YtdlpAdapter`")


def _load_file_store() -> Any:
    """Import the J1.4 file store lazily."""
    from . import file_store as mod  # type: ignore[import-not-found]

    if hasattr(mod, "store"):
        return mod.store
    if hasattr(mod, "LocalFileStore"):
        return mod.LocalFileStore()
    raise RuntimeError("file_store module exposes neither `store` nor `LocalFileStore`")


# ---------------------------------------------------------------------------
# Task: run_download
# ---------------------------------------------------------------------------


async def run_download(ctx: dict[str, Any], job_id: str) -> None:  # noqa: C901
    """End-to-end pipeline for a single download job."""
    jid = UUID(job_id)

    # Load job row
    factory = get_session_factory()
    async with factory() as session:
        row = await session.get(JobRow, jid)
        if row is None:
            log.warning("worker: job %s vanished before processing", jid)
            return
        if is_terminal(row.status):
            log.info("worker: job %s already terminal (%s); skipping", jid, row.status)
            return

    # Probe
    try:
        await engine.update_status(jid, PROBING)
        adapter = _load_ytdlp_adapter()
        probe = await adapter.probe(row.url)
    except Exception as exc:  # noqa: BLE001
        await _fail(jid, "probe_failed", str(exc))
        return

    # Persist site / title / thumbnail from the probe result if present.
    try:
        async with factory() as session:
            row = await session.get(JobRow, jid)
            if row is not None:
                site = getattr(probe, "site", None)
                row.site = getattr(site, "value", site) if site else row.site
                row.title = getattr(probe, "title", None) or row.title
                thumbs = getattr(probe, "thumbnails", None) or []
                if thumbs:
                    first = thumbs[0]
                    row.thumbnail_url = getattr(first, "url", None) or row.thumbnail_url
                session.add(row)
                await session.commit()
                await session.refresh(row)
                fresh_job = await engine.get_job(jid)
            else:
                fresh_job = await engine.get_job(jid)
    except Exception:  # pragma: no cover
        fresh_job = await engine.get_job(jid)

    # Download
    try:
        await engine.update_status(jid, DOWNLOADING)

        async def progress_cb(p: JobProgress) -> None:
            await engine.update_progress(jid, p)

        src_path = await adapter.download(fresh_job, progress_cb)
    except Exception as exc:  # noqa: BLE001
        await _fail(jid, "download_failed", str(exc))
        return

    # Postprocess + finalize
    try:
        await engine.update_status(jid, POSTPROCESSING)
        store = _load_file_store()
        meta = await store.finalize(jid, src_path)

        download_url = f"/v1/jobs/{jid}/file"
        job_file = JobFile(
            filename=meta.filename,
            size_bytes=int(meta.size_bytes),
            mime_type=getattr(meta, "mime_type", None),
            sha256=getattr(meta, "sha256", None),
            download_url=download_url,
        )

        await engine.update_status(jid, READY, file=job_file)
        await engine.publish_event(JobEventDone(job_id=str(jid), file=job_file))
    except Exception as exc:  # noqa: BLE001
        await _fail(jid, "finalize_failed", str(exc))
        return


async def _fail(job_id: UUID, code: str, message: str) -> None:
    """Mark a job as ``failed`` and publish a ``JobEventError``."""
    err = JobErrorInfo(code=code, message=message)
    try:
        await engine.update_status(job_id, FAILED, error=err.model_dump(mode="json"))
    except Exception as exc:  # noqa: BLE001
        log.exception("worker: failed to mark job %s failed (%s)", job_id, exc)
    try:
        await engine.publish_event(JobEventError(job_id=str(job_id), error=err))
    except Exception:  # pragma: no cover
        log.exception("worker: failed to publish error for %s", job_id)


# ---------------------------------------------------------------------------
# arq lifecycle hooks
# ---------------------------------------------------------------------------


async def startup(ctx: dict[str, Any]) -> None:
    """Ensure DB tables exist before the worker dequeues anything."""
    await init_db()
    log.info("worker: startup complete")


async def shutdown(ctx: dict[str, Any]) -> None:
    await engine.close()
    log.info("worker: shutdown complete")


# ---------------------------------------------------------------------------
# WorkerSettings
# ---------------------------------------------------------------------------


def _redis_settings() -> Any:
    from arq.connections import RedisSettings  # type: ignore[import-not-found]

    return RedisSettings.from_dsn(get_settings().REDIS_URL)


def _cron_jobs() -> list[Any]:
    """Optional cron — silently disabled if arq's cron helper is unavailable."""
    try:
        from arq import cron  # type: ignore[import-not-found]
    except Exception:  # pragma: no cover
        return []
    # Every 30 minutes, on the half-hour.
    return [cron(cleanup_expired, minute={0, 30}, run_at_startup=False)]


class WorkerSettings:
    """arq ``WorkerSettings`` for ``app.services.worker``."""

    functions = [run_download, cleanup_expired]
    on_startup = startup
    on_shutdown = shutdown
    queue_name = _QUEUE_NAME
    max_jobs = get_settings().MAX_CONCURRENCY
    redis_settings = _redis_settings()
    cron_jobs = _cron_jobs()
    job_timeout = 60 * 60 * 6  # 6 hours hard cap per download
    keep_result = 0  # we persist results in the DB ourselves
    allow_abort_jobs = True
