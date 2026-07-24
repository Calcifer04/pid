#!/usr/bin/env bash
# Start πD (core app only — no Rainmeter / spotlight).
# Mac / Linux:  ./scripts/start.sh
# Optional:     ROUTINE_DATA=~/Sync/pid/board.json ./scripts/start.sh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PID_PORT:-4000}"
HOST="${PID_HOST:-0.0.0.0}"

if ! command -v node >/dev/null 2>&1; then
  echo "node not found — install Node 20+ from https://nodejs.org"
  exit 1
fi

if [[ ! -d node_modules ]]; then
  echo "installing deps…"
  npm install
fi

if [[ ! -f dist/index.html ]]; then
  echo "building…"
  npm run build
fi

# Already up?
if curl -sf "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
  echo "πD already up → http://127.0.0.1:${PORT}/"
  exit 0
fi

echo "πD starting on http://127.0.0.1:${PORT}/"
if [[ -n "${ROUTINE_DATA:-}" ]]; then
  echo "  board → $ROUTINE_DATA"
else
  echo "  board → $ROOT/data/board.json"
fi

exec npx vite preview --host "$HOST" --port "$PORT" --strictPort
