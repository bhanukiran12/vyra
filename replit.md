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

## Environment variables

Configured in `backend/.env`:

- `MONGO_URL` — Mongo connection string (defaults to local mongod)
- `DB_NAME` — Database name (`vyra`)
- `JWT_SECRET` — HS256 secret used to sign auth tokens
- `CORS_ORIGINS` — Comma-separated allow-list (`*` in dev)

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
