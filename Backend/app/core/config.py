"""
Application configuration.

All values are read from environment variables (or a .env file).
Pydantic-settings validates types and raises on startup if required
variables are missing.
"""

from functools import lru_cache
from typing import List

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
    )

    # ── Application ────────────────────────────────────────────────────────
    APP_NAME: str = "AI Access Governance Dashboard"
    APP_VERSION: str = "2.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "production"

    # ── MongoDB ─────────────────────────────────────────────────────────────
    MONGODB_URL: str = "mongodb://localhost:27017"
    MONGODB_DB_NAME: str = "ai_access_governance"

    # ── JWT ─────────────────────────────────────────────────────────────────
    SECRET_KEY: str
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60

    @field_validator("SECRET_KEY")
    @classmethod
    def validate_secret_key(cls, value: str) -> str:
        """Require a sufficiently strong JWT signing secret."""

        if len(value) < 32:
            raise ValueError(
                "SECRET_KEY must be at least 32 characters long."
            )

        return value

    # ── CORS ────────────────────────────────────────────────────────────────
    ALLOWED_ORIGINS: str = (
        "http://localhost:3000,http://localhost:5173"
    )

    @property
    def allowed_origins_list(self) -> List[str]:
        """Split comma-separated CORS origins into a list."""

        return [
            origin.strip()
            for origin in self.ALLOWED_ORIGINS.split(",")
            if origin.strip()
        ]


@lru_cache
def get_settings() -> Settings:
    """Return a cached singleton Settings instance."""

    return Settings()


# Convenience import alias used throughout the app
settings = get_settings()