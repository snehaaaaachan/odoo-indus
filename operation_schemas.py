from pydantic import BaseModel, field_validator
from typing import List, Optional
from uuid import UUID


# ── Shared ─────────────────────────────────────────────────────
class ItemIn(BaseModel):
    product_id: UUID
    qty_expected: Optional[float] = None   # receipts
    qty_demand:   Optional[float] = None   # deliveries / transfers
    qty_counted:  Optional[float] = None   # adjustments


class ItemDone(BaseModel):
    product_id: UUID
    qty_done: float

    @field_validator("qty_done")
    @classmethod
    def qty_positive(cls, v):
        if v <= 0:
            raise ValueError("qty_done must be positive")
        return v


# ── Receipts ───────────────────────────────────────────────────
class ReceiptCreate(BaseModel):
    dest_location_id: UUID
    supplier: Optional[str] = None
    notes: Optional[str] = None
    items: List[ItemIn]

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("At least one item required")
        return v


class ReceiptValidate(BaseModel):
    items: List[ItemDone]


# ── Deliveries ─────────────────────────────────────────────────
class DeliveryCreate(BaseModel):
    source_location_id: UUID
    customer: Optional[str] = None
    notes: Optional[str] = None
    items: List[ItemIn]

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("At least one item required")
        return v


class DeliveryValidate(BaseModel):
    items: List[ItemDone]


# ── Transfers ──────────────────────────────────────────────────
class TransferCreate(BaseModel):
    source_location_id: UUID
    dest_location_id: UUID
    notes: Optional[str] = None
    scheduled_at: Optional[str] = None
    items: List[ItemIn]

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("At least one item required")
        return v


class TransferValidate(BaseModel):
    items: List[ItemDone]


# ── Adjustments ────────────────────────────────────────────────
class AdjustmentCreate(BaseModel):
    location_id: UUID
    reason: Optional[str] = None
    items: List[ItemIn]

    @field_validator("items")
    @classmethod
    def items_not_empty(cls, v):
        if not v:
            raise ValueError("At least one item required")
        return v
