#!/usr/bin/env node
/** Cross-platform: npm run install:app → Dock/Desktop shortcut. */
import { spawn } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";

if (!win) {
  const sh = join(root, "scripts", "install-mac-app.sh");
  const head = existsSync(sh)
    ? readFileSync(sh, "utf8").split("\n").slice(0, 4).join("\n")
    : "MISSING install-mac-app.sh";
  console.log("install-app.js →", sh);
  console.log(head);
  console.log("---");
}

const child = win
  ? spawn(
      "powershell.exe",
      [
        "-NoProfile",
        "-ExecutionPolicy",
        "Bypass",
        "-File",
        join(root, "scripts", "install-windows-shortcut.ps1"),
      ],
      { cwd: root, stdio: "inherit" },
    )
  : spawn("bash", [join(root, "scripts", "install-mac-app.sh")], {
      cwd: root,
      stdio: "inherit",
    });

child.on("exit", (code) => process.exit(code ?? 1));
