#!/usr/bin/env bash
# Install πD.app → ~/Applications (Dock-able, double-clickable).
# Points at this checkout, so keep the project where you sync it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${PID_APP_DIR:-$HOME/Applications/πD.app}"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RES_DIR="$APP_DIR/Contents/Resources"
BIN="$MACOS_DIR/πD"

chmod +x "$ROOT/scripts/launch.sh" "$ROOT/πD.command" 2>/dev/null || true

mkdir -p "$MACOS_DIR" "$RES_DIR"

# Launcher baked with absolute path to this checkout
cat >"$BIN" <<EOF
#!/bin/bash
export PID_PORT="\${PID_PORT:-4000}"
exec "$ROOT/scripts/launch.sh"
EOF
chmod +x "$BIN"

# Minimal icon (uses SVG via png if sips/qlmanage available later — .icns optional)
if [[ -f "$ROOT/public/icon.svg" ]]; then
  cp "$ROOT/public/icon.svg" "$RES_DIR/icon.svg" 2>/dev/null || true
fi

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
  <string>1</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <false/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

# Clear quarantine + refresh Launch Services so Dock picks it up
xattr -cr "$APP_DIR" 2>/dev/null || true
if command -v lsregister >/dev/null 2>&1; then
  lsregister -f "$APP_DIR" 2>/dev/null || true
elif [[ -x /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister ]]; then
  /System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP_DIR" 2>/dev/null || true
fi

echo "installed → $APP_DIR"
echo "  open once:  open \"$APP_DIR\""
echo "  then:       right-click Dock icon → Options → Keep in Dock"
echo "  project:    $ROOT"
