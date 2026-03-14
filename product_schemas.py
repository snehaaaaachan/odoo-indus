from pydantic import BaseModel, field_validator
from typing import Optional
from uuid import UUID


class CategoryCreate(BaseModel):
    name: str
    description: Optional[str] = None


class UomCreate(BaseModel):
    name: str
    abbreviation: str


class ProductCreate(BaseModel):
    name: str
    sku: str
    category_id: Optional[UUID] = None
    uom_id: Optional[UUID] = None
    description: Optional[str] = None
    reorder_point: float = 0
    reorder_qty: float = 0
    initial_stock: Optional[float] = None
    initial_location_id: Optional[UUID] = None

    @field_validator("sku")
    @classmethod
    def sku_not_empty(cls, v):
        if not v.strip():
            raise ValueError("SKU cannot be empty")
        return v.strip().upper()


class ProductUpdate(BaseModel):
    name: Optional[str] = None
    category_id: Optional[UUID] = None
    uom_id: Optional[UUID] = None
    description: Optional[str] = None
    reorder_point: Optional[float] = None
    reorder_qty: Optional[float] = None
    is_active: Optional[bool] = None
