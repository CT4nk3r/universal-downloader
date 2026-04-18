"""Pure helper functions for translating between yt-dlp's raw format/info
dictionaries and the schemas defined in `packages/shared-types/openapi.yaml`.

These helpers are intentionally side-effect free so they can be unit tested
without invoking yt-dlp or hitting the network.
"""

from __future__ import annotations

from typing import Any

from app.models import Container, Format, ProbeResult, QualityPreset, SiteId, Thumbnail

# ---------------------------------------------------------------------------
# Preset -> yt-dlp format selector mapping
# ---------------------------------------------------------------------------
#
# Reference table (also reproduced in the job summary):
#
#   QualityPreset   | Format selector
#   ----------------+-------------------------------------------------------
#   best            | bestvideo*+bestaudio/best
#   p2160           | bv*[height<=2160]+ba/b[height<=2160]
#   p1440           | bv*[height<=1440]+ba/b[height<=1440]
#   p1080           | bv*[height<=1080]+ba/b[height<=1080]
#   p720            | bv*[height<=720]+ba/b[height<=720]
#   p480            | bv*[height<=480]+ba/b[height<=480]
#   audio_mp3       | bestaudio/best                       (+ FFmpegExtractAudio mp3)
#   audio_m4a       | bestaudio[ext=m4a]/bestaudio/best    (+ FFmpegExtractAudio m4a)
#
# `container` may further constrain the selector for video presets by
# preferring an extension (e.g. `[ext=mp4]`) inside each clause.

_VIDEO_HEIGHT_PRESETS: dict[str, int] = {
    "p2160": 2160,
    "p1440": 1440,
    "p1080": 1080,
    "p720": 720,
    "p480": 480,
}

_AUDIO_PRESETS: dict[str, str] = {
    "audio_mp3": "bestaudio/best",
    "audio_m4a": "bestaudio[ext=m4a]/bestaudio/best",
}


def _preset_value(preset: QualityPreset | str | None) -> str:
    if preset is None:
        return "best"
    return preset.value if hasattr(preset, "value") else str(preset)


def _container_value(container: Container | str | None) -> str | None:
    if container is None:
        return None
    return container.value if hasattr(container, "value") else str(container)


def resolve_format_selector(
    preset: QualityPreset | str | None,
    format_id: str | None,
    container: Container | str | None,
    audio_only: bool,
) -> str:
    """Resolve a yt-dlp ``format`` selector string.

    Precedence:
      1. Explicit ``format_id`` (used as-is).
      2. ``audio_only`` flag implies ``audio_mp3`` if no preset given.
      3. Named ``preset``.
      4. Default ``best``.
    """
    if format_id:
        return format_id

    preset_str = _preset_value(preset)
    if audio_only and preset_str not in _AUDIO_PRESETS:
        preset_str = "audio_mp3"

    if preset_str in _AUDIO_PRESETS:
        return _AUDIO_PRESETS[preset_str]

    if preset_str == "best":
        return "bestvideo*+bestaudio/best"

    height = _VIDEO_HEIGHT_PRESETS.get(preset_str)
    if height is None:
        # Unknown preset — fall back to a sane default.
        return "bestvideo*+bestaudio/best"

    cont = _container_value(container)
    if cont and cont in {"mp4", "webm", "mkv"}:
        return (
            f"bv*[height<={height}][ext={cont}]+ba[ext=m4a]/"
            f"bv*[height<={height}]+ba/"
            f"b[height<={height}]"
        )
    return f"bv*[height<={height}]+ba/b[height<={height}]"


# ---------------------------------------------------------------------------
# Normalisation: yt-dlp dict -> our pydantic models
# ---------------------------------------------------------------------------


def _coerce_int(value: Any) -> int | None:
    if value is None:
        return None
    try:
        return int(value)
    except (TypeError, ValueError):
        return None


def _coerce_float(value: Any) -> float | None:
    if value is None:
        return None
    try:
        return float(value)
    except (TypeError, ValueError):
        return None


def normalize_yt_format(raw: dict[str, Any]) -> Format:
    """Translate one entry of ``info["formats"]`` into our :class:`Format`."""
    vcodec = raw.get("vcodec")
    acodec = raw.get("acodec")
    has_video = bool(vcodec) and vcodec != "none"
    has_audio = bool(acodec) and acodec != "none"

    width = _coerce_int(raw.get("width"))
    height = _coerce_int(raw.get("height"))
    resolution = raw.get("resolution")
    if not resolution and width and height:
        resolution = f"{width}x{height}"

    return Format(
        format_id=str(raw.get("format_id", "")),
        ext=str(raw.get("ext", "")),
        resolution=resolution,
        height=height,
        width=width,
        fps=_coerce_float(raw.get("fps")),
        vcodec=vcodec if has_video else None,
        acodec=acodec if has_audio else None,
        abr=_coerce_float(raw.get("abr")),
        vbr=_coerce_float(raw.get("vbr")),
        filesize=_coerce_int(raw.get("filesize")),
        filesize_approx=_coerce_int(raw.get("filesize_approx")),
        has_audio=has_audio,
        has_video=has_video,
        note=raw.get("format_note"),
    )


def _normalize_thumbnail(raw: dict[str, Any]) -> Thumbnail | None:
    url = raw.get("url")
    if not url:
        return None
    return Thumbnail(
        url=url,
        width=_coerce_int(raw.get("width")),
        height=_coerce_int(raw.get("height")),
    )


def normalize_yt_info(raw: dict[str, Any], site: SiteId) -> ProbeResult:
    """Translate the full ``YoutubeDL.extract_info`` dict into a ``ProbeResult``."""
    raw_formats = raw.get("formats") or []
    formats = [normalize_yt_format(f) for f in raw_formats if isinstance(f, dict)]

    raw_thumbs = raw.get("thumbnails") or []
    thumbnails: list[Thumbnail] = []
    for t in raw_thumbs:
        if isinstance(t, dict):
            thumb = _normalize_thumbnail(t)
            if thumb is not None:
                thumbnails.append(thumb)
    if not thumbnails and raw.get("thumbnail"):
        thumbnails.append(Thumbnail(url=str(raw["thumbnail"]), width=None, height=None))

    return ProbeResult(
        site=site,
        id=str(raw.get("id", "")),
        title=str(raw.get("title", "")),
        description=raw.get("description"),
        uploader=raw.get("uploader"),
        channel=raw.get("channel"),
        duration_seconds=_coerce_float(raw.get("duration")),
        upload_date=raw.get("upload_date"),
        view_count=_coerce_int(raw.get("view_count")),
        like_count=_coerce_int(raw.get("like_count")),
        webpage_url=str(raw.get("webpage_url") or raw.get("original_url") or ""),
        thumbnails=thumbnails,
        formats=formats,
        is_live=bool(raw.get("is_live", False)),
        age_limit=_coerce_int(raw.get("age_limit")) or 0,
    )
