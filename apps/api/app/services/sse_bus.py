"""Pub/sub event bus used to fan SSE events out to subscribers.

Primary backend: Redis pub/sub (so multiple API workers can subscribe to
events produced by the arq worker process). Fallback: in-process asyncio
queues, which keeps unit tests and dev-mode uvicorn workers functional
without a Redis dependency.
"""

from __future__ import annotations

import asyncio
import contextlib
import json
import logging
import os
from collections.abc import AsyncIterator
from typing import Any

try:  # pragma: no cover - import side effect
    from redis import asyncio as aioredis  # type: ignore[import-not-found]
except Exception:  # pragma: no cover
    aioredis = None  # type: ignore[assignment]

try:  # pragma: no cover - depends on sibling job
    from app.settings import settings as _settings  # type: ignore[import-not-found]

    _REDIS_URL: str = getattr(_settings, "UD_REDIS_URL", "")
except Exception:  # pragma: no cover
    _settings = None
    _REDIS_URL = ""

if not _REDIS_URL:
    _REDIS_URL = os.environ.get("UD_REDIS_URL", "redis://localhost:6379/0")

log = logging.getLogger(__name__)


def channel_for(job_id: str) -> str:
    """Return the canonical pub/sub channel for a job UUID string."""
    return f"ud:job:{job_id}"


# ---------------------------------------------------------------------------
# In-memory fallback
# ---------------------------------------------------------------------------


class _InMemoryBus:
    """Process-local pub/sub used when Redis is unreachable."""

    def __init__(self) -> None:
        self._subs: dict[str, set[asyncio.Queue[dict[str, Any]]]] = {}
        self._lock = asyncio.Lock()

    async def publish(self, channel: str, event: dict[str, Any]) -> None:
        async with self._lock:
            queues = list(self._subs.get(channel, ()))
        for q in queues:
            # Drop on full to avoid blocking the publisher; SSE clients
            # are expected to be live consumers.
            try:
                q.put_nowait(event)
            except asyncio.QueueFull:  # pragma: no cover - bounded queues only
                log.warning("sse_bus: dropping event on full queue (channel=%s)", channel)

    async def subscribe(self, channel: str) -> AsyncIterator[dict[str, Any]]:
        q: asyncio.Queue[dict[str, Any]] = asyncio.Queue(maxsize=256)
        async with self._lock:
            self._subs.setdefault(channel, set()).add(q)
        try:
            while True:
                event = await q.get()
                yield event
        finally:
            async with self._lock:
                subs = self._subs.get(channel)
                if subs is not None:
                    subs.discard(q)
                    if not subs:
                        self._subs.pop(channel, None)


_memory_bus = _InMemoryBus()


# ---------------------------------------------------------------------------
# Redis-backed bus with lazy connection + auto-fallback
# ---------------------------------------------------------------------------


class SSEBus:
    """Async pub/sub abstraction with a Redis primary and in-memory fallback."""

    def __init__(self, url: str | None = None) -> None:
        self._url = url or _REDIS_URL
        self._redis: Any | None = None
        self._fallback = False
        self._connect_lock = asyncio.Lock()

    async def _ensure_redis(self) -> Any | None:
        """Lazily open a Redis connection. On failure, latch into fallback mode."""
        if self._fallback:
            return None
        if self._redis is not None:
            return self._redis
        async with self._connect_lock:
            if self._redis is not None:
                return self._redis
            if aioredis is None:
                log.warning("sse_bus: redis library unavailable, using in-memory bus")
                self._fallback = True
                return None
            try:
                client = aioredis.from_url(self._url, encoding="utf-8", decode_responses=True)
                # Cheap liveness check.
                await client.ping()
                self._redis = client
                return self._redis
            except Exception as exc:
                log.warning("sse_bus: redis unreachable (%s); falling back to in-memory", exc)
                self._fallback = True
                return None

    async def publish(self, channel: str, event: dict[str, Any]) -> None:
        """Publish ``event`` (dict, JSON-serializable) on ``channel``."""
        client = await self._ensure_redis()
        payload = json.dumps(event, default=str)
        if client is None:
            await _memory_bus.publish(channel, event)
            return
        try:
            await client.publish(channel, payload)
        except Exception as exc:
            log.warning("sse_bus: redis publish failed (%s); using in-memory", exc)
            self._fallback = True
            self._redis = None
            await _memory_bus.publish(channel, event)

    async def subscribe(self, channel: str) -> AsyncIterator[dict[str, Any]]:
        """Yield successive events posted to ``channel``."""
        client = await self._ensure_redis()
        if client is None:
            async for event in _memory_bus.subscribe(channel):
                yield event
            return

        pubsub = client.pubsub()
        try:
            await pubsub.subscribe(channel)
            async for message in pubsub.listen():
                if message is None:
                    continue
                if message.get("type") != "message":
                    continue
                data = message.get("data")
                if data is None:
                    continue
                if isinstance(data, bytes | bytearray):
                    data = data.decode("utf-8", errors="replace")
                try:
                    yield json.loads(data)
                except json.JSONDecodeError:
                    log.warning("sse_bus: dropping non-JSON message on %s", channel)
        finally:
            try:
                await pubsub.unsubscribe(channel)
                await pubsub.close()
            except Exception:  # pragma: no cover - cleanup best-effort
                pass

    async def close(self) -> None:
        """Close the underlying Redis connection, if any."""
        if self._redis is not None:
            with contextlib.suppress(Exception):  # pragma: no cover
                await self._redis.close()
            self._redis = None


# Module-level singleton — most callers should use this directly.
bus = SSEBus()


async def publish(channel: str, event: dict[str, Any]) -> None:
    """Module-level convenience wrapper around the singleton bus."""
    await bus.publish(channel, event)


async def subscribe(channel: str) -> AsyncIterator[dict[str, Any]]:
    """Module-level convenience wrapper around the singleton bus."""
    async for event in bus.subscribe(channel):
        yield event
