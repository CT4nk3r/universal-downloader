"""POST /probe — inspect a URL via the yt-dlp adapter (J1.3)."""

from __future__ import annotations

from fastapi import APIRouter, status

from ..errors import UnsupportedSiteError, UpstreamError
from ..logging_config import get_logger
from ..models import ProbeRequest, ProbeResult
from ..utils import detect_site

router = APIRouter(tags=["probe"])
log = get_logger(__name__)


@router.post(
    "/probe",
    response_model=ProbeResult,
    status_code=status.HTTP_200_OK,
    summary="Inspect a URL for available formats and metadata",
)
async def probe_url(payload: ProbeRequest) -> ProbeResult:
    site = detect_site(str(payload.url))
    if site is None:
        raise UnsupportedSiteError(
            "URL is not from a supported site",
            details={"url": str(payload.url)},
        )

    # Lazy import: J1.3 owns this module. Until it lands the API still boots.
    try:
        from ..services.ytdlp_adapter import YtdlpAdapterImpl
    except ImportError as exc:
        log.warning("ytdlp_adapter_unavailable", error=str(exc))
        raise UpstreamError(
            "yt-dlp adapter not available",
            details={"reason": "service_not_implemented"},
        ) from exc

    adapter = YtdlpAdapterImpl()
    try:
        return await adapter.probe(str(payload.url))
    except UnsupportedSiteError:
        raise
    except Exception as exc:
        log.exception("probe_failed", url=str(payload.url))
        raise UpstreamError("Upstream probe failed", details={"error": str(exc)}) from exc
