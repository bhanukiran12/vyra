"""Game REST endpoints: rooms, profile, leaderboard, match history, board."""
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
import random
import string
from datetime import datetime, timezone

from auth import get_current_user
from db import get_db
from models import CreateRoomInput, JoinRoomInput
from game_engine import new_game
from board import NODES, ADJACENCY

router = APIRouter(prefix="/api", tags=["game"])


def _room_code():
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=6))


def _public_room(room: dict) -> dict:
    return {
        "code": room["code"],
        "host": room["host"],
        "guest": room.get("guest"),
        "host_side": room["host_side"],
        "status": room["status"],
        "created_at": room["created_at"],
        "winner": room.get("winner"),
    }


@router.get("/board")
async def get_board():
    """Static board metadata (nodes + adjacency)."""
    return {
        "nodes": NODES,
        "adjacency": ADJACENCY,
    }


@router.post("/rooms/create")
async def create_room(payload: CreateRoomInput, current_user: dict = Depends(get_current_user)):
    db = get_db()
    # Generate unique code
    for _ in range(6):
        code = _room_code()
        if not await db.rooms.find_one({"code": code}):
            break
    else:
        raise HTTPException(status_code=500, detail="Could not generate room code")
    room = {
        "code": code,
        "host": {
            "id": current_user["id"],
            "username": current_user["username"],
            "rating": current_user.get("rating", 1000),
        },
        "guest": None,
        "host_side": payload.side,
        "status": "waiting",  # waiting | active | finished
        "state": new_game(),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "winner": None,
    }
    await db.rooms.insert_one(room)
    return _public_room(room)


@router.post("/rooms/join")
async def join_room(payload: JoinRoomInput, current_user: dict = Depends(get_current_user)):
    db = get_db()
    code = payload.code.upper().strip()
    room = await db.rooms.find_one({"code": code}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if room["status"] == "finished":
        raise HTTPException(status_code=400, detail="Game already finished")
    if room["host"]["id"] == current_user["id"]:
        # Host rejoining their own room
        return _public_room(room)
    if room.get("guest") and room["guest"]["id"] != current_user["id"]:
        raise HTTPException(status_code=400, detail="Room is full")
    guest = {
        "id": current_user["id"],
        "username": current_user["username"],
        "rating": current_user.get("rating", 1000),
    }
    update = {"guest": guest}
    if room["status"] == "waiting":
        update["status"] = "active"
    await db.rooms.update_one({"code": code}, {"$set": update})
    room.update(update)
    return _public_room(room)


@router.get("/rooms/{code}")
async def get_room(code: str, current_user: dict = Depends(get_current_user)):
    db = get_db()
    room = await db.rooms.find_one({"code": code.upper()}, {"_id": 0})
    if not room:
        raise HTTPException(status_code=404, detail="Room not found")
    if current_user["id"] not in (room["host"]["id"], (room.get("guest") or {}).get("id")):
        raise HTTPException(status_code=403, detail="Not a member of this room")
    # Determine your side
    side = None
    if current_user["id"] == room["host"]["id"]:
        side = room["host_side"]
    elif room.get("guest") and current_user["id"] == room["guest"]["id"]:
        side = "goat" if room["host_side"] == "tiger" else "tiger"
    return {
        "room": _public_room(room),
        "state": room["state"],
        "your_side": side,
    }


@router.get("/leaderboard")
async def leaderboard(limit: int = 20):
    db = get_db()
    cursor = db.users.find(
        {}, {"_id": 0, "password_hash": 0, "email": 0}
    ).sort("rating", -1).limit(limit)
    items = []
    async for u in cursor:
        items.append(
            {
                "username": u["username"],
                "rating": u.get("rating", 1000),
                "wins": u.get("wins", 0),
                "losses": u.get("losses", 0),
                "coins": u.get("coins", 0),
            }
        )
    return items


@router.get("/profile")
async def profile(current_user: dict = Depends(get_current_user)):
    return {
        "user": {
            "id": current_user["id"],
            "email": current_user["email"],
            "username": current_user["username"],
            "coins": current_user.get("coins", 0),
            "rating": current_user.get("rating", 1000),
            "wins": current_user.get("wins", 0),
            "losses": current_user.get("losses", 0),
        }
    }


@router.get("/match-history")
async def match_history(current_user: dict = Depends(get_current_user), limit: int = 20):
    db = get_db()
    cursor = (
        db.matches.find({"user_id": current_user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(limit)
    )
    items = []
    async for m in cursor:
        items.append(m)
    return items
