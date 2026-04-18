"""URL → SiteId detection. Port of `detectSite()` from
`packages/shared-types/src/index.ts` — keep in lockstep with the TS version.
"""

from __future__ import annotations

import re
from typing import Literal
from urllib.parse import urlparse

SiteId = Literal["youtube", "x", "facebook", "reddit"]

_SITE_PATTERNS: tuple[tuple[SiteId, re.Pattern[str]], ...] = (
    ("youtube", re.compile(r"(?:^|\.)(youtube\.com|youtu\.be|youtube-nocookie\.com)$", re.IGNORECASE)),
    ("x", re.compile(r"(?:^|\.)(twitter\.com|x\.com|t\.co)$", re.IGNORECASE)),
    ("facebook", re.compile(r"(?:^|\.)(facebook\.com|fb\.watch|fb\.com)$", re.IGNORECASE)),
    ("reddit", re.compile(r"(?:^|\.)(reddit\.com|redd\.it)$", re.IGNORECASE)),
)


def detect_site(url: str) -> SiteId | None:
    """Return the SiteId for a URL, or None if the host isn't recognised."""
    try:
        host = urlparse(url).hostname
    except (ValueError, TypeError):
        return None
    if not host:
        return None
    for site_id, pattern in _SITE_PATTERNS:
        if pattern.search(host):
            return site_id
    return None
