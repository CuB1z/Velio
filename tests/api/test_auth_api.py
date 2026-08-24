"""Offline unit tests for the authentication endpoints."""

import re

from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app
from tests.conftest import (
    PASSWORD,
    mail_capture as collect_verification_codes,
    register_account as _register,
    unique_email as _unique_email,
    verification_code as latest_code,
)


def _verified_session(email: str) -> tuple[TestClient, dict]:
    """A client plus tokens for an already ACTIVE account."""
    client = TestClient(app)
    verified = client.post(
        "/api/v1/auth/verify", json={"email": email, "code": _register(email)}
    )
    assert verified.status_code == 200, verified.text

    logged = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert logged.status_code == 200, logged.text
    return client, logged.json()["tokens"]


def test_register_creates_pending_account_without_tokens():
    email = _unique_email()
    with collect_verification_codes():
        resp = TestClient(app).post(
            "/api/v1/auth/register", json={"email": email, "password": PASSWORD}
        )
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == email
    assert body["status"] == "pending"
    assert "tokens" not in body


def test_duplicate_register_conflicts():
    email = _unique_email()
    _register(email)
    resp = TestClient(app).post(
        "/api/v1/auth/register", json={"email": email, "password": PASSWORD}
    )
    assert resp.status_code == 409


def test_login_with_wrong_password_fails():
    email = _unique_email()
    _register(email)
    resp = TestClient(app).post(
        "/api/v1/auth/login", json={"email": email, "password": "wrong-pass"}
    )
    assert resp.status_code == 401


def test_login_pending_account_is_forbidden():
    email = _unique_email()
    _register(email)
    resp = TestClient(app).post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert resp.status_code == 403
    assert resp.json()["error"] == "EMAIL_NOT_VERIFIED"


def test_register_rejects_weak_passwords():
    client = TestClient(app)
    email = _unique_email()
    weak = {
        "all-lowercase1": "no uppercase",
        "ALL-UPPERCASE1": "no lowercase",
        "No-Digits-Here": "no digit",
        "Ab1": "too short",
        email: "same as the email",
        f"prefix-{email}": "contains the email",
    }
    for password in weak:
        resp = client.post(
            "/api/v1/auth/register", json={"email": email, "password": password}
        )
        assert resp.status_code == 422, f"{password!r} should be rejected"
        assert resp.json()["error"] == "VALIDATION_ERROR"
        # The account was never created along the way.
    assert client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Whatever1"}
    ).status_code == 401


def test_verify_activates_the_account_and_login_opens_a_session():
    email = _unique_email()
    code = _register(email)

    client = TestClient(app)
    resp = client.post("/api/v1/auth/verify", json={"email": email, "code": code})
    assert resp.status_code == 200
    assert resp.json()["status"] == "active"

    logged = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert logged.status_code == 200
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {logged.json()['tokens']['access_token']}"},
    )
    assert me.status_code == 200
    assert me.json()["email"] == email


def test_verify_rejects_a_wrong_code():
    email = _unique_email()
    _register(email)
    resp = TestClient(app).post(
        "/api/v1/auth/verify", json={"email": email, "code": "000001"}
    )
    assert resp.status_code == 400
    assert resp.json()["error"] == "VERIFY_ERROR"


def test_verify_exhausts_after_max_attempts():
    email = _unique_email()
    code = _register(email)
    client = TestClient(app)

    for _ in range(settings.otp_max_attempts):
        wrong = client.post("/api/v1/auth/verify", json={"email": email, "code": "000002"})
        assert wrong.status_code == 400

    # The right answer no longer helps once the guesses ran out.
    spent = client.post("/api/v1/auth/verify", json={"email": email, "code": code})
    assert spent.status_code == 400


def test_failed_verification_rolls_back_the_whole_use_case(monkeypatch):
    """consume + activate are atomic: a crash in between keeps the code."""
    from app.repositories.user_repository import UserRepository

    email = _unique_email()
    code = _register(email)
    client = TestClient(app, raise_server_exceptions=False)

    def boom(self, user):
        raise RuntimeError("activation exploded")

    monkeypatch.setattr(UserRepository, "mark_active", boom)
    broken = client.post("/api/v1/auth/verify", json={"email": email, "code": code})
    assert broken.status_code == 500
    monkeypatch.undo()

    # Nothing leaked: the very same code still activates the account.
    retry = client.post("/api/v1/auth/verify", json={"email": email, "code": code})
    assert retry.status_code == 200, retry.text


def test_resend_invalidates_the_old_code():
    email = _unique_email()
    old_code = _register(email)

    client = TestClient(app)
    with collect_verification_codes() as messages:
        resent = client.post("/api/v1/auth/resend-verification", json={"email": email})
        assert resent.status_code == 202
    fresh_code = latest_code(messages)

    old = client.post("/api/v1/auth/verify", json={"email": email, "code": old_code})
    assert old.status_code == 400

    new = client.post("/api/v1/auth/verify", json={"email": email, "code": fresh_code})
    assert new.status_code == 200


