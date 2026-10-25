import logging
import uuid

import pytest

from app.mappers.user import UserMapper
from app.models import User, UserIdentity, UserStatus


def _user(*providers: str) -> User:
    user = User(
        id=uuid.uuid4(),
        email="rider@example.com",
        full_name="Rider",
        status=UserStatus.ACTIVE,
    )
    user.identities = [
        UserIdentity(provider=provider, provider_user_id=f"{provider}-1")
        for provider in providers
    ]
    return user


@pytest.mark.parametrize(
    ("providers", "expected"),
    [
        (("local",), ["local"]),
        (("google",), ["google"]),
        (("local", "google"), ["google", "local"]),
    ],
)
def test_the_payload_lists_how_the_account_signs_in(providers, expected):
    assert UserMapper.out(_user(*providers)).providers == expected


def test_an_unknown_provider_is_skipped_and_logged(caplog):
    with caplog.at_level(logging.WARNING, logger="app.mappers.user"):
        payload = UserMapper.out(_user("local", "myspace"))
    assert payload.providers == ["local"]
    assert "myspace" in caplog.text
