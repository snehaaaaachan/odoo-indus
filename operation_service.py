from fastapi import HTTPException
from src.config.database import fetch, fetchrow, execute, get_connection
from src.modules.ledger.ledger_service import create_entry, update_snapshot, VENDOR_LOC, CUSTOMER_LOC, SCRAP_LOC
from src.events.event_bus import event_bus, EVENTS
from src.utils.ref_generator import next_ref


def _rows(rows): return [dict(r) for r in rows]


# ══════════════════════════════════════════════════════════════
# RECEIPTS
# ══════════════════════════════════════════════════════════════

async def list_receipts(status=None, location_id=None, warehouse_id=None, page=1, limit=20):
    fp, fc = [], []
    if status:      fp.append(status);      fc.append(f"r.status=${len(fp)}")
    if location_id: fp.append(location_id); fc.append(f"r.dest_location_id=${len(fp)}")
    if warehouse_id:fp.append(warehouse_id);fc.append(f"w.id=${len(fp)}")
    where = f"WHERE {' AND '.join(fc)}" if fc else ""

    total = await fetchrow(
        f"""SELECT COUNT(*) AS cnt FROM receipts r
            LEFT JOIN locations l ON l.id=r.dest_location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id {where}""", *fp
    )
    mp = fp + [limit, (page - 1) * limit]
    rows = await fetch(
        f"""SELECT r.*, u.name AS created_by_name,
                   l.name AS dest_location_name, w.name AS warehouse_name,
                   COUNT(ri.id)::int AS item_count
            FROM receipts r
            LEFT JOIN users u ON u.id=r.created_by
            LEFT JOIN locations l ON l.id=r.dest_location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id
            LEFT JOIN receipt_items ri ON ri.receipt_id=r.id
            {where} GROUP BY r.id, u.name, l.name, w.name
            ORDER BY r.created_at DESC
            LIMIT ${len(mp)-1} OFFSET ${len(mp)}""", *mp
    )
    return {"receipts": rows, "total": total["cnt"], "page": page, "limit": limit}


