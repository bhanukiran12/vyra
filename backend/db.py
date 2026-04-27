"""Shared MongoDB client."""
import os
from motor.motor_asyncio import AsyncIOMotorClient

_client = None
_db = None


def init_db():
    global _client, _db
    if _client is None:
        mongo_url = os.environ.get("MONGO_URL")
        db_name = os.environ.get("DB_NAME", "vyra")
        if not mongo_url:
            raise ValueError("MONGO_URL environment variable is required")
        _client = AsyncIOMotorClient(mongo_url)
        _db = _client[db_name]
    return _db


def get_db():
    if _db is None:
        return init_db()
    return _db


def close_db():
    global _client
    if _client is not None:
        _client.close()
        _client = None
