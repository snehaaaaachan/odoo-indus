import json
import redis.asyncio as aioredis
from src.config.settings import settings

_redis: aioredis.Redis = None


async def connect_redis():
    global _redis
    _redis = aioredis.from_url(settings.REDIS_URL, decode_responses=True)
    await _redis.ping()
    print("Redis connected")


async def close_redis():
    global _redis
    if _redis:
        await _redis.close()


def get_redis() -> aioredis.Redis:
    if _redis is None:
        raise RuntimeError("Redis not initialized")
    return _redis


async def cache_set(key: str, value, ttl_seconds: int = 60):
    await get_redis().setex(key, ttl_seconds, json.dumps(value, default=str))


async def cache_get(key: str):
    val = await get_redis().get(key)
    return json.loads(val) if val else None


async def cache_del(key: str):
    await get_redis().delete(key)


async def cache_del_pattern(pattern: str):
    keys = await get_redis().keys(pattern)
    if keys:
        await get_redis().delete(*keys)
