import { cadenceFromLegacyDays } from "./lib/cadence";
import type {
  Board,
  Cadence,
  FocusRun,
  Phase,
  Sop,
  Task,
  Theme,
} from "./types";
import { PHASE_COLOR_MIGRATE, PHASE_COLORS } from "./types";

export type { Board };

const KEY = "routine.board.v3";
const LEGACY_V2 = "routine.board.v2";
const LEGACY_V1 = "routine.board.v1";

export function newId(): string {
  return crypto.randomUUID();
}

export function seedBoard(): Board {
  const names = ["inbox", "today", "doing", "done"];
  const phases: Phase[] = names.map((name, i) => ({
    id: newId(),
    name,
    color: PHASE_COLORS[i % PHASE_COLORS.length],
  }));
  return {
    phases,
    tasks: [],
    sops: [],
    sopLog: {},
    sopPlace: {},
    theme: { accent: "rgb" },
  };
}

function coerceTheme(raw: unknown): Theme | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const accent = (raw as { accent?: unknown }).accent;
  if (typeof accent !== "string" || !accent.trim()) return undefined;
  const a = accent.trim().toLowerCase();
  if (a === "rgb" || a === "cycle" || a === "rainbow") return { accent: "rgb" };
  if (/^#[0-9a-f]{3,8}$/i.test(a)) return { accent: a };
  return undefined;
}

function isPhase(p: unknown): p is Phase {
  if (typeof p !== "object" || p === null) return false;
  const x = p as Partial<Phase>;
  return (
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.color === "string"
  );
}

function isTask(t: unknown): t is Task {
  if (typeof t !== "object" || t === null) return false;
  const x = t as Partial<Task>;
  return (
    typeof x.id === "string" &&
    typeof x.title === "string" &&
    typeof x.phaseId === "string"
  );
}

function isCadence(c: unknown): c is Cadence {
  if (typeof c !== "object" || c === null) return false;
  const x = c as {
    every?: string;
    days?: unknown;
    on?: unknown;
    window?: unknown;
  };
  if (x.every === "day") return true;
  if (x.every === "interval" && typeof x.days === "number" && x.days >= 1)
    return true;
  if (x.every === "week" && Array.isArray(x.days)) return true;
  if (x.every === "month" && (x.on === "last" || Array.isArray(x.on))) {
    if (x.window !== undefined && (typeof x.window !== "number" || x.window < 1))
      return false;
    return true;
  }
  return false;
}

function isSop(r: unknown): r is Sop {
  if (typeof r !== "object" || r === null) return false;
  const x = r as Partial<Sop> & { days?: number[] };
  if (typeof x.id !== "string" || typeof x.title !== "string") return false;
  if (typeof x.color !== "string" || typeof x.enabled !== "boolean")
    return false;
  // v3 cadence or legacy days
  if (x.cadence !== undefined) return isCadence(x.cadence);
  return Array.isArray(x.days);
}

function migrateSop(raw: Sop & { days?: number[] }): Sop {
  const cadence =
    raw.cadence && isCadence(raw.cadence)
      ? raw.cadence
      : cadenceFromLegacyDays(raw.days);
  return {
    id: raw.id,
    title: raw.title,
    color: PHASE_COLOR_MIGRATE[raw.color.toLowerCase()] ?? raw.color,
    cadence,
    time: raw.time,
    phaseId: typeof raw.phaseId === "string" ? raw.phaseId : undefined,
    notes: typeof raw.notes === "string" ? raw.notes : undefined,
    enabled: raw.enabled !== false,
    createdAt: raw.createdAt ?? Date.now(),
  };
}

function migrateColors(phases: Phase[]): Phase[] {
  return phases.map((p) => ({
    ...p,
    color: PHASE_COLOR_MIGRATE[p.color.toLowerCase()] ?? p.color,
  }));
}

