from typing import Optional
from fastapi import HTTPException
from src.config.database import fetch, fetchrow, execute

VIRTUAL_WH = "00000000-0000-0000-0000-000000000001"


async def list_warehouses():
    return await fetch(
        """SELECT w.*, COUNT(l.id) AS location_count
           FROM warehouses w
           LEFT JOIN locations l ON l.warehouse_id = w.id AND l.is_active=true
           WHERE w.id != $1
           GROUP BY w.id ORDER BY w.name""",
        VIRTUAL_WH,
    )


async def get_warehouse(warehouse_id: str) -> dict:
    wh = await fetchrow("SELECT * FROM warehouses WHERE id=$1", warehouse_id)
    if not wh:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    locs = await fetch(
        """SELECT l.*, p.name AS parent_name
           FROM locations l
           LEFT JOIN locations p ON p.id = l.parent_id
           WHERE l.warehouse_id=$1 AND l.is_active=true
           ORDER BY l.type, l.name""",
        warehouse_id,
    )
    return {**dict(wh), "locations": locs}


async def create_warehouse(name: str, code: str, address: Optional[str]) -> dict:
    row = await fetchrow(
        "INSERT INTO warehouses (name, code, address) VALUES ($1,$2,$3) RETURNING *",
        name, code, address,
    )
    return dict(row)


async def update_warehouse(warehouse_id: str, name: str, address: Optional[str], is_active: Optional[bool]) -> dict:
    row = await fetchrow(
        "UPDATE warehouses SET name=$1, address=$2, is_active=COALESCE($3,is_active) WHERE id=$4 RETURNING *",
        name, address, is_active, warehouse_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return dict(row)


async def list_locations(warehouse_id: Optional[str] = None, loc_type: Optional[str] = None):
    fp = [VIRTUAL_WH]
    fc = ["l.is_active=true", "l.warehouse_id != $1"]

    if warehouse_id:
        fp.append(warehouse_id)
        fc.append(f"l.warehouse_id=${len(fp)}")
    if loc_type:
        fp.append(loc_type)
        fc.append(f"l.type=${len(fp)}")

    where = " AND ".join(fc)
    return await fetch(
        f"""SELECT l.*, w.name AS warehouse_name, p.name AS parent_name
            FROM locations l
            JOIN warehouses w ON w.id = l.warehouse_id
            LEFT JOIN locations p ON p.id = l.parent_id
            WHERE {where}
            ORDER BY w.name, l.type, l.name""",
        *fp,
    )


async def create_location(
    warehouse_id: str,
    name: str,
    code: str,
    loc_type: str,
    parent_id: Optional[str] = None,
) -> dict:
    row = await fetchrow(
        "INSERT INTO locations (warehouse_id, parent_id, name, code, type) VALUES ($1,$2,$3,$4,$5) RETURNING *",
        warehouse_id, parent_id, name, code, loc_type,
    )
    return dict(row)


async def update_location(location_id: str, name: Optional[str], is_active: Optional[bool]) -> dict:
    row = await fetchrow(
        "UPDATE locations SET name=COALESCE($1,name), is_active=COALESCE($2,is_active) WHERE id=$3 RETURNING *",
        name, is_active, location_id,
    )
    if not row:
        raise HTTPException(status_code=404, detail="Location not found")
    return dict(row)


async def get_location_stock(location_id: str):
    return await fetch(
        """SELECT ss.*, p.name AS product_name, p.sku, u.abbreviation AS uom
           FROM stock_snapshot ss
           JOIN products p ON p.id = ss.product_id
           LEFT JOIN units_of_measure u ON u.id = p.uom_id
           WHERE ss.location_id=$1 AND ss.qty_on_hand > 0
           ORDER BY p.name""",
        location_id,
    )
