"""Vyra FastAPI backend."""
from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import logging
import os

from fastapi import FastAPI, Request, WebSocket
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from starlette.middleware.cors import CORSMiddleware

from db import init_db, close_db, get_db
from routes_auth import router as auth_router
from routes_game import router as game_router
from routes_wallet import router as wallet_router, handle_webhook as wallet_webhook
from routes_store import router as store_router
from matchmaking import router as matchmaking_router
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
app.include_router(wallet_router)
app.include_router(store_router)
app.include_router(matchmaking_router)

app.mount("/", StaticFiles(directory="static", html=True), name="static")


@app.get("/{path:path}")
async def serve_frontend(path: str):
    return FileResponse("static/index.html")


@app.get("/api/")
async def root():
    return {"message": "Vyra API online"}


@app.get("/api/health")
async def health():
    return {"status": "ok"}


@app.post("/api/wallet/webhook")
async def wallet_webhook_route(request: Request):
    """Razorpay webhook (raw body required for signature verification)."""
    raw = await request.body()
    sig = request.headers.get("x-razorpay-signature", "")
    result = await wallet_webhook(raw, sig)
    return JSONResponse(result)


@app.websocket("/api/ws/{code}")
async def websocket_endpoint(websocket: WebSocket, code: str):
    # Validate origin for production WebSocket connections
    # This is checked before accept() to prevent potential abuse
    origin = websocket.headers.get("origin")
    allowed_origins = os.environ.get("CORS_ORIGINS", "*").split(",")
    
    # Only validate origin if we have explicit allowed origins (not wildcard)
    if origin and "*" not in allowed_origins:
        # Extract base origin without trailing slash
        origin_base = origin.rstrip("/")
        allowed = False
        for allowed_origin in allowed_origins:
            allowed_origin = allowed_origin.strip().rstrip("/")
            if origin_base == allowed_origin or allowed_origin == "*":
                allowed = True
                break
        if not allowed:
            # Log rejected WebSocket connection attempt
            logger = logging.getLogger("vyra.websocket")
            logger.warning(
                f"WebSocket connection rejected - origin: {origin}, code: {code}, "
                f"allowed_origins: {allowed_origins}"
            )
            await websocket.close(code=4403, reason="Origin not allowed")
            return
    
    token = websocket.query_params.get("token") or ""
    await handle_socket(websocket, code, token)


@app.on_event("startup")
async def on_startup():
    db = init_db()
    await db.users.create_index("email", unique=True)
    await db.users.create_index("username", unique=True)
    await db.rooms.create_index("code", unique=True)
    await db.matches.create_index("user_id")
    await db.orders.create_index("order_id", unique=True)
    await db.orders.create_index("user_id")
    await db.transactions.create_index("user_id")
    await db.transactions.create_index([("user_id", 1), ("created_at", -1)])
    await db.inventory.create_index(
        [("user_id", 1), ("item_id", 1)], unique=True
    )


@app.on_event("shutdown")
async def on_shutdown():
    close_db()


logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
)
