"""Helpers for loading shared test fixtures from Python tests.

These helpers are intentionally dependency-free so they can be imported
from any Python test runner (pytest, unittest, plain scripts).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any, Dict

FIXTURES_DIR = Path(__file__).resolve().parent

_SAMPLE_MP4 = FIXTURES_DIR / "sample.mp4"
_SAMPLE_METADATA = FIXTURES_DIR / "sample_metadata.json"


class FixtureMissingError(FileNotFoundError):
    """Raised when a required fixture file is not present on disk."""


def load_sample_metadata() -> Dict[str, Any]:
    """Return the synthetic yt-dlp ``info_dict`` used by offline tests."""
    if not _SAMPLE_METADATA.is_file():
        raise FixtureMissingError(
            f"sample_metadata.json missing at {_SAMPLE_METADATA}. "
            "The fixtures directory appears to be corrupt."
        )
    with _SAMPLE_METADATA.open("r", encoding="utf-8") as fh:
        return json.load(fh)


def sample_mp4_path() -> Path:
    """Return the path to ``sample.mp4``.

    The MP4 itself is **not** committed to the repository (see
    ``tests/fixtures/README.md``). If a maintainer has not provided one,
    raise a clear, actionable error instead of letting tests fail with a
    cryptic ``ffprobe`` / ``yt-dlp`` traceback.
    """
    if not _SAMPLE_MP4.is_file() or _SAMPLE_MP4.stat().st_size == 0:
        raise FixtureMissingError(
            f"Required fixture missing: {_SAMPLE_MP4}\n"
            "Place a small public-domain MP4 at this path before running "
            "integration tests. See tests/fixtures/README.md for a curl "
            "command that fetches Big Buck Bunny from archive.org."
        )
    return _SAMPLE_MP4


def fixture_path(name: str) -> Path:
    """Return an absolute path to an arbitrary fixture file by name."""
    path = FIXTURES_DIR / name
    if not path.exists():
        raise FixtureMissingError(f"Fixture not found: {path}")
    return path


__all__ = [
    "FIXTURES_DIR",
    "FixtureMissingError",
    "load_sample_metadata",
    "sample_mp4_path",
    "fixture_path",
]
