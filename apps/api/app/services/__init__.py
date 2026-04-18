"""Service layer.

Submodules in this package are owned by sibling Wave 1 jobs and may not exist
yet at API-skeleton time:

- ``job_engine``     — J1.2 (arq queue + SQLModel persistence)
- ``ytdlp_adapter``  — J1.3 (yt-dlp probe/download wrapper)
- ``file_store``     — J1.4 (artifact storage + Range serving)

Routers must import these lazily (``from .services import ytdlp_adapter`` *inside*
a function body) so ``app.main`` can still boot in a fresh checkout.
"""
