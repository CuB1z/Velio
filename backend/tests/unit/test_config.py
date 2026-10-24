"""Unit tests for the critical-config validator on Settings."""

import pytest

from app.core.config import Settings


def _settings(**overrides) -> Settings:
    return Settings(_env_file=None, **overrides)


def test_cors_wildcard_rejected_outside_dev():
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        _settings(cors_origins=["*"], environment="prod")


def test_cors_wildcard_banned_among_specific_origins():
    with pytest.raises(ValueError, match="CORS_ORIGINS"):
        _settings(
            cors_origins=["https://app.example.com", "*"],
            environment="staging",
        )


def test_cors_wildcard_allowed_in_dev():
    settings = _settings(cors_origins=["*"], environment="local")
    assert settings.cors_origins == ["*"]


def test_cors_specific_origins_always_allowed():
    settings = _settings(
        cors_origins=["https://app.example.com"],
        environment="prod",
    )
    assert settings.cors_origins == ["https://app.example.com"]