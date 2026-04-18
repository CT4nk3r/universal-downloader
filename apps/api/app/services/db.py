"""Async database engine + ORM table for jobs.

Uses SQLModel on top of SQLAlchemy's async engine. The default URL points
at a local SQLite file via ``aiosqlite`` so the worker and API can run
without external infra; production deployments override
``UD_DATABASE_URL``.
"""

from __future__ import annotations

import json
import os
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import (
    AsyncEngine,
    AsyncSession,
    async_sessionmaker,
    create_async_engine,
)
from sqlmodel import JSON, Column, Field, SQLModel, String

# ---------------------------------------------------------------------------
# Settings — defensive import. J1.1 owns ``app.settings`` but we may run in
# isolation (unit tests, alembic-style scripts). Fall back to env vars.
# ---------------------------------------------------------------------------

try:  # pragma: no cover - depends on sibling job
    from app.settings import get_settings

    _DB_URL: str = getattr(get_settings(), "DATABASE_URL", "")
except Exception:  # pragma: no cover
    _DB_URL = ""

if not _DB_URL:
    _DB_URL = os.environ.get("UD_DATABASE_URL", "sqlite+aiosqlite:///./universal-downloader.db")


def _utcnow() -> datetime:
    return datetime.now(UTC)


# ---------------------------------------------------------------------------
# JobRow — table mirroring the OpenAPI ``Job`` schema
# ---------------------------------------------------------------------------


class JobRow(SQLModel, table=True):
    """Persistent representation of a download job.

    JSON-typed columns hold structured sub-objects (``progress``,
    ``request``, ``file``, ``error``) verbatim so we don't have to
    maintain a parallel relational schema for every nested change.
    """

    __tablename__ = "jobs"

    id: UUID = Field(default_factory=uuid4, primary_key=True, index=True)
    url: str = Field(sa_column=Column(String, nullable=False))
    site: str | None = Field(default=None, index=True)
    status: str = Field(default="queued", index=True)
    progress: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    title: str | None = Field(default=None)
    thumbnail_url: str | None = Field(default=None)
    request: dict[str, Any] = Field(default_factory=dict, sa_column=Column(JSON))
    created_at: datetime = Field(default_factory=_utcnow, index=True)
    started_at: datetime | None = Field(default=None)
    finished_at: datetime | None = Field(default=None)
    expires_at: datetime | None = Field(default=None, index=True)
    file: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))
    error: dict[str, Any] | None = Field(default=None, sa_column=Column(JSON, nullable=True))


# ---------------------------------------------------------------------------
# Engine + session factory (lazily constructed singletons)
# ---------------------------------------------------------------------------

_engine: AsyncEngine | None = None
_session_factory: async_sessionmaker[AsyncSession] | None = None


def get_engine() -> AsyncEngine:
    """Return the lazily constructed module-level async engine."""
    global _engine
    if _engine is None:
        # ``future=True`` is the default in SQLAlchemy 2.x; SQLite needs no
        # special connect args under aiosqlite for our usage.
        _engine = create_async_engine(_DB_URL, echo=False, pool_pre_ping=True)
    return _engine


def get_session_factory() -> async_sessionmaker[AsyncSession]:
    """Return the lazily constructed async session factory."""
    global _session_factory
    if _session_factory is None:
        _session_factory = async_sessionmaker(
            bind=get_engine(),
            class_=AsyncSession,
            expire_on_commit=False,
        )
    return _session_factory


@asynccontextmanager
async def session_scope() -> AsyncIterator[AsyncSession]:
    """Async context manager yielding a session with commit/rollback."""
    factory = get_session_factory()
    session = factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def init_db() -> None:
    """Create all tables. Idempotent — safe to call on every startup."""
    engine = get_engine()
    async with engine.begin() as conn:
        await conn.run_sync(SQLModel.metadata.create_all)


async def dispose_db() -> None:
    """Dispose the engine. Used in tests or graceful shutdown."""
    global _engine, _session_factory
    if _engine is not None:
        await _engine.dispose()
    _engine = None
    _session_factory = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def row_to_dict(row: JobRow) -> dict[str, Any]:
    """Serialize a :class:`JobRow` into a plain dict matching the ``Job``
    schema (datetimes -> ISO-8601 strings, UUID -> str).
    """

    def _iso(dt: datetime | None) -> str | None:
        return dt.isoformat() if dt is not None else None

    return {
        "id": str(row.id),
        "url": row.url,
        "site": row.site,
        "status": row.status,
        "progress": row.progress or {},
        "title": row.title,
        "thumbnail_url": row.thumbnail_url,
        "request": row.request or {},
        "created_at": _iso(row.created_at),
        "started_at": _iso(row.started_at),
        "finished_at": _iso(row.finished_at),
        "expires_at": _iso(row.expires_at),
        "file": row.file,
        "error": row.error,
    }


def dumps(value: Any) -> str:
    """JSON-serialize with ``default=str`` to handle UUID/datetime safely."""
    return json.dumps(value, default=str, separators=(",", ":"))
