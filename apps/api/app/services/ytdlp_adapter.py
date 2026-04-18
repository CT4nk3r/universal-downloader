"""yt-dlp + ffmpeg adapter (J1.3).

Implements the ``YtdlpAdapter`` protocol consumed by ``job_engine`` (J1.2):

    class YtdlpAdapter(Protocol):
        async def probe(self, url: str) -> ProbeResult: ...
        async def download(
            self,
            job: Job,
            progress_cb: Callable[[JobProgress], Awaitable[None]],
        ) -> Path: ...

Design notes
------------
* All blocking yt-dlp work runs in ``asyncio.to_thread`` so the FastAPI event
  loop is never starved.
* The adapter never imports ``app.services.job_engine`` — it depends only on
  Wave 1 contracts (models, errors, settings, site_detection) and on the pure
  helpers in ``format_helpers``/``ffmpeg_helpers``.
* yt-dlp's ``progress_hooks`` are invoked from the worker thread; we use
  ``asyncio.run_coroutine_threadsafe`` to deliver :class:`JobProgress` events
  back onto the caller's loop without blocking it.
* Time-range trimming uses yt-dlp's native ``download_ranges`` (avoids
  fetching bytes outside the requested span). The ffmpeg-based ``trim``
  helper is kept only as a fallback (see ``ffmpeg_helpers.trim``).

Preset → yt-dlp format selector mapping
---------------------------------------
::

    QualityPreset   | yt-dlp format selector
    ----------------+--------------------------------------------------------
    best            | bestvideo*+bestaudio/best
    p2160           | bv*[height<=2160]+ba/b[height<=2160]
    p1440           | bv*[height<=1440]+ba/b[height<=1440]
    p1080           | bv*[height<=1080]+ba/b[height<=1080]
    p720            | bv*[height<=720]+ba/b[height<=720]
    p480            | bv*[height<=480]+ba/b[height<=480]
    audio_mp3       | bestaudio/best                    + FFmpegExtractAudio mp3
    audio_m4a       | bestaudio[ext=m4a]/bestaudio/best + FFmpegExtractAudio m4a

When ``container`` is set to ``mp4|webm|mkv`` for a height-capped preset, the
selector is further refined to prefer that extension (see
``format_helpers.resolve_format_selector``).
"""

from __future__ import annotations

import asyncio
import contextlib
from collections.abc import Awaitable, Callable
from pathlib import Path
from typing import TYPE_CHECKING, Any

from app.errors import UnsupportedSiteError, UpstreamError
from app.models import (
    Container,
    CreateJobRequest,
    Job,
    JobProgress,
    ProbeResult,
    QualityPreset,
    SiteId,
    SubtitleOptions,
    TimeRange,
)
from app.settings import get_settings
from app.utils.site_detection import detect_site

from .format_helpers import normalize_yt_info, resolve_format_selector

if TYPE_CHECKING:  # pragma: no cover
    from yt_dlp import YoutubeDL  # noqa: F401


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

_SUPPORTED_SITES: frozenset[str] = frozenset({"youtube", "x", "facebook", "reddit"})

_DEFAULT_OUTTMPL = "%(title).200B [%(id)s].%(ext)s"

_AUDIO_PRESETS: frozenset[str] = frozenset({"audio_mp3", "audio_m4a"})

ProgressCallback = Callable[[JobProgress], Awaitable[None]]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _site_or_raise(url: str) -> SiteId:
    """Detect supported site or raise :class:`UnsupportedSiteError`."""
    site_str = detect_site(url)
    if site_str is None or site_str not in _SUPPORTED_SITES:
        raise UnsupportedSiteError(
            f"Unsupported site for URL: {url}",
            details={"url": url},
        )
    return SiteId(site_str)


def _preset_str(preset: QualityPreset | str | None) -> str:
    if preset is None:
        return "best"
    return preset.value if hasattr(preset, "value") else str(preset)


def _container_str(container: Container | str | None) -> str | None:
    if container is None:
        return None
    return container.value if hasattr(container, "value") else str(container)


def _is_audio_only(req: CreateJobRequest) -> bool:
    if req.audio_only:
        return True
    return _preset_str(req.preset) in _AUDIO_PRESETS


def _merge_container(req: CreateJobRequest) -> str:
    """Pick the merge/container output for non-audio downloads."""
    if _is_audio_only(req):
        # Audio-only paths are governed by the FFmpegExtractAudio postprocessor.
        return "mp4"
    cont = _container_str(req.container)
    if cont in {"mp4", "webm", "mkv"}:
        return cont
    return "mp4"


def _audio_codec(req: CreateJobRequest) -> str | None:
    """Return the preferred audio codec for FFmpegExtractAudio, or None."""
    preset = _preset_str(req.preset)
    if preset == "audio_mp3":
        return "mp3"
    if preset == "audio_m4a":
        return "m4a"
    if req.audio_only:
        cont = _container_str(req.container)
        if cont in {"mp3", "m4a", "opus"}:
            return cont
        return "mp3"
    return None


