#!/usr/bin/env bash
# Start πD (if needed) and open it as an app window.
# Mac / Linux — double-click via πD.command, Dock app, or: npm run open
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

PORT="${PID_PORT:-4000}"
URL="http://127.0.0.1:${PORT}/"
LOG_DIR="${TMPDIR:-/tmp}"
OUT_LOG="${LOG_DIR}/pid-serve.out.log"
ERR_LOG="${LOG_DIR}/pid-serve.err.log"
LAUNCH_LOG="${LOG_DIR}/pid-launch.log"

# GUI apps (Finder/Dock) get a tiny PATH — pull in real node locations.
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:$HOME/.nvm/versions/node/$(ls "$HOME/.nvm/versions/node" 2>/dev/null | tail -1)/bin:$HOME/.local/share/fnm/aliases/default/bin:$HOME/.volta/bin:$HOME/.asdf/shims:$PATH"

# Load nvm if present
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" 2>/dev/null || true
# fnm
if command -v fnm >/dev/null 2>&1; then
  eval "$(fnm env)" 2>/dev/null || true
fi

log() { echo "[$(date '+%H:%M:%S')] $*" | tee -a "$LAUNCH_LOG" >&2; }

die() {
  log "ERROR: $*"
  if [[ "$(uname -s)" == "Darwin" ]]; then
    osascript -e "display alert \"πD failed\" message \"$*\n\nLog: $LAUNCH_LOG\"" 2>/dev/null || true
  fi
  exit 1
}

need_node() {
  if ! command -v node >/dev/null 2>&1; then
    die "Node.js not found. Install from https://nodejs.org then try again. (Dock apps cannot see Terminal-only Node installs sometimes — use the official installer.)"
  fi
  log "node $(node -v) at $(command -v node)"
}

ensure_built() {
  if [[ ! -d node_modules ]]; then
    log "installing deps…"
    npm install >>"$LAUNCH_LOG" 2>&1 || die "npm install failed — see $LAUNCH_LOG"
  fi
  if [[ ! -f dist/index.html ]]; then
    log "building UI…"
    npm run build >>"$LAUNCH_LOG" 2>&1 || die "npm run build failed — see $LAUNCH_LOG"
  fi
  if [[ ! -f dist-server/pid-server.mjs ]]; then
    log "building server…"
    npm run build:server >>"$LAUNCH_LOG" 2>&1 || true
  fi
}

server_up() {
  curl -sf "$URL" >/dev/null 2>&1
}

start_server() {
  if [[ -f dist-server/pid-server.mjs ]]; then
    nohup env PID_ROOT="$ROOT" PID_PORT="$PORT" PID_HOST="127.0.0.1" \
      node "$ROOT/dist-server/pid-server.mjs" \
      >"$OUT_LOG" 2>"$ERR_LOG" &
  else
    nohup npx vite preview --host 127.0.0.1 --port "$PORT" --strictPort \
      >"$OUT_LOG" 2>"$ERR_LOG" &
  fi
  disown $! 2>/dev/null || true

  for _ in $(seq 1 50); do
    if server_up; then
      log "server up"
      return 0
    fi
    sleep 0.2
  done
  die "server failed to start — see $ERR_LOG"
}

open_app_window() {
  local app profile
  profile="${PID_CHROMIUM_PROFILE:-$HOME/Library/Application Support/piD/chromium-profile}"
  mkdir -p "$profile" 2>/dev/null || true

  if [[ "$(uname -s)" == "Darwin" ]]; then
    for app in \
      "Google Chrome" \
      "Chromium" \
      "Microsoft Edge" \
      "Brave Browser" \
      "Arc" \
      "Dia" \
      "Safari"
    do
      if [[ -d "/Applications/${app}.app" || -d "$HOME/Applications/${app}.app" ]]; then
        if [[ "$app" == "Safari" ]]; then
          open "$URL"
        else
          open -na "$app" --args \
            --user-data-dir="$profile" \
            --no-first-run \
            --no-default-browser-check \
            --app="$URL"
        fi
        log "opened via $app"
        return 0
      fi
    done
    open "$URL"
    log "opened via default browser"
    return 0
  fi

  for app in google-chrome google-chrome-stable chromium chromium-browser microsoft-edge brave-browser; do
    if command -v "$app" >/dev/null 2>&1; then
      nohup "$app" --user-data-dir="$profile" --no-first-run --class=piD --app="$URL" \
        >/dev/null 2>&1 &
      disown $! 2>/dev/null || true
      return 0
    fi
  done
  command -v xdg-open >/dev/null 2>&1 && xdg-open "$URL" >/dev/null 2>&1 &
}

{
  log "launch root=$ROOT"
  need_node
  ensure_built

  if server_up; then
    log "already up → $URL"
  else
    log "starting → $URL"
    start_server
  fi

  open_app_window
  log "done"
} 2>>"$LAUNCH_LOG" || die "launch failed — see $LAUNCH_LOG"
