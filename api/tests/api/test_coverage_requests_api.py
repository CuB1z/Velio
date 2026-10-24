"""Coverage requests: riders asking for their country."""

import asyncio
import re
import uuid

from fastapi.testclient import TestClient
from sqlalchemy import func, select

from app.api.dependencies import get_mail_sender
from app.clients.mail import MailSender
from app.core import ratelimit
from app.core.config import settings
from app.core.database import SessionLocal
from app.main import app
from app.models import CoverageRequest
from tests.conftest import unique_email

URL = "/api/v1/coverage/requests"


def rows(**filters) -> int:
    async def count() -> int:
        async with SessionLocal() as db:
            query = select(func.count()).select_from(CoverageRequest)
            for field, value in filters.items():
                query = query.where(getattr(CoverageRequest, field) == value)
            return (await db.execute(query)).scalar_one()

    return asyncio.run(count())


def test_an_anonymous_request_is_recorded_once(api_client: TestClient):
    email = unique_email()
    body = {"country": "fr", "email": email.upper(), "note": "  Pyrenees  "}

    first = api_client.post(URL, json=body)
    again = api_client.post(URL, json=body)

    assert first.status_code == 202, first.text
    assert first.json() == {"country": "FR", "recorded": True}
    assert again.status_code == 202
    assert again.json() == {"country": "FR", "recorded": False}
    assert rows(email=email) == 1


def test_a_signed_in_request_ignores_the_email(
    api_client: TestClient, auth_headers: dict
):
    body = {"country": "IT", "email": unique_email()}

    first = api_client.post(URL, json=body, headers=auth_headers)
    again = api_client.post(URL, json=body, headers=auth_headers)

    assert first.json() == {"country": "IT", "recorded": True}
    assert again.json() == {"country": "IT", "recorded": False}
    assert rows(email=body["email"]) == 0


def test_a_covered_country_answers_409(api_client: TestClient):
    for country in ("ES", "pt", "AD"):
        resp = api_client.post(URL, json={"country": country, "email": unique_email()})
        assert resp.status_code == 409, resp.text
        assert resp.json()["error"] == "ALREADY_COVERED"
        assert resp.json()["details"] == {"country": country.upper()}


def test_bad_requests_are_rejected(api_client: TestClient):
    unknown = api_client.post(URL, json={"country": "XX", "email": unique_email()})
    long_note = api_client.post(
        URL, json={"country": "FR", "email": unique_email(), "note": "x" * 300}
    )
    anonymous = api_client.post(URL, json={"country": "FR"})

    assert unknown.status_code == 422
    assert long_note.status_code == 422
    assert anonymous.status_code == 400
    assert anonymous.json()["error"] == "VALIDATION_ERROR"
    assert anonymous.json()["details"] == {"field": "email"}


def test_the_ip_budget_answers_429(api_client: TestClient, monkeypatch):
    monkeypatch.setattr(settings, "rate_limit_enabled", True)
    monkeypatch.setitem(ratelimit.RULES[URL], "ip", 2)
    body = {"country": "DE", "email": unique_email()}

    statuses = [api_client.post(URL, json=body).status_code for _ in range(3)]

    assert statuses == [202, 202, 429]


def test_deleting_the_account_removes_its_requests(api_client: TestClient):
    from tests.api.test_auth_api import _auth_header, _create_oauth_user

    class CodeSpy(MailSender):
        def __init__(self):
            self.codes: list[str] = []

        async def send(self, message):
            if found := re.search(r"deletion code is (\d{6})", message.text):
                self.codes.append(found.group(1))

    account = _create_oauth_user(unique_email())
    headers = _auth_header(account["tokens"])
    api_client.post(URL, json={"country": "BE"}, headers=headers)
    api_client.post(URL, json={"country": "NL", "email": account["email"]})
    assert rows(email=account["email"]) == 1

    spy = CodeSpy()
    app.dependency_overrides[get_mail_sender] = lambda: spy
    try:
        api_client.post("/api/v1/auth/me/delete-request", json={}, headers=headers)
        resp = api_client.request(
            "DELETE", "/api/v1/auth/me", json={"code": spy.codes[-1]}, headers=headers
        )
    finally:
        app.dependency_overrides.pop(get_mail_sender, None)

    assert resp.status_code == 204, resp.text
    assert rows(email=account["email"]) == 0
    assert rows(user_id=uuid.UUID(account["user_id"])) == 0
