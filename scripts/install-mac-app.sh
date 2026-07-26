#!/usr/bin/env bash
# Install πD.app into /Applications (Finder) and ~/Applications.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

install_one() {
  local APP_DIR="$1"
  local MACOS_DIR="$APP_DIR/Contents/MacOS"
  local RES_DIR="$APP_DIR/Contents/Resources"
  local BIN="$MACOS_DIR/piD"

  mkdir -p "$MACOS_DIR" "$RES_DIR"

  # Note: executable named piD (ASCII) — Unicode names break some macOS launches
  cat >"$BIN" <<EOF
#!/bin/bash
# πD Dock/Finder launcher — must work with GUI PATH
export PID_PORT="\${PID_PORT:-4000}"
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$HOME/.volta/bin:\$HOME/.local/share/fnm/aliases/default/bin:\$PATH"
export NVM_DIR="\${NVM_DIR:-\$HOME/.nvm}"
[[ -s "\$NVM_DIR/nvm.sh" ]] && . "\$NVM_DIR/nvm.sh" 2>/dev/null || true
command -v fnm >/dev/null 2>&1 && eval "\$(fnm env)" 2>/dev/null || true

ROOT="$ROOT"
LOG="\${TMPDIR:-/tmp}/pid-app.log"
exec >>"\$LOG" 2>&1
echo "---- \$(date) ----"
echo "PATH=\$PATH"
echo "node=\$(command -v node || echo MISSING)"

cd "\$ROOT" || {
  osascript -e "display alert \\"πD\\" message \\"Project folder missing:\\n\$ROOT\\n\\nRe-run npm run install:app from the pid folder.\\"" 
  exit 1
}

if ! command -v node >/dev/null 2>&1; then
  osascript -e "display alert \\"πD needs Node.js\\" message \\"Install Node LTS from https://nodejs.org\\n(use the official installer so Dock can find it)\\n\\nThen open πD again.\\""
  open "https://nodejs.org"
  exit 1
fi

# Prefer Tauri native if present
for N in \\
  "\$ROOT/src-tauri/target/release/bundle/macos/piD.app/Contents/MacOS/piD" \\
  "\$ROOT/src-tauri/target/release/pid"
do
  if [[ -x "\$N" ]]; then
    export PID_ROOT="\$ROOT"
    exec "\$N"
  fi
fi

# Ensure built
if [[ ! -d "\$ROOT/node_modules" || ! -f "\$ROOT/dist/index.html" ]]; then
  osascript -e 'display notification "Building πD…" with title "πD"' 2>/dev/null || true
  npm install && npm run build || {
    osascript -e "display alert \\"πD build failed\\" message \\"See log:\\n\$LOG\\n\\nOr run in Terminal:\\ncd \$ROOT && npm run setup\\""
    exit 1
  }
fi

chmod +x "\$ROOT/scripts/launch.sh" 2>/dev/null || true
exec "\$ROOT/scripts/launch.sh"
EOF
  chmod +x "$BIN"

  # Icon
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
    local ICONSET TMPD
    TMPD="$(mktemp -d)"
    ICONSET="$TMPD/AppIcon.iconset"
    mkdir -p "$ICONSET"
    for sz in 16 32 128 256 512; do
      sips -z "$sz" "$sz" "$PNG_SRC" --out "$ICONSET/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
      sips -z $((sz * 2)) $((sz * 2)) "$PNG_SRC" --out "$ICONSET/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
    done
    iconutil -c icns "$ICONSET" -o "$ICNS" 2>/dev/null || true
    rm -rf "$TMPD"
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
  <string>piD</string>
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
  <string>4</string>
  <key>CFBundleIconFile</key>
  <string>AppIcon</string>
  <key>LSMinimumSystemVersion</key>
  <string>12.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
</dict>
</plist>
PLIST

  # PkgInfo helps Launch Services treat it as an app
  echo -n "APPL????" >"$APP_DIR/Contents/PkgInfo"

  xattr -cr "$APP_DIR" 2>/dev/null || true
  local LSREG="/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister"
  [[ -x "$LSREG" ]] && "$LSREG" -f "$APP_DIR" 2>/dev/null || true

  echo "installed → $APP_DIR"
}

chmod +x "$ROOT/scripts/launch.sh" "$ROOT/scripts/"*.sh "$ROOT/πD.command" 2>/dev/null || true

# Remove broken old apps with unicode executable name
rm -rf "/Applications/πD.app" "$HOME/Applications/πD.app" 2>/dev/null || true

if [[ -n "${PID_APP_DIR:-}" ]]; then
  mkdir -p "$(dirname "$PID_APP_DIR")"
  install_one "$PID_APP_DIR"
else
  if [[ -w /Applications ]] || mkdir -p /Applications 2>/dev/null; then
    install_one "/Applications/πD.app" 2>/dev/null || {
      TMP="$(mktemp -d)/πD.app"
      install_one "$TMP"
      if command -v osascript >/dev/null 2>&1; then
        # copy with admin if needed
        cp -R "$TMP" /Applications/ 2>/dev/null || \
          osascript -e "do shell script \"rm -rf /Applications/πD.app; cp -R '$TMP' /Applications/πD.app\" with administrator privileges" 2>/dev/null || true
      fi
      rm -rf "$(dirname "$TMP")"
    }
  fi
  mkdir -p "$HOME/Applications"
  install_one "$HOME/Applications/πD.app"
fi

echo ""
echo "Open with:"
echo "  open /Applications/πD.app"
echo "  # or"
echo "  open \"\$HOME/Applications/πD.app\""
echo ""
echo "If it fails, check log:"
echo "  cat /tmp/pid-app.log"
echo "  cat /tmp/pid-launch.log"
echo "project: $ROOT"
