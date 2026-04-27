"""Quick-match queue: auto-pair players at the same entry-fee tier.

Long-polled. The first arrival waits inside the request for up to
POLL_TIMEOUT_SECONDS. The second arrival creates the room synchronously and
resolves the first waiter's future. Stake is deducted on enqueue and refunded
on cancel/timeout-eviction.
"""
import asyncio
import random
import string
import uuid
from datetime import datetime, timezone
from typing import Optional, Dict, List

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import get_current_user
from db import get_db
from economy import ALLOWED_ENTRY_FEES
from game_engine import new_game

router = APIRouter(prefix="/api/matchmaking", tags=["matchmaking"])

POLL_TIMEOUT_SECONDS = 25
STALE_AFTER_SECONDS = 90  # evict + refund waiters that stopped re-polling


class QueueInput(BaseModel):
    entry_fee: int = Field(default=0, ge=0, le=1000)
    side: Optional[str] = Field(default=None, pattern="^(tiger|goat)$")


_queues: Dict[int, List[dict]] = {}
_user_index: Dict[str, dict] = {}
_lock = asyncio.Lock()


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _now_ts() -> float:
    return datetime.now(timezone.utc).timestamp()


def _room_code() -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


async def _refund(db, user_id: str, amount: int) -> None:
    if amount > 0:
        await db.users.update_one({"id": user_id}, {"$inc": {"coins": amount}})


async def _evict_stale_locked(db) -> None:
    """Lock must be held. Drops abandoned waiters and refunds their stake."""
    cutoff = _now_ts() - STALE_AFTER_SECONDS
    stale = [w for w in _user_index.values() if w["last_poll_ts"] < cutoff]
    for w in stale:
        _user_index.pop(w["user_id"], None)
        q = _queues.get(w["entry_fee"], [])
        if w in q:
            q.remove(w)
        if not w["future"].done():
            w["future"].cancel()
        await _refund(db, w["user_id"], w["entry_fee"])


async def _create_match_room(
    db, host: dict, guest: dict, host_side: str, entry_fee: int
) -> str:
    for _ in range(8):
        code = _room_code()
        if not await db.rooms.find_one({"code": code}):
            break
    else:
        raise HTTPException(500, "Could not generate room code")

    pot = entry_fee * 2 if entry_fee > 0 else 0
    stakers = [host["id"], guest["id"]] if entry_fee > 0 else []
    now_iso = _now_iso()

    await db.rooms.insert_one(
        {
            "code": code,
            "host": host,
            "guest": guest,
            "host_side": host_side,
            "status": "active",
            "state": new_game(),
            "created_at": now_iso,
            "winner": None,
            "entry_fee": entry_fee,
            "pot": pot,
            "stakers": stakers,
            "matchmaking": True,
        }
    )
    if entry_fee > 0:
        await db.transactions.insert_many(
            [
                {
                    "id": str(uuid.uuid4()),
                    "user_id": host["id"],
                    "kind": "entry_fee",
                    "delta": -entry_fee,
                    "currency": "coins",
                    "room_code": code,
                    "status": "completed",
                    "description": f"Quick match · room {code}",
                    "created_at": now_iso,
                },
                {
                    "id": str(uuid.uuid4()),
                    "user_id": guest["id"],
                    "kind": "entry_fee",
                    "delta": -entry_fee,
                    "currency": "coins",
                    "room_code": code,
                    "status": "completed",
                    "description": f"Quick match · room {code}",
                    "created_at": now_iso,
                },
            ]
        )
    return code


def _resolve_waiter(waiter: dict, code: str, side: str) -> None:
    waiter["match_result"] = {"code": code, "your_side": side}
    if not waiter["future"].done():
        waiter["future"].set_result(waiter["match_result"])


