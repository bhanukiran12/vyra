"""Vyra FastAPI backend."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import logging
import os

from fastapi import FastAPI, WebSocket
from starlette.middleware.cors import CORSMiddleware

from db import init_db, close_db, get_db
from routes_auth import router as auth_router
from routes_game import router as game_router
from ws_manager import handle_socket

app = FastAPI(title="Vyra API")

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(game_router)


@app.get("/api/")
async def root():
    return {"message": "Vyra API online"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.websocket("/api/ws/{code}")
async def websocket_endpoint(websocket: WebSocket, code: str):
    token = websocket.query_params.get("token") or ""
    await handle_socket(websocket, code, token)


@app.on_event("startup")
async def on_startup():
    db = init_db()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.rooms.create_index("code", unique=True)
    await db.matches.create_index("user_id")


@app.on_event("shutdown")
async def on_shutdown():
    close_db()


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
