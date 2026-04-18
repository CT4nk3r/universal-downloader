"""Tests for the SSE event stream at ``/v1/jobs/{id}/events``.

The wire format is ``text/event-stream``: each message is
``event: <type>\\ndata: <json>\\n\\n`` where ``<type>`` is one of
``progress``, ``status``, ``done`` or ``error`` per the
``JobEvent`` discriminated oneOf in ``openapi.yaml``.
"""

from __future__ import annotations

import json
import threading
import time
from typing import Any


def _parse_sse(blob: str) -> list[dict[str, Any]]:
    """Parse a chunk of SSE wire data into a list of {event, data} dicts."""
    events: list[dict[str, Any]] = []
    current: dict[str, str] = {}
    for line in blob.splitlines():
        if not line.strip():
            if current:
                events.append(current)
                current = {}
            continue
        if line.startswith(":"):
            continue  # comment/keepalive
        key, _, value = line.partition(":")
        value = value.lstrip(" ")
        if key == "event":
            current["event"] = value
        elif key == "data":
            current["data"] = current.get("data", "") + value
    if current:
        events.append(current)
    return events


def test_events_stream_404_for_unknown_job(
    client: Any, auth_headers: dict[str, str]
) -> None:
    response = client.get(
        "/v1/jobs/00000000-0000-0000-0000-000000000000/events",
        headers=auth_headers,
    )
    assert response.status_code == 404


def test_events_stream_emits_progress_status_done(
    client: Any, auth_headers: dict[str, str], fake_engine: Any
) -> None:
    """End-to-end: subscribe, publish a progress→status→done sequence,
    then close the stream and parse events from the response body.
    """
    job = client.post(
        "/v1/jobs",
        json={"url": "https://youtu.be/abc"},
        headers=auth_headers,
    ).json()
    job_id = job["id"]

    # Pre-load the queue so events are buffered before subscribe drains it.
    fake_engine.publish(
        job_id,
        "progress",
        {"progress": {"percent": 10.0, "downloaded_bytes": 100}},
    )
    fake_engine.publish(job_id, "status", {"status": "downloading"})
    fake_engine.publish(
        job_id,
        "done",
        {
            "file": {
                "filename": "out.mp4",
                "size_bytes": 1024,
                "download_url": f"/v1/jobs/{job_id}/file",
            }
        },
    )
    fake_engine.close_stream(job_id)

    with client.stream(
        "GET", f"/v1/jobs/{job_id}/events", headers=auth_headers
    ) as response:
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/event-stream")
        raw = "".join(response.iter_text())

    events = _parse_sse(raw)
    types = [e["event"] for e in events if "event" in e]
    assert "progress" in types
    assert "status" in types
    assert "done" in types

    # Each ``data`` field is a JSON-encoded JobEvent body.
    for ev in events:
        if "data" in ev:
            payload = json.loads(ev["data"])
            assert payload["job_id"] == job_id
            assert payload["type"] in {"progress", "status", "done", "error"}


def test_events_stream_emits_error(
    client: Any, auth_headers: dict[str, str], fake_engine: Any
) -> None:
    job = client.post(
        "/v1/jobs",
        json={"url": "https://youtu.be/abc"},
        headers=auth_headers,
    ).json()
    job_id = job["id"]

    fake_engine.publish(
        job_id,
        "error",
        {"error": {"code": "upstream_error", "message": "yt-dlp blew up"}},
    )
    fake_engine.close_stream(job_id)

    with client.stream(
        "GET", f"/v1/jobs/{job_id}/events", headers=auth_headers
    ) as response:
        assert response.status_code == 200
        raw = "".join(response.iter_text())

    events = _parse_sse(raw)
    error_events = [e for e in events if e.get("event") == "error"]
    assert error_events, f"no error event in stream: {raw!r}"
    payload = json.loads(error_events[0]["data"])
    assert payload["error"]["code"] == "upstream_error"
