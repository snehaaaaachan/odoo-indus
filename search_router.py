from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from src.modules.search import search_service
from src.middleware.auth import get_current_user

router = APIRouter()


@router.get("/")
async def global_search(
    q:     str = Query(..., min_length=2, description="Search query"),
    limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    data = await search_service.global_search(q, limit)
    return {"success": True, "data": data}


@router.get("/sku")
async def search_by_sku(
    sku: str = Query(..., min_length=1, description="SKU code"),
    _: dict   = Depends(get_current_user),
):
    data = await search_service.search_by_sku(sku)
    return {"success": True, "data": data}


@router.get("/filter")
async def smart_filter(
    type:         Optional[str] = Query(None, description="receipt|delivery|transfer|adjustment"),
    status:       Optional[str] = Query(None, description="draft|waiting|ready|done|cancelled"),
    warehouse_id: Optional[str] = Query(None),
    date_from:    Optional[str] = Query(None, description="ISO date e.g. 2024-01-01"),
    date_to:      Optional[str] = Query(None, description="ISO date e.g. 2024-12-31"),
    page:         int           = Query(1, ge=1),
    limit:        int           = Query(30, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    data = await search_service.smart_filter(
        type_=type,
        status=status,
        warehouse_id=warehouse_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        limit=limit,
    )
    return {"success": True, "data": data}
