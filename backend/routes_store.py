"""Store endpoints: skins + maps, purchasable with coins or USD."""
import os
import uuid
from datetime import datetime, timezone

import razorpay
from fastapi import APIRouter, Depends, HTTPException

from auth import get_current_user
from db import get_db
from economy import STORE_ITEMS, get_store_item
from models import StorePurchaseInput, StoreOrderInput

router = APIRouter(prefix="/api/store", tags=["store"])


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _client() -> razorpay.Client:
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=503, detail="Razorpay is not configured."
        )
    return razorpay.Client(auth=(key_id, key_secret))


@router.get("/items")
async def list_items():
    return {"items": STORE_ITEMS}


@router.get("/inventory")
async def inventory(current_user: dict = Depends(get_current_user)):
    db = get_db()
    cursor = db.inventory.find({"user_id": current_user["id"]}, {"_id": 0})
    owned = []
    async for entry in cursor:
        owned.append(entry["item_id"])
    return {"owned": owned}


async def _grant_item(db, user_id: str, item: dict, source: str, payment_ref: str):
    """Idempotent grant of an inventory item."""
    res = await db.inventory.update_one(
        {"user_id": user_id, "item_id": item["id"]},
        {
            "$setOnInsert": {
                "user_id": user_id,
                "item_id": item["id"],
                "kind": item["kind"],
                "name": item["name"],
                "source": source,
                "payment_ref": payment_ref,
                "created_at": _now_iso(),
            }
        },
        upsert=True,
    )
    return res.upserted_id is not None


@router.post("/purchase")
async def purchase_with_coins(
    payload: StorePurchaseInput, current_user: dict = Depends(get_current_user)
):
    item = get_store_item(payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if "coins" not in item:
        raise HTTPException(status_code=400, detail="Item not available for coins")

    db = get_db()
    already = await db.inventory.find_one(
        {"user_id": current_user["id"], "item_id": item["id"]}
    )
    if already:
        raise HTTPException(status_code=400, detail="You already own this item")

    cost = int(item["coins"])
    # Atomic: only deduct if balance suffices
    res = await db.users.update_one(
        {"id": current_user["id"], "coins": {"$gte": cost}},
        {"$inc": {"coins": -cost}},
    )
    if res.modified_count == 0:
        raise HTTPException(status_code=400, detail="Not enough coins")

    granted = await _grant_item(db, current_user["id"], item, "coins", "")
    if not granted:
        # race: refund the coins
        await db.users.update_one(
            {"id": current_user["id"]}, {"$inc": {"coins": cost}}
        )
        raise HTTPException(status_code=400, detail="You already own this item")

    await db.transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": current_user["id"],
            "kind": "store_purchase",
            "delta": -cost,
            "currency": "coins",
            "item_id": item["id"],
            "status": "completed",
            "description": f"Store · {item['name']}",
            "created_at": _now_iso(),
        }
    )

    user = await db.users.find_one(
        {"id": current_user["id"]}, {"_id": 0, "password_hash": 0}
    )
    return {"ok": True, "item": item, "balance": user.get("coins", 0)}


@router.post("/order")
async def create_store_order(
    payload: StoreOrderInput, current_user: dict = Depends(get_current_user)
):
    """Create a Razorpay order for a direct USD store purchase."""
    item = get_store_item(payload.item_id)
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    if "usd" not in item:
        raise HTTPException(status_code=400, detail="Item not available for USD")

    db = get_db()
    already = await db.inventory.find_one(
        {"user_id": current_user["id"], "item_id": item["id"]}
    )
    if already:
        raise HTTPException(status_code=400, detail="You already own this item")

    client = _client()
    amount_minor = int(round(item["usd"] * 100))
    receipt = f"vyra_store_{uuid.uuid4().hex[:18]}"
    order = client.order.create(
        {
            "amount": amount_minor,
            "currency": "USD",
            "receipt": receipt,
            "notes": {
                "user_id": current_user["id"],
                "item_id": item["id"],
                "kind": "store",
            },
        }
    )

    await db.orders.insert_one(
        {
            "order_id": order["id"],
            "user_id": current_user["id"],
            "kind": "store",
            "item_id": item["id"],
            "amount_minor": amount_minor,
            "currency": "USD",
            "status": "created",
            "receipt": receipt,
            "created_at": _now_iso(),
        }
    )

    return {
        "order_id": order["id"],
        "amount": amount_minor,
        "currency": "USD",
        "key_id": os.environ["RAZORPAY_KEY_ID"],
        "item": item,
        "name": "Vyra Store",
        "description": item["name"],
        "prefill": {
            "email": current_user.get("email"),
            "name": current_user.get("username"),
        },
    }


async def credit_store_purchase(db, order_doc: dict, payment_id: str):
    """Idempotently grant the store item once a USD order is paid."""
    if order_doc.get("status") == "paid":
        return order_doc
    res = await db.orders.update_one(
        {"order_id": order_doc["order_id"], "status": {"$ne": "paid"}},
        {
            "$set": {
                "status": "paid",
                "payment_id": payment_id,
                "paid_at": _now_iso(),
            }
        },
    )
    if res.modified_count == 0:
        return await db.orders.find_one(
            {"order_id": order_doc["order_id"]}, {"_id": 0}
        )

    item = get_store_item(order_doc["item_id"])
    if item:
        granted = await _grant_item(
            db, order_doc["user_id"], item, "usd", payment_id
        )
        await db.transactions.insert_one(
            {
                "id": str(uuid.uuid4()),
                "user_id": order_doc["user_id"],
                "kind": "store_purchase_usd",
                "delta": 0,
                "currency": "USD",
                "usd_amount": order_doc["amount_minor"] / 100,
                "item_id": item["id"],
                "order_id": order_doc["order_id"],
                "payment_id": payment_id,
                "status": "completed" if granted else "duplicate",
                "description": f"Store (USD) · {item['name']}",
                "created_at": _now_iso(),
            }
        )
    return await db.orders.find_one(
        {"order_id": order_doc["order_id"]}, {"_id": 0}
    )
