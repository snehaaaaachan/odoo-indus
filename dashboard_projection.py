from src.config.database import fetchrow, fetch
from src.config.redis_client import cache_get, cache_set, cache_del

CACHE_KEY = "dashboard:kpis"
CACHE_TTL  = 30  # seconds


async def get_kpis() -> dict:
    cached = await cache_get(CACHE_KEY)
    if cached:
        return {**cached, "from_cache": True}
    kpis = await _compute_kpis()
    await cache_set(CACHE_KEY, kpis, CACHE_TTL)
    return kpis


async def _compute_kpis() -> dict:
    from datetime import datetime, timezone
    import asyncio

    product_stats, pending_ops, transfer_stats, top_movers, wh_summary, recent = await asyncio.gather(
        _product_stats(),
        _pending_operations(),
        _transfer_stats(),
        _top_moving_products(),
        _warehouse_summary(),
        _recent_activity(),
    )
    return {
        "computed_at": datetime.now(timezone.utc).isoformat(),
        "products": product_stats,
        "operations": {**pending_ops, **transfer_stats},
        "top_movers": top_movers,
        "warehouse_summary": wh_summary,
        "recent_activity": recent,
    }


async def _product_stats():
    row = await fetchrow("""
        SELECT
          COUNT(DISTINCT p.id)                                                          AS total_products,
          COUNT(DISTINCT CASE WHEN COALESCE(ss.qty_on_hand,0)=0 THEN p.id END)         AS out_of_stock,
          COUNT(DISTINCT CASE
            WHEN COALESCE(ss.qty_on_hand,0)>0
             AND COALESCE(ss.qty_on_hand,0)<=p.reorder_point
            THEN p.id END)                                                              AS low_stock,
          COALESCE(SUM(ss.qty_on_hand), 0)                                             AS total_units_on_hand
        FROM products p
        LEFT JOIN stock_snapshot ss ON ss.product_id=p.id
        WHERE p.is_active=true
    """)
    return dict(row)


async def _pending_operations():
    row = await fetchrow("""
        SELECT
          (SELECT COUNT(*) FROM receipts   WHERE status IN ('draft','ready'))             AS pending_receipts,
          (SELECT COUNT(*) FROM deliveries WHERE status IN ('draft','waiting','ready'))   AS pending_deliveries,
          (SELECT COUNT(*) FROM adjustments WHERE status='draft')                         AS pending_adjustments
    """)
    return dict(row)


async def _transfer_stats():
    row = await fetchrow("""
        SELECT
          COUNT(*) FILTER (WHERE status IN ('draft','ready'))                                 AS pending_transfers,
          COUNT(*) FILTER (WHERE scheduled_at > NOW() AND status NOT IN ('done','cancelled')) AS scheduled_transfers
        FROM transfers
    """)
    return dict(row)


async def _top_moving_products(limit: int = 10):
    return await fetch("""
        SELECT p.name, p.sku, COUNT(*) AS move_count, SUM(ABS(sl.qty_delta)) AS total_moved
        FROM stock_ledger sl
        JOIN products p ON p.id=sl.product_id
        WHERE sl.created_at >= NOW() - INTERVAL '30 days' AND sl.movement_type != 'initial'
        GROUP BY p.id, p.name, p.sku
        ORDER BY total_moved DESC
        LIMIT $1
    """, limit)


async def _warehouse_summary():
    return await fetch("""
        SELECT w.id, w.name, w.code,
               COUNT(DISTINCT ss.product_id) AS distinct_products,
               COALESCE(SUM(ss.qty_on_hand), 0) AS total_units
        FROM warehouses w
        LEFT JOIN locations l ON l.warehouse_id=w.id
        LEFT JOIN stock_snapshot ss ON ss.location_id=l.id
        WHERE w.id != '00000000-0000-0000-0000-000000000001'
        GROUP BY w.id, w.name, w.code
        ORDER BY total_units DESC
    """)


