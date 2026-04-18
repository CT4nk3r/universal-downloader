"""Error envelope and exception → HTTP translation."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI, Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from .logging_config import get_logger

log = get_logger(__name__)


# ---------------------------------------------------------------------------
# Custom exceptions
# ---------------------------------------------------------------------------


class APIError(Exception):
    """Base for application errors. Translated to the OpenAPI `Error` envelope."""

    code: str = "internal_error"
    http_status: int = status.HTTP_500_INTERNAL_SERVER_ERROR

    def __init__(self, message: str, *, details: dict[str, Any] | None = None) -> None:
        super().__init__(message)
        self.message = message
        self.details = details or {}


class UnsupportedSiteError(APIError):
    code = "unsupported_site"
    http_status = status.HTTP_422_UNPROCESSABLE_ENTITY


class UpstreamError(APIError):
    code = "upstream_error"
    http_status = status.HTTP_502_BAD_GATEWAY


class JobNotFoundError(APIError):
    code = "job_not_found"
    http_status = status.HTTP_404_NOT_FOUND


class JobNotReadyError(APIError):
    code = "job_not_ready"
    http_status = status.HTTP_409_CONFLICT


class UnauthorizedError(APIError):
    code = "unauthorized"
    http_status = status.HTTP_401_UNAUTHORIZED


# ---------------------------------------------------------------------------
# Envelope helpers
# ---------------------------------------------------------------------------


def error_envelope(code: str, message: str, details: dict[str, Any] | None = None) -> dict[str, Any]:
    """Build the `{ "error": { code, message, details } }` envelope."""
    payload: dict[str, Any] = {"code": code, "message": message}
    if details:
        payload["details"] = details
    return {"error": payload}


def _json_error(status_code: int, code: str, message: str, details: dict[str, Any] | None = None) -> JSONResponse:
    return JSONResponse(status_code=status_code, content=error_envelope(code, message, details))


# ---------------------------------------------------------------------------
# Handlers
# ---------------------------------------------------------------------------


def install_exception_handlers(app: FastAPI) -> None:
    """Register handlers for APIError subclasses, HTTPException and validation errors."""

    @app.exception_handler(APIError)
    async def _api_error_handler(_: Request, exc: APIError) -> JSONResponse:
        log.warning("api_error", code=exc.code, message=exc.message, details=exc.details)
        return _json_error(exc.http_status, exc.code, exc.message, exc.details)

    @app.exception_handler(StarletteHTTPException)
    async def _http_exc_handler(_: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = _http_status_to_code(exc.status_code)
        message = exc.detail if isinstance(exc.detail, str) else "HTTP error"
        return _json_error(exc.status_code, code, message)

    @app.exception_handler(RequestValidationError)
    async def _validation_exc_handler(_: Request, exc: RequestValidationError) -> JSONResponse:
        return _json_error(
            status.HTTP_400_BAD_REQUEST,
            "bad_request",
            "Request validation failed",
            {"errors": exc.errors()},
        )

    @app.exception_handler(Exception)
    async def _unhandled_handler(_: Request, exc: Exception) -> JSONResponse:
        log.exception("unhandled_exception", error=str(exc))
        return _json_error(
            status.HTTP_500_INTERNAL_SERVER_ERROR,
            "internal_error",
            "An unexpected error occurred",
        )


def _http_status_to_code(status_code: int) -> str:
    return {
        400: "bad_request",
        401: "unauthorized",
        403: "forbidden",
        404: "not_found",
        409: "conflict",
        422: "unprocessable_entity",
        429: "rate_limited",
        500: "internal_error",
        502: "upstream_error",
        503: "service_unavailable",
    }.get(status_code, "error")
