"""Auth endpoints."""
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Response

from auth import (
    create_access_token,
    get_current_user,
    hash_password,
    verify_password,
)
from db import get_db
from models import LoginInput, RegisterInput

router = APIRouter(prefix="/api/auth", tags=["auth"])


INITIAL_COINS = 0
INITIAL_RATING = 1000


def _user_public(user: dict) -> dict:
    return {
        "id": user["id"],
        "email": user["email"],
        "username": user["username"],
        "coins": user.get("coins", INITIAL_COINS),
        "rating": user.get("rating", INITIAL_RATING),
        "wins": user.get("wins", 0),
        "losses": user.get("losses", 0),
    }


@router.post("/register")
async def register(payload: RegisterInput, response: Response):
    db = get_db()
    email = payload.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="Email already registered")
    if await db.users.find_one({"username": payload.username}):
        raise HTTPException(status_code=400, detail="Username already taken")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "username": payload.username,
        "password_hash": hash_password(payload.password),
        "coins": INITIAL_COINS,
        "rating": INITIAL_RATING,
        "wins": 0,
        "losses": 0,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(user)
    token = create_access_token(user["id"], user["email"])
    response.set_cookie(
        "access_token",
        token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {"token": token, "user": _user_public(user)}


@router.post("/login")
async def login(payload: LoginInput, response: Response):
    db = get_db()
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    response.set_cookie(
        "access_token",
        token,
        httponly=True,
        secure=False,
        samesite="lax",
        max_age=60 * 60 * 24 * 7,
        path="/",
    )
    return {"token": token, "user": _user_public(user)}


@router.post("/logout")
async def logout(response: Response):
    response.delete_cookie("access_token", path="/")
    return {"ok": True}


@router.get("/me")
async def me(current_user: dict = Depends(get_current_user)):
    return _user_public(current_user)
