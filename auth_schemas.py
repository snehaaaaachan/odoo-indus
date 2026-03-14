from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from enum import Enum


class RoleEnum(str, Enum):
    manager = "inventory_manager"
    staff   = "warehouse_staff"


class SignupRequest(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: RoleEnum = RoleEnum.staff

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()

    @field_validator("password")
    @classmethod
    def password_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    email: EmailStr
    otp: str
    new_password: str

    @field_validator("otp")
    @classmethod
    def otp_length(cls, v):
        if len(v) != 6:
            raise ValueError("OTP must be 6 digits")
        return v

    @field_validator("new_password")
    @classmethod
    def password_length(cls, v):
        if len(v) < 6:
            raise ValueError("Password must be at least 6 characters")
        return v


class UpdateProfileRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v):
        if len(v.strip()) < 2:
            raise ValueError("Name must be at least 2 characters")
        return v.strip()
