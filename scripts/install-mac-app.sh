#!/usr/bin/env bash
# install-mac-app.sh — VERSION 2026-03-27-c
# Creates πD.app using Python→osacompile (no broken bash/AppleScript quoting).
set -euo pipefail

echo "piD mac installer VERSION 2026-03-27-c"

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export PATH="/opt/homebrew/bin:/opt/homebrew/sbin:/usr/local/bin:/usr/bin:/bin:${HOME}/.volta/bin:${PATH:-}"
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
  echo "ERROR: node/npm not found. Install https://nodejs.org and retry."
  exit 1
fi

echo "node: ${NODE} ($(${NODE} -v))"
echo "npm:  ${NPM}"
echo "root: ${ROOT}"

if [[ ! -f "${ROOT}/dist/index.html" ]]; then
  echo "Building UI…"
  (cd "${ROOT}" && "${NPM}" install && "${NPM}" run build)
fi
if [[ ! -f "${ROOT}/dist-server/pid-server.mjs" ]]; then
  (cd "${ROOT}" && "${NPM}" run build:server) || true
fi
chmod +x "${ROOT}/scripts/launch.sh" 2>/dev/null || true

LOG_DIR="${HOME}/Library/Logs"
LOG="${LOG_DIR}/piD.log"
mkdir -p "${LOG_DIR}"
NODE_DIR="$(dirname "${NODE}")"

# Runner invoked by the app (plain bash, absolute paths)
RUNNER="${ROOT}/scripts/.mac-dock-run.sh"
cat >"${RUNNER}" <<EOF
#!/bin/bash
export PATH="${NODE_DIR}:/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$PATH"
export PID_ROOT="${ROOT}"
export PID_PORT="\${PID_PORT:-4000}"
LOG="${LOG}"
mkdir -p "${LOG_DIR}"
echo "==== \$(date) APP CLICK ====" >>"\$LOG"
cd "${ROOT}" || { echo "cd failed ${ROOT}" >>"\$LOG"; exit 1; }
/bin/bash "${ROOT}/scripts/launch.sh" >>"\$LOG" 2>&1
EC=\$?
echo "==== \$(date) exit \$EC ====" >>"\$LOG"
exit \$EC
EOF
chmod +x "${RUNNER}"
echo "runner: ${RUNNER}"

# Build .app with Python (clean AppleScript, no bash quote hell)
export PID_INSTALL_ROOT="${ROOT}"
export PID_INSTALL_RUNNER="${RUNNER}"
export PID_INSTALL_LOG="${LOG}"
export PID_INSTALL_NODE="${NODE}"

python3 - <<'PY'
import os, shutil, subprocess, tempfile
from pathlib import Path

root = Path(os.environ["PID_INSTALL_ROOT"])
runner = os.environ["PID_INSTALL_RUNNER"]
log = os.environ["PID_INSTALL_LOG"]
home = Path.home()

# Minimal valid AppleScript
# Use only ASCII in the script source except we can use \u escapes if needed
script = f'''on run
  set runner to "{runner}"
  set logPath to "{log}"
  try
    do shell script "/bin/bash " & quoted form of runner
  on error errMsg
    try
      do shell script "echo " & quoted form of ("ERROR: " & errMsg) & " >> " & quoted form of logPath
    end try
    display alert "piD failed" message errMsg & return & return & "Log: " & logPath & return & return & "Fallback: cd project && npm run open" as critical
  end try
end run
'''

# Validate no smart quotes
assert "\u201c" not in script and "\u201d" not in script

td = Path(tempfile.mkdtemp())
as_path = td / "pid.applescript"
as_path.write_text(script, encoding="utf-8")
print("AppleScript written to", as_path)
print(script)

def build(dest: Path):
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    subprocess.check_call(["/usr/bin/osacompile", "-o", str(dest), str(as_path)])
    info = dest / "Contents" / "Info.plist"
    for key, val in [
        ("CFBundleName", "piD"),
        ("CFBundleDisplayName", "piD"),
        ("CFBundleIdentifier", "local.pid.board"),
    ]:
        subprocess.call(["/usr/bin/plutil", "-replace", key, "-string", val, str(info)])
    # icon
    png = root / "public" / "icon-256.png"
    if png.is_file():
        try:
            iconset = td / "AppIcon.iconset"
            iconset.mkdir(exist_ok=True)
            for sz in (16, 32, 128, 256, 512):
                subprocess.call([
                    "sips", "-z", str(sz), str(sz), str(png),
                    "--out", str(iconset / f"icon_{sz}x{sz}.png"),
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
                subprocess.call([
                    "sips", "-z", str(sz*2), str(sz*2), str(png),
                    "--out", str(iconset / f"icon_{sz}x{sz}@2x.png"),
                ], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            icns = dest / "Contents" / "Resources" / "applet.icns"
            subprocess.call(["iconutil", "-c", "icns", str(iconset), "-o", str(icns)],
                            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        except Exception as e:
            print("icon skip", e)
    subprocess.call(["xattr", "-cr", str(dest)])
    print("built", dest)

apps = [
    home / "Applications" / "piD.app",
    Path("/Applications/piD.app"),
]
(home / "Applications").mkdir(parents=True, exist_ok=True)
build(apps[0])

# system Applications
try:
    build(apps[1])
except Exception as e:
    print("direct /Applications failed:", e)
    try:
        if apps[1].exists():
            shutil.rmtree(apps[1])
        shutil.copytree(apps[0], apps[1])
        subprocess.call(["xattr", "-cr", str(apps[1])])
        print("copied to", apps[1])
    except Exception as e2:
        print("could not install /Applications (ok):", e2)
        print("use", apps[0])

shutil.rmtree(td, ignore_errors=True)
print("OK python build done")
PY

# Double-click helper in project (guaranteed)
cat >"${ROOT}/Open piD.command" <<EOF
#!/bin/bash
cd "${ROOT}" || exit 1
export PATH="$(dirname "${NODE}"):/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:\$PATH"
echo "Opening piD…"
exec /bin/bash "${ROOT}/scripts/launch.sh"
EOF
chmod +x "${ROOT}/Open piD.command"

# Also alias unicode name if possible
cp -R "${HOME}/Applications/piD.app" "${HOME}/Applications/πD.app" 2>/dev/null || true

echo ""
echo "VERSION 2026-03-27-c install finished"
echo "Apps:"
echo "  ${HOME}/Applications/piD.app"
ls -la "${HOME}/Applications/piD.app/Contents/MacOS" 2>/dev/null || true
echo "  /Applications/piD.app"
echo "Log will be: ${LOG}"
echo "Project click: ${ROOT}/Open piD.command"
echo ""
echo "Testing…"
echo "==== $(date) INSTALL TEST ====" >>"${LOG}"
/usr/bin/open "${HOME}/Applications/piD.app" || true
sleep 3
echo "--- log ---"
cat "${LOG}" 2>/dev/null || echo "(no log yet)"
echo "---"
echo "If no window, double-click: Open piD.command"
echo "Or: cd ${ROOT} && npm run open"
