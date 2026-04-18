"""Thin async wrappers around the ``ffmpeg`` binary.

yt-dlp drives the vast majority of post-processing (transcode, extract audio,
embed thumbnails/metadata, time-range trimming via ``download_ranges``), so
these helpers exist mostly for:

* version probing (exposed via ``/health``),
* one-off explicit transcodes initiated by the API layer,
* fallback trimming when ``download_ranges`` cannot be used.
"""

from __future__ import annotations

import asyncio
import shutil
from dataclasses import dataclass
from pathlib import Path


class FfmpegError(RuntimeError):
    """Raised when an ffmpeg subprocess exits non-zero."""

    def __init__(self, returncode: int, stderr: str) -> None:
        super().__init__(f"ffmpeg failed ({returncode}): {stderr.strip()}")
        self.returncode = returncode
        self.stderr = stderr


@dataclass(frozen=True)
class FfmpegResult:
    returncode: int
    stdout: str
    stderr: str


def _ffmpeg_binary() -> str:
    return shutil.which("ffmpeg") or "ffmpeg"


async def _run(*args: str) -> FfmpegResult:
    proc = await asyncio.create_subprocess_exec(
        *args,
        stdout=asyncio.subprocess.PIPE,
        stderr=asyncio.subprocess.PIPE,
    )
    stdout_b, stderr_b = await proc.communicate()
    stdout = stdout_b.decode("utf-8", errors="replace")
    stderr = stderr_b.decode("utf-8", errors="replace")
    rc = proc.returncode if proc.returncode is not None else -1
    if rc != 0:
        raise FfmpegError(rc, stderr)
    return FfmpegResult(returncode=rc, stdout=stdout, stderr=stderr)


async def ffmpeg_version() -> str:
    """Return the first line of ``ffmpeg -version`` (e.g. ``ffmpeg version 6.1``)."""
    try:
        result = await _run(_ffmpeg_binary(), "-version")
    except FileNotFoundError:
        return ""
    except FfmpegError:
        return ""
    first_line = result.stdout.splitlines()[0] if result.stdout else ""
    return first_line.strip()


async def transcode(
    input_path: Path,
    output_path: Path,
    *,
    vcodec: str | None = None,
    acodec: str | None = None,
    extra_args: list[str] | None = None,
    overwrite: bool = True,
) -> Path:
    """Generic transcode. Rarely used; yt-dlp postprocessors handle most cases."""
    args: list[str] = [_ffmpeg_binary(), "-hide_banner", "-loglevel", "error"]
    if overwrite:
        args.append("-y")
    args += ["-i", str(input_path)]
    if vcodec:
        args += ["-c:v", vcodec]
    if acodec:
        args += ["-c:a", acodec]
    if extra_args:
        args += list(extra_args)
    args.append(str(output_path))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    await _run(*args)
    return output_path


async def trim(
    input_path: Path,
    output_path: Path,
    *,
    start_seconds: float | None,
    end_seconds: float | None,
    copy_streams: bool = True,
    overwrite: bool = True,
) -> Path:
    """Trim ``input_path`` between ``start_seconds`` and ``end_seconds``.

    Prefer this only as a fallback — yt-dlp's ``download_ranges`` is more
    efficient because it avoids downloading bytes outside the requested span.
    """
    args: list[str] = [_ffmpeg_binary(), "-hide_banner", "-loglevel", "error"]
    if overwrite:
        args.append("-y")
    if start_seconds is not None:
        args += ["-ss", f"{start_seconds:.3f}"]
    args += ["-i", str(input_path)]
    if end_seconds is not None:
        args += ["-to", f"{end_seconds:.3f}"]
    if copy_streams:
        args += ["-c", "copy"]
    args.append(str(output_path))

    output_path.parent.mkdir(parents=True, exist_ok=True)
    await _run(*args)
    return output_path