@router.post("/queue")
async def queue(
    payload: QueueInput, current_user: dict = Depends(get_current_user)
):
    """Enqueue (or re-poll) for a quick match. Long-polls up to 25s."""
    db = get_db()
    entry_fee = int(payload.entry_fee or 0)
    if entry_fee not in ALLOWED_ENTRY_FEES:
        raise HTTPException(400, "Invalid entry fee")
    user_id = current_user["id"]

    fut: Optional[asyncio.Future] = None
    async with _lock:
        await _evict_stale_locked(db)

        existing = _user_index.get(user_id)
        if existing and existing["entry_fee"] != entry_fee:
            raise HTTPException(
                409, "Cancel your current matchmaking before changing tiers"
            )
        if existing and existing.get("match_result"):
            result = existing["match_result"]
            _user_index.pop(user_id, None)
            return {"matched": True, **result}
        if existing:
            existing["last_poll_ts"] = _now_ts()
            fut = existing["future"]
        else:
            tier = _queues.setdefault(entry_fee, [])
            opponent = next(
                (w for w in tier if w["user_id"] != user_id), None
            )
            if opponent:
                tier.remove(opponent)
                if entry_fee > 0:
                    res = await db.users.update_one(
                        {"id": user_id, "coins": {"$gte": entry_fee}},
                        {"$inc": {"coins": -entry_fee}},
                    )
                    if res.modified_count == 0:
                        tier.append(opponent)  # restore
                        raise HTTPException(
                            400, "Not enough coins for this tier"
                        )
                host_side = opponent["side"] or random.choice(
                    ["tiger", "goat"]
                )
                guest_side = "goat" if host_side == "tiger" else "tiger"
                host = {
                    "id": opponent["user_id"],
                    "username": opponent["username"],
                    "rating": opponent["rating"],
                }
                guest = {
                    "id": user_id,
                    "username": current_user["username"],
                    "rating": current_user.get("rating", 1000),
                }
                try:
                    code = await _create_match_room(
                        db, host, guest, host_side, entry_fee
                    )
                except Exception:
                    await _refund(db, user_id, entry_fee)
                    await _refund(db, opponent["user_id"], entry_fee)
                    if not opponent["future"].done():
                        opponent["future"].cancel()
                    raise
                _resolve_waiter(opponent, code, host_side)
                return {"matched": True, "code": code, "your_side": guest_side}

            # No opponent — deduct & enqueue
            if entry_fee > 0:
                res = await db.users.update_one(
                    {"id": user_id, "coins": {"$gte": entry_fee}},
                    {"$inc": {"coins": -entry_fee}},
                )
                if res.modified_count == 0:
                    raise HTTPException(
                        400, "Not enough coins for this tier"
                    )
            fut = asyncio.get_running_loop().create_future()
            waiter = {
                "user_id": user_id,
                "username": current_user["username"],
                "rating": current_user.get("rating", 1000),
                "side": payload.side,
                "entry_fee": entry_fee,
                "future": fut,
                "joined_at": _now_iso(),
                "last_poll_ts": _now_ts(),
                "match_result": None,
            }
            tier.append(waiter)
            _user_index[user_id] = waiter

    # Long-poll outside the lock
    try:
        result = await asyncio.wait_for(fut, timeout=POLL_TIMEOUT_SECONDS)
        async with _lock:
            _user_index.pop(user_id, None)
        return {"matched": True, **result}
    except asyncio.TimeoutError:
        return {"matched": False, "waiting": True, "entry_fee": entry_fee}
    except asyncio.CancelledError:
        # Explicit /cancel from the client (or stale eviction) cancelled the future.
        # The cleanup + refund already happened in _leave; respond cleanly.
        return {"matched": False, "cancelled": True}


async def _leave(user_id: str, refund: bool = True) -> bool:
    db = get_db()
    async with _lock:
        waiter = _user_index.pop(user_id, None)
        if not waiter:
            return False
        # If they were already matched (result set), don't refund
        already_matched = waiter.get("match_result") is not None
        tier = _queues.get(waiter["entry_fee"], [])
        if waiter in tier:
            tier.remove(waiter)
        if not waiter["future"].done():
            waiter["future"].cancel()
        if refund and not already_matched:
            await _refund(db, user_id, waiter["entry_fee"])
        return True


@router.post("/cancel")
async def cancel(current_user: dict = Depends(get_current_user)):
    left = await _leave(current_user["id"], refund=True)
    return {"cancelled": left}


@router.get("/status")
async def status(current_user: dict = Depends(get_current_user)):
    waiter = _user_index.get(current_user["id"])
    queued_counts = {fee: len(q) for fee, q in _queues.items() if q}
    if waiter:
        return {
            "queued": True,
            "entry_fee": waiter["entry_fee"],
            "queue_sizes": queued_counts,
        }
    return {"queued": False, "queue_sizes": queued_counts}
