from typing import Optional
from fastapi import APIRouter, Depends, Query
from src.modules.dashboard import dashboard_projection
from src.modules.ledger.stock_twin_service import get_global_snapshot, get_low_stock_products
from src.middleware.auth import get_current_user

router = APIRouter()


@router.get("/kpis")
async def get_kpis(_: dict = Depends(get_current_user)):
    return {"success": True, "data": await dashboard_projection.get_kpis()}


@router.get("/operations")
async def get_operations_list(
    type:         Optional[str] = Query(None, description="receipt|delivery|transfer|adjustment"),
    status:       Optional[str] = Query(None, description="draft|waiting|ready|done|cancelled"),
    warehouse_id: Optional[str] = Query(None),
    page:  int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    data = await dashboard_projection.get_operations_list(type, status, warehouse_id, page, limit)
    return {"success": True, "data": data}


@router.get("/stock")
async def get_global_stock(_: dict = Depends(get_current_user)):
    return {"success": True, "data": await get_global_snapshot()}


@router.get("/low-stock")
async def get_low_stock(_: dict = Depends(get_current_user)):
    return {"success": True, "data": await get_low_stock_products()}
