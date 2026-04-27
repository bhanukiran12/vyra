"""Pydantic models."""
from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List
from datetime import datetime, timezone
import uuid


def _uuid():
    return str(uuid.uuid4())


def _now():
    return datetime.now(timezone.utc)


class RegisterInput(BaseModel):
    email: EmailStr
    password: str = Field(min_length=4, max_length=128)
    username: str = Field(min_length=2, max_length=24)


class LoginInput(BaseModel):
    email: EmailStr
    password: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    username: str
    coins: int
    rating: int
    wins: int
    losses: int


class CreateRoomInput(BaseModel):
    side: str = Field(pattern="^(tiger|goat)$")
    entry_fee: int = Field(default=0, ge=0, le=1000)


class JoinRoomInput(BaseModel):
    code: str
    side: Optional[str] = None


class MatchHistoryItem(BaseModel):
    id: str
    opponent: str
    side: str
    result: str  # win | loss
    coins_delta: int
    rating_delta: int
    created_at: datetime


# Wallet / payments (Stripe Checkout)
class CheckoutInput(BaseModel):
    package_id: str = Field(min_length=1, max_length=64)
    success_path: str = Field(default="/wallet", max_length=200)
    cancel_path: str = Field(default="/wallet", max_length=200)


class FinalizeInput(BaseModel):
    session_id: str = Field(min_length=4, max_length=200)


# Store
class StorePurchaseInput(BaseModel):
    item_id: str = Field(min_length=1, max_length=64)


class StoreCheckoutInput(BaseModel):
    item_id: str = Field(min_length=1, max_length=64)
    success_path: str = Field(default="/store", max_length=200)
    cancel_path: str = Field(default="/store", max_length=200)
