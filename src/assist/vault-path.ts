/**
 * Clean πD vault root (markdown knowledge tree).
 * Default: <project>/vault
 * Override: ROUTINE_VAULT=/absolute/or/relative/path
 *
 * Legacy Obsidian vaults are intentionally not referenced here.
 */
import fs from "node:fs";
import path from "node:path";

export function vaultPath(): string {
  const override = process.env.ROUTINE_VAULT?.trim();
  if (override) {
    return path.isAbsolute(override)
      ? override
      : path.resolve(process.cwd(), override);
  }
  return path.resolve(process.cwd(), "vault");
}

export function ensureVaultSkeleton(): string {
  const root = vaultPath();
  const dirs = [
    root,
    path.join(root, "inbox"),
    path.join(root, "projects"),
    path.join(root, "sops"),
    path.join(root, "journal", "daily"),
    path.join(root, "journal", "worklogs"),
    path.join(root, "_templates"),
  ];
  for (const d of dirs) {
    fs.mkdirSync(d, { recursive: true });
  }
  return root;
}
