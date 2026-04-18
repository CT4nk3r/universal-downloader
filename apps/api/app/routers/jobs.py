"""Job lifecycle endpoints.

All persistence + queueing is delegated to ``services.job_engine.JobEngine``
(owned by J1.2). The /jobs/{id}/file endpoint is delegated to
``services.file_router`` (owned by J1.4) so Range/HEAD/streaming logic lives
next to the on-disk store.

These services are imported lazily so the API skeleton can boot in a fresh
checkout where they don't yet exist.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query, Request, Response, status
from sse_starlette.sse import EventSourceResponse

from ..errors import JobNotFoundError, JobNotReadyError, UnsupportedSiteError
from ..logging_config import get_logger
from ..models import CreateJobRequest, Error, Job, JobList, JobStatus
from ..utils import detect_site

router = APIRouter(tags=["jobs"], prefix="/jobs")
log = get_logger(__name__)

# Shared error responses so FastAPI documents them in the generated
# OpenAPI spec (consumed by the schemathesis contract job).
_ERR_400: dict[int | str, dict[str, Any]] = {400: {"model": Error, "description": "Bad request"}}
_ERR_404: dict[int | str, dict[str, Any]] = {404: {"model": Error, "description": "Not found"}}
_ERR_409: dict[int | str, dict[str, Any]] = {409: {"model": Error, "description": "Conflict"}}
_ERR_422: dict[int | str, dict[str, Any]] = {
    422: {"model": Error, "description": "Unprocessable entity"}
}


# ---------------------------------------------------------------------------
# Lazy service accessor. Raises a clear error if J1.2 hasn't delivered yet so
# the failure surfaces as 404-style messaging instead of ImportError at
# import time.
# ---------------------------------------------------------------------------


async def get_job_engine(request: Request) -> Any:
    """Return the singleton JobEngine, instantiating on first use."""
    engine = getattr(request.app.state, "job_engine", None)
    if engine is not None:
        return engine
    try:
        from ..services.job_engine import JobEngine
    except ImportError as exc:  # pragma: no cover - depends on J1.2
        raise JobNotFoundError(
            "Job engine not available (J1.2 not yet wired)",
            details={"reason": "service_not_implemented"},
        ) from exc

    engine = JobEngine()
    request.app.state.job_engine = engine
    return engine


JobEngineDep = Annotated[Any, Depends(get_job_engine)]


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post(
    "",
    response_model=Job,
    status_code=status.HTTP_202_ACCEPTED,
    summary="Create a new download job",
    responses={**_ERR_400, **_ERR_422},
)
async def create_job(payload: CreateJobRequest, engine: JobEngineDep) -> Job:
    site = detect_site(str(payload.url))
    if site is None:
        raise UnsupportedSiteError(
            "URL is not from a supported site",
            details={"url": str(payload.url)},
        )
    job: Job = await engine.create_job(payload)
    return job


@router.get(
    "",
    response_model=JobList,
    summary="List download jobs",
    responses={**_ERR_400},
)
async def list_jobs(
    engine: JobEngineDep,
    status_filter: JobStatus | None = Query(default=None, alias="status"),
    limit: int = Query(default=20, ge=1, le=100),
    cursor: str | None = Query(default=None),
) -> JobList:
    result: JobList = await engine.list_jobs(status=status_filter, limit=limit, cursor=cursor)
    return result


@router.get(
    "/{job_id}",
    response_model=Job,
    summary="Get job by id",
    responses={**_ERR_404},
)
async def get_job(job_id: str, engine: JobEngineDep) -> Job:
    job: Job | None = await engine.get_job(job_id)
    if job is None:
        raise JobNotFoundError("Job not found", details={"id": job_id})
    return job


@router.delete(
    "/{job_id}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="Cancel a running job or delete an artifact",
    responses={**_ERR_404},
)
async def delete_job(job_id: str, engine: JobEngineDep) -> Response:
    deleted: bool = await engine.delete_job(job_id)
    if not deleted:
        raise JobNotFoundError("Job not found", details={"id": job_id})
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get(
    "/{job_id}/events",
    summary="Server-Sent Events stream of job progress",
    responses={**_ERR_404},
)
async def stream_job_events(job_id: str, engine: JobEngineDep) -> EventSourceResponse:
    job: Job | None = await engine.get_job(job_id)
    if job is None:
        raise JobNotFoundError("Job not found", details={"id": job_id})

    async def _iterator() -> AsyncIterator[dict[str, Any]]:
        async for event in engine.subscribe(job_id):
            yield {"event": event["type"], "data": event["data"]}

    return EventSourceResponse(_iterator())


@router.get(
    "/{job_id}/file",
    summary="Download the completed file (Range supported)",
    responses={**_ERR_404, **_ERR_409},
)
async def download_job_file(job_id: str, request: Request, engine: JobEngineDep) -> Response:
    job: Job | None = await engine.get_job(job_id)
    if job is None:
        raise JobNotFoundError("Job not found", details={"id": job_id})
    if getattr(job, "status", None) != JobStatus.ready or getattr(job, "file", None) is None:
        raise JobNotReadyError(
            "Job is not ready for download",
            details={"id": job_id, "status": str(getattr(job, "status", None))},
        )

    # Lazy import: J1.4 owns the Range-aware file router.
    try:
        from ..services.file_router import serve_job_file
    except ImportError as exc:  # pragma: no cover - depends on J1.4
        raise JobNotReadyError(
            "File router not available (J1.4 not yet wired)",
            details={"reason": "service_not_implemented"},
        ) from exc

    response: Response = await serve_job_file(request, job)
    return response
