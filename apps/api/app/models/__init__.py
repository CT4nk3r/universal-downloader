"""Pydantic models for the API.

Prefers `generated.py` (produced by `datamodel-code-generator` via
`pnpm codegen`); falls back to the hand-written `api_models.py` stub so the
app can boot before codegen has run.
"""

from __future__ import annotations

try:  # pragma: no cover - exercised by codegen presence
    from .generated import *  # type: ignore[no-redef]  # noqa: F401,F403
    _SOURCE = "generated"
except ImportError:  # pragma: no cover
    from .api_models import *  # type: ignore[no-redef]  # noqa: F401,F403
    _SOURCE = "stub"
