#!/usr/bin/env bash
# Entry used by πD.app (Finder/Dock). Must not rely on Terminal PATH.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PID_PORT:-4000}"
URL="http://127.0.0.1:${PORT}/"
LOG="${TMPDIR:-/tmp}/pid-app.log"

exec >>"$LOG" 2>&1
echo "======== $(date) ========"
echo "ROOT=$ROOT"
echo "whoami=$(whoami)"

alert() {
  local msg="$1"
  echo "ALERT: $msg"
  /usr/bin/osascript -e "display alert \"πD\" message \"$(echo "$msg" | sed 's/"/\\"/g')\"" 2>/dev/null || true
}

# --- PATH bootstrap (Homebrew + common Node managers) ---
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# Optional: paths baked in at install:app time (see install-mac-app.sh)
# shellcheck disable=SC1091
[[ -f "$ROOT/scripts/.mac-paths.sh" ]] && source "$ROOT/scripts/.mac-paths.sh"

# nvm
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1 || true

# fnm / volta
command -v fnm >/dev/null 2>&1 && eval "$(fnm env)" >/dev/null 2>&1 || true
[[ -d "$HOME/.volta/bin" ]] && export PATH="$HOME/.volta/bin:$PATH"
[[ -d "$HOME/.asdf/shims" ]] && export PATH="$HOME/.asdf/shims:$PATH"

# Latest nvm node dir if still missing
if ! command -v node >/dev/null 2>&1 && [[ -d "$HOME/.nvm/versions/node" ]]; then
  LATEST=$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | tail -1 || true)
  [[ -n "$LATEST" ]] && export PATH="$HOME/.nvm/versions/node/$LATEST/bin:$PATH"
fi

echo "PATH=$PATH"
echo "node=$(command -v node || echo NONE) $(node -v 2>/dev/null || true)"
echo "npm=$(command -v npm || echo NONE)"

cd "$ROOT" || {
  alert "Project folder not found:\n$ROOT\n\nIn Terminal:\ncd /path/to/pid && npm run install:app"
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  alert "Node.js not found for Dock apps.\n\n1) Install Node LTS from nodejs.org (official installer)\n2) Or in Terminal: which node\n   then: npm run install:app\n\nLog: $LOG"
  /usr/bin/open "https://nodejs.org" 2>/dev/null || true
  exit 1
fi

NODE="$(command -v node)"
NPM="$(command -v npm)"

# Prefer standalone server; build if needed
if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "building UI…"
  "$NPM" run build || {
    alert "Build failed. In Terminal:\ncd $ROOT && npm run setup\n\nLog: $LOG"
    exit 1
  }
fi
if [[ ! -f "$ROOT/dist-server/pid-server.mjs" ]]; then
  echo "building server…"
  "$NPM" run build:server || true
fi

server_up() {
  /usr/bin/curl -sf "$URL" >/dev/null 2>&1
}

if ! server_up; then
  echo "starting server…"
  if [[ -f "$ROOT/dist-server/pid-server.mjs" ]]; then
    /usr/bin/nohup env PID_ROOT="$ROOT" PID_PORT="$PORT" PID_HOST="127.0.0.1" \
      "$NODE" "$ROOT/dist-server/pid-server.mjs" \
      >"${TMPDIR:-/tmp}/pid-serve.out.log" 2>"${TMPDIR:-/tmp}/pid-serve.err.log" &
  else
    /usr/bin/nohup "$NPM" run start:vite \
      >"${TMPDIR:-/tmp}/pid-serve.out.log" 2>"${TMPDIR:-/tmp}/pid-serve.err.log" &
  fi
  for _ in $(seq 1 60); do
    server_up && break
    sleep 0.25
  done
  if ! server_up; then
    alert "Server failed to start on port $PORT.\n\nLog: ${TMPDIR:-/tmp}/pid-serve.err.log\n$LOG"
    exit 1
  fi
fi
echo "server ok"

# Open Chromium app window using full binary paths (more reliable than open -na from .app)
PROFILE="${PID_CHROMIUM_PROFILE:-$HOME/Library/Application Support/piD/chromium-profile}"
mkdir -p "$PROFILE"

open_chrome_app() {
  local bin="$1"
  if [[ -x "$bin" ]]; then
    echo "launching $bin"
    # detach fully so .app exit doesn't affect browser
    /usr/bin/open -n -a "$bin" --args \
      --user-data-dir="$PROFILE" \
      --no-first-run \
      --no-default-browser-check \
      --new-window \
      --app="$URL"
    return 0
  fi
  return 1
}

# open -a wants app name or path to .app bundle
opened=0
for app in \
  "/Applications/Google Chrome.app" \
  "$HOME/Applications/Google Chrome.app" \
  "/Applications/Microsoft Edge.app" \
  "/Applications/Brave Browser.app" \
  "/Applications/Chromium.app" \
  "/Applications/Arc.app"
do
  if [[ -d "$app" ]]; then
    echo "open -n -a $app"
    /usr/bin/open -n -a "$app" --args \
      --user-data-dir="$PROFILE" \
      --no-first-run \
      --no-default-browser-check \
      --new-window \
      --app="$URL" && opened=1 && break
  fi
done

if [[ "$opened" -eq 0 ]]; then
  echo "fallback default browser"
  /usr/bin/open "$URL" || {
    alert "Could not open a browser.\nInstall Chrome or Edge, or open:\n$URL"
    exit 1
  }
fi

echo "done ok"
# Brief stay-alive so Dock bounce feels intentional
sleep 1
exit 0
