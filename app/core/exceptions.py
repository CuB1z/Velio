"""Centralised application errors and their HTTP handlers."""

import logging
from typing import Any

from fastapi import Request, status
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

logger = logging.getLogger(__name__)


class AppError(Exception):
    """Base application error."""

    def __init__(
        self,
        message: str,
        status_code: int = status.HTTP_500_INTERNAL_SERVER_ERROR,
        error_code: str = "INTERNAL_ERROR",
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code
        self.details = details or {}
        self.headers = headers
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


class ClientDisconnectedError(AppError):
    """The client went away before the answer was ready (499)."""

    def __init__(self, message: str = "Client closed the request"):
        super().__init__(
            message=message, status_code=499, error_code="CLIENT_CLOSED_REQUEST"
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


class OutOfCoverageError(AppError):
    """Some points fall outside the regions the routing graph covers (422)."""

    def __init__(self, points: list[int], regions: list[str]):
        super().__init__(
            message="Some points are outside the covered regions",
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            error_code="OUT_OF_COVERAGE",
            details={"points": points, "regions": regions},
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


class PasswordResetError(AppError):
    """The submitted reset code is wrong, expired or exhausted (400)."""

    def __init__(self, message: str = "Invalid or expired reset code"):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="RESET_ERROR",
        )


class RateLimitingError(AppError):
    """The caller exhausted a rate budget (429)."""

    def __init__(self, retry_after: int):
        super().__init__(
            message="Too many requests",
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            error_code="RATE_LIMITED",
            headers={"Retry-After": str(retry_after)},
        )


class UnauthorizedError(AppError):
    """No or invalid credentials on an authenticated endpoint (401)."""

    def __init__(self, message: str = "Authentication required"):
        super().__init__(
            message=message,
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="UNAUTHORIZED",
            headers={"WWW-Authenticate": "Bearer"},
        )


class NotFoundError(AppError):
    """The referenced resource does not exist for this caller (404)."""

    def __init__(self, message: str = "Not found"):
        super().__init__(
            message=message,
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="NOT_FOUND",
        )


class ConflictError(AppError):
    """The request clashes with existing state (409)."""

    def __init__(self, message: str = "Conflict"):
        super().__init__(
            message=message,
            status_code=status.HTTP_409_CONFLICT,
            error_code="CONFLICT",
        )


# ---------------------------------------------------------------------------
# Domain errors — AppErrors too, so services raise once and the central
# handler renders the envelope; `context` enriches logs, never responses.


class InvalidCredentialsError(AppError):
    """Wrong email or password (401)."""

    def __init__(self, context: str | None = None):
        super().__init__(
            message="Invalid credentials",
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="INVALID_CREDENTIALS",
        )
        self.context = context


class InvalidRefreshTokenError(AppError):
    """Unknown, revoked or expired refresh token (401)."""

    def __init__(self):
        super().__init__(
            message="Invalid refresh token",
            status_code=status.HTTP_401_UNAUTHORIZED,
            error_code="INVALID_REFRESH_TOKEN",
        )


class NoLocalPasswordError(AppError):
    """The account has no local credential to operate on (400)."""

    def __init__(self):
        super().__init__(
            message="This account has no local password",
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="NO_LOCAL_PASSWORD",
        )


class EmailAlreadyRegisteredError(AppError):
    """The email is taken by another account (409)."""

    def __init__(self, context: str | None = None):
        super().__init__(
            message="Email already registered",
            status_code=status.HTTP_409_CONFLICT,
            error_code="EMAIL_ALREADY_REGISTERED",
        )
        self.context = context


class UnknownProviderError(AppError):
    """The provider name is not one of the configured ones (404)."""

    def __init__(self, context: str | None = None):
        super().__init__(
            message="Unknown provider",
            status_code=status.HTTP_404_NOT_FOUND,
            error_code="UNKNOWN_PROVIDER",
        )
        self.context = context


class WeakPasswordError(ValueError):
    """The password does not satisfy the policy.

    Stays a ValueError: schema validators turn it into a 422 through the
    request-validation pipeline.
    """


# ---------------------------------------------------------------------------
# Provider errors — raised by outbound clients, translated upstream.


class AccountDeletionError(AppError):
    """Account deletion code is wrong, expired or exhausted (400)."""

    def __init__(self, message: str = "Invalid or expired deletion code"):
        super().__init__(
            message=message,
            status_code=status.HTTP_400_BAD_REQUEST,
            error_code="DELETE_ERROR",
        )


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


INTERNAL_ERROR_BODY: dict[str, Any] = {
    "error": "INTERNAL_ERROR",
    "message": "An unexpected error occurred",
    "details": {},
}


def error_body(exc: AppError) -> dict[str, Any]:
    return {"error": exc.error_code, "message": exc.message, "details": exc.details}


async def app_error_handler(request: Request, exc: AppError) -> JSONResponse:
    context = getattr(exc, "context", None)
    logger.warning(
        f"{exc.error_code}: {exc.message}",
        extra={
            "extra_data": {
                "error_code": exc.error_code,
                "details": exc.details,
                "path": str(request.url),
                **({"context": context} if context else {}),
            }
        },
    )
    return JSONResponse(
        status_code=exc.status_code, content=error_body(exc), headers=exc.headers
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
    errors = _jsonable_validation_errors(exc)
    logger.warning(
        "Validation error",
        extra={"extra_data": {"errors": errors, "path": str(request.url)}},
    )
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
        content={
            "error": "VALIDATION_ERROR",
            "message": "Invalid request data",
            "details": errors,
        },
    )


async def generic_exception_handler(request: Request, exc: Exception) -> JSONResponse:
    logger.error(
        "Unhandled exception",
        exc_info=exc,
        extra={"extra_data": {"path": str(request.url)}},
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, content=INTERNAL_ERROR_BODY
    )


def register_exception_handlers(app) -> None:
    app.add_exception_handler(AppError, app_error_handler)
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    app.add_exception_handler(Exception, generic_exception_handler)
