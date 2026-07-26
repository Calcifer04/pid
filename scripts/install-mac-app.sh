#!/usr/bin/env bash
# Install πD.app into Applications (Dock / Launchpad).
# Prefers /Applications (what Finder shows); falls back to ~/Applications.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

install_one() {
  local APP_DIR="$1"
  local MACOS_DIR="$APP_DIR/Contents/MacOS"
  local RES_DIR="$APP_DIR/Contents/Resources"
  local BIN="$MACOS_DIR/πD"

  mkdir -p "$MACOS_DIR" "$RES_DIR"

  cat >"$BIN" <<EOF
#!/bin/bash
export PID_PORT="\${PID_PORT:-4000}"
cd "$ROOT" || exit 1
if [[ ! -d "$ROOT/node_modules" || ! -f "$ROOT/dist/index.html" ]]; then
  osascript -e 'display notification "Installing πD…" with title "πD"' 2>/dev/null || true
  (cd "$ROOT" && npm install && npm run build) || {
    osascript -e 'display alert "πD setup failed" message "Open Terminal in the project and run: npm run setup"' 2>/dev/null || true
    exit 1
  }
fi
# Prefer native Tauri if built
NATIVE="$ROOT/src-tauri/target/release/bundle/macos/piD.app/Contents/MacOS/piD"
if [[ -x "\$NATIVE" ]]; then
  export PID_ROOT="$ROOT"
  exec "\$NATIVE"
fi
NATIVE2="$ROOT/src-tauri/target/release/pid"
if [[ -x "\$NATIVE2" ]]; then
  export PID_ROOT="$ROOT"
  exec "\$NATIVE2"
fi
exec "$ROOT/scripts/launch.sh"
EOF
  chmod +x "$BIN"

  # .icns for Dock
  local ICNS="$RES_DIR/AppIcon.icns"
  local PNG_SRC=""
  for c in \
    "$ROOT/public/icon-1024.png" \
    "$ROOT/public/icon-512.png" \
    "$ROOT/public/apple-touch-icon.png" \
    "$ROOT/public/icon-256.png"
  do
    [[ -f "$c" ]] && PNG_SRC="$c" && break
  done

  if [[ -n "$PNG_SRC" ]] && command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
    local ICONSET
    ICONSET="$(mktemp -d)/AppIcon.iconset"
    mkdir -p "$ICONSET"
    for sz in 16 32 128 256 512; do
      sips -z "$sz" "$sz" "$PNG_SRC" --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
      sips -z $((sz * 2)) $((sz * 2)) "$PNG_SRC" --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
    done
    iconutil -c icns "$ICONSET" -o "$ICNS" 2>/dev/null || true
    rm -rf "$(dirname "$ICONSET")"
  fi
  [[ -n "$PNG_SRC" ]] && cp "$PNG_SRC" "$RES_DIR/icon.png" 2>/dev/null || true

  cat >"$APP_DIR/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleExecutable</key>
  <string>πD</string>
  <key>CFBundleIdentifier</key>
  <string>local.pid.board</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>πD</string>
  <key>CFBundleDisplayName</key>
  <string>πD</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>0.1.0</string>
  <key>CFBundleVersion</key>
  <string>3</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  xattr -cr "$APP_DIR" 2>/dev/null || true
  local LSREG="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  [[ -x "$LSREG" ]] && "$LSREG" -f "$APP_DIR" 2>/dev/null || true

  echo "installed → $APP_DIR"
}

chmod +x "$ROOT/scripts/launch.sh" "$ROOT/scripts/"*.sh "$ROOT/πD.command" 2>/dev/null || true

# Explicit override
if [[ -n "${PID_APP_DIR:-}" ]]; then
  mkdir -p "$(dirname "$PID_APP_DIR")"
  install_one "$PID_APP_DIR"
else
  # 1) System Applications (shows in Finder → Applications)
  if mkdir -p /Applications 2>/dev/null && [[ -w /Applications ]]; then
    install_one "/Applications/πD.app"
  else
    # may need admin once
    if sudo mkdir -p /Applications 2>/dev/null; then
      TMP_APP="$(mktemp -d)/πD.app"
      install_one "$TMP_APP"
      sudo rm -rf "/Applications/πD.app"
      sudo mv "$TMP_APP" "/Applications/πD.app"
      sudo chown -R "$(whoami):staff" "/Applications/πD.app" 2>/dev/null || true
      echo "installed → /Applications/πD.app (via sudo)"
    fi
  fi

  # 2) Always also put in ~/Applications
  mkdir -p "$HOME/Applications"
  install_one "$HOME/Applications/πD.app"
fi

echo ""
echo "Open now:"
echo "  open -a πD"
echo "  # or: open /Applications/πD.app"
echo "  # or: open \"\$HOME/Applications/πD.app\""
echo ""
echo "If you still don't see it: Finder → Go → Go to Folder… → /Applications"
echo "project: $ROOT"
