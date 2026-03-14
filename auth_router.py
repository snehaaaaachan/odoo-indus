from fastapi import APIRouter, Depends
from src.modules.auth.auth_schemas import (
    SignupRequest, LoginRequest, ForgotPasswordRequest,
    ResetPasswordRequest, UpdateProfileRequest,
)
from src.modules.auth import auth_service
from src.middleware.auth import get_current_user

router = APIRouter()


@router.post("/signup", status_code=201)
async def signup(body: SignupRequest):
    data = await auth_service.signup(body.name, body.email, body.password, body.role.value)
    return {"success": True, "data": data}


@router.post("/login")
async def login(body: LoginRequest):
    data = await auth_service.login(body.email, body.password)
    return {"success": True, "data": data}


@router.post("/forgot-password")
async def forgot_password(body: ForgotPasswordRequest):
    data = await auth_service.send_otp(body.email)
    return {"success": True, "data": data}


@router.post("/reset-password")
async def reset_password(body: ResetPasswordRequest):
    data = await auth_service.verify_otp_and_reset(body.email, body.otp, body.new_password)
    return {"success": True, "data": data}


@router.get("/profile")
async def get_profile(current_user: dict = Depends(get_current_user)):
    data = await auth_service.get_profile(str(current_user["id"]))
    return {"success": True, "data": data}


@router.put("/profile")
async def update_profile(
    body: UpdateProfileRequest,
    current_user: dict = Depends(get_current_user),
):
    data = await auth_service.update_profile(str(current_user["id"]), body.name)
    return {"success": True, "data": data}
