#!/usr/bin/env bash
set -e

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

mkdir -p /tmp/mongo-data /tmp/mongo-logs

if ! pgrep -x mongod >/dev/null 2>&1; then
  echo "[start] launching mongod..."
  mongod --dbpath /tmp/mongo-data \
         --logpath /tmp/mongo-logs/mongod.log \
         --bind_ip 127.0.0.1 --port 27017 --fork
fi

cleanup() {
  echo "[start] shutting down..."
  if [[ -n "${BACKEND_PID:-}" ]]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT

echo "[start] launching FastAPI backend on :8001..."
(
  cd "$ROOT_DIR/backend"
  exec python -m uvicorn server:app --host 127.0.0.1 --port 8001 --reload
) &
BACKEND_PID=$!

echo "[start] launching CRA frontend on :5000..."
cd "$ROOT_DIR/frontend"
exec yarn start
