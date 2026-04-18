"""FastAPI application factory for Universal Downloader by CT4nk3r.

Wires:
- structlog (pretty in dev, JSON in prod)
- CORS
- Bearer-token auth dependency on every /v1 router
- Exception handlers translating to the OpenAPI Error envelope
- A lifespan that initialises a Redis connection pool placeholder so the
  job engine (J1.2) can pick it up from `app.state.redis` later.
"""

from __future__ import annotations

import time
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from typing import Any

from fastapi import Depends, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import __version__
from .errors import install_exception_handlers
from .logging_config import configure_logging, get_logger
from .routers import jobs as jobs_router
from .routers import meta as meta_router
from .routers import probe as probe_router
from .security import require_api_key
from .settings import Settings, get_settings


@asynccontextmanager
async def _lifespan(app: FastAPI) -> AsyncIterator[None]:
    """App lifespan. Initialise lazy resources used by Wave-1 services."""
    settings = get_settings()
    log = get_logger("app.lifespan")

    app.state.started_at = time.monotonic()
    app.state.version = __version__

    # Redis pool placeholder. The actual pool is created lazily by the job
    # engine (J1.2) so this skeleton can boot without a running Redis.
    app.state.redis = None
    app.state.redis_url = settings.REDIS_URL

    # Cached probes performed once (filled by /health endpoint on first call).
    app.state.ytdlp_version = None
    app.state.ffmpeg_version = None

    log.info(
        "api_startup",
        version=__version__,
        env=settings.ENV,
        port=settings.PORT,
        data_dir=str(settings.DATA_DIR),
    )

    # Ensure the jobs table exists. ``init_db`` is idempotent; skipped in
    # tests that use a fake engine via ``app.state.job_engine``.
    try:
        from .services.db import init_db

        await init_db()
    except Exception as exc:  # pragma: no cover - defensive
        log.warning("db_init_failed", error=str(exc))

    try:
        yield
    finally:
        redis = app.state.redis
        if redis is not None:
            try:
                close = getattr(redis, "aclose", None) or getattr(redis, "close", None)
                if close is not None:
                    result = close()
                    if hasattr(result, "__await__"):
                        await result
            except Exception as exc:  # pragma: no cover - defensive
                log.warning("redis_close_failed", error=str(exc))
        log.info("api_shutdown")


def create_app(settings: Settings | None = None) -> FastAPI:
    """Application factory. Idempotent and test-friendly."""
    settings = settings or get_settings()
    configure_logging(settings.LOG_LEVEL, dev=settings.is_dev)

    app = FastAPI(
        title="Universal Downloader API",
        version=__version__,
        description="yt-dlp + ffmpeg wrapper API for Universal Downloader by CT4nk3r.",
        docs_url="/docs",
        redoc_url="/redoc",
        openapi_url="/openapi.json",
        lifespan=_lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.CORS_ORIGINS,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    install_exception_handlers(app)

    # All authenticated routers live under /v1. The auth dep itself is a no-op
    # for paths in `security.PUBLIC_PATHS` (eg. /v1/health).
    auth: list[Any] = [Depends(require_api_key)]
    app.include_router(meta_router.router, prefix="/v1", dependencies=auth)
    app.include_router(probe_router.router, prefix="/v1", dependencies=auth)
    app.include_router(jobs_router.router, prefix="/v1", dependencies=auth)

    return app


app = create_app()
