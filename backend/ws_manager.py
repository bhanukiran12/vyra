"""WebSocket manager for Vyra game rooms."""
import json
import asyncio
from typing import Dict, Set
from datetime import datetime, timezone

from fastapi import WebSocket, WebSocketDisconnect

from auth import decode_token
from db import get_db
from game_engine import validate_and_apply_move, apply_ability
from economy import payout_for_pot
import uuid


class RoomHub:
    def __init__(self):
        self.rooms: Dict[str, Set[WebSocket]] = {}
        self.lock = asyncio.Lock()

    async def join(self, code: str, ws: WebSocket):
        async with self.lock:
            self.rooms.setdefault(code, set()).add(ws)

    async def leave(self, code: str, ws: WebSocket):
        async with self.lock:
            if code in self.rooms:
                self.rooms[code].discard(ws)
                if not self.rooms[code]:
                    self.rooms.pop(code, None)

    async def broadcast(self, code: str, message: dict):
        members = list(self.rooms.get(code, set()))
        for ws in members:
            try:
                await ws.send_json(message)
            except Exception:
                pass


hub = RoomHub()


async def _finalize_match(db, room: dict, winner_side: str):
    """Award coins + rating on game finish, idempotent."""
    if room.get("finalized"):
        return
    host = room["host"]
    guest = room.get("guest")
    if not guest:
        return
    host_side = room["host_side"]
    guest_side = "goat" if host_side == "tiger" else "tiger"
    winner_user = host if host_side == winner_side else guest
    loser_user = guest if winner_user is host else host
    winner_elo_gain = 25
    loser_elo_loss = 25

    pot = int(room.get("pot", 0))
    if pot > 0:
        split = payout_for_pot(pot)
        winner_coins = split["winner"]
        loser_coins = 0
        platform_fee = split["platform"]
    else:
        # Casual match — house bonus
        winner_coins = 100
        loser_coins = 20
        platform_fee = 0
    now = datetime.now(timezone.utc).isoformat()

    await db.users.update_one(
        {"id": winner_user["id"]},
        {"$inc": {"coins": winner_coins, "rating": winner_elo_gain, "wins": 1}},
    )
    await db.users.update_one(
        {"id": loser_user["id"]},
        {"$inc": {"coins": loser_coins, "rating": -loser_elo_loss, "losses": 1}},
    )
    if pot > 0:
        await db.transactions.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": winner_user["id"],
                "kind": "match_win",
                "delta": winner_coins,
                "currency": "coins",
                "room_code": room["code"],
                "pot": pot,
                "platform_fee": platform_fee,
                "status": "completed",
                "description": f"Match win · pot {pot} (fee {platform_fee})",
                "created_at": now,
            }
        )
    else:
        await db.transactions.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": winner_user["id"],
                "kind": "match_win",
                "delta": winner_coins,
                "currency": "coins",
                "room_code": room["code"],
                "status": "completed",
                "description": f"Match win · room {room['code']}",
                "created_at": now,
            }
        )
        await db.transactions.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": loser_user["id"],
                "kind": "match_loss",
                "delta": loser_coins,
                "currency": "coins",
                "room_code": room["code"],
                "status": "completed",
                "description": f"Consolation · room {room['code']}",
                "created_at": now,
            }
        )
    await db.matches.insert_many(
        [
            {
                "user_id": winner_user["id"],
                "opponent": loser_user["username"],
                "side": winner_side,
                "result": "win",
                "coins_delta": winner_coins,
                "rating_delta": winner_elo_gain,
                "created_at": now,
            },
            {
                "user_id": loser_user["id"],
                "opponent": winner_user["username"],
                "side": guest_side if loser_user is guest else host_side,
                "result": "loss",
                "coins_delta": loser_coins,
                "rating_delta": -loser_elo_loss,
                "created_at": now,
            },
        ]
    )
    await db.rooms.update_one(
        {"code": room["code"]},
        {"$set": {"finalized": True, "status": "finished", "winner": winner_side}},
    )


def _side_for(room: dict, user_id: str):
    if room["host"]["id"] == user_id:
        return room["host_side"]
    if room.get("guest") and room["guest"]["id"] == user_id:
        return "goat" if room["host_side"] == "tiger" else "tiger"
    return None


