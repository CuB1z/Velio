"""Unit tests for the mail port: adapter selection and Brevo payloads."""

import asyncio
import json
import logging
import re

import httpx
import pytest

from app.clients.mail import (
    BrevoMailSender,
    ConsoleMailSender,
    account_delete_email,
    build_mail_sender,
    password_reset_email,
    verification_email,
)
from app.core.config import settings
from app.core.exceptions import MailDeliveryError


def _capture_client(handler) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


def test_build_selects_console_without_key(monkeypatch):
    monkeypatch.setattr(settings, "brevo_api_key", None)
    assert isinstance(build_mail_sender(), ConsoleMailSender)


def test_build_selects_brevo_with_key(monkeypatch):
    monkeypatch.setattr(settings, "brevo_api_key", "xkeysib-test")
    sender = build_mail_sender()
    assert isinstance(sender, BrevoMailSender)
    assert sender._list_id == settings.brevo_list_id


def test_brevo_send_posts_the_message(monkeypatch):
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["api_key"] = request.headers.get("api-key")
        seen["payload"] = request.read()
        return httpx.Response(201, json={"messageId": "m-1"})

    monkeypatch.setattr(settings, "mail_from", "no-reply@cycling.test")
    client = _capture_client(handler)
    sender = BrevoMailSender("xkeysib-test", 7, client=client)

    async def run():
        await sender.send(
            verification_email("rider@example.com", "123456", expire_minutes=15)
        )

    asyncio.run(run())

    assert seen["url"] == "https://api.brevo.com/v3/smtp/email"
    assert seen["api_key"] == "xkeysib-test"
    body = json.loads(seen["payload"])
    assert body["sender"] == {"email": "no-reply@cycling.test"}
    assert body["to"] == [{"email": "rider@example.com"}]
    assert body["subject"]
    assert "123456" in body["textContent"]
    assert "123456" in body["htmlContent"]
    asyncio.run(client.aclose())


def test_brevo_send_raises_on_provider_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"message": "bad key"})

    client = _capture_client(handler)
    sender = BrevoMailSender("wrong-key", 7, client=client)

    with pytest.raises(MailDeliveryError):
        asyncio.run(
            sender.send(verification_email("rider@example.com", "123456", 15))
        )
    asyncio.run(client.aclose())


def test_brevo_add_contact_files_into_the_list():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["payload"] = request.read()
        return httpx.Response(201, json={"id": 42})

    client = _capture_client(handler)
    sender = BrevoMailSender("xkeysib-test", 7, client=client)

    asyncio.run(sender.add_contact("rider@example.com", "Test Rider"))

    assert seen["url"] == "https://api.brevo.com/v3/contacts"
    body = json.loads(seen["payload"])
    assert body == {
        "email": "rider@example.com",
        "listIds": [7],
        "updateEnabled": True,
    }
    asyncio.run(client.aclose())


def test_brevo_add_contact_skips_without_list():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url)
        return httpx.Response(201, json={"id": 42})

    client = _capture_client(handler)
    sender = BrevoMailSender("xkeysib-test", list_id=None, client=client)

    asyncio.run(sender.add_contact("rider@example.com"))
    assert not calls
    asyncio.run(client.aclose())


def test_console_add_contact_logs(caplog):
    mail_logger = logging.getLogger("app.clients.mail")

    class _Capture:
        def __enter__(self):
            self.handler_messages = caplog.messages
            return self

        def __exit__(self, *args):
            return False

    with caplog.at_level("INFO", logger=mail_logger.name):
        asyncio.run(ConsoleMailSender().add_contact("rider@example.com", "Test Rider"))
    assert any("contact add rider@example.com" in m for m in caplog.messages)


def test_verification_email_carries_the_code():
    message = verification_email("rider@example.com", "654321", expire_minutes=15)
    assert message.to == "rider@example.com"
    code_in_text = re.search(r"\b654321\b", message.text)
    code_in_html = re.search(r"\b654321\b", message.html)
    assert code_in_text and code_in_html


def test_password_reset_email_carries_the_code():
    message = password_reset_email("rider@example.com", "654321", expire_minutes=15)
    assert message.to == "rider@example.com"
    assert message.subject
    code_in_text = re.search(r"\b654321\b", message.text)
    code_in_html = re.search(r"\b654321\b", message.html)
    assert code_in_text and code_in_html


# ---------------------------------------------------------------------------
# delete_contact


