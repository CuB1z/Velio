"""Application configuration."""

from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

_REPO_ROOT = Path(__file__).resolve().parents[2]

_PLACEHOLDER_SECRETS = frozenset(
    {"", "changeme", "change-me", "dev-secret-change-in-production"}
)


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
        env_ignore_empty=True,
    )

    app_name: str = "velio"
    app_version: str = "0.35.0"
    debug: bool = False
    environment: str = Field(
        default="dev",
        validation_alias=AliasChoices("environment", "ENV"),
    )

    @property
    def is_dev(self) -> bool:
        """Developer environments where conveniences are allowed."""
        return self.environment.lower() in ("dev", "development", "local")

    @property
    def docs_enabled(self) -> bool:
        """Interactive docs exist only where developers actually work."""
        return self.is_dev

    # --- Valhalla (required) ---
    valhalla_url: str = Field(
        validation_alias=AliasChoices("valhalla_url", "VALHALLA_URL"),
    )
    valhalla_timeout_s: float = Field(
        default=120.0,
        validation_alias=AliasChoices("valhalla_timeout_s", "VALHALLA_TIMEOUT_S"),
    )
    elevation_dir: Path = Field(
        validation_alias=AliasChoices("elevation_dir", "VALHALLA_ELEVATION_DIR"),
    )
    restricted_areas_path: Path | None = Field(
        default=Path("data/restricted_areas.geojson"), alias="RESTRICTED_AREAS_PATH"
    )
    coverage_path: Path | None = Field(
        default=Path("data/coverage.geojson"), alias="COVERAGE_PATH"
    )

    cors_origins: list[str] = Field(default=["*"])
    cache_control_max_age: int = Field(default=3600, alias="CACHE_CONTROL_MAX_AGE")

    # --- Database (required) ---
    db_driver: str = Field(
        default="postgresql+asyncpg",
        validation_alias=AliasChoices("db_driver", "DB_DRIVER"),
    )
    db_host: str = Field(
        validation_alias=AliasChoices("db_host", "DB_HOST"),
    )
    db_port: int = Field(
        validation_alias=AliasChoices("db_port", "DB_PORT"),
    )
    db_user: str = Field(
        validation_alias=AliasChoices("db_user", "DB_USER"),
    )
    db_password: str = Field(
        validation_alias=AliasChoices("db_password", "DB_PASSWORD"),
    )
    db_name: str = Field(
        validation_alias=AliasChoices("db_name", "DB_NAME"),
    )

    # --- JWT (required) ---
    jwt_secret_key: str = Field(
        validation_alias=AliasChoices("jwt_secret_key", "JWT_SECRET_KEY"),
    )
    jwt_algorithm: str = "HS256"
    jwt_access_token_expire_minutes: int = 30
    jwt_refresh_token_expire_days: int = 7

    # --- OAuth (optional) ---
    oauth_google_client_id: str | None = Field(
        default=None, alias="OAUTH_GOOGLE_CLIENT_ID"
    )
    oauth_google_client_secret: str | None = Field(
        default=None, alias="OAUTH_GOOGLE_CLIENT_SECRET"
    )
    auth_redirect_base: str = Field(
        default="http://localhost:8000", alias="AUTH_REDIRECT_BASE"
    )
    # SPA URL the OAuth callback redirects to, with the result in the fragment.
    # Unset, the callback answers JSON.
    oauth_success_redirect: str | None = Field(
        default=None, alias="OAUTH_SUCCESS_REDIRECT"
    )

    # --- Email (optional, can be None for local dev) ---
    brevo_api_key: str | None = Field(default=None, alias="BREVO_API_KEY")
    brevo_list_id: int | None = Field(default=None, alias="BREVO_LIST_ID")
    mail_from: str = Field(default="no-reply@localhost", alias="MAIL_FROM")

    # --- OTP ---
    otp_expire_minutes: int = Field(default=15, alias="OTP_EXPIRE_MINUTES")
    otp_max_attempts: int = Field(default=5, alias="OTP_MAX_ATTEMPTS")
    otp_test_mode: bool = Field(default=False, alias="OTP_TEST_MODE")

    @property
    def otp_test_mode_active(self) -> bool:
        """Test mode requires BOTH the flag and a dev environment."""
        return self.otp_test_mode and self.is_dev

    # --- Metrics ---
    metrics_enabled: bool = Field(default=False, alias="METRICS_ENABLED")
    metrics_token: str | None = Field(default=None, alias="METRICS_TOKEN")

    # --- Rate limiting ---
    rate_limit_enabled: bool = Field(default=True, alias="RATE_LIMIT_ENABLED")
    rate_limit_backend: Literal["memory", "redis"] = Field(
        default="memory", alias="RATE_LIMIT_BACKEND"
    )
    redis_url: str = Field(default="", alias="REDIS_URL")

    @model_validator(mode="after")
    def _validate_critical(self) -> "Settings":
        errors: list[str] = []

        if self.jwt_secret_key in _PLACEHOLDER_SECRETS and not self.is_dev:
            errors.append(
                "JWT_SECRET_KEY must be a real secret in non-dev environments"
            )

        if self.rate_limit_backend == "redis" and not self.redis_url:
            errors.append(
                "REDIS_URL is required when RATE_LIMIT_BACKEND=redis"
            )

        if self.rate_limit_backend == "redis" and not self.rate_limit_enabled:
            errors.append(
                "RATE_LIMIT_BACKEND=redis with RATE_LIMIT_ENABLED=false is "
                "misconfigured; set RATE_LIMIT_BACKEND=memory or enable "
                "rate limiting"
            )

        if "*" in self.cors_origins and not self.is_dev:
            errors.append(
                'CORS_ORIGINS must not contain "*" outside dev; '
                "list the front-end origins explicitly"
            )

        if errors:
            raise ValueError(
                "Configuration errors:\n" + "\n".join(f"  - {e}" for e in errors)
            )
        return self

    @property
    def database_url(self) -> str:
        if self.db_driver.startswith("sqlite"):
            return f"{self.db_driver}:///{self.db_name}"
        return (
            f"{self.db_driver}://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )


settings = Settings()