/** Accept v3, v2 (routines), or loose shapes. */
export function coerceBoard(raw: unknown): Board | null {
  if (typeof raw !== "object" || raw === null) return null;
  const b = raw as Record<string, unknown>;
  if (!Array.isArray(b.phases) || !Array.isArray(b.tasks)) return null;
  if (!b.phases.every(isPhase) || !b.tasks.every(isTask)) return null;

  const sopSrc = (b.sops ?? b.routines ?? []) as unknown[];
  if (!Array.isArray(sopSrc) || !sopSrc.every(isSop)) return null;

  const logSrc =
    (b.sopLog as Record<string, number> | undefined) ??
    (b.routineLog as Record<string, number> | undefined) ??
    {};

  const phases = migrateColors(b.phases as Phase[]);
  const ids = new Set(phases.map((p) => p.id));
  const sops = (sopSrc as Sop[]).map(migrateSop);
  const sopIds = new Set(sops.map((s) => s.id));
  const placeSrc =
    (b.sopPlace as Record<string, string> | undefined) ?? {};
  const sopPlace: Record<string, string> = {};
  for (const [k, v] of Object.entries(placeSrc)) {
    if (typeof v !== "string" || !ids.has(v)) continue;
    // Drop placements for deleted SOPs (`${sopId}:${YYYY-MM-DD}`).
    const sopId = k.slice(0, Math.max(0, k.lastIndexOf(":")));
    if (!sopIds.has(sopId)) continue;
    sopPlace[k] = v;
  }

  return {
    phases,
    tasks: (b.tasks as Task[]).filter((t) => ids.has(t.phaseId)),
    sops,
    sopLog: { ...logSrc },
    sopPlace,
    theme: coerceTheme(b.theme),
    focusId:
      typeof b.focusId === "string" && b.focusId.trim()
        ? b.focusId.trim()
        : undefined,
    focusRun: coerceFocusRun(b.focusRun),
  };
}

function coerceFocusRun(raw: unknown): FocusRun | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const x = raw as Partial<FocusRun>;
  if (typeof x.targetId !== "string" || !x.targetId.trim()) return undefined;
  const accumulatedMs =
    typeof x.accumulatedMs === "number" && x.accumulatedMs >= 0
      ? x.accumulatedMs
      : 0;
  const startedAt =
    x.startedAt === null
      ? null
      : typeof x.startedAt === "number" && x.startedAt > 0
        ? x.startedAt
        : null;
  return {
    targetId: x.targetId.trim(),
    startedAt,
    accumulatedMs,
  };
}

/** localStorage only — cache / offline fallback. Prefer loadBoard() for real use. */
export function loadLocal(): Board {
  try {
    for (const key of [KEY, LEGACY_V2, LEGACY_V1]) {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      const board = coerceBoard(parsed);
      if (board) {
        if (key !== KEY) saveLocal(board);
        return board;
      }
    }
    return seedBoard();
  } catch {
    return seedBoard();
  }
}

/** @deprecated use loadLocal */
export const load = loadLocal;

export function saveLocal(board: Board): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(board));
  } catch {
    // Storage full or blocked. Export stays available as the escape hatch.
  }
}

/** @deprecated use saveLocal */
export const save = saveLocal;

/** How "full" a board is — used when lifting browser cache into the shared file. */
export function boardWeight(b: Board): number {
  return (
    b.sops.length * 10 +
    b.tasks.length * 3 +
    Object.keys(b.sopLog).length +
    b.phases.length +
    (b.focusRun ? 2 : 0)
  );
}

export function pickRicher(a: Board, b: Board): Board {
  return boardWeight(a) >= boardWeight(b) ? a : b;
}

/** Shared file via /api/board — same data across machines (Syncthing). */
export async function fetchSharedBoard(): Promise<{
  board: Board;
  path: string;
  mtimeMs: number;
} | null> {
  try {
    const res = await fetch("/api/board", {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      board?: unknown;
      path?: string;
      mtimeMs?: number;
    };
    const board = coerceBoard(body.board);
    if (!board) return null;
    return {
      board,
      path: body.path ?? "data/board.json",
      mtimeMs: typeof body.mtimeMs === "number" ? body.mtimeMs : 0,
    };
  } catch {
    return null;
  }
}

export async function pushSharedBoard(
  board: Board,
): Promise<{ ok: boolean; mtimeMs: number }> {
  try {
    const res = await fetch("/api/board", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ board }),
    });
    if (!res.ok) return { ok: false, mtimeMs: 0 };
    const body = (await res.json().catch(() => ({}))) as { mtimeMs?: number };
    return {
      ok: true,
      mtimeMs: typeof body.mtimeMs === "number" ? body.mtimeMs : Date.now(),
    };
  } catch {
    return { ok: false, mtimeMs: 0 };
  }
}

/** Stable fingerprint so we can detect remote disk changes. */
export function boardFingerprint(board: Board): string {
  // Order-insensitive enough for our purpose; full JSON is fine (board is small).
  return JSON.stringify(board);
}

export function exportFile(board: Board): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(board, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `pid-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importFile(file: File): Promise<Board> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  const board = coerceBoard(parsed);
  if (!board) throw new Error("That file is not a πD board.");
  return board;
}
