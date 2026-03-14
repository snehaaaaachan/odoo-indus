from datetime import datetime


async def next_ref(conn, prefix: str, sequence: str) -> str:
    """Generate human-readable reference like REC/2024/00001."""
    seq = await conn.fetchval(f"SELECT nextval('{sequence}')")
    year = datetime.now().year
    return f"{prefix}/{year}/{str(seq).zfill(5)}"
