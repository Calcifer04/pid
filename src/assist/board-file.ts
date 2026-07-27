/**
 * Disk-backed board. Shared across every browser hitting this Vite server.
 * Default path: <project>/data/board.json  (override with ROUTINE_DATA)
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { coerceBoard, seedBoard, type Board } from "../store";

function fileMtimeMs(path: string): number {
  try {
    return statSync(path).mtimeMs;
  } catch {
    return 0;
  }
}

export function boardFilePath(cwd = process.cwd()): string {
  const override = process.env.ROUTINE_DATA?.trim();
  if (override) {
    return isAbsolute(override) ? override : join(cwd, override);
  }
  return join(cwd, "data", "board.json");
}

export function readBoardFile(cwd = process.cwd()): Board | null {
  const path = boardFilePath(cwd);
  if (!existsSync(path)) return null;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as unknown;
    return coerceBoard(raw);
  } catch {
    return null;
  }
}

export function writeBoardFile(board: Board, cwd = process.cwd()): void {
  const path = boardFilePath(cwd);
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(board, null, 2), "utf8");
  renameSync(tmp, path);
}

export async function handleBoardRequest(
  req: IncomingMessage,
  res: ServerResponse,
  cwd = process.cwd(),
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    const path = boardFilePath(cwd);
    const fromDisk = readBoardFile(cwd);
    const board = fromDisk ?? seedBoard();
    // First hit with no file: materialize seed so path is real.
    if (!fromDisk) writeBoardFile(board, cwd);
    json(res, 200, {
      board,
      path,
      persisted: true,
      /** Disk mtime — clients use this to pull Syncthing updates. */
      mtimeMs: fileMtimeMs(path),
    });
    return;
  }

  if (req.method === "PUT" || req.method === "POST") {
    let body: { board?: unknown };
    try {
      body = JSON.parse(await readBody(req)) as { board?: unknown };
    } catch {
      json(res, 400, { error: "invalid json" });
      return;
    }
    const board = coerceBoard(body.board);
    if (!board) {
      json(res, 400, { error: "invalid board" });
      return;
    }
    try {
      const path = boardFilePath(cwd);
      writeBoardFile(board, cwd);
      json(res, 200, {
        ok: true,
        path,
        mtimeMs: fileMtimeMs(path),
      });
    } catch (e) {
      json(res, 500, {
        error: e instanceof Error ? e.message : "write failed",
      });
    }
    return;
  }

  json(res, 405, { error: "method not allowed" });
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  // Stop caches holding a stale board across browsers.
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