def _build_postprocessors(req: CreateJobRequest) -> list[dict[str, Any]]:
    pps: list[dict[str, Any]] = []

    audio_codec = _audio_codec(req)
    if audio_codec:
        pps.append(
            {
                "key": "FFmpegExtractAudio",
                "preferredcodec": audio_codec,
                "preferredquality": "192",
            }
        )

    if req.embed_metadata:
        pps.append({"key": "FFmpegMetadata", "add_metadata": True})

    subs: SubtitleOptions | None = req.subtitles
    if subs and subs.enabled and subs.embed and not audio_codec:
        pps.append({"key": "FFmpegEmbedSubtitle", "already_have_subtitle": False})

    if req.embed_thumbnail:
        pps.append({"key": "EmbedThumbnail", "already_have_thumbnail": False})

    return pps


def _build_download_ranges(time_range: TimeRange | None) -> Any | None:
    """Return a yt-dlp ``download_ranges`` callable for the requested span."""
    if time_range is None:
        return None
    start = time_range.start_seconds
    end = time_range.end_seconds
    if start is None and end is None:
        return None
    try:
        from yt_dlp.utils import download_range_func
    except ImportError:  # pragma: no cover - yt-dlp must be installed
        return None
    span_start = float(start) if start is not None else 0.0
    span_end = float(end) if end is not None else 0.0
    # download_range_func(chapters, ranges) — ranges is list[(start, end)].
    return download_range_func(None, [(span_start, span_end)])


def _build_outtmpl(job: Job, req: CreateJobRequest) -> str:
    settings = get_settings()
    job_dir = Path(settings.DATA_DIR) / "jobs" / job.id
    job_dir.mkdir(parents=True, exist_ok=True)
    template = req.filename_template or _DEFAULT_OUTTMPL
    return str(job_dir / template)


def _build_ydl_opts(
    job: Job,
    req: CreateJobRequest,
    progress_hook: Callable[[dict[str, Any]], None],
) -> dict[str, Any]:
    audio_only = _is_audio_only(req)

    fmt = resolve_format_selector(
        preset=req.preset,
        format_id=req.format_id,
        container=req.container,
        audio_only=audio_only,
    )

    opts: dict[str, Any] = {
        "quiet": True,
        "no_warnings": True,
        "noprogress": True,
        "format": fmt,
        "outtmpl": _build_outtmpl(job, req),
        "merge_output_format": _merge_container(req),
        "restrictfilenames": False,
        "windowsfilenames": True,
        "noplaylist": True,
        "ignoreerrors": False,
        "retries": 3,
        "fragment_retries": 3,
        "concurrent_fragment_downloads": 4,
        "progress_hooks": [progress_hook],
        "writethumbnail": bool(req.embed_thumbnail),
    }

    subs: SubtitleOptions | None = req.subtitles
    if subs and subs.enabled and not audio_only:
        opts["writesubtitles"] = True
        opts["writeautomaticsub"] = False
        opts["subtitleslangs"] = list(subs.languages) or ["en"]
        if subs.embed:
            opts["embedsubtitles"] = True

    ranges = _build_download_ranges(req.time_range)
    if ranges is not None:
        opts["download_ranges"] = ranges
        # Force keyframes near cut points so the trimmed output is playable.
        opts["force_keyframes_at_cuts"] = True

    pps = _build_postprocessors(req)
    if pps:
        opts["postprocessors"] = pps

    return opts


def _resolve_output_path(info: dict[str, Any], fallback_dir: Path) -> Path:
    """Find the final on-disk path produced by yt-dlp."""
    requested = info.get("requested_downloads")
    if isinstance(requested, list) and requested:
        last = requested[-1]
        if isinstance(last, dict):
            for key in ("filepath", "_filename"):
                value = last.get(key)
                if value:
                    return Path(value)
    for key in ("filepath", "_filename"):
        value = info.get(key)
        if value:
            return Path(value)
    # Fallback: pick newest file in the job directory.
    candidates = [p for p in fallback_dir.glob("*") if p.is_file()]
    if candidates:
        candidates.sort(key=lambda p: p.stat().st_mtime, reverse=True)
        return candidates[0]
    raise UpstreamError(
        "yt-dlp finished but no output file could be located.",
        details={"job_dir": str(fallback_dir)},
    )


def _hook_to_progress(hook: dict[str, Any]) -> JobProgress | None:
    """Translate a yt-dlp progress_hooks dict into our :class:`JobProgress`."""
    status = hook.get("status")
    if status not in {"downloading", "finished"}:
        return None

    downloaded = hook.get("downloaded_bytes")
    total = hook.get("total_bytes") or hook.get("total_bytes_estimate")
    speed = hook.get("speed")
    eta = hook.get("eta")
    frag_idx = hook.get("fragment_index")
    frag_count = hook.get("fragment_count")

    percent: float | None = None
    if isinstance(downloaded, int | float) and isinstance(total, int | float) and total > 0:
        percent = max(0.0, min(100.0, (float(downloaded) / float(total)) * 100.0))
    elif status == "finished":
        percent = 100.0

    return JobProgress(
        percent=percent,
        downloaded_bytes=int(downloaded) if isinstance(downloaded, int | float) else None,
        total_bytes=int(total) if isinstance(total, int | float) else None,
        speed_bps=float(speed) if isinstance(speed, int | float) else None,
        eta_seconds=int(eta) if isinstance(eta, int | float) else None,
        fragment_index=int(frag_idx) if isinstance(frag_idx, int | float) else None,
        fragment_count=int(frag_count) if isinstance(frag_count, int | float) else None,
    )


