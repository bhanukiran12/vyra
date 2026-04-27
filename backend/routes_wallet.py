"""Razorpay wallet & top-up endpoints."""
import hmac
import hashlib
import logging
import os
import uuid
from datetime import datetime, timezone

import razorpay
from fastapi import APIRouter, Depends, HTTPException, Request

from auth import get_current_user
from db import get_db
from economy import COIN_PACKAGES, get_package
from models import CreateOrderInput, VerifyPaymentInput

log = logging.getLogger("vyra.wallet")
router = APIRouter(prefix="/api/wallet", tags=["wallet"])


def _client() -> razorpay.Client:
    key_id = os.environ.get("RAZORPAY_KEY_ID")
    key_secret = os.environ.get("RAZORPAY_KEY_SECRET")
    if not key_id or not key_secret:
        raise HTTPException(
            status_code=503,
            detail="Razorpay is not configured. Set RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.",
        )
    return razorpay.Client(auth=(key_id, key_secret))


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


@router.get("/packages")
async def list_packages():
    """Available coin top-up packages (USD → coins)."""
    return {"packages": COIN_PACKAGES, "currency": "USD"}


@router.get("/balance")
async def balance(current_user: dict = Depends(get_current_user)):
    return {
        "coins": current_user.get("coins", 0),
        "username": current_user.get("username"),
    }


@router.get("/transactions")
async def transactions(
    limit: int = 50, current_user: dict = Depends(get_current_user)
):
    db = get_db()
    cursor = (
        db.transactions.find({"user_id": current_user["id"]}, {"_id": 0})
        .sort("created_at", -1)
        .limit(min(max(limit, 1), 200))
    )
    items = []
    async for t in cursor:
        items.append(t)
    return {"transactions": items}


@router.post("/order")
async def create_order(
    payload: CreateOrderInput, current_user: dict = Depends(get_current_user)
):
    """Create a Razorpay Order for a coin package, return checkout details."""
    pkg = get_package(payload.package_id)
    if not pkg:
        raise HTTPException(status_code=400, detail="Unknown package")

    client = _client()
    amount_paise = int(round(pkg["usd"] * 100))  # smallest unit (cents/paise)
    receipt = f"vyra_topup_{uuid.uuid4().hex[:18]}"

    order = client.order.create(
        {
            "amount": amount_paise,
            "currency": "USD",
            "receipt": receipt,
            "notes": {
                "user_id": current_user["id"],
                "username": current_user["username"],
                "package_id": pkg["id"],
                "coins": str(pkg["coins"]),
                "kind": "topup",
            },
        }
    )

    db = get_db()
    await db.orders.insert_one(
        {
            "order_id": order["id"],
            "user_id": current_user["id"],
            "package_id": pkg["id"],
            "kind": "topup",
            "amount_minor": amount_paise,
            "currency": "USD",
            "coins": pkg["coins"],
            "status": "created",
            "receipt": receipt,
            "created_at": _now_iso(),
        }
    )

    return {
        "order_id": order["id"],
        "amount": amount_paise,
        "currency": "USD",
        "key_id": os.environ["RAZORPAY_KEY_ID"],
        "package": pkg,
        "name": "Vyra Coins",
        "description": f"{pkg['coins']} Vyra coins · {pkg['label']}",
        "prefill": {
            "email": current_user.get("email"),
            "name": current_user.get("username"),
        },
    }


def _verify_signature(order_id: str, payment_id: str, signature: str) -> bool:
    secret = os.environ.get("RAZORPAY_KEY_SECRET", "").encode()
    body = f"{order_id}|{payment_id}".encode()
    expected = hmac.new(secret, body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


async def _credit_topup(db, order_doc: dict, payment_id: str):
    """Idempotently credit coins for a paid top-up order."""
    if order_doc.get("status") == "paid":
        return order_doc
    # Atomic flip created → paid; only one writer wins.
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
    coins = int(order_doc["coins"])
    user_id = order_doc["user_id"]
    await db.users.update_one({"id": user_id}, {"$inc": {"coins": coins}})
    await db.transactions.insert_one(
        {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "kind": "topup",
            "delta": coins,
            "currency": "coins",
            "usd_amount": order_doc["amount_minor"] / 100,
            "package_id": order_doc.get("package_id"),
            "order_id": order_doc["order_id"],
            "payment_id": payment_id,
            "status": "completed",
            "description": f"Top-up · {coins} coins",
            "created_at": _now_iso(),
        }
    )
    return await db.orders.find_one(
        {"order_id": order_doc["order_id"]}, {"_id": 0}
    )


@router.post("/verify")
async def verify_payment(
    payload: VerifyPaymentInput,
    current_user: dict = Depends(get_current_user),
):
    """Verify a Razorpay payment after the checkout modal closes, then credit coins."""
    if not _verify_signature(
        payload.razorpay_order_id,
        payload.razorpay_payment_id,
        payload.razorpay_signature,
    ):
        raise HTTPException(status_code=400, detail="Invalid payment signature")

    db = get_db()
    order_doc = await db.orders.find_one(
        {"order_id": payload.razorpay_order_id}, {"_id": 0}
    )
    if not order_doc:
        raise HTTPException(status_code=404, detail="Order not found")
    if order_doc["user_id"] != current_user["id"]:
        raise HTTPException(status_code=403, detail="Order does not belong to you")

    if order_doc["kind"] == "topup":
        order_doc = await _credit_topup(db, order_doc, payload.razorpay_payment_id)
    elif order_doc["kind"] == "store":
        # delegated to routes_store helper
        from routes_store import credit_store_purchase

        order_doc = await credit_store_purchase(
            db, order_doc, payload.razorpay_payment_id
        )

    user = await db.users.find_one(
        {"id": current_user["id"]}, {"_id": 0, "password_hash": 0}
    )
    return {
        "ok": True,
        "order": order_doc,
        "balance": user.get("coins", 0),
    }


async def handle_webhook(raw_body: bytes, signature: str):
    """Razorpay webhook handler. Idempotent."""
    secret = os.environ.get("RAZORPAY_WEBHOOK_SECRET")
    if secret:
        expected = hmac.new(
            secret.encode(), raw_body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(expected, signature or ""):
            raise HTTPException(status_code=400, detail="Invalid webhook signature")

    import json

    try:
        event = json.loads(raw_body.decode())
    except Exception:
        raise HTTPException(status_code=400, detail="Malformed payload")

    event_type = event.get("event", "")
    log.info("razorpay webhook: %s", event_type)
    if event_type not in ("payment.captured", "order.paid"):
        return {"ignored": event_type}

    payload = event.get("payload", {})
    payment = payload.get("payment", {}).get("entity") or {}
    order = payload.get("order", {}).get("entity") or {}
    order_id = payment.get("order_id") or order.get("id")
    payment_id = payment.get("id") or "webhook"
    if not order_id:
        return {"ignored": "no order id"}

    db = get_db()
    order_doc = await db.orders.find_one({"order_id": order_id}, {"_id": 0})
    if not order_doc:
        log.warning("webhook for unknown order %s", order_id)
        return {"unknown_order": order_id}

    if order_doc["kind"] == "topup":
        await _credit_topup(db, order_doc, payment_id)
    elif order_doc["kind"] == "store":
        from routes_store import credit_store_purchase

        await credit_store_purchase(db, order_doc, payment_id)
    return {"ok": True}
