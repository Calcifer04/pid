#!/usr/bin/env node
/** Build frontend + server + native Tauri app (uses MSVC env on Windows). */
import { spawn } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";

const child = win
  ? spawn("cmd.exe", ["/c", join(root, "scripts", "tauri-build.cmd")], {
      cwd: root,
      stdio: "inherit",
      env: {
        ...process.env,
        PATH: `${process.env.USERPROFILE}\\.cargo\\bin;${process.env.PATH || ""}`,
      },
    })
  : spawn("npx", ["tauri", "build"], {
      cwd: root,
      stdio: "inherit",
      shell: true,
      env: {
        ...process.env,
        PATH: `${process.env.HOME}/.cargo/bin:${process.env.PATH || ""}`,
      },
    });

child.on("exit", (code) => process.exit(code ?? 1));
