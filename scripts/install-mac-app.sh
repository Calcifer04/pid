#!/usr/bin/env bash
# Install πD.app → ~/Applications (Dock-able, double-clickable).
# Points at this checkout, so keep the project where you sync it.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="${PID_APP_DIR:-$HOME/Applications/πD.app}"
MACOS_DIR="$APP_DIR/Contents/MacOS"
RES_DIR="$APP_DIR/Contents/Resources"
BIN="$MACOS_DIR/πD"

chmod +x "$ROOT/scripts/launch.sh" "$ROOT/scripts/"*.sh "$ROOT/πD.command" 2>/dev/null || true
mkdir -p "$MACOS_DIR" "$RES_DIR" "$HOME/Applications"

# Launcher baked with absolute path to this checkout
cat >"$BIN" <<EOF
#!/bin/bash
export PID_PORT="\${PID_PORT:-4000}"
cd "$ROOT" || exit 1
# first run: deps/build if missing
if [[ ! -d "$ROOT/node_modules" || ! -f "$ROOT/dist/index.html" ]]; then
  osascript -e 'display notification "Installing πD…" with title "πD"' 2>/dev/null || true
  (cd "$ROOT" && npm install && npm run build) || {
    osascript -e 'display alert "πD setup failed" message "Open Terminal in the project and run: npm run setup"' 2>/dev/null || true
    exit 1
  }
fi
exec "$ROOT/scripts/launch.sh"
EOF
chmod +x "$BIN"

# Build .icns from PNG master when possible (real Dock icon)
ICNS="$RES_DIR/AppIcon.icns"
PNG_SRC=""
for c in \
  "$ROOT/public/icon-1024.png" \
  "$ROOT/public/icon-512.png" \
  "$ROOT/public/apple-touch-icon.png" \
  "$ROOT/public/icon-256.png"
do
  if [[ -f "$c" ]]; then PNG_SRC="$c"; break; fi
done

if [[ -n "$PNG_SRC" ]] && command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  ICONSET="$(mktemp -d)/AppIcon.iconset"
  mkdir -p "$ICONSET"
  for sz in 16 32 128 256 512; do
    sips -z "$sz" "$sz" "$PNG_SRC" --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null
    sips -z $((sz*2)) $((sz*2)) "$PNG_SRC" --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null
  done
  iconutil -c icns "$ICONSET" -o "$ICNS" 2>/dev/null || true
  rm -rf "$(dirname "$ICONSET")"
fi

# Fallback copy PNG for tooling
if [[ -n "$PNG_SRC" ]]; then
  cp "$PNG_SRC" "$RES_DIR/icon.png" 2>/dev/null || true
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
  <string>2</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>LSUIElement</key>
  <false/>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

xattr -cr "$APP_DIR" 2>/dev/null || true
LSREG="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
if [[ -x "$LSREG" ]]; then
  "$LSREG" -f "$APP_DIR" 2>/dev/null || true
fi

echo "installed → $APP_DIR"
echo "  open:   open \"$APP_DIR\""
echo "  Dock:   right-click → Options → Keep in Dock"
echo "  project:$ROOT"
