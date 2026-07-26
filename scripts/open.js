#!/usr/bin/env node
/** Cross-platform: npm run open → launch πD app window. */
import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";

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
