"""HTTP schemas for the authentication endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, model_validator

from app.core.security import validate_password_strength


class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=255)

    @model_validator(mode="after")
    def _password_policy(self):
        validate_password_strength(self.password, email=self.email)
        return self


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


class ForgotPasswordIn(BaseModel):
    email: EmailStr


class ResetPasswordIn(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _password_policy(self):
        validate_password_strength(self.new_password, email=self.email)
        return self


class ChangePasswordIn(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _password_policy(self):
        validate_password_strength(self.new_password)
        return self


class UserOut(BaseModel):
    id: uuid.UUID
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


class SessionOut(BaseModel):
    """One live session of the account, as listed for management."""

    id: int
    created_at: datetime
    user_agent: str | None
    current: bool
