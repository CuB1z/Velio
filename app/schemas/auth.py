"""HTTP schemas for the authentication endpoints."""

from pydantic import BaseModel, EmailStr, Field


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=255)


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class RefreshIn(BaseModel):
    refresh_token: str


class VerifyIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendVerificationIn(BaseModel):
    email: EmailStr


class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    status: str

    @classmethod
    def from_model(cls, user) -> "UserOut":
        status = getattr(user.status, "value", user.status)
        return cls(
            id=user.id,
            email=user.email,
            full_name=user.full_name,
            status=status,
        )


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthSession(BaseModel):
    """Everything a client needs after a successful login."""

    user: UserOut
    tokens: TokenPair