def test_resend_is_accepted_even_for_unknown_emails():
    resp = TestClient(app).post(
        "/api/v1/auth/resend-verification", json={"email": _unique_email()}
    )
    assert resp.status_code == 202


def test_verify_is_idempotent_once_active():
    email = _unique_email()
    _verified_session(email)
    resp = TestClient(app).post(
        "/api/v1/auth/verify", json={"email": email, "code": "999999"}
    )
    assert resp.status_code == 200


def test_refresh_rotates_and_revokes_the_old_token():
    client, tokens = _verified_session(_unique_email())

    first = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert first.status_code == 200
    new_tokens = first.json()["tokens"]

    # The old refresh token was rotated away: replaying it must fail...
    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401

    # ...and the new pair works.
    me = client.get(
        "/api/v1/auth/me",
        headers={"Authorization": f"Bearer {new_tokens['access_token']}"},
    )
    assert me.status_code == 200


def test_logout_revokes_the_refresh_token():
    client, tokens = _verified_session(_unique_email())

    out = client.post(
        "/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}
    )
    assert out.status_code == 204

    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401


def test_me_without_token_is_unauthorized():
    resp = TestClient(app).get("/api/v1/auth/me")
    assert resp.status_code == 401


def test_change_password_rotates_the_credential_and_kills_sessions():
    email = _unique_email()
    client, tokens = _verified_session(email)
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}

    changed = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "Fresh-Secret9"},
        headers=auth,
    )
    assert changed.status_code == 204

    # The refresh token from before the change is dead.
    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401

    # Only the new credential opens sessions.
    old_login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    assert old_login.status_code == 401
    new_login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Fresh-Secret9"}
    )
    assert new_login.status_code == 200


def test_change_password_rejects_wrong_current_or_weak_new():
    email = _unique_email()
    client, tokens = _verified_session(email)
    auth = {"Authorization": f"Bearer {tokens['access_token']}"}

    wrong_current = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": "not-it-123", "new_password": "Fresh-Secret9"},
        headers=auth,
    )
    assert wrong_current.status_code == 401

    weak_new = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": PASSWORD, "new_password": "alllowercase1"},
        headers=auth,
    )
    assert weak_new.status_code == 422

    email_shaped = client.post(
        "/api/v1/auth/change-password",
        json={"current_password": PASSWORD, "new_password": f"x-{email}"},
        headers=auth,
    )
    assert email_shaped.status_code == 422

    # The original password still works: nothing was changed.
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
        ).status_code
        == 200
    )


def test_change_password_needs_a_local_credential(monkeypatch):
    """OAuth-only accounts have no password to change."""
    from test_oauth_api import _configure_google, _google_round_trip

    from app.api.dependencies import get_oauth_gateway
    from app.core.security import create_state_token

    _configure_google(monkeypatch)
    gateway, _ = _google_round_trip()
    app.dependency_overrides[get_oauth_gateway] = lambda: gateway
    try:
        session = TestClient(app).get(
            "/api/v1/auth/google/callback",
            params={"code": "good-code", "state": create_state_token("google")},
        )
    finally:
        app.dependency_overrides.pop(get_oauth_gateway, None)
    assert session.status_code == 200
    tokens = session.json()["tokens"]

    resp = TestClient(app).post(
        "/api/v1/auth/change-password",
        json={"current_password": "whatever-1A", "new_password": "Fresh-Secret9"},
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )
    assert resp.status_code == 400
    body = resp.json()
    assert body["error"] == "NO_LOCAL_PASSWORD"
    assert body["message"] == "This account has no local password"


# Password reset --------------------------------------------------------------


def _reset_code(messages: list[str]) -> str:
    found = re.findall(r"reset code is (\d{6})", "\n".join(messages))
    assert found, f"no reset code logged: {messages}"
    return found[-1]


def test_forgot_and_reset_swap_the_credential_and_kill_sessions():
    email = _unique_email()
    client, tokens = _verified_session(email)

    with collect_verification_codes() as messages:
        asked = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert asked.status_code == 202
    code = _reset_code(messages)

    reset = client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "code": code, "new_password": "Fresh-Secret9"},
    )
    assert reset.status_code == 204

    # Sessions opened before the reset are dead.
    replay = client.post(
        "/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert replay.status_code == 401

    # Only the new credential opens sessions.
    old_login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": PASSWORD}
    )
    new_login = client.post(
        "/api/v1/auth/login", json={"email": email, "password": "Fresh-Secret9"}
    )
    assert old_login.status_code == 401
    assert new_login.status_code == 200


