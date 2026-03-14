from typing import Optional
from uuid import UUID
from fastapi import APIRouter, Depends, Query
from src.modules.products.product_schemas import CategoryCreate, UomCreate, ProductCreate, ProductUpdate
from src.modules.products import product_service
from src.middleware.auth import get_current_user, require_manager

router = APIRouter()


# ── Categories ────────────────────────────────────────────────
@router.get("/categories")
async def list_categories(_: dict = Depends(get_current_user)):
    return {"success": True, "data": await product_service.list_categories()}


@router.post("/categories", status_code=201)
async def create_category(body: CategoryCreate, _: dict = Depends(require_manager)):
    return {"success": True, "data": await product_service.create_category(body.name, body.description)}


# ── Units of Measure ──────────────────────────────────────────
@router.get("/uom")
async def list_uoms(_: dict = Depends(get_current_user)):
    return {"success": True, "data": await product_service.list_uoms()}


@router.post("/uom", status_code=201)
async def create_uom(body: UomCreate, _: dict = Depends(require_manager)):
    return {"success": True, "data": await product_service.create_uom(body.name, body.abbreviation)}


# ── Products ──────────────────────────────────────────────────
@router.get("/")
async def list_products(
    page:        int            = Query(1,    ge=1),
    limit:       int            = Query(20,   ge=1, le=100),
    category_id: Optional[str] = Query(None),
    search:      Optional[str] = Query(None),
    is_active:   Optional[bool] = Query(None),
    _: dict = Depends(get_current_user),
):
    data = await product_service.list_products(page, limit, category_id, search, is_active)
    return {"success": True, "data": data}


@router.post("/", status_code=201)
async def create_product(body: ProductCreate, current_user: dict = Depends(require_manager)):
    data = await product_service.create_product(body.model_dump(), str(current_user["id"]))
    return {"success": True, "data": data}


@router.get("/{product_id}")
async def get_product(product_id: str, _: dict = Depends(get_current_user)):
    return {"success": True, "data": await product_service.get_product(product_id)}


@router.put("/{product_id}")
async def update_product(product_id: str, body: ProductUpdate, _: dict = Depends(require_manager)):
    data = await product_service.update_product(product_id, body.model_dump(exclude_none=True))
    return {"success": True, "data": data}


@router.get("/{product_id}/stock")
async def get_stock(product_id: str, _: dict = Depends(get_current_user)):
    return {"success": True, "data": await product_service.get_stock_by_location(product_id)}
