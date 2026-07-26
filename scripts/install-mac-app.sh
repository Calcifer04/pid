#!/usr/bin/env bash
# Build πD.app via osacompile (works from Dock/Finder).
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"

export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${HOME}/.volta/bin:${PATH}"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
# shellcheck disable=SC1091
[[ -s "${NVM_DIR}/nvm.sh" ]] && . "${NVM_DIR}/nvm.sh" 2>/dev/null || true
if command -v fnm >/dev/null 2>&1; then eval "$(fnm env)" 2>/dev/null || true; fi
if ! command -v node >/dev/null 2>&1 && [[ -d "${HOME}/.nvm/versions/node" ]]; then
  L="$(ls -1 "${HOME}/.nvm/versions/node" 2>/dev/null | tail -1 || true)"
  [[ -n "${L}" ]] && export PATH="${HOME}/.nvm/versions/node/${L}/bin:${PATH}"
fi

NODE="$(command -v node || true)"
NPM="$(command -v npm || true)"

if [[ -z "${NODE}" || -z "${NPM}" ]]; then
  echo "ERROR: node/npm not found. Install from https://nodejs.org then re-run."
  exit 1
fi

NODE_DIR="$(dirname "${NODE}")"
echo "Using node: ${NODE} ($(${NODE} -v))"
echo "Using npm:  ${NPM}"
echo "Project:    ${ROOT}"

if [[ ! -f "${ROOT}/dist/index.html" ]]; then
  echo "Building once…"
  (cd "${ROOT}" && "${NPM}" install && "${NPM}" run build)
fi
if [[ ! -f "${ROOT}/dist-server/pid-server.mjs" ]]; then
  (cd "${ROOT}" && "${NPM}" run build:server) || true
fi

chmod +x "${ROOT}/scripts/launch.sh" "${ROOT}/scripts/mac-app-run.sh" 2>/dev/null || true

LOG_DIR="${HOME}/Library/Logs"
LOG="${LOG_DIR}/piD.log"
mkdir -p "${LOG_DIR}"

# Write a tiny runner shell with NO nested quotes problems
RUNNER="${ROOT}/scripts/.mac-dock-run.sh"
cat >"${RUNNER}" <<RUN
#!/bin/bash
set -e
export PATH="${NODE_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$PATH"
export PID_ROOT="${ROOT}"
export PID_PORT="\${PID_PORT:-4000}"
LOG="${LOG}"
mkdir -p "${LOG_DIR}"
echo "==== \$(date) APP CLICK ====" >>"\$LOG"
cd "${ROOT}" || { echo "bad root" >>"\$LOG"; exit 1; }
/bin/bash "${ROOT}/scripts/launch.sh" >>"\$LOG" 2>&1
echo "==== \$(date) OK ====" >>"\$LOG"
RUN
chmod +x "${RUNNER}"

# AppleScript file — minimal quoting: only call the runner
AS_FILE="$(mktemp /tmp/pid-applet.XXXXXX).applescript"
cat >"${AS_FILE}" <<EOF
on run
  try
    do shell script quoted form of "${RUNNER}"
  on error errMsg
    try
      do shell script "echo " & quoted form of ("ERROR: " & errMsg) & " >> " & quoted form of "${LOG}"
    end try
    display alert "πD failed" message errMsg & return & return & "Log: ${LOG}" & return & return & "Fallback:" & return & "cd ${ROOT} && npm run open" as critical
  end try
end run
EOF

# Fix: do shell script needs the script invoked via bash, not as quoted form alone
cat >"${AS_FILE}" <<EOF
on run
  set runner to "${RUNNER}"
  set logPath to "${LOG}"
  try
    do shell script "/bin/bash " & quoted form of runner
  on error errMsg
    try
      do shell script "echo " & quoted form of ("ERROR: " & errMsg) & " >> " & quoted form of logPath
    end try
    display alert "πD failed" message errMsg & return & return & "Log: ${LOG}" & return & return & "Fallback in Terminal:" & return & "cd ${ROOT} && npm run open" as critical
  end try
end run
EOF

echo "AppleScript source:"
cat "${AS_FILE}"
echo "---"

build_app() {
  local DEST="$1"
  rm -rf "${DEST}"
  mkdir -p "$(dirname "${DEST}")"
  /usr/bin/osacompile -o "${DEST}" "${AS_FILE}"
  /usr/bin/plutil -replace CFBundleName -string "πD" "${DEST}/Contents/Info.plist" 2>/dev/null || true
  /usr/bin/plutil -replace CFBundleDisplayName -string "πD" "${DEST}/Contents/Info.plist" 2>/dev/null || true
  /usr/bin/plutil -replace CFBundleIdentifier -string "local.pid.board" "${DEST}/Contents/Info.plist" 2>/dev/null || true

  # Icon
  if [[ -f "${ROOT}/public/icon-256.png" ]] && command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
    local TMPD ICONSET
    TMPD="$(mktemp -d)"
    ICONSET="${TMPD}/icon.iconset"
    mkdir -p "${ICONSET}"
    for sz in 16 32 128 256 512; do
      sips -z "${sz}" "${sz}" "${ROOT}/public/icon-256.png" --out "${ICONSET}/icon_${sz}x${sz}.png" >/dev/null 2>&1 || true
      sips -z $((sz * 2)) $((sz * 2)) "${ROOT}/public/icon-256.png" --out "${ICONSET}/icon_${sz}x${sz}@2x.png" >/dev/null 2>&1 || true
    done
    iconutil -c icns "${ICONSET}" -o "${DEST}/Contents/Resources/applet.icns" 2>/dev/null || true
    rm -rf "${TMPD}"
  fi

  xattr -cr "${DEST}" 2>/dev/null || true
  echo "built ${DEST}"
}

mkdir -p "${HOME}/Applications"
build_app "${HOME}/Applications/πD.app"

if [[ -w /Applications ]]; then
  build_app "/Applications/πD.app"
else
  rm -rf /Applications/πD.app 2>/dev/null || true
  if cp -R "${HOME}/Applications/πD.app" /Applications/πD.app 2>/dev/null; then
    xattr -cr /Applications/πD.app 2>/dev/null || true
    echo "copied → /Applications/πD.app"
  else
    osascript -e "do shell script \"rm -rf /Applications/πD.app; cp -R '${HOME}/Applications/πD.app' /Applications/πD.app; xattr -cr /Applications/πD.app\" with administrator privileges" 2>/dev/null \
      && echo "installed → /Applications/πD.app" \
      || echo "note: use ${HOME}/Applications/πD.app"
  fi
fi

rm -f "${AS_FILE}"

# Finder double-click in project
cat >"${ROOT}/Open πD.command" <<EOF
#!/bin/bash
cd "${ROOT}" || exit 1
export PATH="${NODE_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$PATH"
exec /bin/bash "${ROOT}/scripts/launch.sh"
EOF
chmod +x "${ROOT}/Open πD.command"

echo ""
echo "==== $(date) INSTALL TEST ====" >>"${LOG}"
echo "Testing app…"
/usr/bin/open "${HOME}/Applications/πD.app" || true
sleep 2

echo ""
echo "Done."
echo "  App:  ${HOME}/Applications/πD.app"
echo "  App:  /Applications/πD.app"
echo "  Log:  ${LOG}"
echo "  Also: ${ROOT}/Open πD.command"
echo ""
if [[ -f "${LOG}" ]]; then
  echo "--- log tail ---"
  tail -20 "${LOG}" || true
else
  echo "Log not written yet — click the app once, then: cat ${LOG}"
fi
