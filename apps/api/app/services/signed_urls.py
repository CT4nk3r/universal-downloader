"""Short-lived HMAC-signed download URLs.

The signing key is derived from ``settings.API_KEY`` via HKDF-SHA256 with
a fixed application-specific info string, so rotating the API key also
invalidates outstanding signed URLs.

Format
------
``?token=<hex hmac>&exp=<unix epoch seconds>``

The signed payload is ``f"{job_id}:{exp}"`` so a token issued for one job
cannot be replayed against another, and expiry is bound into the MAC.
"""

from __future__ import annotations

import hashlib
import hmac
import time
from uuid import UUID

from app.settings import get_settings

# HKDF parameters --------------------------------------------------------------
_HKDF_SALT: bytes = b"ud-signed-urls/v1"
_HKDF_INFO: bytes = b"file-download"
_KEY_LEN: int = 32


def _hkdf_sha256(ikm: bytes, length: int, salt: bytes, info: bytes) -> bytes:
    """Minimal RFC 5869 HKDF-SHA256, stdlib-only."""
    # Extract
    prk = hmac.new(salt, ikm, hashlib.sha256).digest()
    # Expand
    out = b""
    block = b""
    counter = 1
    while len(out) < length:
        block = hmac.new(prk, block + info + bytes([counter]), hashlib.sha256).digest()
        out += block
        counter += 1
    return out[:length]


def _signing_key() -> bytes:
    """Derive the per-process signing key from the configured API key."""
    api_key = get_settings().API_KEY.encode("utf-8")
    return _hkdf_sha256(api_key, _KEY_LEN, _HKDF_SALT, _HKDF_INFO)


def _mac(job_id: UUID, exp: int) -> str:
    payload = f"{job_id}:{exp}".encode()
    return hmac.new(_signing_key(), payload, hashlib.sha256).hexdigest()


def sign(job_id: UUID, ttl_seconds: int = 3600) -> str:
    """Return a query-string fragment ``?token=...&exp=...`` for ``job_id``."""
    if ttl_seconds <= 0:
        raise ValueError("ttl_seconds must be positive")
    exp = int(time.time()) + int(ttl_seconds)
    token = _mac(job_id, exp)
    return f"?token={token}&exp={exp}"


def verify(job_id: UUID, token: str, exp: int) -> bool:
    """Constant-time verify a ``(token, exp)`` pair for ``job_id``."""
    if not token or exp <= 0:
        return False
    if int(time.time()) >= exp:
        return False
    expected = _mac(job_id, exp)
    return hmac.compare_digest(expected, token)
