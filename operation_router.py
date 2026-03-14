from typing import Optional
from fastapi import APIRouter, Depends, Query
from src.modules.operations.operation_schemas import (
    ReceiptCreate, ReceiptValidate,
    DeliveryCreate, DeliveryValidate,
    TransferCreate, TransferValidate,
    AdjustmentCreate,
)
from src.modules.operations import operation_service as svc
from src.middleware.auth import get_current_user, require_manager

router = APIRouter()

# ── RECEIPTS ──────────────────────────────────────────────────
@router.get("/receipts")
async def list_receipts(
    status:      Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    warehouse_id:Optional[str] = Query(None),
    page:  int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    return {"success": True, "data": await svc.list_receipts(status, location_id, warehouse_id, page, limit)}

@router.post("/receipts", status_code=201)
async def create_receipt(body: ReceiptCreate, user: dict = Depends(get_current_user)):
    return {"success": True, "data": await svc.create_receipt(body.model_dump(), str(user["id"]))}

@router.get("/receipts/{receipt_id}")
async def get_receipt(receipt_id: str, _: dict = Depends(get_current_user)):
    return {"success": True, "data": await svc.get_receipt(receipt_id)}

@router.post("/receipts/{receipt_id}/validate")
async def validate_receipt(receipt_id: str, body: ReceiptValidate, user: dict = Depends(require_manager)):
    items = [i.model_dump() for i in body.items]
    return {"success": True, "data": await svc.validate_receipt(receipt_id, items, str(user["id"]))}

@router.post("/receipts/{receipt_id}/cancel")
async def cancel_receipt(receipt_id: str, _: dict = Depends(require_manager)):
    return {"success": True, "data": await svc.cancel_receipt(receipt_id)}


# ── DELIVERIES ────────────────────────────────────────────────
@router.get("/deliveries")
async def list_deliveries(
    status:      Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    warehouse_id:Optional[str] = Query(None),
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    return {"success": True, "data": await svc.list_deliveries(status, location_id, warehouse_id, page, limit)}

@router.post("/deliveries", status_code=201)
async def create_delivery(body: DeliveryCreate, user: dict = Depends(get_current_user)):
    return {"success": True, "data": await svc.create_delivery(body.model_dump(), str(user["id"]))}

@router.get("/deliveries/{delivery_id}")
async def get_delivery(delivery_id: str, _: dict = Depends(get_current_user)):
    return {"success": True, "data": await svc.get_delivery(delivery_id)}

@router.post("/deliveries/{delivery_id}/validate")
async def validate_delivery(delivery_id: str, body: DeliveryValidate, user: dict = Depends(require_manager)):
    items = [i.model_dump() for i in body.items]
    return {"success": True, "data": await svc.validate_delivery(delivery_id, items, str(user["id"]))}

@router.post("/deliveries/{delivery_id}/cancel")
async def cancel_delivery(delivery_id: str, _: dict = Depends(require_manager)):
    return {"success": True, "data": await svc.cancel_delivery(delivery_id)}


# ── TRANSFERS ─────────────────────────────────────────────────
@router.get("/transfers")
async def list_transfers(
    status:             Optional[str] = Query(None),
    source_location_id: Optional[str] = Query(None),
    dest_location_id:   Optional[str] = Query(None),
    warehouse_id:       Optional[str] = Query(None),
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    return {"success": True, "data": await svc.list_transfers(status, source_location_id, dest_location_id, warehouse_id, page, limit)}

@router.post("/transfers", status_code=201)
async def create_transfer(body: TransferCreate, user: dict = Depends(get_current_user)):
    return {"success": True, "data": await svc.create_transfer(body.model_dump(), str(user["id"]))}

@router.get("/transfers/{transfer_id}")
async def get_transfer(transfer_id: str, _: dict = Depends(get_current_user)):
    return {"success": True, "data": await svc.get_transfer(transfer_id)}

@router.post("/transfers/{transfer_id}/validate")
async def validate_transfer(transfer_id: str, body: TransferValidate, user: dict = Depends(require_manager)):
    items = [i.model_dump() for i in body.items]
    return {"success": True, "data": await svc.validate_transfer(transfer_id, items, str(user["id"]))}

@router.post("/transfers/{transfer_id}/cancel")
async def cancel_transfer(transfer_id: str, _: dict = Depends(require_manager)):
    return {"success": True, "data": await svc.cancel_transfer(transfer_id)}


# ── ADJUSTMENTS ───────────────────────────────────────────────
@router.get("/adjustments")
async def list_adjustments(
    status:      Optional[str] = Query(None),
    location_id: Optional[str] = Query(None),
    warehouse_id:Optional[str] = Query(None),
    page: int = Query(1, ge=1), limit: int = Query(20, ge=1, le=100),
    _: dict = Depends(get_current_user),
):
    return {"success": True, "data": await svc.list_adjustments(status, location_id, warehouse_id, page, limit)}

@router.post("/adjustments", status_code=201)
async def create_adjustment(body: AdjustmentCreate, user: dict = Depends(get_current_user)):
    return {"success": True, "data": await svc.create_adjustment(body.model_dump(), str(user["id"]))}

@router.get("/adjustments/{adjustment_id}")
async def get_adjustment(adjustment_id: str, _: dict = Depends(get_current_user)):
    return {"success": True, "data": await svc.get_adjustment(adjustment_id)}

@router.post("/adjustments/{adjustment_id}/validate")
async def validate_adjustment(adjustment_id: str, user: dict = Depends(require_manager)):
    return {"success": True, "data": await svc.validate_adjustment(adjustment_id, str(user["id"]))}
