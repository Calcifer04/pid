/**
 * Desktop assist for Rainmeter / scripts.
 * POST /api/desk  { "message": "..." }  → load board, run πD, apply, save
 * GET  /api/desk  plain status for the skin
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import { join } from "node:path";
import { toDateKey } from "../lib/dates";
import { seedBoard } from "../store";
import type { View } from "../types";
import { taskColor } from "../types";
import { applyActions } from "./actions";
import { resolveAuth } from "./auth";
import { readBoardFile, writeBoardFile } from "./board-file";
import { runGrokAssist } from "./server";

export type DeskLast = {
  at: number;
  message: string;
  reply: string;
  applied: number;
  error?: string;
};

function deskStatePath(cwd: string): string {
  return join(cwd, "data", "desk-last.json");
}

export function readDeskLast(cwd: string): DeskLast | null {
  const p = deskStatePath(cwd);
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8")) as DeskLast;
  } catch {
    return null;
  }
}

function writeDeskLast(cwd: string, last: DeskLast): void {
  const dir = join(cwd, "data");
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(deskStatePath(cwd), JSON.stringify(last, null, 2), "utf8");
}

export async function handleDeskRequest(
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
    const url = req.url ?? "";
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.setHeader("cache-control", "no-store");

    // GET /api/desk/items — @ picker feed (task/sop lines)
    // t|id|title|meta|color
    if (url.includes("/items")) {
      const board = readBoardFile(cwd) ?? seedBoard();
      const lines: string[] = [];
      const scrub = (s: string) => s.replace(/[\r\n|]/g, " ").trim();
      for (const t of board.tasks) {
        if (t.done) continue;
        const phase =
          board.phases.find((p) => p.id === t.phaseId)?.name ?? "";
        lines.push(
          `t|${t.id}|${scrub(t.title)}|${scrub(phase)}|${taskColor(t)}`,
        );
      }
      for (const s of board.sops) {
        if (!s.enabled) continue;
        lines.push(`s|${s.id}|${scrub(s.title)}|sop|${s.color}`);
      }
      res.statusCode = 200;
      res.end(lines.join("\n") + (lines.length ? "\n" : ""));
      return;
    }

    const last = readDeskLast(cwd);
    res.statusCode = 200;
    if (!last) {
      res.end("status=idle\nreply=\napplied=0\nmsg=\n");
      return;
    }
    const scrub = (s: string) => s.replace(/[\r\n|]/g, " ").slice(0, 160);
    res.end(
      [
        `status=${last.error ? "err" : "ok"}`,
        `reply=${scrub(last.error || last.reply || "")}`,
        `applied=${last.applied}`,
        `msg=${scrub(last.message || "")}`,
      ].join("\n") + "\n",
    );
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "method not allowed" });
    return;
  }

  let message = "";
  try {
    const raw = await readBody(req);
    if (raw.trim().startsWith("{")) {
      const body = JSON.parse(raw) as { message?: string };
      message = body.message?.trim() ?? "";
    } else {
      message = raw.trim();
    }
  } catch {
    json(res, 400, { error: "invalid body" });
    return;
  }

  if (!message) {
    json(res, 400, { error: "message required" });
    return;
  }

  const auth = await resolveAuth(headerValue(req, "x-routine-xai-key"));
  if (!auth.token) {
    writeDeskLast(cwd, {
      at: Date.now(),
      message,
      reply: "",
      applied: 0,
      error: "offline — no auth",
    });
    json(res, 503, { error: "offline — no auth" });
    return;
  }

  const board = readBoardFile(cwd) ?? seedBoard();
  const dayKey = toDateKey();
  const view: View = "today";

  try {
    const { reply, actions } = await runGrokAssist({
      token: auth.token,
      model: auth.model,
      message,
      board,
      dayKey,
      view,
    });
    const result = applyActions(board, actions);
    writeBoardFile(result.board, cwd);
    const text = reply || `${result.applied.length} change(s)`;
    writeDeskLast(cwd, {
      at: Date.now(),
      message,
      reply: text,
      applied: result.applied.length,
    });
    json(res, 200, {
      reply: text,
      applied: result.applied.length,
      rejected: result.rejected.length,
      source: auth.source,
    });
  } catch (e) {
    const err = e instanceof Error ? e.message : "assist failed";
    writeDeskLast(cwd, {
      at: Date.now(),
      message,
      reply: "",
      applied: 0,
      error: err,
    });
    json(res, 502, { error: err });
  }
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0];
  return raw;
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
