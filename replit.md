# Vyra

Vyra is a real-time multiplayer reimagining of the Aadu Puli Aatam (Goats vs.
Tigers) board game. The repo contains a FastAPI backend, a Create React App
frontend (Craco) and a MongoDB datastore.

## Stack

- **Frontend** — React 19 + Create React App via Craco, TailwindCSS, Radix UI,
  Zustand. Lives in `frontend/`.
- **Backend** — FastAPI + Motor (async Mongo) + bcrypt/PyJWT auth +
  WebSockets for live game state. Lives in `backend/`.
- **Database** — Local MongoDB 7 (started by the start script in dev).

## Replit setup

A single workflow named **Start application** runs `bash scripts/start.sh`.
The script:

1. Starts `mongod` on `127.0.0.1:27017` (data dir `/tmp/mongo-data`,
   logs `/tmp/mongo-logs/mongod.log`) if it isn't already running.
2. Launches the FastAPI backend with `uvicorn server:app` on
   `127.0.0.1:8001`.
3. Launches the CRA dev server on `0.0.0.0:5000` (bound to all hosts so the
   Replit preview iframe can reach it).

The CRA dev server proxies `/api/*` (HTTP + WebSocket) to the backend via
`frontend/src/setupProxy.js`, so the browser only ever talks to port 5000.
`REACT_APP_BACKEND_URL` is intentionally left empty — `frontend/src/lib/api.js`
falls back to `window.location.origin`, which makes the same code work in dev,
preview, and production.

## Economy & payments (Razorpay)

Vyra has an in-game coin economy backed by Razorpay USD top-ups. There is **no**
direct cash betting — players exchange USD for coins, then stake coins on
matches. Real-money flow:

1. Frontend asks `POST /api/wallet/order` with a `package_id`. Backend creates a
   Razorpay Order (currency `USD`) and persists it in `orders` (`status:created`).
2. `frontend/src/lib/razorpay.js` opens the Razorpay Checkout modal.
3. On success the modal returns `razorpay_order_id`, `razorpay_payment_id`,
   `razorpay_signature`. Frontend posts them to `POST /api/wallet/verify`.
4. Backend recomputes `HMAC_SHA256(order_id|payment_id, KEY_SECRET)` and only
   credits coins if signatures match. The `orders` row is atomically flipped
   `created → paid` so credit is exactly-once even if both the verify call and
   the webhook (`POST /api/wallet/webhook`) fire.

Coin packages: `$1→100`, `$5→550`, `$10→1200`, `$20→2600` (defined in
`backend/economy.py`). Match entry fees: `[0,10,25,50,100,250]`. Pot games pay
the winner `pot − 10%` (no consolation). Casual matches pay +100/+20.

Mongo collections added: `orders`, `transactions`, `inventory`. All have unique
indexes (`order_id` for orders, `(user_id,item_id)` for inventory) to keep the
flow idempotent.

Frontend pages:

- `/wallet` — balance + transaction ledger + Add coins modal
- `/store` — skins & maps purchasable in coins or direct USD
- TopBar shows the live coin balance with a `+` button that opens the top-up
  modal from anywhere.

## Environment variables

Configured in `backend/.env`:

- `MONGO_URL` — Mongo connection string (defaults to local mongod)
- `DB_NAME` — Database name (`vyra`)
- `JWT_SECRET` — HS256 secret used to sign auth tokens
- `CORS_ORIGINS` — Comma-separated allow-list (`*` in dev)

Secrets (Replit Secrets pane):

- `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET` — required for top-ups & store USD
- `RAZORPAY_WEBHOOK_SECRET` — optional; if set, `/api/wallet/webhook` rejects
  payloads with bad HMAC signatures

Configured in `frontend/.env`:

- `REACT_APP_BACKEND_URL` — empty so the client uses the current origin
- `PORT=5000`, `HOST=0.0.0.0`, `DANGEROUSLY_DISABLE_HOST_CHECK=true`,
  `WDS_SOCKET_PORT=0` — make CRA work behind the Replit proxy

## Deployment

Configured as a **VM** deployment running `bash scripts/start.sh`. VM is
required because the game uses long-lived WebSocket connections and a local
MongoDB instance.

For a managed Mongo (Atlas etc.), update `MONGO_URL` in the production
environment via the Secrets pane.
