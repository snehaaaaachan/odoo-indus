import random
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException
from jose import jwt
from passlib.context import CryptContext

from src.config.database import fetchrow, execute, fetch
from src.config.settings import settings
from src.utils.email import send_otp_email

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


def _make_token(user_id: str, role: str) -> str:
    expire = datetime.now(timezone.utc) + timedelta(minutes=settings.JWT_EXPIRES_MINUTES)
    return jwt.encode(
        {"user_id": user_id, "role": role, "exp": expire},
        settings.JWT_SECRET,
        algorithm="HS256",
    )


async def signup(name: str, email: str, password: str, role: str) -> dict:
    existing = await fetchrow("SELECT id FROM users WHERE email=$1", email)
    if existing:
        raise HTTPException(status_code=409, detail="Email already registered")

    hashed = pwd_ctx.hash(password)
    user = await fetchrow(
        """INSERT INTO users (name, email, password, role)
           VALUES ($1, $2, $3, $4)
           RETURNING id, name, email, role, created_at""",
        name, email, hashed, role,
    )
    return dict(user)


async def login(email: str, password: str) -> dict:
    user = await fetchrow(
        "SELECT * FROM users WHERE email=$1 AND is_active=true", email
    )
    if not user or not pwd_ctx.verify(password, user["password"]):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    token = _make_token(str(user["id"]), user["role"])
    return {
        "token": token,
        "user": {
            "id": str(user["id"]),
            "name": user["name"],
            "email": user["email"],
            "role": user["role"],
        },
    }


async def send_otp(email: str) -> dict:
    user = await fetchrow(
        "SELECT id FROM users WHERE email=$1 AND is_active=true", email
    )
    if not user:
        raise HTTPException(status_code=404, detail="No active account with that email")

    otp = str(random.randint(100000, 999999))
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=settings.OTP_EXPIRES_MINUTES)

    await execute(
        "INSERT INTO otp_tokens (user_id, email, otp, expires_at) VALUES ($1,$2,$3,$4)",
        user["id"], email, otp, expires_at,
    )

    try:
        await send_otp_email(email, otp)
    except Exception as e:
        print(f"Email error: {e}")
        raise HTTPException(status_code=500, detail="Failed to send OTP email")

    return {"message": "OTP sent to email"}


async def verify_otp_and_reset(email: str, otp: str, new_password: str) -> dict:
    record = await fetchrow(
        """SELECT * FROM otp_tokens
           WHERE email=$1 AND otp=$2 AND used=false AND expires_at > NOW()
           ORDER BY created_at DESC LIMIT 1""",
        email, otp,
    )
    if not record:
        raise HTTPException(status_code=400, detail="Invalid or expired OTP")

    hashed = pwd_ctx.hash(new_password)
    await execute(
        "UPDATE users SET password=$1, updated_at=NOW() WHERE email=$2", hashed, email
    )
    await execute(
        "UPDATE otp_tokens SET used=true WHERE id=$1", record["id"]
    )
    return {"message": "Password reset successful"}


async def get_profile(user_id: str) -> dict:
    user = await fetchrow(
        "SELECT id, name, email, role, created_at FROM users WHERE id=$1", user_id
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)


async def update_profile(user_id: str, name: str) -> dict:
    user = await fetchrow(
        "UPDATE users SET name=$1, updated_at=NOW() WHERE id=$2 RETURNING id, name, email, role",
        name, user_id,
    )
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return dict(user)
