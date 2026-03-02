import asyncio
import os
import asyncpg
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '..', '.env'))

pool: asyncpg.Pool | None = None


async def get_pool() -> asyncpg.Pool:
    global pool
    if pool is None:
        pool = await asyncpg.create_pool(
            host=os.environ["ANALYTICSDB_HOST"],
            port=int(os.environ.get("ANALYTICSDB_PORT", "5432")),
            user=os.environ["ANALYTICSDB_USER"],
            password=os.environ["ANALYTICSDB_PASSWORD"],
            database=os.environ["ANALYTICSDB_NAME"],
            ssl="prefer",
            min_size=0,
            max_size=10,
        )
    return pool


async def close_pool():
    global pool
    if pool:
        try:
            await asyncio.wait_for(pool.close(), timeout=3)
        except Exception:
            pool.terminate()
        pool = None
