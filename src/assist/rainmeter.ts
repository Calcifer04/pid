/**
 * Desk feed + focus control for Rainmeter top bar.
 *
 * GET  /api/rainmeter
 *   ok|open|done|total|frac|next|more|focus|id
 *
 * GET|POST /api/rainmeter/focus?dir=next|prev|clear
 *   cycles board.focusId among open desk items and returns the feed line.
 *
 * Ranking (productivity-first):
 *   1) board.focusId if still open
 *   2) pinned tasks
 *   3) doing-phase work
 *   4) timed items (sooner first)
 *   5) today-phase tasks
 *   6) other one-shot tasks on the day
 *   7) SOPs last (ritual, not deep work)
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { toDateKey } from "../lib/dates";
import {
  buildDaySchedule,
  type ScheduleEntry,
} from "../lib/schedule";
import type { Board } from "../types";
import { taskColor } from "../types";
import { seedBoard } from "../store";
import { readBoardFile, writeBoardFile } from "./board-file";

export async function handleRainmeterRequest(
  req: IncomingMessage,
  res: ServerResponse,
  cwd = process.cwd(),
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = req.url ?? "";
  const isFocus = url.includes("/focus");

  if (req.method !== "GET" && req.method !== "POST") {
    plain(res, 405, "err|0|0|0|0||||");
    return;
  }

  try {
    if (isFocus) {
      const dir = parseFocusDir(url, req.method);
      const board = readBoardFile(cwd) ?? seedBoard();
      const next = applyFocusDir(board, dir);
      if (next !== board) writeBoardFile(next, cwd);
      plain(res, 200, feedLine(next));
      return;
    }

    if (req.method !== "GET") {
      plain(res, 405, "err|0|0|0|0||||");
      return;
    }

    const board = readBoardFile(cwd) ?? seedBoard();
    plain(res, 200, feedLine(board));
  } catch {
    plain(res, 500, "err|0|0|0|0||||");
  }
}

function parseFocusDir(
  url: string,
  method: string,
): "next" | "prev" | "clear" {
  const q = url.includes("?") ? url.slice(url.indexOf("?") + 1) : "";
  const params = new URLSearchParams(q);
  const raw = (params.get("dir") || params.get("to") || "next")
    .trim()
    .toLowerCase();
  if (raw === "prev" || raw === "back" || raw === "-1") return "prev";
  if (raw === "clear" || raw === "none" || raw === "off") return "clear";
  if (method === "POST" && raw === "") return "next";
  return "next";
}

function applyFocusDir(
  board: Board,
  dir: "next" | "prev" | "clear",
): Board {
  if (dir === "clear") {
    if (!board.focusId) return board;
    return { ...board, focusId: undefined };
  }

  const dayKey = toDateKey();
  const open = buildFocusPool(board, dayKey).filter((e) => !e.done);
  // Stable cycle order — MUST ignore current focus boost, otherwise
  // rankOpen always puts the focused item at [0] and next↔prev only
  // oscillates between two entries.
  const ordered = rankOpen(open, { ...board, focusId: undefined });
  if (ordered.length === 0) {
    if (!board.focusId) return board;
    return { ...board, focusId: undefined };
  }

  const keys = ordered.map(refKey);
  const shown = rankOpen(open, board)[0];
  const cur = board.focusId?.trim() || (shown ? refKey(shown) : "");
  let idx = cur ? keys.indexOf(cur) : 0;
  if (idx < 0) idx = 0;

  if (dir === "next") idx = (idx + 1) % keys.length;
  else idx = (idx - 1 + keys.length) % keys.length;

  const focusId = keys[idx];
  if (focusId === board.focusId) return board;
  return { ...board, focusId };
}

function feedLine(board: Board): string {
  const dayKey = toDateKey();
  const pool = buildFocusPool(board, dayKey);
  const open = pool.filter((e) => !e.done);
  const done = pool.filter((e) => e.done).length;
  const total = pool.length;
  const frac = total > 0 ? Math.round((done / total) * 100) : 0;

  const ranked = rankOpen(open, board);
  const top = ranked[0];
  const next = top ? sanitize(top.title, 96) : "";
  const more = Math.max(0, ranked.length - 1);
  const focusFlag =
    board.focusId && ranked.some((e) => refKey(e) === board.focusId)
      ? "1"
      : top?.pinned
        ? "pin"
        : top
          ? top.kind
          : "";
  const id = top ? refKey(top) : "";
  const color = sanitizeColor(top?.color);

  // ok|open|done|total|frac|next|more|focus|id|color
  return [
    "ok",
    open.length,
    done,
    total,
    frac,
    next,
    String(more),
    focusFlag,
    id,
    color,
  ].join("|");
}

function plain(res: ServerResponse, status: number, body: string): void {
  res.statusCode = status;
  res.setHeader("content-type", "text/plain; charset=ascii");
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

type FocusEntry = ScheduleEntry & {
  pinned?: boolean;
  phaseName?: string;
};

/** Day schedule + active board work that should surface on the desk. */
function buildFocusPool(board: Board, dayKey: string): FocusEntry[] {
  const day = buildDaySchedule(board, dayKey);
  const seen = new Set<string>();
  const out: FocusEntry[] = [];

  const push = (e: FocusEntry) => {
    const k = refKey(e);
    if (seen.has(k)) return;
    seen.add(k);
    out.push(e);
  };

  for (const e of [...day.timed, ...day.anytime]) {
    push({
      ...e,
      pinned:
        e.kind === "task"
          ? Boolean(board.tasks.find((t) => t.id === e.id)?.pinned)
          : false,
    });
  }

  // Surface undated active work even if not stamped due today
  // (inbox URGENT / doing / today columns).
  for (const t of board.tasks) {
    if (t.done) continue;
    const phase = board.phases.find((p) => p.id === t.phaseId);
    const pn = phase?.name.toLowerCase() ?? "";
    const activeCol = pn === "doing" || pn === "today" || pn === "inbox";
    if (!activeCol && !t.pinned) continue;
    // skip future-dated
    if (t.dueDate && t.dueDate > dayKey) continue;

    push({
      key: `t:${t.id}`,
      kind: "task",
      id: t.id,
      title: t.title,
      color: taskColor(t),
      time: t.dueTime,
      done: false,
      phaseId: t.phaseId,
      phaseName: phase?.name,
      pinned: Boolean(t.pinned),
    });
  }

  return out;
}

