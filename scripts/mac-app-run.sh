#!/usr/bin/env bash
# Entry used by πD.app (Finder/Dock). Must not rely on Terminal PATH.
# Always leaves a log at ~/Library/Logs/piD.log
set +e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${PID_PORT:-4000}"
URL="http://127.0.0.1:${PORT}/"

# Fixed log locations (macOS TMPDIR is not /tmp)
LOG_DIR="${HOME}/Library/Logs"
mkdir -p "$LOG_DIR" 2>/dev/null
LOG="${LOG_DIR}/piD.log"
# also mirror to Desktop-adjacent easy path
LOG2="${HOME}/piD-launch.log"

log() {
  local line="[$(date '+%Y-%m-%d %H:%M:%S')] $*"
  echo "$line" >>"$LOG" 2>/dev/null
  echo "$line" >>"$LOG2" 2>/dev/null
  echo "$line" >&2
}

alert() {
  local msg="$1"
  log "ALERT: $msg"
  # Escape for AppleScript
  local esc
  esc=$(printf '%s' "$msg" | sed 's/\\/\\\\/g; s/"/\\"/g')
  /usr/bin/osascript <<AS 2>>"$LOG"
display alert "πD" message "$esc" as critical
AS
}

log "======== launch start ========"
log "ROOT=$ROOT"
log "HOME=$HOME USER=$(whoami 2>/dev/null)"
log "argv0=$0"

# Immediate feedback so user knows click registered
/usr/bin/osascript -e 'display notification "Starting…" with title "πD"' 2>>"$LOG" || true

# --- PATH bootstrap ---
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"

if [[ -f "$ROOT/scripts/.mac-paths.sh" ]]; then
  # shellcheck disable=SC1091
  source "$ROOT/scripts/.mac-paths.sh"
  log "sourced .mac-paths.sh"
fi

export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" >/dev/null 2>&1

command -v fnm >/dev/null 2>&1 && eval "$(fnm env)" >/dev/null 2>&1
[[ -d "$HOME/.volta/bin" ]] && export PATH="$HOME/.volta/bin:$PATH"
[[ -d "$HOME/.asdf/shims" ]] && export PATH="$HOME/.asdf/shims:$PATH"

if ! command -v node >/dev/null 2>&1 && [[ -d "$HOME/.nvm/versions/node" ]]; then
  LATEST=$(/bin/ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | /usr/bin/tail -1)
  [[ -n "$LATEST" ]] && export PATH="$HOME/.nvm/versions/node/$LATEST/bin:$PATH"
fi

# Hunt common node locations
for c in \
  /opt/homebrew/bin/node \
  /usr/local/bin/node \
  "$HOME/.nvm/versions/node"/*/bin/node \
  "$HOME/.volta/bin/node" \
  /opt/local/bin/node
do
  if [[ -x "$c" ]]; then
    export PATH="$(dirname "$c"):$PATH"
    log "found node candidate $c"
    break
  fi
done

log "PATH=$PATH"
log "node=$(command -v node || echo NONE)"
log "npm=$(command -v npm || echo NONE)"

if [[ ! -d "$ROOT" ]]; then
  alert "Project folder missing:
$ROOT

Open Terminal and run:
  cd /path/to/pid && npm run install:app"
  exit 1
fi

cd "$ROOT" || {
  alert "Cannot open project folder:
$ROOT"
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  alert "Node.js not found (Dock cannot see your Terminal Node).

Fix:
1. Install Node LTS from https://nodejs.org
   (official installer — not only nvm)
2. Then in Terminal:
   cd $ROOT
   npm run install:app
   open /Applications/πD.app

Log: $LOG"
  /usr/bin/open "https://nodejs.org" 2>/dev/null
  exit 1
fi

NODE="$(command -v node)"
NPM="$(command -v npm || echo npm)"
log "using NODE=$NODE NPM=$NPM $($NODE -v 2>&1)"

if [[ ! -f "$ROOT/dist/index.html" ]]; then
  log "building UI…"
  /usr/bin/osascript -e 'display notification "Building πD…" with title "πD"' 2>/dev/null
  if ! "$NPM" run build >>"$LOG" 2>&1; then
    alert "Build failed.

In Terminal:
  cd $ROOT && npm run setup

Log: $LOG"
    exit 1
  fi
fi

if [[ ! -f "$ROOT/dist-server/pid-server.mjs" ]]; then
  log "building server…"
  "$NPM" run build:server >>"$LOG" 2>&1 || true
fi

server_up() {
  /usr/bin/curl -sf --max-time 1 "$URL" >/dev/null 2>&1
}

if server_up; then
  log "server already up"
else
  log "starting server…"
  if [[ -f "$ROOT/dist-server/pid-server.mjs" ]]; then
    /usr/bin/nohup env PID_ROOT="$ROOT" PID_PORT="$PORT" PID_HOST="127.0.0.1" \
      "$NODE" "$ROOT/dist-server/pid-server.mjs" \
      >>"${LOG_DIR}/piD-server.log" 2>&1 &
    log "server pid $!"
  else
    /usr/bin/nohup "$NPM" run start:vite \
      >>"${LOG_DIR}/piD-server.log" 2>&1 &
    log "vite preview pid $!"
  fi
  ok=0
  for i in $(seq 1 80); do
    if server_up; then ok=1; break; fi
    sleep 0.25
  done
  if [[ "$ok" -ne 1 ]]; then
    alert "Server did not start on $URL

Check:
  cat $LOG
  cat ${LOG_DIR}/piD-server.log

Or run: cd $ROOT && npm run open"
    exit 1
  fi
  log "server ready"
fi

# Open browser app window
PROFILE="$HOME/Library/Application Support/piD/chromium-profile"
mkdir -p "$PROFILE"
opened=0

for app in \
  "Google Chrome" \
  "Microsoft Edge" \
  "Brave Browser" \
  "Chromium" \
  "Arc" \
  "Dia"
do
  if [[ -d "/Applications/${app}.app" || -d "$HOME/Applications/${app}.app" ]]; then
    log "opening $app app-mode"
    if /usr/bin/open -n -a "$app" --args \
      --user-data-dir="$PROFILE" \
      --no-first-run \
      --no-default-browser-check \
      --new-window \
      --app="$URL"
    then
      opened=1
      break
    fi
  fi
done

if [[ "$opened" -ne 1 ]]; then
  log "fallback open URL"
  if ! /usr/bin/open "$URL"; then
    alert "Could not open browser.

Install Chrome or Edge, or open manually:
$URL

Log: $LOG"
    exit 1
  fi
fi

log "success — opened $URL"
/usr/bin/osascript -e 'display notification "Opened" with title "πD"' 2>/dev/null || true
sleep 2
exit 0
