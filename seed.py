"""
Seed the database with development data.
Usage:  python -m src.db.seed
"""
import asyncio
import os
from passlib.context import CryptContext
from dotenv import load_dotenv
import asyncpg

load_dotenv()

pwd_ctx = CryptContext(schemes=["bcrypt"], deprecated="auto")


async def seed():
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME", "coreinventory"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password"),
    )

    async with conn.transaction():
        # ── Users ──────────────────────────────────────────────
        hashed = pwd_ctx.hash("password123")
        await conn.execute("""
            INSERT INTO users (name, email, password, role) VALUES
              ('Admin Manager',   'manager@coreinventory.com', $1, 'inventory_manager'),
              ('Warehouse Staff', 'staff@coreinventory.com',   $1, 'warehouse_staff')
            ON CONFLICT (email) DO NOTHING
        """, hashed)

        # ── Categories ─────────────────────────────────────────
        await conn.execute("""
            INSERT INTO categories (name, description) VALUES
              ('Raw Materials',  'Input materials for production'),
              ('Finished Goods', 'Ready-to-ship products'),
              ('Consumables',    'Items used during operations'),
              ('Packaging',      'Packaging and wrapping materials')
            ON CONFLICT (name) DO NOTHING
        """)

        # ── Units of Measure ───────────────────────────────────
        await conn.execute("""
            INSERT INTO units_of_measure (name, abbreviation) VALUES
              ('Kilogram', 'kg'),
              ('Piece',    'pcs'),
              ('Litre',    'L'),
              ('Metre',    'm'),
              ('Box',      'box')
            ON CONFLICT (name) DO NOTHING
        """)

        # ── Main Warehouse ─────────────────────────────────────
        wh = await conn.fetchrow("""
            INSERT INTO warehouses (name, code, address)
            VALUES ('Main Warehouse', 'WH-MAIN', '123 Industrial Area, City')
            ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
        """)
        wh2 = await conn.fetchrow("""
            INSERT INTO warehouses (name, code, address)
            VALUES ('Secondary Warehouse', 'WH-SEC', '456 Storage Lane, City')
            ON CONFLICT (code) DO UPDATE SET name=EXCLUDED.name
            RETURNING id
        """)

        # ── Locations for Main Warehouse ───────────────────────
        if wh:
            wh_id = wh["id"]
            await conn.execute("""
                INSERT INTO locations (warehouse_id, name, code, type) VALUES
                  ($1, 'Receiving Area',      'WH-MAIN/RECV',   'receiving'),
                  ($1, 'Main Store - Rack A', 'WH-MAIN/RACK-A', 'rack'),
                  ($1, 'Main Store - Rack B', 'WH-MAIN/RACK-B', 'rack'),
                  ($1, 'Production Floor',    'WH-MAIN/PROD',   'production_floor'),
                  ($1, 'Dispatch Area',       'WH-MAIN/DISP',   'dispatch')
                ON CONFLICT (code) DO NOTHING
            """, wh_id)

        # ── Locations for Secondary Warehouse ──────────────────
        if wh2:
            wh2_id = wh2["id"]
            await conn.execute("""
                INSERT INTO locations (warehouse_id, name, code, type) VALUES
                  ($1, 'Receiving Area', 'WH-SEC/RECV',   'receiving'),
                  ($1, 'Storage Zone A', 'WH-SEC/ZONE-A', 'zone'),
                  ($1, 'Dispatch Area',  'WH-SEC/DISP',   'dispatch')
                ON CONFLICT (code) DO NOTHING
            """, wh2_id)

    await conn.close()

    print("✓ Seed complete.\n")
    print("  Login credentials:")
    print("    manager@coreinventory.com / password123  (inventory_manager)")
    print("    staff@coreinventory.com   / password123  (warehouse_staff)")


if __name__ == "__main__":
    asyncio.run(seed())
