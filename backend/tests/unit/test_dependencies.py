"""Shared resources and caller identity behind the dependency providers."""

from fastapi import Depends, FastAPI
from fastapi.security import HTTPAuthorizationCredentials
from fastapi.testclient import TestClient

from app.api.dependencies import (
    get_coverage,
    get_current_user,
    get_session_sid,
    provide,
    reset,
)
from app.core.security import ACCESS_TYPE, decode_token
from app.models import User


def test_a_shared_resource_is_built_once_until_reset():
    first = get_coverage()
    assert get_coverage() is first

    reset()
    try:
        assert get_coverage() is not first
    finally:
        provide(coverage=first)


def test_the_session_sid_does_not_depend_on_declaration_order(auth_headers):
    probe = FastAPI()

    @probe.get("/probe")
    async def read(
        sid: str | None = Depends(get_session_sid),
        user: User = Depends(get_current_user),
    ) -> dict:
        return {"sid": sid}

    token = auth_headers["Authorization"].removeprefix("Bearer ")
    expected = decode_token(token, ACCESS_TYPE).get("sid")
    assert expected is not None

    resp = TestClient(probe).get("/probe", headers=auth_headers)

    assert resp.json() == {"sid": expected}


def test_anonymous_and_invalid_callers_have_no_session_sid():
    garbage = HTTPAuthorizationCredentials(scheme="Bearer", credentials="not-a-jwt")

    assert get_session_sid(None) is None
    assert get_session_sid(garbage) is None