def test_forgot_password_stays_silent_for_unknown_and_pending_emails():
    client = TestClient(app)
    pending_email = _unique_email()
    _register(pending_email)

    with collect_verification_codes() as messages:
        unknown = client.post(
            "/api/v1/auth/forgot-password", json={"email": _unique_email()}
        )
        pending = client.post(
            "/api/v1/auth/forgot-password", json={"email": pending_email}
        )
    assert unknown.status_code == 202
    assert pending.status_code == 202
    assert not any("reset code is" in m for m in messages), messages


def test_forgot_password_skips_oauth_only_accounts(monkeypatch):
    """OAuth-only accounts have no local credential to reset."""
    from test_oauth_api import _configure_google, _google_round_trip

    from app.api.dependencies import get_oauth_gateway
    from app.core.security import create_state_token

    _configure_google(monkeypatch)
    gateway, oauth_email = _google_round_trip()
    app.dependency_overrides[get_oauth_gateway] = lambda: gateway
    try:
        session = TestClient(app).get(
            "/api/v1/auth/google/callback",
            params={"code": "good-code", "state": create_state_token("google")},
        )
        assert session.status_code == 200

        with collect_verification_codes() as messages:
            asked = TestClient(app).post(
                "/api/v1/auth/forgot-password", json={"email": oauth_email}
            )
    finally:
        app.dependency_overrides.pop(get_oauth_gateway, None)
    assert asked.status_code == 202
    assert not any("reset code is" in m for m in messages), messages


def test_reset_rejects_a_wrong_code_but_keeps_trying():
    email = _unique_email()
    client, _ = _verified_session(email)
    with collect_verification_codes() as messages:
        client.post("/api/v1/auth/forgot-password", json={"email": email})
    code = _reset_code(messages)

    wrong = client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "code": "000001", "new_password": "Fresh-Secret9"},
    )
    assert wrong.status_code == 400
    assert wrong.json()["error"] == "RESET_ERROR"

    # The live code still works after the failed guess.
    ok = client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "code": code, "new_password": "Fresh-Secret9"},
    )
    assert ok.status_code == 204


def test_reset_exhausts_after_max_attempts():
    email = _unique_email()
    client, _ = _verified_session(email)
    with collect_verification_codes() as messages:
        client.post("/api/v1/auth/forgot-password", json={"email": email})
    code = _reset_code(messages)

    for _ in range(settings.otp_max_attempts):
        wrong = client.post(
            "/api/v1/auth/reset-password",
            json={
                "email": email,
                "code": "000002",
                "new_password": "Fresh-Secret9",
            },
        )
        assert wrong.status_code == 400

    # The right answer no longer helps once the guesses ran out.
    spent = client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "code": code, "new_password": "Fresh-Secret9"},
    )
    assert spent.status_code == 400


def test_repeat_forgot_does_not_resend_while_the_code_is_alive():
    """One code stays in flight; re-asking never mails again meanwhile."""
    email = _unique_email()
    client, _ = _verified_session(email)

    with collect_verification_codes() as messages:
        first = client.post("/api/v1/auth/forgot-password", json={"email": email})
        second = client.post("/api/v1/auth/forgot-password", json={"email": email})
    assert first.status_code == 202
    assert second.status_code == 202
    sent = [m for m in messages if "reset code is" in m]
    assert len(sent) == 1, messages


def test_reset_rejects_weak_passwords_without_burning_the_code():
    email = _unique_email()
    client, _ = _verified_session(email)
    with collect_verification_codes() as messages:
        client.post("/api/v1/auth/forgot-password", json={"email": email})
    code = _reset_code(messages)

    weak = client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "code": code, "new_password": "alllowercase1"},
    )
    shaped = client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "code": code, "new_password": f"x-{email}"},
    )
    assert weak.status_code == 422
    assert shaped.status_code == 422

    # Rejected payloads never reached the service: the code is intact.
    ok = client.post(
        "/api/v1/auth/reset-password",
        json={"email": email, "code": code, "new_password": "Fresh-Secret9"},
    )
    assert ok.status_code == 204


def test_verified_accounts_are_filed_into_the_mailing_list():
    """Activation pushes the rider into the Brevo list via the port."""
    from app.api.dependencies import get_mail_sender
    from app.clients.mail import MailSender

    class SpySender(MailSender):
        def __init__(self):
            self.contacts = []
            self.codes = []

        async def send(self, message):
            found = re.search(r"verification code is (\d{6})", message.text)
            if found:
                self.codes.append(found.group(1))

        async def add_contact(self, email, full_name=""):
            self.contacts.append(email)

    spy = SpySender()
    app.dependency_overrides[get_mail_sender] = lambda: spy
    try:
        email = _unique_email()
        resp = TestClient(app).post(
            "/api/v1/auth/register", json={"email": email, "password": PASSWORD}
        )
        assert resp.status_code == 201
        verified = TestClient(app).post(
            "/api/v1/auth/verify", json={"email": email, "code": spy.codes[-1]}
        )
    finally:
        app.dependency_overrides.pop(get_mail_sender, None)

    assert verified.status_code == 200
    assert spy.contacts == [email]

