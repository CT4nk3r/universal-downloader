"""Cron task: expire ready jobs past their TTL and delete their files.

Scheduled by :class:`app.services.worker.WorkerSettings` to run every
30 minutes. Safe to invoke manually for testing.
"""

from __future__ import annotations

import logging
from datetime import datetime, timezone
from typing import Any

from sqlalchemy import select

from app.models import JobStatus  # type: ignore[attr-defined]

from .db import JobRow, get_session_factory
from .state_machine import EXPIRED, READY, validate_transition

log = logging.getLogger(__name__)


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


async def cleanup_expired(ctx: dict[str, Any] | None = None) -> int:
    """Mark ready jobs past ``expires_at`` as ``expired`` and delete their files.

    Returns the number of jobs expired (useful for tests / metrics).
    """
    factory = get_session_factory()
    now = _utcnow()
    expired_count = 0

    # Lazy import — avoid pulling the file_store module unless something is due.
    file_store = None

    async with factory() as session:
        stmt = (
            select(JobRow)
            .where(JobRow.status == READY)
            .where(JobRow.expires_at.is_not(None))
            .where(JobRow.expires_at <= now)
        )
        result = await session.execute(stmt)
        rows = list(result.scalars().all())

        if not rows:
            return 0

        if file_store is None:
            try:
                from . import file_store as fs_mod  # type: ignore[import-not-found]

                file_store = getattr(fs_mod, "store", None) or fs_mod.LocalFileStore()
            except Exception as exc:  # noqa: BLE001 - cleanup must keep going
                log.warning("cleanup: file_store unavailable (%s)", exc)
                file_store = None

        for row in rows:
            if not validate_transition(row.status, EXPIRED):
                continue
            row.status = EXPIRED
            row.finished_at = row.finished_at or now
            session.add(row)

            if file_store is not None:
                try:
                    await file_store.delete(row.id)
                except Exception as exc:  # noqa: BLE001
                    log.warning("cleanup: delete failed for %s (%s)", row.id, exc)

            expired_count += 1

        await session.commit()

    if expired_count:
        # Publish status events on a best-effort basis so live SSE clients learn
        # about the expiration too.
        try:
            from .job_engine import engine
            from app.models import JobEventStatus  # type: ignore[attr-defined]

            for row in rows:
                if row.status != EXPIRED:
                    continue
                await engine.publish_event(
                    JobEventStatus(job_id=str(row.id), status=JobStatus(EXPIRED))
                )
        except Exception:  # pragma: no cover
            log.exception("cleanup: failed to publish expiration events")

    log.info("cleanup: expired %d job(s)", expired_count)
    return expired_count
