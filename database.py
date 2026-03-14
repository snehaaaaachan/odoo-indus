import asyncpg
from src.config.settings import settings

_pool: asyncpg.Pool = None


async def connect_db():
    global _pool
    _pool = await asyncpg.create_pool(
        host=settings.DB_HOST,
        port=settings.DB_PORT,
        database=settings.DB_NAME,
        user=settings.DB_USER,
        password=settings.DB_PASSWORD,
        min_size=2,
        max_size=20,
    )
    print("PostgreSQL connected")


async def close_db():
    global _pool
    if _pool:
        await _pool.close()


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database not initialized")
    return _pool


async def fetch(sql: str, *args):
    async with get_pool().acquire() as conn:
        rows = await conn.fetch(sql, *args)
        return [dict(r) for r in rows]


async def fetchrow(sql: str, *args):
    async with get_pool().acquire() as conn:
        row = await conn.fetchrow(sql, *args)
        return dict(row) if row else None


async def fetchval(sql: str, *args):
    async with get_pool().acquire() as conn:
        return await conn.fetchval(sql, *args)


async def execute(sql: str, *args):
    async with get_pool().acquire() as conn:
        return await conn.execute(sql, *args)


def get_connection():
    return get_pool().acquire()
