"""Shared fixtures for the API integration test suite (J2.1).

Goals:

* Boot the FastAPI app from ``apps/api/app/main.py`` without requiring
  Redis, real yt-dlp, ffmpeg, or a populated SQLite database.
* Pin ``UD_API_KEY`` *before* ``app.settings`` is imported so the
  ``Settings`` instance can be constructed.
* Replace the lazy ``JobEngine`` (J1.2) with an in-memory fake that
  satisfies the surface used by ``apps/api/app/routers/jobs.py``.
* Replace the lazy ``serve_job_file`` (J1.4) with a temp-file backed
  Range-aware streaming response so the ``/jobs/{id}/file`` endpoint can
  be exercised end-to-end.
* Provide a fake yt-dlp adapter so any test that wants to inspect probe
  results can monkey-patch deterministically — never invoke real binaries.

These fixtures are intentionally self-contained: they do not import the
production database or signed-URL code at module import time, only when
specific tests opt in.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
import uuid
from collections.abc import AsyncIterator, Iterator
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import pytest

# ---------------------------------------------------------------------------
# Path + environment setup. MUST run before any ``app.*`` import.
# ---------------------------------------------------------------------------

_REPO_ROOT = Path(__file__).resolve().parents[2]
_API_PKG = _REPO_ROOT / "apps" / "api"
if str(_API_PKG) not in sys.path:
    sys.path.insert(0, str(_API_PKG))

#: Deterministic test bearer token. Tests that exercise the auth boundary
#: import this constant directly.
TEST_API_KEY = "test-api-key-j21"

os.environ.setdefault("UD_API_KEY", TEST_API_KEY)
os.environ.setdefault("UD_ENV", "development")
# In-memory SQLite via aiosqlite. The DB is touched only by file_router in
# its real form; our fake serve_job_file bypasses it entirely. We still
# point the URL at :memory: so any accidental engine construction is cheap.
os.environ.setdefault("UD_DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("UD_REDIS_URL", "redis://localhost:6379/15")


# ---------------------------------------------------------------------------
# Fake JobEngine
# ---------------------------------------------------------------------------


class FakeJobEngine:
    """In-memory stand-in for ``apps.api.app.services.job_engine.JobEngine``.

    The real engine is async and persistence-backed; the router only needs
    six coroutine methods, all of which are reproduced here:
    ``create_job``, ``list_jobs``, ``get_job``, ``delete_job``,
    ``subscribe`` and a synchronous ``publish`` helper used by tests.

    Idempotency keys (``Idempotency-Key`` header) are honoured by
    ``create_job`` when supplied via the constructor's ``idempotency``
    pass-through so jobs created with the same key collapse to one record.
    """

    def __init__(self) -> None:
        self.jobs: dict[str, dict[str, Any]] = {}
        self._idempotency: dict[str, str] = {}
        # Pre-buffered events per-job (populated synchronously by tests
        # via :meth:`publish`/:meth:`close_stream`). ``subscribe`` moves
        # these into an asyncio.Queue bound to the running loop so we
        # never share an Event across loops.
        self._buffered: dict[str, list[dict[str, Any] | None]] = {}
        # Active queues keyed by job id; populated inside ``subscribe`` on
        # the loop that serves the SSE response.
        self._queues: dict[str, asyncio.Queue[dict[str, Any] | None]] = {}

    # ------------------------------------------------------------------ CRUD

    async def create_job(
        self,
        payload: Any,
        *,
        idempotency_key: str | None = None,
    ) -> Any:
        # The router passes ``CreateJobRequest`` directly. Tolerate both
        # the pydantic model and a raw dict so unit tests can call us
        # without constructing the model.
        if hasattr(payload, "model_dump"):
            req = payload.model_dump(mode="json")
        else:
            req = dict(payload)

        if idempotency_key and idempotency_key in self._idempotency:
            existing_id = self._idempotency[idempotency_key]
            return _materialise_job(self.jobs[existing_id])

        job_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        record: dict[str, Any] = {
            "id": job_id,
            "url": req.get("url"),
            "site": _detect_site(req.get("url")),
            "status": "queued",
            "progress": None,
            "title": None,
            "thumbnail_url": None,
            "request": req,
            "created_at": now,
            "started_at": None,
            "finished_at": None,
            "expires_at": None,
            "file": None,
            "error": None,
        }
        self.jobs[job_id] = record
        if idempotency_key:
            self._idempotency[idempotency_key] = job_id
        return _materialise_job(record)

    async def list_jobs(
        self,
        *,
        status: Any = None,
        limit: int = 20,
        cursor: str | None = None,
    ) -> Any:
        items = list(self.jobs.values())
        if status is not None:
            wanted = status.value if hasattr(status, "value") else str(status)
            items = [j for j in items if j["status"] == wanted]
        items.sort(key=lambda j: j["created_at"], reverse=True)
        sliced = items[: int(limit)]
        return _materialise_job_list([_materialise_job(j) for j in sliced])

    async def get_job(self, job_id: str) -> Any:
        record = self.jobs.get(str(job_id))
        if record is None:
            return None
        return _materialise_job(record)

    async def delete_job(self, job_id: str) -> bool:
        return self.jobs.pop(str(job_id), None) is not None

    # ------------------------------------------------------------------- SSE

    async def subscribe(self, job_id: str) -> AsyncIterator[dict[str, Any]]:
        # Bind queue to the currently running loop (ASGI loop) and drain any
        # events buffered synchronously before the stream was opened.
        queue: asyncio.Queue[dict[str, Any] | None] = asyncio.Queue()
        for evt in self._buffered.pop(str(job_id), []):
            queue.put_nowait(evt)
        self._queues[str(job_id)] = queue
        # Drain pre-published events synchronously, then await new ones until
        # a sentinel ``None`` arrives.
        while True:
            event = await queue.get()
            if event is None:
                return
            yield event

    def publish(self, job_id: str, event_type: str, payload: dict[str, Any]) -> None:
        """Test helper: enqueue a JobEvent for a subscribed stream."""
        body = {"type": event_type, "job_id": str(job_id), **payload}
        event = {"type": event_type, "data": json.dumps(body)}
        queue = self._queues.get(str(job_id))
        if queue is not None:
            queue.put_nowait(event)
        else:
            self._buffered.setdefault(str(job_id), []).append(event)

    def close_stream(self, job_id: str) -> None:
        queue = self._queues.get(str(job_id))
        if queue is not None:
            queue.put_nowait(None)
        else:
            self._buffered.setdefault(str(job_id), []).append(None)

    # --------------------------------------------------------- direct mutate

    def mark_ready(self, job_id: str, file_meta: dict[str, Any]) -> None:
        """Test helper: flip a job to ``ready`` with a file payload."""
        record = self.jobs[str(job_id)]
        record["status"] = "ready"
        record["file"] = file_meta
        record["finished_at"] = datetime.now(timezone.utc).isoformat()


def _detect_site(url: str | None) -> str | None:
    if not url:
        return None
    from app.utils import detect_site  # type: ignore[import-not-found]

    return detect_site(url)


def _materialise_job(record: dict[str, Any]) -> Any:
    """Convert a raw record dict into a pydantic ``Job`` (so FastAPI's
    ``response_model`` machinery serialises it identically to production).
    """
    from app.models import Job  # type: ignore[import-not-found]

    return Job.model_validate(record)


def _materialise_job_list(items: list[Any]) -> Any:
    from app.models import JobList  # type: ignore[import-not-found]

    return JobList(items=items, next_cursor=None)


# ---------------------------------------------------------------------------
# Fake yt-dlp adapter
# ---------------------------------------------------------------------------


class FakeYtdlpAdapter:
    """Stand-in for ``app.services.ytdlp_adapter`` used in unit tests.

    Returns canned probe metadata; never spawns a subprocess. Tests that
    care about probe behaviour can mutate ``self.canned`` between calls.
    """

    def __init__(self) -> None:
        self.canned: dict[str, Any] = {
            "site": "youtube",
            "id": "dQw4w9WgXcQ",
            "title": "Fake Video",
            "webpage_url": "https://youtube.com/watch?v=dQw4w9WgXcQ",
            "thumbnails": [],
            "formats": [
                {
                    "format_id": "22",
                    "ext": "mp4",
                    "resolution": "1280x720",
                    "height": 720,
                    "width": 1280,
                    "fps": 30.0,
                    "vcodec": "h264",
                    "acodec": "aac",
                    "has_audio": True,
                    "has_video": True,
                }
            ],
        }
        self.calls: list[tuple[str, dict[str, Any]]] = []

    async def probe(self, url: str, **kwargs: Any) -> dict[str, Any]:
        self.calls.append((url, kwargs))
        return dict(self.canned)

    async def download(self, *args: Any, **kwargs: Any) -> dict[str, Any]:
        raise AssertionError("FakeYtdlpAdapter.download must not be called in tests")


# ---------------------------------------------------------------------------
# Stub serve_job_file (J1.4)
# ---------------------------------------------------------------------------


def _build_serve_job_file(file_path: Path) -> Any:
    """Return an async ``serve_job_file(request, job)`` honouring Range."""
    from fastapi import Response
    from fastapi.responses import StreamingResponse

    async def _serve(request: Any, job: Any) -> Response:
        size = file_path.stat().st_size
        data = file_path.read_bytes()
        range_hdr = request.headers.get("range") or request.headers.get("Range")
        if not range_hdr:
            return Response(
                content=data,
                media_type="application/octet-stream",
                headers={
                    "Accept-Ranges": "bytes",
                    "Content-Length": str(size),
                },
            )
        # bytes=start-end (either bound optional)
        spec = range_hdr.split("=", 1)[1]
        raw_start, _, raw_end = spec.partition("-")
        if raw_start == "":
            suffix = int(raw_end)
            start = max(0, size - suffix)
            end = size - 1
        else:
            start = int(raw_start)
            end = int(raw_end) if raw_end else size - 1
        if start > end or start >= size:
            return Response(
                status_code=416,
                headers={"Content-Range": f"bytes */{size}"},
            )
        chunk = data[start : end + 1]
        return Response(
            content=chunk,
            status_code=206,
            media_type="application/octet-stream",
            headers={
                "Accept-Ranges": "bytes",
                "Content-Range": f"bytes {start}-{end}/{size}",
                "Content-Length": str(len(chunk)),
            },
        )

    return _serve


# ---------------------------------------------------------------------------
# App + client fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(scope="session")
def api_key() -> str:
    """The bearer token tests should use."""
    return TEST_API_KEY


@pytest.fixture(scope="session")
def auth_headers(api_key: str) -> dict[str, str]:
    """Standard auth header dict — spread into ``client.get(..., headers=...)``."""
    return {"Authorization": f"Bearer {api_key}"}


@pytest.fixture()
def temp_data_dir(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> Path:
    """Per-test isolated data directory."""
    monkeypatch.setenv("UD_DATA_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture()
def fake_engine() -> FakeJobEngine:
    """A fresh in-memory job engine for the test."""
    return FakeJobEngine()


@pytest.fixture()
def fake_ytdlp() -> FakeYtdlpAdapter:
    """A canned yt-dlp adapter — never invokes real binaries."""
    return FakeYtdlpAdapter()


@pytest.fixture()
def temp_artifact(tmp_path: Path) -> Path:
    """Write a deterministic 1024-byte payload and return its path."""
    p = tmp_path / "artifact.bin"
    p.write_bytes(bytes((i % 256 for i in range(1024))))
    return p


@pytest.fixture()
def app(
    fake_engine: FakeJobEngine,
    temp_artifact: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> Any:
    """FastAPI application with fake services pre-wired."""
    from app.main import create_app  # type: ignore[import-not-found]
    from app.services import file_router as file_router_mod  # type: ignore[import-not-found]

    application = create_app()
    application.state.job_engine = fake_engine

    # Inject our streaming stub. The jobs router does
    #   ``from ..services.file_router import serve_job_file``
    # at request time, so setting the attribute on the module is enough.
    monkeypatch.setattr(
        file_router_mod,
        "serve_job_file",
        _build_serve_job_file(temp_artifact),
        raising=False,
    )
    return application


@pytest.fixture()
def client(app: Any) -> Iterator[Any]:
    """Synchronous TestClient bound to the configured app."""
    from fastapi.testclient import TestClient

    with TestClient(app) as c:
        yield c