async def _send_state(ws: WebSocket, room: dict, user_id: str):
    await ws.send_json(
        {
            "type": "state",
            "room": {
                "code": room["code"],
                "host": room["host"],
                "guest": room.get("guest"),
                "host_side": room["host_side"],
                "status": room["status"],
                "winner": room.get("winner"),
            },
            "state": room["state"],
            "your_side": _side_for(room, user_id),
        }
    )


async def handle_socket(ws: WebSocket, code: str, token: str):
    payload = decode_token(token) if token else None
    if not payload or payload.get("type") != "access":
        await ws.close(code=4401)
        return
    user_id = payload["sub"]
    db = get_db()

    code = code.upper()
    room = await db.rooms.find_one({"code": code}, {"_id": 0})
    if not room:
        await ws.close(code=4404)
        return
    # Auth: must be host or guest (or auto-join as guest if room open)
    if user_id not in (room["host"]["id"], (room.get("guest") or {}).get("id")):
        if room.get("guest"):
            await ws.close(code=4403)
            return
        user = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
        if not user:
            await ws.close(code=4401)
            return
        guest = {
            "id": user["id"],
            "username": user["username"],
            "rating": user.get("rating", 1000),
        }
        await db.rooms.update_one(
            {"code": code}, {"$set": {"guest": guest, "status": "active"}}
        )
        room["guest"] = guest
        room["status"] = "active"

    await ws.accept()
    await hub.join(code, ws)

    # Send initial state to the joiner and notify others
    await _send_state(ws, room, user_id)
    await hub.broadcast(
        code,
        {
            "type": "presence",
            "message": f"{payload.get('email', user_id)} connected",
        },
    )
    # Also broadcast full state to all
    room = await db.rooms.find_one({"code": code}, {"_id": 0})
    await hub.broadcast(
        code,
        {
            "type": "state",
            "room": {
                "code": room["code"],
                "host": room["host"],
                "guest": room.get("guest"),
                "host_side": room["host_side"],
                "status": room["status"],
                "winner": room.get("winner"),
            },
            "state": room["state"],
        },
    )

    try:
        while True:
            raw = await ws.receive_text()
            try:
                msg = json.loads(raw)
            except Exception:
                await ws.send_json({"type": "error", "message": "Invalid JSON"})
                continue

            action = msg.get("action")
            room = await db.rooms.find_one({"code": code}, {"_id": 0})
            if not room:
                await ws.send_json({"type": "error", "message": "Room missing"})
                continue
            side = _side_for(room, user_id)
            if not side:
                await ws.send_json({"type": "error", "message": "Not a player"})
                continue
            state = room["state"]

            if action == "place":
                ok, err, events = validate_and_apply_move(
                    state, side, None, msg.get("to")
                )
            elif action == "move":
                ok, err, events = validate_and_apply_move(
                    state, side, msg.get("from"), msg.get("to")
                )
            elif action == "ability":
                ok, err, events = apply_ability(
                    state, side, msg.get("ability"), msg.get("payload") or {}
                )
            elif action == "ping":
                await ws.send_json({"type": "pong"})
                continue
            else:
                await ws.send_json({"type": "error", "message": "Unknown action"})
                continue

            if not ok:
                await ws.send_json({"type": "error", "message": err})
                continue

            await db.rooms.update_one({"code": code}, {"$set": {"state": state}})

            payload_msg = {
                "type": "state",
                "state": state,
                "events": events,
            }
            if state.get("winner"):
                await _finalize_match(db, room, state["winner"])
                room2 = await db.rooms.find_one({"code": code}, {"_id": 0})
                payload_msg["room"] = {
                    "code": room2["code"],
                    "host": room2["host"],
                    "guest": room2.get("guest"),
                    "host_side": room2["host_side"],
                    "status": room2["status"],
                    "winner": room2.get("winner"),
                }
                payload_msg["type"] = "gameOver"
            await hub.broadcast(code, payload_msg)

    except WebSocketDisconnect:
        await hub.leave(code, ws)
    except Exception:
        await hub.leave(code, ws)
        try:
            await ws.close()
        except Exception:
            pass
