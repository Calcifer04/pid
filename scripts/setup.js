#!/usr/bin/env node
/**
 * One-shot install: deps → build → server → Tauri app (if Rust) → shortcuts.
 *   npm run setup
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
      env: {
        ...process.env,
        PATH: `${process.env.USERPROFILE || process.env.HOME || ""}\\.cargo\\bin${win ? ";" : ":"}${process.env.PATH || ""}`,
      },
      ...opts,
    });
    child.on("exit", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${cmd} ${args.join(" ")} exited ${code}`));
    });
    child.on("error", reject);
  });
}

function hasCmd(cmd) {
  return new Promise((resolve) => {
    const c = spawn(cmd, ["--version"], {
      stdio: "ignore",
      shell: win,
      env: process.env,
    });
    c.on("exit", (code) => resolve(code === 0));
    c.on("error", () => resolve(false));
  });
}

async function main() {
  console.log("πD setup");
  console.log("--------");

  if (!existsSync(join(root, "package.json"))) {
    throw new Error("run from the piD project folder");
  }

  const npm = win ? "npm.cmd" : "npm";

  console.log("\n[1/4] npm install…");
  await run(npm, ["install"]);

  console.log("\n[2/4] build UI + server…");
  await run(npm, ["run", "build"]);
  await run(npm, ["run", "build:server"]);

  let tauriOk = false;
  const rustc = await hasCmd("rustc");
  const cargo = await hasCmd("cargo");
  if (rustc && cargo && existsSync(join(root, "src-tauri", "Cargo.toml"))) {
    console.log("\n[3/4] build native app (Tauri)…");
    try {
      await run(npm, ["run", "tauri", "build"]);
      tauriOk = true;
    } catch (e) {
      console.warn(
        "Tauri build skipped/failed — browser app mode still works.\n",
        e.message || e,
      );
    }
  } else {
    console.log(
      "\n[3/4] skip Tauri (install Rust from https://rustup.rs for native .exe/.app)",
    );
  }

  console.log("\n[4/4] install shortcuts…");
  await run(npm, ["run", "install:app"]);

  console.log(`
Done.

Open:
  npm run open${tauriOk ? "\n  or the native piD app from Desktop / Start Menu / Applications" : ""}

Board:   data/board.json
Secrets: .env.local
`);
}

main().catch((e) => {
  console.error("\nsetup failed:", e.message || e);
  process.exit(1);
});
