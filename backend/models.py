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


# Wallet / payments
class CreateOrderInput(BaseModel):
    package_id: str = Field(min_length=1, max_length=64)


class VerifyPaymentInput(BaseModel):
    razorpay_order_id: str
    razorpay_payment_id: str
    razorpay_signature: str


# Store
class StorePurchaseInput(BaseModel):
    item_id: str = Field(min_length=1, max_length=64)


class StoreOrderInput(BaseModel):
    item_id: str = Field(min_length=1, max_length=64)


# Withdrawals
class WithdrawalInput(BaseModel):
    coins: int = Field(ge=250, le=1_000_000)
    method: str = Field(pattern="^(upi|bank)$")
    payout_target: str = Field(min_length=3, max_length=128)
    holder_name: str = Field(min_length=2, max_length=64)
