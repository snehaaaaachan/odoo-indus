from typing import Optional
from fastapi import APIRouter, Depends, Query
from src.modules.alerts import alert_service
from src.middleware.auth import get_current_user

router = APIRouter()


# IMPORTANT: /mark-all-read MUST be before /{alert_id} to avoid FastAPI
# matching 'mark-all-read' as the alert_id path param
@router.put("/mark-all-read")
async def mark_all_read(_: dict = Depends(get_current_user)):
    await alert_service.mark_all_read()
    return {"success": True}


@router.get("/count")
async def get_unread_count(_: dict = Depends(get_current_user)):
    count = await alert_service.get_unread_count()
    return {"success": True, "data": {"unread": count}}


@router.get("/")
async def list_alerts(
    is_read: Optional[bool] = Query(None),
    type:    Optional[str]  = Query(None),
    page:    int            = Query(1, ge=1),
    limit:   int            = Query(30, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    data = await alert_service.list_alerts(is_read, type, page, limit)
    return {"success": True, "data": data}


@router.put("/{alert_id}/read")
async def mark_read(alert_id: str, _: dict = Depends(get_current_user)):
    await alert_service.mark_read(alert_id)
    return {"success": True}
