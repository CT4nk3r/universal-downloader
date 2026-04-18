"""Bearer-token authentication. Single shared key from `UD_API_KEY`."""

from __future__ import annotations

import hmac

from fastapi import Depends, Request

from .errors import UnauthorizedError
from .settings import Settings, get_settings

# Paths that bypass auth (mounted at app root, not under /v1).
PUBLIC_PATHS: frozenset[str] = frozenset(
    {
        "/v1/health",
        "/health",
        "/openapi.json",
        "/docs",
        "/redoc",
        "/docs/oauth2-redirect",
    }
)


def _extract_bearer(request: Request) -> str | None:
    auth = request.headers.get("authorization") or request.headers.get("Authorization")
    if not auth:
        return None
    parts = auth.split(None, 1)
    if len(parts) != 2 or parts[0].lower() != "bearer":
        return None
    return parts[1].strip()


def require_api_key(
    request: Request,
    settings: Settings = Depends(get_settings),
) -> None:
    """FastAPI dependency: enforce bearer auth using constant-time compare."""
    if request.url.path in PUBLIC_PATHS:
        return
    token = _extract_bearer(request)
    if token is None:
        raise UnauthorizedError("Missing bearer token")
    expected = settings.API_KEY
    if not hmac.compare_digest(token.encode("utf-8"), expected.encode("utf-8")):
        raise UnauthorizedError("Invalid bearer token")
