#!/usr/bin/env bash
# Mac: install Syncthing (Homebrew) + open UI, with piD join steps.
set -euo pipefail

echo "=== piD + Syncthing (Mac) ==="

if ! command -v brew >/dev/null 2>&1; then
  echo "Homebrew not found. Install from https://brew.sh then re-run."
  exit 1
fi

if ! command -v syncthing >/dev/null 2>&1; then
  echo "Installing syncthing…"
  brew install syncthing
fi

# Start at login / now
brew services start syncthing 2>/dev/null || true
if ! curl -sf http://127.0.0.1:8384 >/dev/null 2>&1; then
  echo "Starting syncthing…"
  nohup syncthing -no-browser >"${TMPDIR:-/tmp}/syncthing.out.log" 2>&1 &
  sleep 2
fi

echo
echo "Syncthing UI → http://127.0.0.1:8384"
echo
echo "Join this Windows folder:"
echo "  1. On Windows SyncTrayzor: Actions → Show ID  (copy Device ID)"
echo "  2. On Mac UI: Add Remote Device → paste Windows ID → Save"
echo "  3. On Windows: accept the Mac device when prompted"
echo "  4. On Windows: folder 'piD' (id: pid-routine) → Edit → Share → check your Mac"
echo "  5. On Mac: accept folder share"
echo "     Path suggestion:  \$HOME/Sync/pid"
echo "     (or iCloud is fine too — but Syncthing path is enough)"
echo
echo "Then once:"
echo "  cd ~/Sync/pid"
echo "  npm install && npm run build"
echo "  chmod +x scripts/*.sh πD.command"
echo "  npm run install:app"
echo "  open ~/Applications/πD.app"
echo
open "http://127.0.0.1:8384" 2>/dev/null || true
