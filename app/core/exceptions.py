"""Centralised application errors and their HTTP handlers."""

from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

import logging

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base application error."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str = "INTERNAL_ERROR",
        details: dict[str, Any] | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        super().__init__(message)


class ValidationError(AppError):
    """A well-formed request carries an unusable value (400)."""

    def __init__(
        self,
        message: str = "Invalid request",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="VALIDATION_ERROR",
            details=details,
        )


class ServiceUnavailableError(AppError):
    """An upstream dependency is unreachable (503)."""

    def __init__(
        self,
        message: str = "Service temporarily unavailable",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            error_code="SERVICE_UNAVAILABLE",
            details=details,
        )


class RoutingError(AppError):
    """Valhalla answered but no route exists through the points (422)."""

    def __init__(
        self,
        message: str = "No route found between waypoints",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            error_code="ROUTING_ERROR",
            details=details,
        )


class OAuthError(AppError):
    """The OAuth round trip was rejected (bad state, code or scope) (400)."""

    def __init__(
        self,
        message: str = "OAuth authentication failed",
        details: dict[str, Any] | None = None,
    ):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="OAUTH_ERROR",
            details=details,
        )


class EmailNotVerifiedError(AppError):
    """A pending account tried to open or refresh a session (403)."""

    def __init__(self, message: str = "Email address not verified"):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="EMAIL_NOT_VERIFIED",
        )


class AccountSuspendedError(AppError):
    """A suspended account tried to open or refresh a session (403)."""

    def __init__(self, message: str = "Account suspended"):
        super().__init__(
            message=message,
            status_code=status.HTTP_403_FORBIDDEN,
            error_code="ACCOUNT_SUSPENDED",
        )


class EmailVerificationError(AppError):
    """The submitted code is wrong, expired or exhausted (400)."""

    def __init__(self, message: str = "Invalid or expired verification code"):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="VERIFY_ERROR",
        )


# ---------------------------------------------------------------------------
# Domain errors — plain exceptions; routes and services map them to HTTP.


class InvalidCredentialsError(Exception):
    """Wrong email or password."""


class UnknownProviderError(Exception):
    """The provider name is not one of the configured ones."""


class NoLocalPasswordError(Exception):
    """The account has no local credential (OAuth-only) to change."""


class EmailAlreadyRegisteredError(Exception):
    """The email is taken by another account."""


class InvalidRefreshTokenError(Exception):
    """Unknown, revoked or expired refresh token."""


class WeakPasswordError(ValueError):
    """The password does not satisfy the policy."""


# ---------------------------------------------------------------------------
# Provider errors — raised by outbound clients, translated upstream.


class OAuthRejectedError(Exception):
    """The provider refused the round trip (bad code, expired, denied)."""


class OAuthUnavailableError(Exception):
    """The provider could not be reached or answered a server error."""


class ProviderNotConfiguredError(Exception):
    """Client id/secret for this provider are absent from settings."""


class MailDeliveryError(Exception):
    """Brevo refused the message or contact, or could not be reached."""


class ValhallaError(RuntimeError):
    """Valhalla could not be reached or answered unexpectedly."""


class RouteError(ValhallaError):
    """Valhalla answered but no route exists through the points."""


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    logger.warning(
        f"{exc.error_code}: {exc.message}",
        extra={"error_code": exc.error_code, "details": exc.details, "path": str(request.url)},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": exc.error_code, "message": exc.message, "details": exc.details},
    )


def _jsonable_validation_errors(exc: RequestValidationError) -> list[dict[str, Any]]:
    """Flatten pydantic errors, stringifying exception objects in ctx."""
    flat = []
    for err in exc.errors():
        ctx = err.get("ctx")
        if isinstance(ctx, dict):
            err = {**err, "ctx": {k: str(v) for k, v in ctx.items()}}
        flat.append(err)
    return flat


async def validation_exception_handler(
    request: Request, exc: RequestValidationError
) -> JSONResponse:
    logger.warning("Validation error", extra={"errors": exc.errors(), "path": str(request.url)})
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Invalid request data",
            "details": _jsonable_validation_errors(exc),
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error("Unhandled exception", exc_info=exc, extra={"path": str(request.url)})
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"error": "INTERNAL_ERROR", "message": "An unexpected error occurred"},
    )


def register_exception_handlers(app) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
