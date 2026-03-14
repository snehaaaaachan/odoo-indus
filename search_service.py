from typing import Optional
from src.config.database import fetch, fetchrow


async def global_search(q: str, limit: int = 20) -> dict:
    """Search products and operations by a single query string."""
    if not q or len(q.strip()) < 2:
        return {"products": [], "operations": []}

    term = f"%{q.strip()}%"
    half = max(1, limit // 2)

    products = await fetch("""
        SELECT p.id, p.name, p.sku, c.name AS category,
               COALESCE(SUM(ss.qty_on_hand), 0) AS qty_on_hand
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN stock_snapshot ss ON ss.product_id = p.id
        WHERE (p.name ILIKE $1 OR p.sku ILIKE $1) AND p.is_active = true
        GROUP BY p.id, c.name
        ORDER BY p.name
        LIMIT $2
    """, term, half)

    receipts = await fetch("""
        SELECT 'receipt' AS type, id, reference AS label, status, created_at
        FROM receipts
        WHERE reference ILIKE $1 OR supplier ILIKE $1
        ORDER BY created_at DESC LIMIT $2
    """, term, 5)

    deliveries = await fetch("""
        SELECT 'delivery' AS type, id, reference AS label, status, created_at
        FROM deliveries
        WHERE reference ILIKE $1 OR customer ILIKE $1
        ORDER BY created_at DESC LIMIT $2
    """, term, 5)

    transfers = await fetch("""
        SELECT 'transfer' AS type, id, reference AS label, status, created_at
        FROM transfers
        WHERE reference ILIKE $1
        ORDER BY created_at DESC LIMIT $2
    """, term, 5)

    adjustments = await fetch("""
        SELECT 'adjustment' AS type, id, reference AS label, status, created_at
        FROM adjustments
        WHERE reference ILIKE $1
        ORDER BY created_at DESC LIMIT $2
    """, term, 5)

    all_ops = sorted(
        receipts + deliveries + transfers + adjustments,
        key=lambda x: x["created_at"],
        reverse=True,
    )[:limit]

    return {"products": products, "operations": all_ops}


async def search_by_sku(sku: str):
    """Exact or fuzzy SKU lookup with stock totals."""
    return await fetch("""
        SELECT p.*, c.name AS category, u.abbreviation AS uom,
               COALESCE(SUM(ss.qty_on_hand), 0) AS total_qty
        FROM products p
        LEFT JOIN categories c ON c.id = p.category_id
        LEFT JOIN units_of_measure u ON u.id = p.uom_id
        LEFT JOIN stock_snapshot ss ON ss.product_id = p.id
        WHERE p.sku ILIKE $1
        GROUP BY p.id, c.name, u.abbreviation
        LIMIT 10
    """, f"%{sku}%")


async def smart_filter(
    type_: Optional[str]  = None,
    status: Optional[str] = None,
    warehouse_id: Optional[str] = None,
    date_from: Optional[str]    = None,
    date_to: Optional[str]      = None,
    page: int  = 1,
    limit: int = 30,
) -> dict:
    """
    Smart filter across all operation types.
    type: receipt | delivery | transfer | adjustment
    """
    s   = status       or None
    w   = warehouse_id or None
    f   = date_from    or None
    t   = date_to      or None
    lim = int(limit)
    off = (int(page) - 1) * lim
    results = {}

    if not type_ or type_ == "receipt":
        results["receipts"] = await fetch("""
            SELECT 'receipt' AS doc_type, r.id, r.reference, r.status,
                   r.supplier AS party, l.name AS location_name,
                   w.name AS warehouse_name, r.created_at
            FROM receipts r
            LEFT JOIN locations  l ON l.id = r.dest_location_id
            LEFT JOIN warehouses w ON w.id = l.warehouse_id
            WHERE ($1::text IS NULL OR r.status = $1)
              AND ($2::uuid IS NULL OR w.id = $2::uuid)
              AND ($3::timestamptz IS NULL OR r.created_at >= $3::timestamptz)
              AND ($4::timestamptz IS NULL OR r.created_at <= $4::timestamptz)
            ORDER BY r.created_at DESC LIMIT $5 OFFSET $6
        """, s, w, f, t, lim, off)

    if not type_ or type_ == "delivery":
        results["deliveries"] = await fetch("""
            SELECT 'delivery' AS doc_type, d.id, d.reference, d.status,
                   d.customer AS party, l.name AS location_name,
                   w.name AS warehouse_name, d.created_at
            FROM deliveries d
            LEFT JOIN locations  l ON l.id = d.source_location_id
            LEFT JOIN warehouses w ON w.id = l.warehouse_id
            WHERE ($1::text IS NULL OR d.status = $1)
              AND ($2::uuid IS NULL OR w.id = $2::uuid)
              AND ($3::timestamptz IS NULL OR d.created_at >= $3::timestamptz)
              AND ($4::timestamptz IS NULL OR d.created_at <= $4::timestamptz)
            ORDER BY d.created_at DESC LIMIT $5 OFFSET $6
        """, s, w, f, t, lim, off)

    if not type_ or type_ == "transfer":
        results["transfers"] = await fetch("""
            SELECT 'transfer' AS doc_type, t.id, t.reference, t.status,
                   src.name AS source_location_name, dst.name AS dest_location_name,
                   w.name AS warehouse_name, t.created_at
            FROM transfers t
            LEFT JOIN locations  src ON src.id = t.source_location_id
            LEFT JOIN locations  dst ON dst.id = t.dest_location_id
            LEFT JOIN warehouses w   ON w.id   = src.warehouse_id
            WHERE ($1::text IS NULL OR t.status = $1)
              AND ($2::uuid IS NULL OR w.id = $2::uuid)
              AND ($3::timestamptz IS NULL OR t.created_at >= $3::timestamptz)
              AND ($4::timestamptz IS NULL OR t.created_at <= $4::timestamptz)
            ORDER BY t.created_at DESC LIMIT $5 OFFSET $6
        """, s, w, f, t, lim, off)

    if not type_ or type_ == "adjustment":
        results["adjustments"] = await fetch("""
            SELECT 'adjustment' AS doc_type, a.id, a.reference, a.status,
                   l.name AS location_name, w.name AS warehouse_name, a.created_at
            FROM adjustments a
            LEFT JOIN locations  l ON l.id = a.location_id
            LEFT JOIN warehouses w ON w.id = l.warehouse_id
            WHERE ($1::text IS NULL OR a.status = $1)
              AND ($2::uuid IS NULL OR w.id = $2::uuid)
              AND ($3::timestamptz IS NULL OR a.created_at >= $3::timestamptz)
              AND ($4::timestamptz IS NULL OR a.created_at <= $4::timestamptz)
            ORDER BY a.created_at DESC LIMIT $5 OFFSET $6
        """, s, w, f, t, lim, off)

    return {"results": results, "page": page, "limit": limit}
