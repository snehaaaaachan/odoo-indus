from src.config.database import fetch, fetchrow, execute


async def apply_ledger_entries(entries: list):
    """
    Called by event handlers after each validated operation.
    Updates the live stock_snapshot (twin) from a list of ledger entry dicts.
    """
    for entry in entries:
        product_id  = str(entry["product_id"])
        qty_delta   = float(entry["qty_delta"])
        dest_loc    = entry.get("dest_location_id")
        source_loc  = entry.get("source_location_id")

        # Stock arrives at destination
        if dest_loc and qty_delta > 0:
            await execute(
                """INSERT INTO stock_snapshot (product_id, location_id, qty_on_hand)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (product_id, location_id) DO UPDATE
                   SET qty_on_hand = GREATEST(0, stock_snapshot.qty_on_hand + $3),
                       updated_at  = NOW()""",
                product_id, str(dest_loc), abs(qty_delta),
            )

        # Stock leaves source
        if source_loc and qty_delta < 0:
            await execute(
                """UPDATE stock_snapshot
                   SET qty_on_hand = GREATEST(0, qty_on_hand + $1), updated_at=NOW()
                   WHERE product_id=$2 AND location_id=$3""",
                qty_delta, product_id, str(source_loc),
            )


async def get_global_snapshot():
    """Full live twin — all products with totals across all locations."""
    return await fetch(
        """SELECT
               p.id, p.name, p.sku, p.reorder_point,
               c.name AS category,
               u.abbreviation AS uom,
               COALESCE(SUM(ss.qty_on_hand),  0) AS total_on_hand,
               COALESCE(SUM(ss.qty_reserved), 0) AS total_reserved,
               COALESCE(SUM(ss.qty_available),0) AS total_available,
               COALESCE(SUM(ss.qty_incoming), 0) AS total_incoming
            FROM products p
            LEFT JOIN categories c ON c.id = p.category_id
            LEFT JOIN units_of_measure u ON u.id = p.uom_id
            LEFT JOIN stock_snapshot ss ON ss.product_id = p.id
            WHERE p.is_active = true
            GROUP BY p.id, c.name, u.abbreviation
            ORDER BY p.name"""
    )


async def get_low_stock_products():
    """Products at or below their reorder point."""
    return await fetch(
        """SELECT
               p.id, p.name, p.sku, p.reorder_point,
               COALESCE(SUM(ss.qty_on_hand), 0) AS total_on_hand
            FROM products p
            LEFT JOIN stock_snapshot ss ON ss.product_id = p.id
            WHERE p.is_active=true AND p.reorder_point > 0
            GROUP BY p.id
            HAVING COALESCE(SUM(ss.qty_on_hand), 0) <= p.reorder_point
            ORDER BY (COALESCE(SUM(ss.qty_on_hand), 0) / NULLIF(p.reorder_point, 0)) ASC"""
    )
