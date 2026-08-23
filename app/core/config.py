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
    app_version: str = "0.10.0"
    debug: bool = False
    environment: str = Field(
        default="dev",
        validation_alias=AliasChoices("environment", "ENV"),
    )

    @property
    def docs_enabled(self) -> bool:
        """Interactive docs exist only where developers actually work."""
        return self.environment.lower() in ("dev", "development", "local")

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

    db_driver: str = Field(
        default="postgresql+asyncpg",
        validation_alias=AliasChoices("db_driver", "DB_DRIVER"),
    )
    db_host: str = Field(default="localhost", alias="DB_HOST")
    db_port: int = Field(default=5432, alias="DB_PORT")
    db_user: str = Field(default="cycling", alias="DB_USER")
    db_password: str = Field(default="cycling", alias="DB_PASSWORD")
    db_name: str = Field(default="cycling_router", alias="DB_NAME")

    jwt_secret_key: str = Field(
        default="dev-secret-change-in-production",
        validation_alias=AliasChoices("jwt_secret_key", "JWT_SECRET_KEY"),
    )
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    oauth_google_client_id: str | None = Field(
        default=None, alias="OAUTH_GOOGLE_CLIENT_ID"
    )
    oauth_google_client_secret: str | None = Field(
        default=None, alias="OAUTH_GOOGLE_CLIENT_SECRET"
    )
    auth_redirect_base: str = Field(
        default="http://localhost:8000", alias="AUTH_REDIRECT_BASE"
    )

    @property
    def database_url(self) -> str:
        if self.db_driver.startswith("sqlite"):
            return f"{self.db_driver}:///{self.db_name}"
        return (
            f"{self.db_driver}://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
