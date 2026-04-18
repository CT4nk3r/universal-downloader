"""Job status state machine.

Pure functions describing the lifecycle transitions of a download job.
The canonical state set lives in ``packages/shared-types/openapi.yaml``
under ``JobStatus``.

Transitions
-----------
queued          -> probing | cancelled
probing         -> downloading | failed | cancelled
downloading     -> postprocessing | failed | cancelled
postprocessing  -> ready | failed | cancelled
ready           -> expired
failed          -> (terminal)
cancelled       -> (terminal)
expired         -> (terminal)

Additionally, *any* non-terminal state may transition to ``cancelled``.
"""

from __future__ import annotations

from typing import Final

# We intentionally use plain strings here rather than importing the
# generated enum so this module remains importable in isolation
# (other parallel jobs are still scaffolding the models package).
QUEUED: Final[str] = "queued"
PROBING: Final[str] = "probing"
DOWNLOADING: Final[str] = "downloading"
POSTPROCESSING: Final[str] = "postprocessing"
READY: Final[str] = "ready"
FAILED: Final[str] = "failed"
CANCELLED: Final[str] = "cancelled"
EXPIRED: Final[str] = "expired"

TERMINAL_STATES: Final[frozenset[str]] = frozenset({READY, FAILED, CANCELLED, EXPIRED})

_TRANSITIONS: Final[dict[str, frozenset[str]]] = {
    QUEUED: frozenset({PROBING, CANCELLED, FAILED}),
    PROBING: frozenset({DOWNLOADING, FAILED, CANCELLED}),
    DOWNLOADING: frozenset({POSTPROCESSING, FAILED, CANCELLED}),
    POSTPROCESSING: frozenset({READY, FAILED, CANCELLED}),
    READY: frozenset({EXPIRED}),
    FAILED: frozenset(),
    CANCELLED: frozenset(),
    EXPIRED: frozenset(),
}


class InvalidTransitionError(ValueError):
    """Raised when an illegal status transition is attempted."""

    def __init__(self, old: str, new: str) -> None:
        super().__init__(f"Invalid job status transition: {old!r} -> {new!r}")
        self.old = old
        self.new = new


def _normalize(value: object) -> str:
    """Accept either a plain string or an Enum-like with a ``.value``."""
    if isinstance(value, str):
        return value
    inner = getattr(value, "value", None)
    if isinstance(inner, str):
        return inner
    raise TypeError(f"Cannot normalize status value: {value!r}")


def validate_transition(old: object, new: object) -> bool:
    """Return ``True`` iff ``old -> new`` is a permitted transition."""
    o = _normalize(old)
    n = _normalize(new)
    if o == n:
        return False
    allowed = _TRANSITIONS.get(o)
    if allowed is None:
        return False
    return n in allowed


def assert_transition(old: object, new: object) -> None:
    """Raise :class:`InvalidTransitionError` if ``old -> new`` is illegal."""
    if not validate_transition(old, new):
        raise InvalidTransitionError(_normalize(old), _normalize(new))


def is_terminal(status: object) -> bool:
    """Return ``True`` if ``status`` is a terminal state."""
    return _normalize(status) in TERMINAL_STATES


def allowed_next(status: object) -> frozenset[str]:
    """Return the set of statuses reachable from ``status`` in one hop."""
    return _TRANSITIONS.get(_normalize(status), frozenset())
