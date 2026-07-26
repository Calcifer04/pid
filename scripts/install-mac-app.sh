#!/usr/bin/env bash
# Build a REAL Mac .app via osacompile (AppleScript) — reliable from Dock/Finder.
# Shell-script .app bundles often never execute under Gatekeeper/LaunchServices.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

# Resolve node/npm the same way Terminal does
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:$HOME/.volta/bin:$PATH"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "$NVM_DIR/nvm.sh" ]] && . "$NVM_DIR/nvm.sh" 2>/dev/null || true
command -v fnm >/dev/null 2>&1 && eval "$(fnm env)" 2>/dev/null || true
if ! command -v node >/dev/null 2>&1 && [[ -d "$HOME/.nvm/versions/node" ]]; then
  L=$(ls -1 "$HOME/.nvm/versions/node" 2>/dev/null | tail -1 || true)
  [[ -n "$L" ]] && export PATH="$HOME/.nvm/versions/node/$L/bin:$PATH"
fi

NODE="$(command -v node || true)"
NPM="$(command -v npm || true)"

if [[ -z "$NODE" || -z "$NPM" ]]; then
  echo "ERROR: node/npm not found in this Terminal."
  echo "Install Node from https://nodejs.org then re-run: npm run install:app"
  exit 1
fi

echo "Using node: $NODE ($($NODE -v))"
echo "Using npm:  $NPM"
echo "Project:    $ROOT"

# Ensure project is built
if [[ ! -f "$ROOT/dist/index.html" ]]; then
  echo "Building once…"
  (cd "$ROOT" && "$NPM" install && "$NPM" run build)
fi
if [[ ! -f "$ROOT/dist-server/pid-server.mjs" ]]; then
  (cd "$ROOT" && "$NPM" run build:server) || true
fi

chmod +x "$ROOT/scripts/launch.sh" "$ROOT/scripts/mac-app-run.sh" 2>/dev/null || true

LOG_DIR="$HOME/Library/Logs"
mkdir -p "$LOG_DIR"
LOG="$LOG_DIR/piD.log"

# AppleScript app body — absolute paths only, always logs
# do shell script runs as GUI user; we still pass full PATH and full binaries
read -r -d '' ASCRIPT <<EOF || true
on run
  set logFile to POSIX file "$LOG"
  set projectDir to "$ROOT"
  set nodeBin to "$NODE"
  set npmBin to "$NPM"
  set launchSh to "$ROOT/scripts/launch.sh"

  try
    -- Always append a heartbeat so we know the app ran
    do shell script "mkdir -p " & quoted form of "$LOG_DIR" & " ; echo '==== ' & (do shell script "date") & ' APP CLICK ====' >> " & quoted form of "$LOG"

    -- Same effective command as: cd project && npm run open
    -- launch.sh starts server + Chrome app window
    set cmd to "export PATH=" & quoted form of "$(dirname "$NODE"):$(dirname "$NPM"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin" & " ; export PID_ROOT=" & quoted form of projectDir & " ; cd " & quoted form of projectDir & " && /bin/bash " & quoted form of launchSh & " >> " & quoted form of "$LOG" & " 2>&1"
    do shell script cmd

  on error errMsg number errNum
    try
      do shell script "echo 'ERROR ' & " & quoted form of "errNum" & " & ' ' & " & quoted form of "errMsg" & " >> " & quoted form of "$LOG"
    end try
    display alert "πD failed" message (errMsg & return & return & "Log: $LOG" & return & return & "Fallback in Terminal:" & return & "cd $ROOT && npm run open") as critical
  end try
end run
EOF

