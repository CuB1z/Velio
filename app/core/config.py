"""Application configuration."""

from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    app_name: str = "cycling-router"
    app_version: str = "0.4.0"
    debug: bool = False

    valhalla_url: str = "http://localhost:8002"
    valhalla_timeout_s: float = 120.0
    elevation_dir: Path = _REPO_ROOT / "valhalla" / "elevation"

    cors_origins: list[str] = ["*"]


settings = Settings()
