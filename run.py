"""
Run all SQL migration files in order.
Usage:  python -m src.db.migrations.run
"""
import asyncio
import os
from pathlib import Path

import asyncpg
from dotenv import load_dotenv

load_dotenv()


async def run():
    conn = await asyncpg.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", 5432)),
        database=os.getenv("DB_NAME", "coreinventory"),
        user=os.getenv("DB_USER", "postgres"),
        password=os.getenv("DB_PASSWORD", "password"),
    )

    migrations_dir = Path(__file__).parent
    sql_files = sorted(migrations_dir.glob("*.sql"))

    for sql_file in sql_files:
        print(f"Running migration: {sql_file.name}")
        sql = sql_file.read_text()
        await conn.execute(sql)
        print(f"  ✓ Done: {sql_file.name}")

    await conn.close()
    print("\nAll migrations complete.")


if __name__ == "__main__":
    asyncio.run(run())
