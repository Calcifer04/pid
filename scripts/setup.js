#!/usr/bin/env node
/**
 * One-shot install: deps → build → desktop/Dock app.
 *   npm run setup
 * Then: npm run open   (or double-click Desktop / Dock πD)
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const win = process.platform === "win32";

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd: root,
      stdio: "inherit",
      shell: win,
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
    child.on("error", reject);
  });
}

async function main() {
  console.log("πD setup");
  console.log("--------");

  if (!existsSync(join(root, "package.json"))) {
    throw new Error("run from the piD project folder");
  }

  console.log("\n[1/3] npm install…");
  await run(win ? "npm.cmd" : "npm", ["install"]);

  console.log("\n[2/3] build…");
  await run(win ? "npm.cmd" : "npm", ["run", "build"]);

  console.log("\n[3/3] install app shortcut…");
  await run(win ? "npm.cmd" : "npm", ["run", "install:app"]);

  console.log(`
Done.

Open:
  npm run open

Or double-click:
  Windows → Desktop "piD"
  Mac     → ~/Applications/πD.app  (Keep in Dock)

Board file: data/board.json
Secrets:    .env.local  (copy from the other machine or Syncthing)
`);
}

main().catch((e) => {
  console.error("\nsetup failed:", e.message || e);
  process.exit(1);
});
