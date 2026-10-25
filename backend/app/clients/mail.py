"""Mail delivery port with console and Brevo adapters.

The port keeps email out of the auth use cases: tests and local
development use the console adapter (the content lands in the logs),
production plugs Brevo's transactional API in through settings alone.
"""

import json
import logging
from dataclasses import dataclass
from html import escape
from pathlib import Path
from string import Template
from urllib.parse import quote, urlsplit

import httpx

from app.core.config import settings
from app.core.exceptions import MailDeliveryError
from app.core.i18n import DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, Language

logger = logging.getLogger(__name__)

_TEMPLATES_DIR = Path(__file__).parent.parent / "mail"
_COPY = {
    language: json.loads((_TEMPLATES_DIR / f"{language}.json").read_text("utf-8"))
    for language in SUPPORTED_LANGUAGES
}
_LAYOUT_HTML = Template((_TEMPLATES_DIR / "layout.html").read_text("utf-8"))
_LAYOUT_TEXT = Template((_TEMPLATES_DIR / "layout.txt").read_text("utf-8"))


@dataclass(frozen=True)
class Message:
    """A plain-text + HTML email ready to hand to a sender."""

    to: str
    subject: str
    text: str
    html: str


class MailSender:
    """Port every mail adapter implements."""

    async def send(self, message: Message) -> None:
        raise NotImplementedError

    async def add_contact(self, email: str, full_name: str = "") -> None:
        """Best-effort CRM hook: file the rider into the mailing list.

        Adapters without a list configured may ignore it.
        """
        raise NotImplementedError

    async def delete_contact(self, email: str) -> None:
        """Best-effort CRM hook: remove the rider from the mailing list.

        Adapters without a list configured may ignore it.
        """
        raise NotImplementedError


class ConsoleMailSender(MailSender):
    """Logs the full message; the dev/test stand-in for a real provider."""

    async def send(self, message: Message) -> None:
        logger.info(
            f"mail to={message.to} subject={message.subject!r}:\n{message.text}"
        )

    async def add_contact(self, email: str, full_name: str = "") -> None:
        logger.info(f"contact add {email} name={full_name!r}")

    async def delete_contact(self, email: str) -> None:
        logger.info(f"contact delete {email}")


class BrevoMailSender(MailSender):
    """Sends transactional email and files contacts through Brevo's v3 API."""

    BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"
    BREVO_CONTACTS_URL = "https://api.brevo.com/v3/contacts"
    TIMEOUT_S = 10.0

    def __init__(
        self,
        api_key: str,
        list_id: int | None = None,
        client: httpx.AsyncClient | None = None,
    ):
        self._api_key = api_key
        self._list_id = list_id
        self._client = client

    async def _post(self, url: str, payload: dict) -> httpx.Response:
        """POST once through the injected client or a fresh one."""
        headers = {"api-key": self._api_key}
        try:
            if self._client is not None:
                return await self._client.post(url, json=payload, headers=headers)
            async with httpx.AsyncClient(timeout=self.TIMEOUT_S) as client:
                return await client.post(url, json=payload, headers=headers)
        except httpx.HTTPError as exc:
            raise MailDeliveryError(f"brevo unreachable: {exc}") from exc

    async def _delete(self, url: str) -> httpx.Response:
        """DELETE once through the injected client or a fresh one."""
        headers = {"api-key": self._api_key}
        try:
            if self._client is not None:
                return await self._client.delete(url, headers=headers)
            async with httpx.AsyncClient(timeout=self.TIMEOUT_S) as client:
                return await client.delete(url, headers=headers)
        except httpx.HTTPError as exc:
            raise MailDeliveryError(f"brevo unreachable: {exc}") from exc

    @staticmethod
    def _require_ok(response: httpx.Response, what: str) -> None:
        if response.status_code >= 400:
            raise MailDeliveryError(
                f"brevo rejected the {what} ({response.status_code})"
            )

    async def send(self, message: Message) -> None:
        payload = {
            # The display name comes from the sender verified in Brevo.
            "sender": {"email": settings.mail_from},
            "to": [{"email": message.to}],
            "subject": message.subject,
            "textContent": message.text,
            "htmlContent": message.html,
        }
        self._require_ok(await self._post(self.BREVO_SEND_URL, payload), "message")

    async def add_contact(self, email: str, full_name: str = "") -> None:
        """Upsert the rider into the configured Brevo contacts list."""
        if not self._list_id:
            logger.warning(
                f"no BREVO_LIST_ID configured; skipping contact sync for {email}"
            )
            return
        payload = {
            "email": email,
            "listIds": [self._list_id],
            "updateEnabled": True,
        }
        response = await self._post(self.BREVO_CONTACTS_URL, payload)
        self._require_ok(response, "contact")

    async def delete_contact(self, email: str) -> None:
        """Remove the rider from the configured Brevo contacts list."""
        if not self._list_id:
            logger.warning(
                f"no BREVO_LIST_ID configured; skipping contact deletion for {email}"
            )
            return
        encoded = quote(email, safe="")
        url = f"{self.BREVO_CONTACTS_URL}/{encoded}"
        response = await self._delete(url)
        self._require_ok(response, "contact deletion")


def build_mail_sender() -> MailSender:
    """Pick the adapter from settings: Brevo when a key is present."""
    if settings.brevo_api_key:
        return BrevoMailSender(settings.brevo_api_key, settings.brevo_list_id)
    return ConsoleMailSender()


def _code_email(
    kind: str, to: str, code: str, expire_minutes: int, language: Language
) -> Message:
    lines = {
        key: Template(value).substitute(code=code, expire_minutes=expire_minutes)
        for key, value in _COPY[language][kind].items()
    }
    site = settings.site_url.rstrip("/")
    prefix = "" if language == DEFAULT_LANGUAGE else f"/{language}"
    html = _LAYOUT_HTML.substitute(
        {key: escape(value) for key, value in lines.items()},
        lang=language,
        code=code,
        logo_url=f"{site}/email/velio-wordmark.png",
        site_url=site,
        site_label=urlsplit(site).netloc,
        privacy_url=f"{site}{prefix}/privacy",
        privacy_label=escape(_COPY[language]["privacy"]),
    )
    text = _LAYOUT_TEXT.substitute(lines)
    return Message(to=to, subject=lines["subject"], text=text, html=html)


def verification_email(
    to: str, code: str, expire_minutes: int, language: Language = DEFAULT_LANGUAGE
) -> Message:
    """Compose the account verification email carrying the OTP."""
    return _code_email("verification", to, code, expire_minutes, language)


def password_reset_email(
    to: str, code: str, expire_minutes: int, language: Language = DEFAULT_LANGUAGE
) -> Message:
    """Compose the password reset email carrying the OTP."""
    return _code_email("password_reset", to, code, expire_minutes, language)


def account_delete_email(
    to: str, code: str, expire_minutes: int, language: Language = DEFAULT_LANGUAGE
) -> Message:
    """Compose the account deletion email carrying the OTP."""
    return _code_email("account_delete", to, code, expire_minutes, language)
