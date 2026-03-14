from src.config.database import fetch, fetchrow


# Virtual location UUIDs (must match schema)
VENDOR_LOC   = "00000000-0000-0000-0001-000000000001"
CUSTOMER_LOC = "00000000-0000-0000-0001-000000000002"
SCRAP_LOC    = "00000000-0000-0000-0001-000000000003"


async def create_entry(conn, *, product_id, source_location_id, dest_location_id,
                       movement_type, qty_delta, document_type, document_id, performed_by):
    """
    Create one immutable ledger row inside an existing transaction.
    Returns the row as a dict.
    """
    loc_id = dest_location_id if movement_type in ("receipt", "transfer_in", "adjustment", "initial") \
             else source_location_id

    snap = await conn.fetchrow(
        "SELECT qty_on_hand FROM stock_snapshot WHERE product_id=$1 AND location_id=$2",
        product_id, loc_id,
    )
    qty_before = float(snap["qty_on_hand"]) if snap else 0.0
    qty_after  = round(qty_before + float(qty_delta), 6)

    row = await conn.fetchrow(
        """INSERT INTO stock_ledger
             (product_id, source_location_id, dest_location_id, movement_type,
              qty_delta, qty_before, qty_after, document_type, document_id, performed_by)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
           RETURNING *""",
        product_id,
        source_location_id or None,
        dest_location_id   or None,
        movement_type,
        qty_delta,
        qty_before,
        qty_after,
        document_type,
        document_id,
        performed_by,
    )
    return dict(row)


async def update_snapshot(conn, *, product_id, location_id, qty_delta):
    """Upsert the live stock twin inside a transaction."""
    await conn.execute(
        """INSERT INTO stock_snapshot (product_id, location_id, qty_on_hand)
           VALUES ($1, $2, GREATEST(0, $3))
           ON CONFLICT (product_id, location_id) DO UPDATE
           SET qty_on_hand = GREATEST(0, stock_snapshot.qty_on_hand + $3),
               updated_at  = NOW()""",
        product_id, location_id, qty_delta,
    )


async def get_move_history(
    product_id=None, location_id=None, movement_type=None,
    date_from=None, date_to=None, page=1, limit=50,
):
    fp, fc = [], []

    if product_id:
        fp.append(product_id)
        fc.append(f"sl.product_id = ${len(fp)}")
    if location_id:
        fp.append(location_id)
        fc.append(f"(sl.source_location_id = ${len(fp)} OR sl.dest_location_id = ${len(fp)})")
    if movement_type:
        fp.append(movement_type)
        fc.append(f"sl.movement_type = ${len(fp)}")
    if date_from:
        fp.append(date_from)
        fc.append(f"sl.created_at >= ${len(fp)}")
    if date_to:
        fp.append(date_to)
        fc.append(f"sl.created_at <= ${len(fp)}")

    where = f"WHERE {' AND '.join(fc)}" if fc else ""

    total = await fetchrow(
        f"SELECT COUNT(*) AS cnt FROM stock_ledger sl {where}", *fp
    )

    mp = fp + [limit, (page - 1) * limit]
    lim_n = len(mp) - 1
    off_n = len(mp)

    rows = await fetch(
        f"""SELECT sl.*,
                   p.name   AS product_name, p.sku,
                   src.name AS source_location_name,
                   dst.name AS dest_location_name,
                   u.name   AS performed_by_name
            FROM stock_ledger sl
            JOIN     products   p   ON p.id   = sl.product_id
            LEFT JOIN locations src ON src.id = sl.source_location_id
            LEFT JOIN locations dst ON dst.id = sl.dest_location_id
            LEFT JOIN users     u   ON u.id   = sl.performed_by
            {where}
            ORDER BY sl.created_at DESC
            LIMIT ${lim_n} OFFSET ${off_n}""",
        *mp,
    )
    return {"entries": rows, "total": total["cnt"], "page": page, "limit": limit}


async def replay_stock_at(at_timestamp, product_id=None, location_id=None):
    """Inventory Replay Mode — time-travel to any historical stock state."""
    params = [at_timestamp]
    conds  = ["sl.created_at <= $1"]

    if product_id:
        params.append(product_id)
        conds.append(f"sl.product_id = ${len(params)}")
    if location_id:
        params.append(location_id)
        conds.append(
            f"(sl.dest_location_id = ${len(params)} OR sl.source_location_id = ${len(params)})"
        )

    where = " AND ".join(conds)

    rows = await fetch(
        f"""SELECT
               p.id   AS product_id,
               p.name AS product_name,
               p.sku,
               loc.id   AS location_id,
               loc.name AS location_name,
               SUM(
                 CASE
                   WHEN sl.dest_location_id   = loc.id THEN  sl.qty_delta
                   WHEN sl.source_location_id = loc.id THEN -sl.qty_delta
                   ELSE 0
                 END
               ) AS qty_at_time
            FROM stock_ledger sl
            JOIN products p ON p.id = sl.product_id
            JOIN (
               SELECT DISTINCT id, name FROM locations
               WHERE id NOT IN ($1::uuid, $2::uuid, $3::uuid)
            ) loc ON loc.id = sl.dest_location_id OR loc.id = sl.source_location_id
            WHERE {where}
            GROUP BY p.id, p.name, p.sku, loc.id, loc.name
            HAVING SUM(
              CASE
                WHEN sl.dest_location_id   = loc.id THEN  sl.qty_delta
                WHEN sl.source_location_id = loc.id THEN -sl.qty_delta
                ELSE 0
              END
            ) <> 0
            ORDER BY p.name, loc.name""",
        VENDOR_LOC, CUSTOMER_LOC, SCRAP_LOC, *params,
    )
    return {"replayed_at": str(at_timestamp), "entries": rows}
