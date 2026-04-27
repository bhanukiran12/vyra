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
