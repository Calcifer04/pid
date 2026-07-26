#!/usr/bin/env node
/** Cross-platform: npm run open → native Tauri app if built, else browser app mode. */
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";
const mac = process.platform === "darwin";

function tauriCandidates() {
  const list = [];
  if (win) {
    list.push(
      join(root, "src-tauri", "target", "release", "piD.exe"),
      join(root, "src-tauri", "target", "release", "pid.exe"),
      join(root, "piD.exe"),
    );
  } else if (mac) {
    list.push(
      join(root, "src-tauri", "target", "release", "bundle", "macos", "piD.app", "Contents", "MacOS", "piD"),
      join(process.env.HOME || "", "Applications", "πD.app", "Contents", "MacOS", "πD"),
    );
  } else {
    list.push(join(root, "src-tauri", "target", "release", "pid"));
  }
  return list;
}

const native = tauriCandidates().find((p) => p && existsSync(p));

if (native) {
  // Ensure server bundle exists
  if (!existsSync(join(root, "dist", "index.html"))) {
    spawnSync(win ? "npm.cmd" : "npm", ["run", "build"], {
      cwd: root,
      stdio: "inherit",
      shell: win,
    });
  }
  if (!existsSync(join(root, "dist-server", "pid-server.mjs"))) {
    spawnSync(win ? "npm.cmd" : "npm", ["run", "build:server"], {
      cwd: root,
      stdio: "inherit",
      shell: win,
    });
  }

  const child = spawn(native, [], {
    cwd: root,
    stdio: "inherit",
    detached: win,
    env: { ...process.env, PID_ROOT: root },
    windowsHide: false,
  });
  if (win) {
    child.unref();
    process.exit(0);
  }
  child.on("exit", (code) => process.exit(code ?? 1));
} else {
  // Browser app-mode fallback
  const child = win
    ? spawn(
        "powershell.exe",
        [
          "-NoProfile",
          "-ExecutionPolicy",
          "Bypass",
          "-File",
          join(root, "scripts", "launch.ps1"),
        ],
        { cwd: root, stdio: "inherit", windowsHide: true },
      )
    : spawn("bash", [join(root, "scripts", "launch.sh")], {
        cwd: root,
        stdio: "inherit",
      });
  child.on("exit", (code) => process.exit(code ?? 1));
}
