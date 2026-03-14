from src.config.database import fetchrow, fetch, execute

VARIANCE_THRESHOLD = 0.20  # 20% delta triggers audit alert


async def check_low_stock(product_id: str):
    row = await fetchrow("""
        SELECT p.id, p.name, p.sku, p.reorder_point,
               COALESCE(SUM(ss.qty_on_hand), 0) AS total_qty
        FROM products p
        LEFT JOIN stock_snapshot ss ON ss.product_id=p.id
        WHERE p.id=$1
        GROUP BY p.id
    """, product_id)

    if not row or float(row["reorder_point"]) <= 0:
        return

    total = float(row["total_qty"])
    reorder = float(row["reorder_point"])

    if total == 0:
        await _create_alert("out_of_stock", product_id,
            f"{row['name']} ({row['sku']}) is completely out of stock.")
    elif total <= reorder:
        await _create_alert("low_stock", product_id,
            f"{row['name']} ({row['sku']}) is below reorder point: "
            f"{total} remaining (threshold: {reorder}).")


async def check_adjustment_variance(adjustment_id: str):
    items = await fetch("""
        SELECT ai.*, p.name AS product_name, p.sku
        FROM adjustment_items ai
        JOIN products p ON p.id=ai.product_id
        WHERE ai.adjustment_id=$1 AND ABS(ai.qty_delta) > 0
    """, adjustment_id)

    for item in items:
        recorded = float(item["qty_recorded"])
        delta    = abs(float(item["qty_delta"]))
        variance = delta / recorded if recorded > 0 else 1.0

        if variance > VARIANCE_THRESHOLD:
            await _create_alert("high_variance", str(item["product_id"]),
                f"High adjustment variance for {item['product_name']} ({item['sku']}): "
                f"{variance*100:.1f}% deviation (delta: {item['qty_delta']}).")


async def _create_alert(alert_type: str, product_id: str, message: str, location_id: str = None):
    # Debounce: don't create duplicate unread alerts within 1 hour
    existing = await fetchrow("""
        SELECT id FROM alerts
        WHERE type=$1 AND product_id=$2 AND is_read=false
          AND created_at > NOW() - INTERVAL '1 hour'
    """, alert_type, product_id)
    if existing:
        return

    await execute(
        "INSERT INTO alerts (type, product_id, location_id, message) VALUES ($1,$2,$3,$4)",
        alert_type, product_id, location_id, message,
    )
    print(f"[AlertEngine] {alert_type}: {message}")


async def list_alerts(is_read=None, alert_type=None, page=1, limit=30):
    fp, fc = [], []
    if is_read is not None:
        fp.append(is_read)
        fc.append(f"a.is_read=${len(fp)}")
    if alert_type:
        fp.append(alert_type)
        fc.append(f"a.type=${len(fp)}")

    where = f"WHERE {' AND '.join(fc)}" if fc else ""
    mp = fp + [limit, (page - 1) * limit]
    return await fetch(
        f"""SELECT a.*, p.name AS product_name, p.sku
            FROM alerts a
            LEFT JOIN products p ON p.id=a.product_id
            {where}
            ORDER BY a.created_at DESC
            LIMIT ${len(mp)-1} OFFSET ${len(mp)}""",
        *mp,
    )


async def get_unread_count() -> int:
    row = await fetchrow("SELECT COUNT(*) AS cnt FROM alerts WHERE is_read=false")
    return int(row["cnt"])


async def mark_read(alert_id: str):
    await execute("UPDATE alerts SET is_read=true WHERE id=$1", alert_id)


async def mark_all_read():
    await execute("UPDATE alerts SET is_read=true WHERE is_read=false")
