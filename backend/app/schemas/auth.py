"""HTTP schemas for the authentication endpoints."""

import uuid
from datetime import datetime

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.core.security import validate_password_strength
from app.models import AuthProvider


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    full_name: str = Field(default="", max_length=255)

    @model_validator(mode="after")
    def _password_policy(self):
        validate_password_strength(self.password, email=self.email)
        return self


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class VerifyRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")


class ResendVerificationRequest(BaseModel):
    email: EmailStr


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _password_policy(self):
        validate_password_strength(self.new_password, email=self.email)
        return self


class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str = Field(min_length=8, max_length=128)

    @model_validator(mode="after")
    def _password_policy(self):
        validate_password_strength(self.new_password)
        return self


class ProfileUpdateRequest(BaseModel):
    full_name: str = Field(min_length=1, max_length=255)

    @field_validator("full_name")
    @classmethod
    def _tidy(cls, value: str) -> str:
        cleaned = " ".join(value.split())
        if not cleaned:
            raise ValueError("full_name must not be blank")
        return cleaned


class UserResponse(BaseModel):
    id: uuid.UUID
    email: str
    full_name: str
    status: str
    providers: list[AuthProvider]


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthSession(BaseModel):
    """Everything a client needs after a successful login."""

    user: UserResponse
    tokens: TokenPair


class SessionResponse(BaseModel):
    """One live session of the account, as listed for management."""

    id: int
    created_at: datetime
    user_agent: str | None
    current: bool


class DeleteAccountRequest(BaseModel):
    """Confirmation code for account deletion."""

    code: str = Field(min_length=6, max_length=6, pattern=r"^\d{6}$")
