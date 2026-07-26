#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
mkdirSync(join(root, "dist-server"), { recursive: true });

const args = [
  "esbuild",
  "src/assist/standalone.ts",
  "--bundle",
  "--platform=node",
  "--format=esm",
  "--outfile=dist-server/pid-server.mjs",
  "--packages=bundle",
];

const child = spawn(
  process.platform === "win32" ? "npx.cmd" : "npx",
  args,
  { cwd: root, stdio: "inherit", shell: true },
);

child.on("exit", (code) => process.exit(code ?? 1));
