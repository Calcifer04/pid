#!/usr/bin/env node
/** Run production server (dist + API). Builds server bundle if missing. */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const server = join(root, "dist-server", "pid-server.mjs");
const dist = join(root, "dist", "index.html");

async function run(cmd, args) {
  return new Promise((resolve, reject) => {
    const c = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    c.on("exit", (code) =>
      code === 0 ? resolve() : reject(new Error(String(code))),
    );
  });
}

if (!existsSync(dist)) {
  console.log("building frontend…");
  await run(process.platform === "win32" ? "npm.cmd" : "npm", ["run", "build"]);
}
if (!existsSync(server)) {
  console.log("building server…");
  await run(process.platform === "win32" ? "npm.cmd" : "npm", [
    "run",
    "build:server",
  ]);
}

const port = process.env.PID_PORT || "4000";
const child = spawn(process.execPath, [server], {
  cwd: root,
  stdio: "inherit",
  env: {
    ...process.env,
    PID_ROOT: root,
    PID_PORT: port,
    PID_HOST: process.env.PID_HOST || "0.0.0.0",
  },
});
child.on("exit", (code) => process.exit(code ?? 0));