# Simpler reliable AppleScript (avoid nested quoting bugs)
AS_FILE="$(mktemp).applescript"
cat >"$AS_FILE" <<EOF
on run
  set logPath to "$LOG"
  set rootPath to "$ROOT"
  set launchPath to "$ROOT/scripts/launch.sh"
  set pathExport to "export PATH=\\"$(dirname "$NODE"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\\$PATH\\""

  try
    do shell script "mkdir -p \\"$LOG_DIR\\" && echo \\"==== \$(date) APP CLICK ====" >> \\"$LOG\\""

    set sh to pathExport & " ; export PID_ROOT=" & quoted form of rootPath & " ; cd " & quoted form of rootPath & " && /bin/bash " & quoted form of launchPath & " >> " & quoted form of logPath & " 2>&1"
    do shell script sh

  on error errMsg
    try
      do shell script "echo ERROR: " & quoted form of errMsg & " >> " & quoted form of logPath
    end try
    display alert "πD failed" message errMsg & return & return & "Log: $LOG" & return & return & "Works in Terminal:" & return & "cd $ROOT && npm run open" as critical
  end try
end run
EOF

build_app() {
  local DEST="$1"
  rm -rf "$DEST"
  mkdir -p "$(dirname "$DEST")"
  /usr/bin/osacompile -o "$DEST" "$AS_FILE"
  # Icon if possible
  if [[ -f "$ROOT/public/icon-256.png" ]] && command -v sips >/dev/null 2>&1; then
    local ICNS RES
    RES="$DEST/Contents/Resources"
    mkdir -p "$RES"
    # osacompile already has applet.icns — replace if we can
    if command -v iconutil >/dev/null 2>&1; then
      local TMPD ICONSET
      TMPD="$(mktemp -d)"
      ICONSET="$TMPD/AppIcon.iconset"
      mkdir -p "$ICONSET"
      for sz in 16 32 128 256 512; do
        sips -z $sz $sz "$ROOT/public/icon-256.png" --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
        sips -z $((sz*2)) $((sz*2)) "$ROOT/public/icon-256.png" --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
      done
      iconutil -c icns "$ICONSET" -o "$RES/applet.icns" 2>/dev/null || true
      rm -rf "$TMPD"
    fi
  fi
  # Rename display name
  /usr/bin/plutil -replace CFBundleName -string "πD" "$DEST/Contents/Info.plist" 2>/dev/null || true
  /usr/bin/plutil -replace CFBundleDisplayName -string "πD" "$DEST/Contents/Info.plist" 2>/dev/null || true
  /usr/bin/plutil -replace CFBundleIdentifier -string "local.pid.board" "$DEST/Contents/Info.plist" 2>/dev/null || true
  xattr -cr "$DEST" 2>/dev/null || true
  echo "built $DEST"
}

# Install locations
build_app "$HOME/Applications/πD.app"

if [[ -w /Applications ]]; then
  build_app "/Applications/πD.app"
else
  # try copy
  if cp -R "$HOME/Applications/πD.app" /Applications/πD.app 2>/dev/null; then
    echo "copied to /Applications/πD.app"
  else
    echo "Installing to /Applications (password prompt)…"
    osascript -e "do shell script \"rm -rf /Applications/πD.app; cp -R '$HOME/Applications/πD.app' /Applications/πD.app; xattr -cr /Applications/πD.app\" with administrator privileges" 2>/dev/null \
      && echo "installed /Applications/πD.app" \
      || echo "skipped /Applications — use ~/Applications/πD.app"
  fi
fi

rm -f "$AS_FILE"

# Project folder launcher (double-click in Finder)
cat >"$ROOT/Open πD.command" <<EOF
#!/bin/bash
cd "$ROOT" || exit 1
export PATH="$(dirname "$NODE"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$PATH"
exec /bin/bash "$ROOT/scripts/launch.sh"
EOF
chmod +x "$ROOT/Open πD.command"

echo ""
echo "Testing AppleScript app now…"
echo "==== $(date) INSTALL TEST ====" >>"$LOG"
if /usr/bin/open "$HOME/Applications/πD.app"; then
  sleep 3
  echo "open returned OK — check for Chrome/Edge window"
else
  echo "open failed"
fi

echo ""
echo "Log file (should exist now):"
echo "  $LOG"
ls -la "$LOG" 2>/dev/null || echo "  (not created yet — wait a second)"
echo ""
echo "If no window:  cat \"$LOG\""
echo "Always works:  cd $ROOT && npm run open"
echo "Or double-click: Open πD.command  (in the pid folder)"
