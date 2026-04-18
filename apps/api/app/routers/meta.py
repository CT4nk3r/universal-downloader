"""Meta endpoints: liveness and supported-site catalog."""

from __future__ import annotations

import shutil
import subprocess
import time

from fastapi import APIRouter, Request

from .. import __version__
from ..logging_config import get_logger
from ..models import Health, Site, SiteCapabilities, SiteId

router = APIRouter(tags=["meta"])
log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Static site catalog. Capabilities mirror what J1.3 (ytdlp_adapter) intends
# to support; the canonical source remains `openapi.yaml` + `detect_site()`.
# ---------------------------------------------------------------------------
_SITES: tuple[Site, ...] = (
    Site(
        id=SiteId.youtube,
        name="YouTube",
        domains=["youtube.com", "youtu.be", "youtube-nocookie.com"],
        capabilities=SiteCapabilities(
            video=True, audio=True, subtitles=True, live=True, playlists=True
        ),
    ),
    Site(
        id=SiteId.x,
        name="X (Twitter)",
        domains=["x.com", "twitter.com", "t.co"],
        capabilities=SiteCapabilities(
            video=True, audio=True, subtitles=False, live=False, playlists=False
        ),
    ),
    Site(
        id=SiteId.facebook,
        name="Facebook",
        domains=["facebook.com", "fb.watch", "fb.com"],
        capabilities=SiteCapabilities(
            video=True, audio=True, subtitles=False, live=True, playlists=False
        ),
    ),
    Site(
        id=SiteId.reddit,
        name="Reddit",
        domains=["reddit.com", "redd.it"],
        capabilities=SiteCapabilities(
            video=True, audio=True, subtitles=False, live=False, playlists=False
        ),
    ),
)


def _probe_ytdlp_version() -> str | None:
    try:
        import yt_dlp  # type: ignore[import-untyped]

        return str(getattr(yt_dlp.version, "__version__", "unknown"))
    except Exception as exc:  # pragma: no cover - optional at boot time
        log.warning("ytdlp_probe_failed", error=str(exc))
        return None


def _probe_ffmpeg_version() -> str | None:
    binary = shutil.which("ffmpeg")
    if binary is None:
        return None
    try:
        out = subprocess.run(
            [binary, "-version"],
            check=False,
            capture_output=True,
            text=True,
            timeout=3,
        )
        first = (out.stdout or out.stderr).splitlines()[0] if out.stdout or out.stderr else ""
        # "ffmpeg version 6.1.1 Copyright ..." → "6.1.1"
        parts = first.split()
        return parts[2] if len(parts) >= 3 else first or None
    except (OSError, subprocess.SubprocessError) as exc:  # pragma: no cover
        log.warning("ffmpeg_probe_failed", error=str(exc))
        return None


@router.get("/health", response_model=Health, summary="Liveness probe")
async def get_health(request: Request) -> Health:
    """Return server liveness + cached tool versions.

    `yt_dlp` and `ffmpeg` versions are probed lazily on the first call and
    cached on `app.state` for the lifetime of the process.
    """
    state = request.app.state
    if state.ytdlp_version is None:
        state.ytdlp_version = _probe_ytdlp_version()
    if state.ffmpeg_version is None:
        state.ffmpeg_version = _probe_ffmpeg_version()

    started_at = getattr(state, "started_at", None)
    uptime = int(time.monotonic() - started_at) if started_at is not None else None

    return Health(
        status="ok",
        version=__version__,
        ytdlp_version=state.ytdlp_version,
        ffmpeg_version=state.ffmpeg_version,
        uptime_seconds=uptime,
    )


@router.get("/sites", response_model=list[Site], summary="List supported sites")
async def list_sites() -> list[Site]:
    return list(_SITES)
