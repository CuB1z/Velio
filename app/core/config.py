"""Application configuration."""

from pathlib import Path

from pydantic import AliasChoices, Field
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
    app_version: str = "0.7.0"
    debug: bool = False

    valhalla_url: str = Field(
        default="http://localhost:8002",
        validation_alias=AliasChoices("valhalla_url", "VALHALLA_URL"),
    )
    valhalla_timeout_s: float = Field(
        default=120.0,
        validation_alias=AliasChoices("valhalla_timeout_s", "VALHALLA_TIMEOUT_S"),
    )
    elevation_dir: Path = Field(
        default=_REPO_ROOT / "valhalla" / "elevation",
        validation_alias=AliasChoices("elevation_dir", "VALHALLA_ELEVATION_DIR"),
    )

    cors_origins: list[str] = ["*"]


settings = Settings()