def test_brevo_delete_contact_hits_correct_endpoint():
    seen = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["method"] = request.method
        seen["api_key"] = request.headers.get("api-key")
        return httpx.Response(200, json={})

    client = _capture_client(handler)
    sender = BrevoMailSender("xkeysib-test", 7, client=client)

    asyncio.run(sender.delete_contact("rider@example.com"))

    assert seen["method"] == "DELETE"
    assert seen["url"] == "https://api.brevo.com/v3/contacts/rider%40example.com"
    assert seen["api_key"] == "xkeysib-test"
    asyncio.run(client.aclose())


def test_brevo_delete_contact_raises_on_provider_error():
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(404, json={"message": "not found"})

    client = _capture_client(handler)
    sender = BrevoMailSender("xkeysib-test", 7, client=client)

    with pytest.raises(MailDeliveryError):
        asyncio.run(sender.delete_contact("rider@example.com"))
    asyncio.run(client.aclose())


def test_brevo_delete_contact_skips_without_list():
    calls = []

    def handler(request: httpx.Request) -> httpx.Response:
        calls.append(request.url)
        return httpx.Response(200, json={})

    client = _capture_client(handler)
    sender = BrevoMailSender("xkeysib-test", list_id=None, client=client)

    asyncio.run(sender.delete_contact("rider@example.com"))
    assert not calls
    asyncio.run(client.aclose())


def test_console_delete_contact_logs(caplog):
    mail_logger = logging.getLogger("app.clients.mail")

    with caplog.at_level("INFO", logger=mail_logger.name):
        asyncio.run(ConsoleMailSender().delete_contact("rider@example.com"))
    assert any("contact delete rider@example.com" in m for m in caplog.messages)


# ---------------------------------------------------------------------------
# account_delete email template


def test_account_delete_email_carries_the_code():
    message = account_delete_email("rider@example.com", "654321", expire_minutes=15)
    assert message.to == "rider@example.com"
    assert "deletion" in message.subject.lower()
    code_in_text = re.search(r"\b654321\b", message.text)
    code_in_html = re.search(r"\b654321\b", message.html)
    assert code_in_text and code_in_html


# ---------------------------------------------------------------------------
# Rate-rule completeness


def test_all_rule_paths_are_importable():
    from app.core.ratelimit import RULES

    assert "/api/v1/auth/me/delete-request" in RULES


@pytest.mark.parametrize(
    ("compose", "phrase"),
    [
        (verification_email, "Your verification code is 123456."),
        (password_reset_email, "Your reset code is 123456."),
        (account_delete_email, "Your account deletion code is 123456."),
    ],
)
def test_code_emails_render_in_english_by_default(compose, phrase):
    message = compose("rider@example.com", "123456", 15)
    assert message.subject.startswith("Your Velio")
    assert phrase in message.text
    assert "It expires in 15 minutes." in message.text
    assert '<html lang="en">' in message.html
    assert "123456" in message.html
    assert f'href="{settings.site_url}/privacy"' in message.html
    assert f'src="{settings.site_url}/email/velio-wordmark.png"' in message.html
    assert "$" not in message.html


@pytest.mark.parametrize(
    ("compose", "subject", "phrase"),
    [
        (
            verification_email,
            "Tu código de verificación de Velio",
            "Tu código de verificación es 654321.",
        ),
        (
            password_reset_email,
            "Tu código para cambiar la contraseña de Velio",
            "Tu código para cambiar la contraseña es 654321.",
        ),
        (
            account_delete_email,
            "Tu código para borrar tu cuenta de Velio",
            "Tu código para borrar la cuenta es 654321.",
        ),
    ],
)
def test_code_emails_render_in_spanish(compose, subject, phrase):
    message = compose("rider@example.com", "654321", 15, "es")
    assert message.subject == subject
    assert phrase in message.text
    assert "Caduca en 15 minutos." in message.text
    assert '<html lang="es">' in message.html
    assert f'href="{settings.site_url}/es/privacy"' in message.html
    assert ">Privacidad<" in message.html


def test_email_copy_is_escaped_in_the_html(monkeypatch):
    from app.clients import mail

    verification = {**mail._COPY["en"]["verification"], "heading": "Ride <now> & smile"}
    copy = {**mail._COPY["en"], "verification": verification}
    monkeypatch.setitem(mail._COPY, "en", copy)
    message = verification_email("rider@example.com", "123456", 15)
    assert "Ride &lt;now&gt; &amp; smile" in message.html
    assert "Ride <now> & smile" in message.text
