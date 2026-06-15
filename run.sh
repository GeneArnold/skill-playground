#!/usr/bin/env bash
# Start the Skill Playground (backend + frontend) for local development.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# --- backend ---
cd "$ROOT/backend"
if [ ! -d .venv ]; then
  echo "Creating backend venv…"
  python3 -m venv .venv
  .venv/bin/pip install -q -r requirements.txt
fi
if [ ! -f .env ]; then
  echo "No backend/.env found — copying from .env.example. Add your API keys!"
  cp .env.example .env
fi

echo "Starting backend on http://127.0.0.1:8000 …"
.venv/bin/uvicorn app.main:app --reload --port 8000 &
BACKEND_PID=$!

# --- frontend ---
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then
  echo "Installing frontend deps…"
  npm install
fi

echo "Starting frontend on http://127.0.0.1:5173 …"
npm run dev &
FRONTEND_PID=$!

trap "echo; echo 'Shutting down…'; kill $BACKEND_PID $FRONTEND_PID 2>/dev/null || true" EXIT INT TERM

echo
echo "  ➜  Open http://127.0.0.1:5173 in your browser."
echo "  ➜  Ctrl+C to stop both servers."
echo
wait