# ---------------------------------------------------------------------------
# Adapter implementation
# ---------------------------------------------------------------------------


class YtdlpAdapterImpl:
    """Concrete :class:`YtdlpAdapter` implementation.

    Stateless aside from the import-time yt-dlp module reference; safe to share
    across job workers.
    """

    def __init__(self) -> None:
        # Import lazily so that unit tests of pure helpers don't require yt-dlp.
        try:
            import yt_dlp
        except ImportError as exc:  # pragma: no cover - dependency is required at runtime
            raise RuntimeError(
                "yt-dlp is not installed; install it via `pip install yt-dlp`."
            ) from exc
        self._yt_dlp = yt_dlp

    # -- probe -------------------------------------------------------------

    async def probe(self, url: str) -> ProbeResult:
        site = _site_or_raise(url)

        def _do_probe() -> dict[str, Any]:
            ydl_opts: dict[str, Any] = {
                "quiet": True,
                "no_warnings": True,
                "skip_download": True,
                "noplaylist": True,
                "extract_flat": False,
            }
            with self._yt_dlp.YoutubeDL(ydl_opts) as ydl:
                raw = ydl.extract_info(url, download=False)
                if raw is None:
                    raise UpstreamError(
                        "yt-dlp returned no info for the URL.",
                        details={"url": url},
                    )
                # Ensure we have a serialisable plain dict.
                return ydl.sanitize_info(raw) if hasattr(ydl, "sanitize_info") else dict(raw)

        try:
            info = await asyncio.to_thread(_do_probe)
        except UpstreamError:
            raise
        except UnsupportedSiteError:
            raise
        except self._yt_dlp.utils.DownloadError as exc:
            raise UpstreamError(
                str(exc),
                details={"code": "extractor_failed", "url": url},
            ) from exc
        except self._yt_dlp.utils.ExtractorError as exc:
            raise UpstreamError(
                str(exc),
                details={"code": "extractor_failed", "url": url},
            ) from exc
        except Exception as exc:
            raise UpstreamError(
                f"Probe failed: {exc}",
                details={"code": "extractor_failed", "url": url},
            ) from exc

        return normalize_yt_info(info, site)

    # -- download ----------------------------------------------------------

    async def download(self, job: Job, progress_cb: ProgressCallback) -> Path:
        if job.request is None:
            raise UpstreamError(
                "Job is missing the original CreateJobRequest payload.",
                details={"job_id": job.id},
            )
        req: CreateJobRequest = job.request
        _site_or_raise(req.url)

        loop = asyncio.get_running_loop()
        settings = get_settings()
        job_dir = Path(settings.DATA_DIR) / "jobs" / job.id

        def _progress_hook(hook: dict[str, Any]) -> None:
            # Called from the yt-dlp worker thread.
            progress = _hook_to_progress(hook)
            if progress is None:
                return
            try:
                coro = progress_cb(progress)
                fut: asyncio.Future[None] = asyncio.run_coroutine_threadsafe(coro, loop)  # type: ignore[arg-type]
                # Don't block the download thread waiting for the SSE bus.
                fut.result(timeout=0.001)
            except TimeoutError:
                # Delivery is best-effort — drop late acks.
                pass
            except Exception:
                # Never let a progress-callback failure abort the download.
                pass

        ydl_opts = _build_ydl_opts(job, req, _progress_hook)

        def _do_download() -> dict[str, Any]:
            with self._yt_dlp.YoutubeDL(ydl_opts) as ydl:
                raw = ydl.extract_info(req.url, download=True)
                if raw is None:
                    raise UpstreamError(
                        "yt-dlp returned no info for the URL.",
                        details={"url": req.url},
                    )
                return ydl.sanitize_info(raw) if hasattr(ydl, "sanitize_info") else dict(raw)

        try:
            info = await asyncio.to_thread(_do_download)
        except UpstreamError:
            raise
        except UnsupportedSiteError:
            raise
        except self._yt_dlp.utils.DownloadError as exc:
            raise UpstreamError(
                str(exc),
                details={"code": "extractor_failed", "url": req.url, "job_id": job.id},
            ) from exc
        except self._yt_dlp.utils.ExtractorError as exc:
            raise UpstreamError(
                str(exc),
                details={"code": "extractor_failed", "url": req.url, "job_id": job.id},
            ) from exc
        except Exception as exc:
            raise UpstreamError(
                f"Download failed: {exc}",
                details={"code": "extractor_failed", "url": req.url, "job_id": job.id},
            ) from exc

        output = _resolve_output_path(info, job_dir)
        # Emit a final 100% progress event so consumers always see completion.
        with contextlib.suppress(Exception):
            await progress_cb(JobProgress(percent=100.0))
        return output


__all__ = ["ProgressCallback", "YtdlpAdapterImpl"]