function rankOpen(open: FocusEntry[], board: Board): FocusEntry[] {
  const focus = board.focusId?.trim();
  const phaseRank = (name?: string) => {
    const n = (name ?? "").toLowerCase();
    if (n === "doing") return 0;
    if (n === "today") return 1;
    if (n === "inbox") return 2;
    return 3;
  };
  const nowM = new Date().getHours() * 60 + new Date().getMinutes();
  const timeScore = (t?: string) => {
    if (!t) return 10_000;
    const [h, m] = t.split(":").map(Number);
    if (Number.isNaN(h)) return 10_000;
    const mins = h * 60 + (m || 0);
    // overdue timed first, then upcoming
    if (mins <= nowM) return mins - nowM; // negative = overdue priority
    return mins - nowM + 500;
  };

  return [...open].sort((a, b) => {
    const aFocus = focus && refKey(a) === focus ? 0 : 1;
    const bFocus = focus && refKey(b) === focus ? 0 : 1;
    if (aFocus !== bFocus) return aFocus - bFocus;

    const aPin = a.pinned ? 0 : 1;
    const bPin = b.pinned ? 0 : 1;
    if (aPin !== bPin) return aPin - bPin;

    // URGENT in title
    const aU = /urgent/i.test(a.title) ? 0 : 1;
    const bU = /urgent/i.test(b.title) ? 0 : 1;
    if (aU !== bU) return aU - bU;

    const aPh = phaseRank(a.phaseName);
    const bPh = phaseRank(b.phaseName);
    if (aPh !== bPh) return aPh - bPh;

    // tasks before SOPs (deep work > ritual), unless SOP is only thing
    if (a.kind !== b.kind) return a.kind === "task" ? -1 : 1;

    const aT = timeScore(a.time);
    const bT = timeScore(b.time);
    if (aT !== bT) return aT - bT;

    return a.title.localeCompare(b.title);
  });
}

function refKey(e: { kind: string; id: string }): string {
  return `${e.kind}:${e.id}`;
}

function sanitize(s: string, max = 96): string {
  return s
    .replace(/[\r\n|]/g, " ")
    .replace(/[^\x20-\x7E]/g, "?")
    .trim()
    .slice(0, max);
}

/** Task identity hex for the desk swatch. */
function sanitizeColor(c: string | undefined): string {
  const raw = (c ?? "#9a9aab").trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(raw)) return raw;
  if (/^#[0-9a-f]{3}$/.test(raw)) {
    const r = raw[1],
      g = raw[2],
      b = raw[3];
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^[0-9a-f]{6}$/.test(raw)) return `#${raw}`;
  return "#9a9aab";
}
