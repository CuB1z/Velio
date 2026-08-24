"""JWT issuing/verification, one-time codes, password policy and hashing."""

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Any

import bcrypt
import jwt

from app.core.config import settings
from app.core.exceptions import WeakPasswordError

ACCESS_TYPE = "access"
REFRESH_TYPE = "refresh"
STATE_TYPE = "state"

# Anti-CSRF lifetime for OAuth authorize->callback round trips.
STATE_EXPIRE_SECONDS = 600

PASSWORD_MIN_LENGTH = 8
PASSWORD_MAX_LENGTH = 128


def validate_password_strength(
    password: str, *, email: str | None = None
) -> None:
    """Raise WeakPasswordError unless the password satisfies the policy.

    Rules: 8-128 characters with at least one lowercase, one uppercase
    and one digit; it must not equal the account email nor contain its
    local part. Symbols are allowed but not required.
    """
    problems: list[str] = []
    if not PASSWORD_MIN_LENGTH <= len(password) <= PASSWORD_MAX_LENGTH:
        problems.append(f"must be {PASSWORD_MIN_LENGTH}-{PASSWORD_MAX_LENGTH} characters long")
    if not any(c.islower() for c in password):
        problems.append("must contain a lowercase letter")
    if not any(c.isupper() for c in password):
        problems.append("must contain an uppercase letter")
    if not any(c.isdigit() for c in password):
        problems.append("must contain a digit")

    if email:
        local = email.split("@", 1)[0].casefold()
        candidate = password.casefold()
        if candidate == email.casefold() or local and local in candidate:
            problems.append("must not match or contain the email")

    if problems:
        raise WeakPasswordError("password " + ", ".join(problems))


def generate_otp(digits: int = 6) -> str:
    """Cryptographically random numeric one-time code, zero padded."""
    return f"{secrets.randbelow(10 ** digits):0{digits}d}"


def create_state_token(provider: str) -> str:
    """Signed CSRF guard binding an OAuth round trip to one provider."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": provider,
        "type": STATE_TYPE,
        "iat": now,
        "exp": now + timedelta(seconds=STATE_EXPIRE_SECONDS),
        "jti": uuid.uuid4().hex,
    }
    return jwt.encode(payload, settings.jwt_secret_key, settings.jwt_algorithm)


def verify_state_token(token: str, provider: str) -> None:
    """Raise jwt.PyJWTError unless the state matches this provider."""
    payload = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != STATE_TYPE or payload.get("sub") != provider:
        raise jwt.InvalidTokenError("state/provider mismatch")


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except ValueError:
        return False


def _create_token(
    subject: str,
    token_type: str,
    expires_delta: timedelta,
    extra_claims: dict[str, Any] | None = None,
) -> tuple[str, str]:
    """Return (token, jti) for the given subject and lifetime."""
    now = datetime.now(timezone.utc)
    jti = uuid.uuid4().hex
    payload: dict[str, Any] = {
        "sub": subject,
        "type": token_type,
        "iat": now,
        "exp": now + expires_delta,
        "jti": jti,
    }
    if extra_claims:
        payload.update(extra_claims)
    token = jwt.encode(payload, settings.jwt_secret_key, settings.jwt_algorithm)
    return token, jti


def create_access_token(user_id: uuid.UUID, email: str) -> str:
    token, _ = _create_token(
        str(user_id),
        ACCESS_TYPE,
        timedelta(minutes=settings.jwt_access_token_expire_minutes),
        {"email": email},
    )
    return token


def create_refresh_token(user_id: uuid.UUID) -> tuple[str, str]:
    """Return (token, jti) so callers can persist and revoke refreshes."""
    return _create_token(
        str(user_id), REFRESH_TYPE, timedelta(days=settings.jwt_refresh_token_expire_days)
    )


def decode_token(token: str, expected_type: str) -> dict[str, Any]:
    """Decode and validate a JWT of the expected type.

    Raises jwt.PyJWTError on bad signature/expiry/type mismatch.
    """
    payload = jwt.decode(
        token, settings.jwt_secret_key, algorithms=[settings.jwt_algorithm]
    )
    if payload.get("type") != expected_type:
        raise jwt.InvalidTokenError(f"expected {expected_type} token")
    return payload