async def _recent_activity(limit: int = 15):
    return await fetch("""
        SELECT sl.id, sl.movement_type, sl.qty_delta, sl.created_at,
               p.name AS product_name, p.sku,
               src.name AS source_location, dst.name AS dest_location,
               u.name AS performed_by
        FROM stock_ledger sl
        JOIN     products  p   ON p.id  =sl.product_id
        LEFT JOIN locations src ON src.id=sl.source_location_id
        LEFT JOIN locations dst ON dst.id=sl.dest_location_id
        LEFT JOIN users     u   ON u.id =sl.performed_by
        WHERE sl.movement_type != 'initial'
        ORDER BY sl.created_at DESC LIMIT $1
    """, limit)


async def invalidate_cache():
    await cache_del(CACHE_KEY)


async def get_operations_list(type_=None, status=None, warehouse_id=None, page=1, limit=20):
    """Unified operation list with combined filters. type: receipt|delivery|transfer|adjustment"""
    results = {}
    s   = status       or None
    w   = warehouse_id or None
    lim = int(limit)
    off = (int(page) - 1) * lim

    if not type_ or type_ == "receipt":
        results["receipts"] = await fetch("""
            SELECT 'receipt' AS doc_type, r.id, r.reference, r.status,
                   r.supplier AS counterparty, l.name AS location_name,
                   w.name AS warehouse_name, r.created_at, COUNT(ri.id)::int AS item_count
            FROM receipts r
            LEFT JOIN locations l ON l.id=r.dest_location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id
            LEFT JOIN receipt_items ri ON ri.receipt_id=r.id
            WHERE ($1::text IS NULL OR r.status=$1) AND ($2::uuid IS NULL OR w.id=$2::uuid)
            GROUP BY r.id, l.name, w.name ORDER BY r.created_at DESC LIMIT $3 OFFSET $4
        """, s, w, lim, off)

    if not type_ or type_ == "delivery":
        results["deliveries"] = await fetch("""
            SELECT 'delivery' AS doc_type, d.id, d.reference, d.status,
                   d.customer AS counterparty, l.name AS location_name,
                   w.name AS warehouse_name, d.created_at, COUNT(di.id)::int AS item_count
            FROM deliveries d
            LEFT JOIN locations l ON l.id=d.source_location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id
            LEFT JOIN delivery_items di ON di.delivery_id=d.id
            WHERE ($1::text IS NULL OR d.status=$1) AND ($2::uuid IS NULL OR w.id=$2::uuid)
            GROUP BY d.id, l.name, w.name ORDER BY d.created_at DESC LIMIT $3 OFFSET $4
        """, s, w, lim, off)

    if not type_ or type_ == "transfer":
        results["transfers"] = await fetch("""
            SELECT 'transfer' AS doc_type, t.id, t.reference, t.status,
                   src.name AS source_location_name, dst.name AS dest_location_name,
                   w.name AS warehouse_name, t.created_at, COUNT(ti.id)::int AS item_count
            FROM transfers t
            LEFT JOIN locations src ON src.id=t.source_location_id
            LEFT JOIN locations dst ON dst.id=t.dest_location_id
            LEFT JOIN warehouses w ON w.id=src.warehouse_id
            LEFT JOIN transfer_items ti ON ti.transfer_id=t.id
            WHERE ($1::text IS NULL OR t.status=$1) AND ($2::uuid IS NULL OR w.id=$2::uuid)
            GROUP BY t.id, src.name, dst.name, w.name ORDER BY t.created_at DESC LIMIT $3 OFFSET $4
        """, s, w, lim, off)

    if not type_ or type_ == "adjustment":
        results["adjustments"] = await fetch("""
            SELECT 'adjustment' AS doc_type, a.id, a.reference, a.status,
                   l.name AS location_name, w.name AS warehouse_name,
                   a.created_at, COUNT(ai.id)::int AS item_count
            FROM adjustments a
            LEFT JOIN locations l ON l.id=a.location_id
            LEFT JOIN warehouses w ON w.id=l.warehouse_id
            LEFT JOIN adjustment_items ai ON ai.adjustment_id=a.id
            WHERE ($1::text IS NULL OR a.status=$1) AND ($2::uuid IS NULL OR w.id=$2::uuid)
            GROUP BY a.id, l.name, w.name ORDER BY a.created_at DESC LIMIT $3 OFFSET $4
        """, s, w, lim, off)

    return results
