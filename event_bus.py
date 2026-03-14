import asyncio
import uuid
from datetime import datetime, timezone
from typing import Callable, Dict, List

# ── Event type constants ──────────────────────────────────────
class EVENTS:
    PRODUCT_CREATED       = "PRODUCT_CREATED"
    PRODUCT_UPDATED       = "PRODUCT_UPDATED"

    RECEIPT_CREATED       = "RECEIPT_CREATED"
    RECEIPT_VALIDATED     = "RECEIPT_VALIDATED"
    RECEIPT_CANCELLED     = "RECEIPT_CANCELLED"

    DELIVERY_CREATED      = "DELIVERY_CREATED"
    DELIVERY_VALIDATED    = "DELIVERY_VALIDATED"
    DELIVERY_CANCELLED    = "DELIVERY_CANCELLED"

    TRANSFER_CREATED      = "TRANSFER_CREATED"
    TRANSFER_VALIDATED    = "TRANSFER_VALIDATED"
    TRANSFER_CANCELLED    = "TRANSFER_CANCELLED"

    ADJUSTMENT_CREATED    = "ADJUSTMENT_CREATED"
    ADJUSTMENT_VALIDATED  = "ADJUSTMENT_VALIDATED"

    STOCK_UPDATED         = "STOCK_UPDATED"
    LOW_STOCK_TRIGGERED   = "LOW_STOCK_TRIGGERED"


class InventoryEventBus:
    def __init__(self):
        self._handlers: Dict[str, List[Callable]] = {}

    def on(self, event_type: str, handler: Callable):
        if event_type not in self._handlers:
            self._handlers[event_type] = []
        self._handlers[event_type].append(handler)

    async def emit(self, event_type: str, payload: dict):
        event = {
            "id": str(uuid.uuid4()),
            "type": event_type,
            "payload": payload,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
        print(f"[EventBus] Emitting: {event_type} ({event['id']})")

        handlers = self._handlers.get(event_type, [])
        wildcard = self._handlers.get("*", [])

        results = await asyncio.gather(
            *[h(event) for h in handlers + wildcard],
            return_exceptions=True,
        )
        for i, r in enumerate(results):
            if isinstance(r, Exception):
                print(f"[EventBus] Handler error for {event_type}: {r}")

        return event


# Singleton instance used throughout the app
event_bus = InventoryEventBus()
