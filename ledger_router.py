from typing import Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from src.modules.ledger import ledger_service
from src.middleware.auth import get_current_user

router = APIRouter()


@router.get("/moves")
async def get_move_history(
    product_id:    Optional[str] = Query(None),
    location_id:   Optional[str] = Query(None),
    movement_type: Optional[str] = Query(None),
    date_from:     Optional[str] = Query(None),
    date_to:       Optional[str] = Query(None),
    page:          int           = Query(1, ge=1),
    limit:         int           = Query(50, ge=1, le=200),
    _: dict = Depends(get_current_user),
):
    data = await ledger_service.get_move_history(
        product_id=product_id,
        location_id=location_id,
        movement_type=movement_type,
        date_from=date_from,
        date_to=date_to,
        page=page,
        limit=limit,
    )
    return {"success": True, "data": data}


@router.get("/replay")
async def replay_stock(
    at:          str           = Query(..., description="ISO timestamp e.g. 2024-11-01T00:00:00Z"),
    product_id:  Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    _: dict = Depends(get_current_user),
):
    data = await ledger_service.replay_stock_at(
        at_timestamp=at,
        product_id=product_id,
        location_id=location_id,
    )
    return {"success": True, "data": data}
