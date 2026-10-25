"""OAuth provider definitions and the async gateway that talks to them.

Privacy stance: request the minimum scopes that identify the rider
(Google: openid, email, profile). Nothing about training, contacts or
health is asked for.
"""

from collections.abc import Callable
from dataclasses import dataclass
from urllib.parse import urlencode

import httpx

from app.core.config import settings
from app.core.exceptions import (
    OAuthRejectedError,
    OAuthUnavailableError,
    ProviderNotConfiguredError,
)
from app.core.security import create_state_token
from app.models import AuthProvider


@dataclass(frozen=True)
class OAuthIdentity:
    """Minimum user data extracted from a provider profile."""

    provider: str
    provider_user_id: str
    email: str
    full_name: str = ""
    email_verified: bool = False


@dataclass(frozen=True)
class ProviderConfig:
    name: str
    authorize_url: str
    token_url: str
    profile_url: str | None  # None when the token response already carries it
    scope: str
    client_id: str | None
    client_secret: str | None

    @property
    def configured(self) -> bool:
        return bool(self.client_id and self.client_secret)


def _google() -> ProviderConfig:
    return ProviderConfig(
        name=AuthProvider.GOOGLE,
        authorize_url="https://accounts.google.com/o/oauth2/v2/auth",
        token_url="https://oauth2.googleapis.com/token",
        profile_url="https://openidconnect.googleapis.com/v1/userinfo",
        scope="openid email profile",
        client_id=settings.oauth_google_client_id,
        client_secret=settings.oauth_google_client_secret,
    )


_FACTORIES: dict[str, Callable[[], ProviderConfig]] = {AuthProvider.GOOGLE: _google}


def get_provider(name: str) -> ProviderConfig:
    factory = _FACTORIES.get(name)
    if factory is None:
        raise KeyError(name)
    config = factory()
    if not config.configured:
        raise ProviderNotConfiguredError(
            f"OAuth provider '{name}' is missing client credentials"
        )
    return config


def build_authorize_url(config: ProviderConfig, redirect_uri: str, state: str) -> str:
    params = {
        "response_type": "code",
        "client_id": config.client_id,
        "redirect_uri": redirect_uri,
        "scope": config.scope,
        "state": state,
    }
    return f"{config.authorize_url}?{urlencode(params)}"


class OAuthGateway:
    """Performs the provider round trips behind the auth service."""

    def __init__(self, transport: httpx.AsyncBaseTransport | None = None):
        self._transport = transport

    def redirect_uri(self, provider: str) -> str:
        return (
            f"{settings.auth_redirect_base.rstrip('/')}"
            f"/api/v1/auth/{provider}/callback"
        )

    def authorize_url(self, provider: str) -> tuple[str, str]:
        """Return (authorize_url, state) for the provider."""
        config = get_provider(provider)
        state = create_state_token(provider)
        url = build_authorize_url(config, self.redirect_uri(provider), state)
        return url, state

    async def exchange(
        self, provider: str, code: str, redirect_uri: str
    ) -> OAuthIdentity:
        """Swap an authorization code for tokens and the minimum identity."""
        config = get_provider(provider)

        async with httpx.AsyncClient(timeout=30.0, transport=self._transport) as client:
            try:
                token_resp = await client.post(
                    config.token_url,
                    data={
                        "grant_type": "authorization_code",
                        "code": code,
                        "redirect_uri": redirect_uri,
                        "client_id": config.client_id,
                        "client_secret": config.client_secret,
                    },
                )
            except httpx.HTTPError as exc:
                raise OAuthUnavailableError(str(exc)) from exc

            if token_resp.status_code >= 400:
                raise OAuthRejectedError(
                    f"{provider} rejected the code: {token_resp.status_code}"
                )

            payload = token_resp.json()
            access_token = payload.get("access_token")
            if not access_token:
                raise OAuthRejectedError(f"{provider} returned no access token")

            try:
                if config.profile_url is None:
                    raise RuntimeError(
                        f"{provider} has no profile_url configured"
                    )
                profile_resp = await client.get(
                    config.profile_url,
                    headers={"Authorization": f"Bearer {access_token}"},
                )
            except httpx.HTTPError as exc:
                raise OAuthUnavailableError(str(exc)) from exc
            if profile_resp.status_code >= 400:
                raise OAuthRejectedError(
                    f"{provider} refused the profile fetch: "
                    f"{profile_resp.status_code}"
                )
            profile = profile_resp.json()
            identity = OAuthIdentity(
                provider=provider,
                provider_user_id=str(profile["sub"]),
                email=str(profile.get("email") or ""),
                full_name=str(profile.get("name") or ""),
                email_verified=bool(profile.get("email_verified", False)),
            )

        if not identity.provider_user_id or not identity.email:
            raise OAuthRejectedError(f"{provider} profile lacks id or email")
        return identity
