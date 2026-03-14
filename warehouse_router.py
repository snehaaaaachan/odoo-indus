from typing import Optional
from uuid import UUID
from pydantic import BaseModel
from fastapi import APIRouter, Depends, Query
from src.modules.warehouses import warehouse_service
from src.middleware.auth import get_current_user, require_manager


class WarehouseCreate(BaseModel):
    name: str
    code: str
    address: Optional[str] = None


class WarehouseUpdate(BaseModel):
    name: str
    address: Optional[str] = None
    is_active: Optional[bool] = None


class LocationCreate(BaseModel):
    warehouse_id: UUID
    name: str
    code: str
    type: str
    parent_id: Optional[UUID] = None


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    is_active: Optional[bool] = None


router = APIRouter()

# ── IMPORTANT: specific paths before /{id} to prevent routing collisions ──

@router.get("/locations/all")
async def list_locations(
    warehouse_id: Optional[str] = Query(None),
    type:         Optional[str] = Query(None),
    _: dict = Depends(get_current_user),
):
    data = await warehouse_service.list_locations(warehouse_id, type)
    return {"success": True, "data": data}


@router.post("/locations", status_code=201)
async def create_location(body: LocationCreate, _: dict = Depends(require_manager)):
    data = await warehouse_service.create_location(
        str(body.warehouse_id), body.name, body.code, body.type,
        str(body.parent_id) if body.parent_id else None,
    )
    return {"success": True, "data": data}


@router.put("/locations/{location_id}")
async def update_location(location_id: str, body: LocationUpdate, _: dict = Depends(require_manager)):
    data = await warehouse_service.update_location(location_id, body.name, body.is_active)
    return {"success": True, "data": data}


@router.get("/locations/{location_id}/stock")
async def get_location_stock(location_id: str, _: dict = Depends(get_current_user)):
    return {"success": True, "data": await warehouse_service.get_location_stock(location_id)}


# ── Warehouse CRUD (after specific paths) ────────────────────

@router.get("/")
async def list_warehouses(_: dict = Depends(get_current_user)):
    return {"success": True, "data": await warehouse_service.list_warehouses()}


@router.post("/", status_code=201)
async def create_warehouse(body: WarehouseCreate, _: dict = Depends(require_manager)):
    data = await warehouse_service.create_warehouse(body.name, body.code, body.address)
    return {"success": True, "data": data}


@router.get("/{warehouse_id}")
async def get_warehouse(warehouse_id: str, _: dict = Depends(get_current_user)):
    return {"success": True, "data": await warehouse_service.get_warehouse(warehouse_id)}


@router.put("/{warehouse_id}")
async def update_warehouse(warehouse_id: str, body: WarehouseUpdate, _: dict = Depends(require_manager)):
    data = await warehouse_service.update_warehouse(warehouse_id, body.name, body.address, body.is_active)
    return {"success": True, "data": data}