async def get_receipt(receipt_id: str) -> dict:
    row = await fetchrow(
        """SELECT r.*, l.name AS dest_location_name, w.name AS warehouse_name,
                  u.name AS created_by_name, v.name AS validated_by_name
           FROM receipts r
           LEFT JOIN locations l ON l.id=r.dest_location_id
           LEFT JOIN warehouses w ON w.id=l.warehouse_id
           LEFT JOIN users u ON u.id=r.created_by
           LEFT JOIN users v ON v.id=r.validated_by
           WHERE r.id=$1""", receipt_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Receipt not found")
    items = await fetch(
        """SELECT ri.*, p.name AS product_name, p.sku, um.abbreviation AS uom
           FROM receipt_items ri
           JOIN products p ON p.id=ri.product_id
           LEFT JOIN units_of_measure um ON um.id=p.uom_id
           WHERE ri.receipt_id=$1""", receipt_id
    )
    return {**dict(row), "items": items}


async def create_receipt(data: dict, user_id: str) -> dict:
    async with get_connection() as conn:
        async with conn.transaction():
            ref = await next_ref(conn, "REC", "receipt_seq")
            rec = await conn.fetchrow(
                """INSERT INTO receipts (reference, supplier, dest_location_id, notes, created_by)
                   VALUES ($1,$2,$3,$4,$5) RETURNING *""",
                ref, data.get("supplier"), str(data["dest_location_id"]),
                data.get("notes"), user_id,
            )
            for item in data["items"]:
                await conn.execute(
                    "INSERT INTO receipt_items (receipt_id, product_id, qty_expected) VALUES ($1,$2,$3)",
                    rec["id"], str(item["product_id"]), item.get("qty_expected", 0),
                )
    await event_bus.emit(EVENTS.RECEIPT_CREATED, {"receipt_id": str(rec["id"])})
    return await get_receipt(str(rec["id"]))


async def validate_receipt(receipt_id: str, items: list, user_id: str) -> dict:
    async with get_connection() as conn:
        async with conn.transaction():
            rec = await conn.fetchrow(
                "SELECT * FROM receipts WHERE id=$1 AND status IN ('draft','ready') FOR UPDATE",
                receipt_id,
            )
            if not rec:
                raise HTTPException(status_code=400, detail="Receipt not found or already processed")

            ledger_entries = []
            for item in items:
                qty = float(item["qty_done"])
                if qty <= 0:
                    continue
                await conn.execute(
                    "UPDATE receipt_items SET qty_done=$1 WHERE receipt_id=$2 AND product_id=$3",
                    qty, receipt_id, str(item["product_id"]),
                )
                entry = await create_entry(
                    conn,
                    product_id=str(item["product_id"]),
                    source_location_id=VENDOR_LOC,
                    dest_location_id=str(rec["dest_location_id"]),
                    movement_type="receipt",
                    qty_delta=qty,
                    document_type="receipt",
                    document_id=receipt_id,
                    performed_by=user_id,
                )
                await update_snapshot(conn, product_id=str(item["product_id"]),
                                      location_id=str(rec["dest_location_id"]), qty_delta=qty)
                ledger_entries.append(entry)

            if not ledger_entries:
                raise HTTPException(status_code=400, detail="No valid quantities to process")

            await conn.execute(
                "UPDATE receipts SET status='done', validated_at=NOW(), validated_by=$1, updated_at=NOW() WHERE id=$2",
                user_id, receipt_id,
            )

    await event_bus.emit(EVENTS.RECEIPT_VALIDATED, {"receipt_id": receipt_id, "ledger_entries": ledger_entries})
    return {"message": "Receipt validated", "ledger_entries": len(ledger_entries)}


async def cancel_receipt(receipt_id: str) -> dict:
    row = await fetchrow(
        "UPDATE receipts SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status IN ('draft','ready') RETURNING *",
        receipt_id,
    )
    if not row:
        raise HTTPException(status_code=400, detail="Cannot cancel this receipt")
    await event_bus.emit(EVENTS.RECEIPT_CANCELLED, {"receipt_id": receipt_id})
    return dict(row)


# ══════════════════════════════════════════════════════════════
# DELIVERIES
# ══════════════════════════════════════════════════════════════

async def list_deliveries(status=None, location_id=None, warehouse_id=None, page=1, limit=20):
    fp, fc = [], []
    if status:      fp.append(status);      fc.append(f"d.status=${len(fp)}")
    if location_id: fp.append(location_id); fc.append(f"d.source_location_id=${len(fp)}")
    if warehouse_id:fp.append(warehouse_id);fc.append(f"w.id=${len(fp)}")
    where = f"WHERE {' AND '.join(fc)}" if fc else ""

    total = await fetchrow(
        f"""SELECT COUNT(*) AS cnt FROM deliveries d
            LEFT JOIN locations l ON l.id=d.source_location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id {where}""", *fp
    )
    mp = fp + [limit, (page - 1) * limit]
    rows = await fetch(
        f"""SELECT d.*, u.name AS created_by_name,
                   l.name AS source_location_name, w.name AS warehouse_name,
                   COUNT(di.id)::int AS item_count
            FROM deliveries d
            LEFT JOIN users u ON u.id=d.created_by
            LEFT JOIN locations l ON l.id=d.source_location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id
            LEFT JOIN delivery_items di ON di.delivery_id=d.id
            {where} GROUP BY d.id, u.name, l.name, w.name
            ORDER BY d.created_at DESC
            LIMIT ${len(mp)-1} OFFSET ${len(mp)}""", *mp
    )
    return {"deliveries": rows, "total": total["cnt"], "page": page, "limit": limit}


async def get_delivery(delivery_id: str) -> dict:
    row = await fetchrow(
        """SELECT d.*, l.name AS source_location_name, w.name AS warehouse_name,
                  u.name AS created_by_name, v.name AS validated_by_name
           FROM deliveries d
           LEFT JOIN locations l ON l.id=d.source_location_id
           LEFT JOIN warehouses w ON w.id=l.warehouse_id
           LEFT JOIN users u ON u.id=d.created_by
           LEFT JOIN users v ON v.id=d.validated_by
           WHERE d.id=$1""", delivery_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Delivery not found")
    items = await fetch(
        """SELECT di.*, p.name AS product_name, p.sku, um.abbreviation AS uom,
                  COALESCE(ss.qty_available, 0) AS qty_available_at_source
           FROM delivery_items di
           JOIN products p ON p.id=di.product_id
           LEFT JOIN units_of_measure um ON um.id=p.uom_id
           LEFT JOIN stock_snapshot ss ON ss.product_id=di.product_id AND ss.location_id=$2
           WHERE di.delivery_id=$1""", delivery_id, row["source_location_id"]
    )
    return {**dict(row), "items": items}


async def create_delivery(data: dict, user_id: str) -> dict:
    async with get_connection() as conn:
        async with conn.transaction():
            ref = await next_ref(conn, "DEL", "delivery_seq")
            del_ = await conn.fetchrow(
                """INSERT INTO deliveries (reference, customer, source_location_id, notes, created_by)
                   VALUES ($1,$2,$3,$4,$5) RETURNING *""",
                ref, data.get("customer"), str(data["source_location_id"]),
                data.get("notes"), user_id,
            )
            for item in data["items"]:
                qty = float(item.get("qty_demand", 0))
                await conn.execute(
                    "INSERT INTO delivery_items (delivery_id, product_id, qty_demand) VALUES ($1,$2,$3)",
                    del_["id"], str(item["product_id"]), qty,
                )
                # Reserve stock on creation
                await conn.execute(
                    """UPDATE stock_snapshot SET qty_reserved=qty_reserved+$1, updated_at=NOW()
                       WHERE product_id=$2 AND location_id=$3""",
                    qty, str(item["product_id"]), str(del_["source_location_id"]),
                )
    await event_bus.emit(EVENTS.DELIVERY_CREATED, {"delivery_id": str(del_["id"])})
    return await get_delivery(str(del_["id"]))


async def validate_delivery(delivery_id: str, items: list, user_id: str) -> dict:
    async with get_connection() as conn:
        async with conn.transaction():
            del_ = await conn.fetchrow(
                "SELECT * FROM deliveries WHERE id=$1 AND status IN ('draft','waiting','ready') FOR UPDATE",
                delivery_id,
            )
            if not del_:
                raise HTTPException(status_code=400, detail="Delivery not found or already processed")

            ledger_entries = []
            for item in items:
                qty = float(item["qty_done"])
                if qty <= 0:
                    continue
                await conn.execute(
                    "UPDATE delivery_items SET qty_done=$1 WHERE delivery_id=$2 AND product_id=$3",
                    qty, delivery_id, str(item["product_id"]),
                )
                entry = await create_entry(
                    conn,
                    product_id=str(item["product_id"]),
                    source_location_id=str(del_["source_location_id"]),
                    dest_location_id=CUSTOMER_LOC,
                    movement_type="delivery",
                    qty_delta=-qty,
                    document_type="delivery",
                    document_id=delivery_id,
                    performed_by=user_id,
                )
                await conn.execute(
                    """UPDATE stock_snapshot
                       SET qty_on_hand=GREATEST(0,qty_on_hand-$1),
                           qty_reserved=GREATEST(0,qty_reserved-$1), updated_at=NOW()
                       WHERE product_id=$2 AND location_id=$3""",
                    qty, str(item["product_id"]), str(del_["source_location_id"]),
                )
                ledger_entries.append(entry)

            if not ledger_entries:
                raise HTTPException(status_code=400, detail="No valid quantities to process")

            await conn.execute(
                "UPDATE deliveries SET status='done', validated_at=NOW(), validated_by=$1, updated_at=NOW() WHERE id=$2",
                user_id, delivery_id,
            )

    await event_bus.emit(EVENTS.DELIVERY_VALIDATED, {"delivery_id": delivery_id, "ledger_entries": ledger_entries})
    return {"message": "Delivery validated", "ledger_entries": len(ledger_entries)}


async def cancel_delivery(delivery_id: str) -> dict:
    async with get_connection() as conn:
        async with conn.transaction():
            row = await conn.fetchrow(
                "UPDATE deliveries SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status IN ('draft','waiting','ready') RETURNING *",
                delivery_id,
            )
            if not row:
                raise HTTPException(status_code=400, detail="Cannot cancel this delivery")
            items = await conn.fetch("SELECT * FROM delivery_items WHERE delivery_id=$1", delivery_id)
            for item in items:
                unreserved = float(item["qty_demand"]) - float(item["qty_done"])
                if unreserved > 0:
                    await conn.execute(
                        "UPDATE stock_snapshot SET qty_reserved=GREATEST(0,qty_reserved-$1), updated_at=NOW() WHERE product_id=$2 AND location_id=$3",
                        unreserved, item["product_id"], row["source_location_id"],
                    )
    await event_bus.emit(EVENTS.DELIVERY_CANCELLED, {"delivery_id": delivery_id})
    return dict(row)


# ══════════════════════════════════════════════════════════════
# INTERNAL TRANSFERS
# ══════════════════════════════════════════════════════════════

async def list_transfers(status=None, source_location_id=None, dest_location_id=None, warehouse_id=None, page=1, limit=20):
    fp, fc = [], []
    if status:            fp.append(status);            fc.append(f"t.status=${len(fp)}")
    if source_location_id:fp.append(source_location_id);fc.append(f"t.source_location_id=${len(fp)}")
    if dest_location_id:  fp.append(dest_location_id);  fc.append(f"t.dest_location_id=${len(fp)}")
    if warehouse_id:      fp.append(warehouse_id);      fc.append(f"w.id=${len(fp)}")
    where = f"WHERE {' AND '.join(fc)}" if fc else ""

    total = await fetchrow(
        f"""SELECT COUNT(*) AS cnt FROM transfers t
            LEFT JOIN locations src ON src.id=t.source_location_id
            LEFT JOIN warehouses w ON w.id=src.warehouse_id {where}""", *fp
    )
    mp = fp + [limit, (page - 1) * limit]
    rows = await fetch(
        f"""SELECT t.*, u.name AS created_by_name,
                   src.name AS source_location_name, dst.name AS dest_location_name,
                   w.name AS warehouse_name, COUNT(ti.id)::int AS item_count
            FROM transfers t
            LEFT JOIN users u ON u.id=t.created_by
            LEFT JOIN locations src ON src.id=t.source_location_id
            LEFT JOIN locations dst ON dst.id=t.dest_location_id
            LEFT JOIN warehouses w ON w.id=src.warehouse_id
            LEFT JOIN transfer_items ti ON ti.transfer_id=t.id
            {where} GROUP BY t.id, u.name, src.name, dst.name, w.name
            ORDER BY t.created_at DESC
            LIMIT ${len(mp)-1} OFFSET ${len(mp)}""", *mp
    )
    return {"transfers": rows, "total": total["cnt"], "page": page, "limit": limit}


async def get_transfer(transfer_id: str) -> dict:
    row = await fetchrow(
        """SELECT t.*, src.name AS source_location_name, dst.name AS dest_location_name,
                  ws.name AS source_warehouse, wd.name AS dest_warehouse,
                  u.name AS created_by_name, v.name AS validated_by_name
           FROM transfers t
           LEFT JOIN locations src ON src.id=t.source_location_id
           LEFT JOIN locations dst ON dst.id=t.dest_location_id
           LEFT JOIN warehouses ws ON ws.id=src.warehouse_id
           LEFT JOIN warehouses wd ON wd.id=dst.warehouse_id
           LEFT JOIN users u ON u.id=t.created_by
           LEFT JOIN users v ON v.id=t.validated_by
           WHERE t.id=$1""", transfer_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Transfer not found")
    items = await fetch(
        """SELECT ti.*, p.name AS product_name, p.sku, um.abbreviation AS uom,
                  COALESCE(ss.qty_available, 0) AS qty_available_at_source
           FROM transfer_items ti
           JOIN products p ON p.id=ti.product_id
           LEFT JOIN units_of_measure um ON um.id=p.uom_id
           LEFT JOIN stock_snapshot ss ON ss.product_id=ti.product_id AND ss.location_id=$2
           WHERE ti.transfer_id=$1""", transfer_id, row["source_location_id"]
    )
    return {**dict(row), "items": items}


async def create_transfer(data: dict, user_id: str) -> dict:
    src = str(data["source_location_id"])
    dst = str(data["dest_location_id"])
    if src == dst:
        raise HTTPException(status_code=400, detail="Source and destination must differ")

    async with get_connection() as conn:
        async with conn.transaction():
            ref = await next_ref(conn, "TRF", "transfer_seq")
            trf = await conn.fetchrow(
                """INSERT INTO transfers (reference, source_location_id, dest_location_id, notes, scheduled_at, created_by)
                   VALUES ($1,$2,$3,$4,$5,$6) RETURNING *""",
                ref, src, dst, data.get("notes"), data.get("scheduled_at"), user_id,
            )
            for item in data["items"]:
                await conn.execute(
                    "INSERT INTO transfer_items (transfer_id, product_id, qty_demand) VALUES ($1,$2,$3)",
                    trf["id"], str(item["product_id"]), float(item.get("qty_demand", 0)),
                )
    await event_bus.emit(EVENTS.TRANSFER_CREATED, {"transfer_id": str(trf["id"])})
    return await get_transfer(str(trf["id"]))


async def validate_transfer(transfer_id: str, items: list, user_id: str) -> dict:
    async with get_connection() as conn:
        async with conn.transaction():
            trf = await conn.fetchrow(
                "SELECT * FROM transfers WHERE id=$1 AND status IN ('draft','ready') FOR UPDATE",
                transfer_id,
            )
            if not trf:
                raise HTTPException(status_code=400, detail="Transfer not found or already processed")

            ledger_entries = []
            for item in items:
                qty = float(item["qty_done"])
                if qty <= 0:
                    continue
                await conn.execute(
                    "UPDATE transfer_items SET qty_done=$1 WHERE transfer_id=$2 AND product_id=$3",
                    qty, transfer_id, str(item["product_id"]),
                )
                out = await create_entry(conn, product_id=str(item["product_id"]),
                    source_location_id=str(trf["source_location_id"]),
                    dest_location_id=str(trf["dest_location_id"]),
                    movement_type="transfer_out", qty_delta=-qty,
                    document_type="transfer", document_id=transfer_id, performed_by=user_id)
                inn = await create_entry(conn, product_id=str(item["product_id"]),
                    source_location_id=str(trf["source_location_id"]),
                    dest_location_id=str(trf["dest_location_id"]),
                    movement_type="transfer_in", qty_delta=qty,
                    document_type="transfer", document_id=transfer_id, performed_by=user_id)

                await conn.execute(
                    "UPDATE stock_snapshot SET qty_on_hand=GREATEST(0,qty_on_hand-$1), updated_at=NOW() WHERE product_id=$2 AND location_id=$3",
                    qty, str(item["product_id"]), str(trf["source_location_id"]),
                )
                await conn.execute(
                    """INSERT INTO stock_snapshot (product_id, location_id, qty_on_hand) VALUES ($1,$2,$3)
                       ON CONFLICT (product_id, location_id) DO UPDATE
                       SET qty_on_hand=stock_snapshot.qty_on_hand+$3, updated_at=NOW()""",
                    str(item["product_id"]), str(trf["dest_location_id"]), qty,
                )
                ledger_entries.extend([out, inn])

            if not ledger_entries:
                raise HTTPException(status_code=400, detail="No valid quantities to process")

            await conn.execute(
                "UPDATE transfers SET status='done', validated_at=NOW(), validated_by=$1, updated_at=NOW() WHERE id=$2",
                user_id, transfer_id,
            )

    await event_bus.emit(EVENTS.TRANSFER_VALIDATED, {"transfer_id": transfer_id, "ledger_entries": ledger_entries})
    return {"message": "Transfer validated", "ledger_entries": len(ledger_entries)}


async def cancel_transfer(transfer_id: str) -> dict:
    row = await fetchrow(
        "UPDATE transfers SET status='cancelled', updated_at=NOW() WHERE id=$1 AND status IN ('draft','ready') RETURNING *",
        transfer_id,
    )
    if not row:
        raise HTTPException(status_code=400, detail="Cannot cancel this transfer")
    await event_bus.emit(EVENTS.TRANSFER_CANCELLED, {"transfer_id": transfer_id})
    return dict(row)


# ══════════════════════════════════════════════════════════════
# STOCK ADJUSTMENTS
# ══════════════════════════════════════════════════════════════

async def list_adjustments(status=None, location_id=None, warehouse_id=None, page=1, limit=20):
    fp, fc = [], []
    if status:      fp.append(status);      fc.append(f"a.status=${len(fp)}")
    if location_id: fp.append(location_id); fc.append(f"a.location_id=${len(fp)}")
    if warehouse_id:fp.append(warehouse_id);fc.append(f"w.id=${len(fp)}")
    where = f"WHERE {' AND '.join(fc)}" if fc else ""

    total = await fetchrow(
        f"""SELECT COUNT(*) AS cnt FROM adjustments a
            LEFT JOIN locations l ON l.id=a.location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id {where}""", *fp
    )
    mp = fp + [limit, (page - 1) * limit]
    rows = await fetch(
        f"""SELECT a.*, u.name AS created_by_name,
                   l.name AS location_name, w.name AS warehouse_name,
                   COUNT(ai.id)::int AS item_count
            FROM adjustments a
            LEFT JOIN users u ON u.id=a.created_by
            LEFT JOIN locations l ON l.id=a.location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id
            LEFT JOIN adjustment_items ai ON ai.adjustment_id=a.id
            {where} GROUP BY a.id, u.name, l.name, w.name
            ORDER BY a.created_at DESC
            LIMIT ${len(mp)-1} OFFSET ${len(mp)}""", *mp
    )
    return {"adjustments": rows, "total": total["cnt"], "page": page, "limit": limit}


async def get_adjustment(adjustment_id: str) -> dict:
    row = await fetchrow(
        """SELECT a.*, l.name AS location_name, w.name AS warehouse_name,
                  u.name AS created_by_name, v.name AS validated_by_name
           FROM adjustments a
           LEFT JOIN locations l ON l.id=a.location_id
           LEFT JOIN warehouses w ON w.id=l.warehouse_id
           LEFT JOIN users u ON u.id=a.created_by
           LEFT JOIN users v ON v.id=a.validated_by
           WHERE a.id=$1""", adjustment_id
    )
    if not row:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    items = await fetch(
        """SELECT ai.*, p.name AS product_name, p.sku, um.abbreviation AS uom
           FROM adjustment_items ai
           JOIN products p ON p.id=ai.product_id
           LEFT JOIN units_of_measure um ON um.id=p.uom_id
           WHERE ai.adjustment_id=$1""", adjustment_id
    )
    return {**dict(row), "items": items}


async def create_adjustment(data: dict, user_id: str) -> dict:
    loc_id = str(data["location_id"])
    async with get_connection() as conn:
        async with conn.transaction():
            ref = await next_ref(conn, "ADJ", "adjustment_seq")
            adj = await conn.fetchrow(
                "INSERT INTO adjustments (reference, location_id, reason, created_by) VALUES ($1,$2,$3,$4) RETURNING *",
                ref, loc_id, data.get("reason"), user_id,
            )
            for item in data["items"]:
                snap = await conn.fetchrow(
                    "SELECT qty_on_hand FROM stock_snapshot WHERE product_id=$1 AND location_id=$2",
                    str(item["product_id"]), loc_id,
                )
                qty_recorded = float(snap["qty_on_hand"]) if snap else 0.0
                await conn.execute(
                    "INSERT INTO adjustment_items (adjustment_id, product_id, qty_recorded, qty_counted) VALUES ($1,$2,$3,$4)",
                    adj["id"], str(item["product_id"]), qty_recorded, float(item.get("qty_counted", 0)),
                )
    await event_bus.emit(EVENTS.ADJUSTMENT_CREATED, {"adjustment_id": str(adj["id"])})
    return await get_adjustment(str(adj["id"]))


async def validate_adjustment(adjustment_id: str, user_id: str) -> dict:
    async with get_connection() as conn:
        async with conn.transaction():
            adj = await conn.fetchrow(
                "SELECT * FROM adjustments WHERE id=$1 AND status='draft' FOR UPDATE", adjustment_id
            )
            if not adj:
                raise HTTPException(status_code=400, detail="Adjustment not found or already processed")

            items = await conn.fetch("SELECT * FROM adjustment_items WHERE adjustment_id=$1", adjustment_id)
            ledger_entries = []
            for item in items:
                delta = float(item["qty_counted"]) - float(item["qty_recorded"])
                if abs(delta) < 0.001:
                    continue
                entry = await create_entry(conn,
                    product_id=str(item["product_id"]),
                    source_location_id=str(adj["location_id"]) if delta < 0 else SCRAP_LOC,
                    dest_location_id=str(adj["location_id"])   if delta > 0 else SCRAP_LOC,
                    movement_type="adjustment", qty_delta=delta,
                    document_type="adjustment", document_id=adjustment_id, performed_by=user_id,
                )
                await conn.execute(
                    "UPDATE stock_snapshot SET qty_on_hand=GREATEST(0,qty_on_hand+$1), updated_at=NOW() WHERE product_id=$2 AND location_id=$3",
                    delta, str(item["product_id"]), str(adj["location_id"]),
                )
                ledger_entries.append(entry)

            await conn.execute(
                "UPDATE adjustments SET status='done', validated_at=NOW(), validated_by=$1, updated_at=NOW() WHERE id=$2",
                user_id, adjustment_id,
            )

    await event_bus.emit(EVENTS.ADJUSTMENT_VALIDATED, {"adjustment_id": adjustment_id, "ledger_entries": ledger_entries})
    return {"message": "Adjustment validated", "ledger_entries": len(ledger_entries)}
