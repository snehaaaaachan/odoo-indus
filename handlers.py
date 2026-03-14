from src.events.event_bus import event_bus, EVENTS


def register_event_handlers():
    from src.modules.ledger.stock_twin_service import apply_ledger_entries
    from src.modules.dashboard.dashboard_projection import invalidate_cache
    from src.modules.alerts.alert_service import check_low_stock, check_adjustment_variance

    async def on_receipt_validated(event):
        entries = event["payload"].get("ledger_entries", [])
        await apply_ledger_entries(entries)
        await invalidate_cache()

    async def on_delivery_validated(event):
        entries = event["payload"].get("ledger_entries", [])
        await apply_ledger_entries(entries)
        await invalidate_cache()
        for entry in entries:
            await check_low_stock(entry["product_id"])

    async def on_transfer_validated(event):
        entries = event["payload"].get("ledger_entries", [])
        await apply_ledger_entries(entries)
        await invalidate_cache()

    async def on_adjustment_validated(event):
        entries = event["payload"].get("ledger_entries", [])
        await apply_ledger_entries(entries)
        await invalidate_cache()
        adj_id = event["payload"].get("adjustment_id")
        if adj_id:
            await check_adjustment_variance(adj_id)

    event_bus.on(EVENTS.RECEIPT_VALIDATED,    on_receipt_validated)
    event_bus.on(EVENTS.DELIVERY_VALIDATED,   on_delivery_validated)
    event_bus.on(EVENTS.TRANSFER_VALIDATED,   on_transfer_validated)
    event_bus.on(EVENTS.ADJUSTMENT_VALIDATED, on_adjustment_validated)

    print("[EventBus] All handlers registered")
