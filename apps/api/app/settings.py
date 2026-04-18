"""Application configuration sourced from `UD_*` environment variables."""

from __future__ import annotations

from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration. Fail-fast if `UD_API_KEY` is missing."""

    model_config = SettingsConfigDict(
        env_prefix="UD_",
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    API_KEY: str = Field(
        ...,
        description="Bearer token. Required at startup; the app refuses to boot without it.",
    )
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL for the arq job queue.",
    )
    DATABASE_URL: str = Field(
        default="sqlite+aiosqlite:///./ud.db",
        description="SQLModel/SQLAlchemy async database URL.",
    )
    DATA_DIR: Path = Field(
        default=Path("./data"),
        description="Directory where downloaded artifacts are persisted.",
    )
    PORT: int = Field(default=8787, ge=1, le=65535)
    JOB_TTL_HOURS: int = Field(default=24, ge=1)
    MAX_CONCURRENCY: int = Field(default=3, ge=1, le=64)
    LOG_LEVEL: str = Field(default="INFO")
    CORS_ORIGINS: list[str] = Field(default_factory=lambda: ["*"])
    ENV: str = Field(default="development", description="development|production")

    @property
    def is_dev(self) -> bool:
        return self.ENV.lower() in {"dev", "development", "local"}


_settings: Settings | None = None


def get_settings() -> Settings:
    """Lazy singleton accessor (FastAPI dependency-friendly)."""
    global _settings
    if _settings is None:
        _settings = Settings()  # type: ignore[call-arg]
    return _settings
