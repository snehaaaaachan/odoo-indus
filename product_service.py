from typing import Optional
from uuid import UUID
from fastapi import HTTPException
from src.config.database import fetch, fetchrow, execute, get_connection
from src.events.event_bus import event_bus, EVENTS


# ── Categories ─────────────────────────────────────────────────
async def list_categories():
    return await fetch("SELECT * FROM categories ORDER BY name")


async def create_category(name: str, description: Optional[str]) -> dict:
    row = await fetchrow(
        "INSERT INTO categories (name, description) VALUES ($1,$2) RETURNING *",
        name, description,
    )
    return dict(row)


# ── Units of Measure ───────────────────────────────────────────
async def list_uoms():
    return await fetch("SELECT * FROM units_of_measure ORDER BY name")


async def create_uom(name: str, abbreviation: str) -> dict:
    row = await fetchrow(
        "INSERT INTO units_of_measure (name, abbreviation) VALUES ($1,$2) RETURNING *",
        name, abbreviation,
    )
    return dict(row)


# ── Products ───────────────────────────────────────────────────
async def list_products(
    page: int = 1,
    limit: int = 20,
    category_id: Optional[str] = None,
    search: Optional[str] = None,
    is_active: Optional[bool] = None,
):
    fp = [is_active]          # $1
    fc = ["p.is_active = COALESCE($1, p.is_active)"]

    if category_id:
        fp.append(category_id)
        fc.append(f"p.category_id = ${len(fp)}")
    if search:
        fp.append(f"%{search}%")
        fc.append(f"(p.name ILIKE ${len(fp)} OR p.sku ILIKE ${len(fp)})")

    where = " AND ".join(fc)

    count_val = await fetchrow(
        f"SELECT COUNT(*) AS cnt FROM products p WHERE {where}", *fp
    )
    total = count_val["cnt"]

    fp_main = fp + [limit, (page - 1) * limit]
    lim_n = len(fp_main) - 1
    off_n = len(fp_main)

    rows = await fetch(
        f"""SELECT p.*, c.name AS category_name,
                   u.name AS uom_name, u.abbreviation AS uom_abbr,
                   COALESCE(SUM(ss.qty_on_hand), 0)  AS total_qty_on_hand,
                   COALESCE(SUM(ss.qty_available), 0) AS total_qty_available
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN units_of_measure u ON u.id = p.uom_id
            LEFT JOIN stock_snapshot ss ON ss.product_id = p.id
            WHERE {where}
            GROUP BY p.id, c.name, u.name, u.abbreviation
            ORDER BY p.created_at DESC
            LIMIT ${lim_n} OFFSET ${off_n}""",
        *fp_main,
    )
    return {"products": rows, "total": total, "page": page, "limit": limit}


async def get_product(product_id: str) -> dict:
    row = await fetchrow(
        """SELECT p.*, c.name AS category_name, u.name AS uom_name, u.abbreviation AS uom_abbr
           FROM products p
           LEFT JOIN categories c ON c.id = p.category_id
           LEFT JOIN units_of_measure u ON u.id = p.uom_id
           WHERE p.id = $1""",
        product_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")

    stock = await fetch(
        """SELECT ss.*, l.name AS location_name, l.code AS location_code, w.name AS warehouse_name
           FROM stock_snapshot ss
           JOIN locations l ON l.id = ss.location_id
           JOIN warehouses w ON w.id = l.warehouse_id
           WHERE ss.product_id = $1""",
        product_id,
    )
    return {**dict(row), "stock_by_location": stock}


async def create_product(data: dict, user_id: str) -> dict:
    async with get_connection() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                """INSERT INTO products (name, sku, category_id, uom_id, description,
                   reorder_point, reorder_qty, created_by)
                   VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *""",
                data["name"], data["sku"], data.get("category_id"),
                data.get("uom_id"), data.get("description"),
                data.get("reorder_point", 0), data.get("reorder_qty", 0), user_id,
            )
            product = dict(row)

            initial_stock = data.get("initial_stock")
            initial_loc   = data.get("initial_location_id")
            if initial_stock and initial_stock > 0 and initial_loc:
                await conn.execute(
                    """INSERT INTO stock_snapshot (product_id, location_id, qty_on_hand)
                       VALUES ($1,$2,$3)
                       ON CONFLICT (product_id, location_id) DO UPDATE
                       SET qty_on_hand=$3, updated_at=NOW()""",
                    product["id"], initial_loc, initial_stock,
                )
                await conn.execute(
                    """INSERT INTO stock_ledger
                       (product_id, dest_location_id, movement_type,
                        qty_delta, qty_before, qty_after, document_type, performed_by)
                       VALUES ($1,$2,'initial',$3,0,$3,'initial',$4)""",
                    product["id"], initial_loc, initial_stock, user_id,
                )

    await event_bus.emit(EVENTS.PRODUCT_CREATED, {"product_id": str(product["id"])})
    return product


async def update_product(product_id: str, data: dict) -> dict:
    fields = {k: v for k, v in data.items() if v is not None}
    if not fields:
        raise HTTPException(status_code=400, detail="No fields to update")

    set_parts = []
    values = []
    for i, (k, v) in enumerate(fields.items(), start=1):
        set_parts.append(f"{k}=${i}")
        values.append(v)
    values.append(product_id)

    row = await fetchrow(
        f"UPDATE products SET {', '.join(set_parts)}, updated_at=NOW() "
        f"WHERE id=${len(values)} RETURNING *",
        *values,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    await event_bus.emit(EVENTS.PRODUCT_UPDATED, {"product_id": product_id})
    return dict(row)


async def get_stock_by_location(product_id: str):
    return await fetch(
        """SELECT ss.*, l.name AS location_name, l.code, w.name AS warehouse_name
           FROM stock_snapshot ss
           JOIN locations l ON l.id = ss.location_id
           JOIN warehouses w ON w.id = l.warehouse_id
           WHERE ss.product_id = $1""",
        product_id,
    )
