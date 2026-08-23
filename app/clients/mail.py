"""Mail delivery port with console and Brevo adapters.

The port keeps email out of the auth use cases: tests and local
development use the console adapter (the content lands in the logs),
production plugs Brevo's transactional API in through settings alone.
"""

import logging
from dataclasses import dataclass

import httpx

from app.core.config import settings
from app.core.exceptions import MailDeliveryError

logger = logging.getLogger(__name__)


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


class ConsoleMailSender(MailSender):
    """Logs the full message; the dev/test stand-in for a real provider."""

    async def send(self, message: Message) -> None:
        logger.info(
            f"mail to={message.to} subject={message.subject!r}:\n{message.text}"
        )

    async def add_contact(self, email: str, full_name: str = "") -> None:
        logger.info(f"contact add {email} name={full_name!r}")


class BrevoMailSender(MailSender):
    """Sends transactional email and files contacts through Brevo's v3 API."""

    BREVO_SEND_URL = "https://api.brevo.com/v3/smtp/email"
    BREVO_CONTACTS_URL = "https://api.brevo.com/v3/contacts"

    def __init__(
        self,
        api_key: str,
        list_id: int | None = None,
        client: httpx.AsyncClient | None = None,
    ):
        self._api_key = api_key
        self._list_id = list_id
        self._client = client

    async def send(self, message: Message) -> None:
        payload = {
            # The display name comes from the sender verified in Brevo.
            "sender": {"email": settings.mail_from},
            "to": [{"email": message.to}],
            "subject": message.subject,
            "textContent": message.text,
            "htmlContent": message.html,
        }
        headers = {"api-key": self._api_key}
        try:
            if self._client is not None:
                response = await self._client.post(
                    self.BREVO_SEND_URL, json=payload, headers=headers
                )
            else:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        self.BREVO_SEND_URL, json=payload, headers=headers
                    )
        except httpx.HTTPError as exc:
            raise MailDeliveryError(f"brevo unreachable: {exc}") from exc

        if response.status_code >= 400:
            raise MailDeliveryError(
                f"brevo rejected the message ({response.status_code})"
            )

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
        try:
            if self._client is not None:
                response = await self._client.post(
                    self.BREVO_CONTACTS_URL,
                    json=payload,
                    headers={"api-key": self._api_key},
                )
            else:
                async with httpx.AsyncClient(timeout=10.0) as client:
                    response = await client.post(
                        self.BREVO_CONTACTS_URL,
                        json=payload,
                        headers={"api-key": self._api_key},
                    )
        except httpx.HTTPError as exc:
            raise MailDeliveryError(f"brevo unreachable: {exc}") from exc

        if response.status_code >= 400:
            raise MailDeliveryError(
                f"brevo rejected the contact ({response.status_code})"
            )


def build_mail_sender() -> MailSender:
    """Pick the adapter from settings: Brevo when a key is present."""
    if settings.brevo_api_key:
        return BrevoMailSender(settings.brevo_api_key, settings.brevo_list_id)
    return ConsoleMailSender()


def verification_email(to: str, code: str, expire_minutes: int) -> Message:
    """Compose the account verification email carrying the OTP."""
    subject = "Your Cycling Router verification code"
    text = (
        f"Welcome to Cycling Router!\n\nYour verification code is "
        f"{code}. It expires in {expire_minutes} minutes.\n\n"
        f"If you did not create an account, you can ignore this email."
    )
    html = (
        "<p>Welcome to <strong>Cycling Router</strong>!</p>"
        f"<p>Your verification code is "
        f"<strong style=\"font-size:1.4em\">{code}</strong>. "
        f"It expires in {expire_minutes} minutes.</p>"
        "<p>If you did not create an account, you can ignore this email.</p>"
    )
    return Message(to=to, subject=subject, text=text, html=html)
