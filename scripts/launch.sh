#!/usr/bin/env bash
# Start πD (if needed) and open it as an app window.
# Mac / Linux — double-click via πD.command, or: npm run open
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PID_PORT:-4000}"
URL="http://127.0.0.1:${PORT}/"
LOG_DIR="${TMPDIR:-/tmp}"
OUT_LOG="${LOG_DIR}/pid-serve.out.log"
ERR_LOG="${LOG_DIR}/pid-serve.err.log"

die() { echo "πD: $*" >&2; exit 1; }

need_node() {
  command -v node >/dev/null 2>&1 || die "Node 20+ required — https://nodejs.org"
}

ensure_built() {
  if [[ ! -d node_modules ]]; then
    echo "πD: installing deps…"
    npm install
  fi
  if [[ ! -f dist/index.html ]]; then
    echo "πD: building…"
    npm run build
  fi
}

server_up() {
  curl -sf "$URL" >/dev/null 2>&1
}

start_server() {
  # Detach so closing the app window doesn't kill the board server.
  nohup npx vite preview --host 0.0.0.0 --port "$PORT" --strictPort \
    >"$OUT_LOG" 2>"$ERR_LOG" &
  disown $! 2>/dev/null || true

  for _ in $(seq 1 40); do
    if server_up; then return 0; fi
    sleep 0.25
  done
  die "server failed to start — see $ERR_LOG"
}

# Prefer a Chromium shell in --app mode (no tabs/URL bar). Fall back to default browser.
open_app_window() {
  local app
  if [[ "$(uname -s)" == "Darwin" ]]; then
    for app in \
      "Google Chrome" \
      "Chromium" \
      "Microsoft Edge" \
      "Brave Browser" \
      "Arc" \
      "Dia"
    do
      if [[ -d "/Applications/${app}.app" || -d "$HOME/Applications/${app}.app" ]]; then
        open -na "$app" --args --app="$URL" --new-window
        return 0
      fi
    done
    # Safari / default — still one click, just with browser chrome
    open "$URL"
    return 0
  fi

  # Linux
  for app in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
    if command -v "$app" >/dev/null 2>&1; then
      nohup "$app" --app="$URL" >/dev/null 2>&1 &
      disown $! 2>/dev/null || true
      return 0
    fi
  done
  if command -v xdg-open >/dev/null 2>&1; then
    xdg-open "$URL" >/dev/null 2>&1 &
    return 0
  fi
  die "no browser found — open $URL manually"
}

need_node
ensure_built

if server_up; then
  echo "πD already up → $URL"
else
  echo "πD starting → $URL"
  start_server
fi

open_app_window
echo "opened $URL"
