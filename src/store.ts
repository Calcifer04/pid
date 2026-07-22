import type { Board } from "./types";
import { PHASE_COLORS } from "./types";

const KEY = "routine.board.v1";

export function newId(): string {
  return crypto.randomUUID();
}

function seed(): Board {
  const names = ["inbox", "today", "doing", "done"];
  const phases = names.map((name, i) => ({
    id: newId(),
    name,
    color: PHASE_COLORS[i % PHASE_COLORS.length],
  }));
  return { phases, tasks: [] };
}

/** Shape-check on the way in, so a bad import or a stale key cannot wedge the app. */
function isBoard(value: unknown): value is Board {
  if (typeof value !== "object" || value === null) return false;
  const b = value as Partial<Board>;
  if (!Array.isArray(b.phases) || !Array.isArray(b.tasks)) return false;
  const phasesOk = b.phases.every(
    (p) =>
      typeof p?.id === "string" &&
      typeof p?.name === "string" &&
      typeof p?.color === "string",
  );
  const tasksOk = b.tasks.every(
    (t) =>
      typeof t?.id === "string" &&
      typeof t?.title === "string" &&
      typeof t?.phaseId === "string",
  );
  return phasesOk && tasksOk;
}

export function load(): Board {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return seed();
    const parsed: unknown = JSON.parse(raw);
    if (!isBoard(parsed)) return seed();
    // Drop tasks pointing at phases that no longer exist.
    const ids = new Set(parsed.phases.map((p) => p.id));
    return { ...parsed, tasks: parsed.tasks.filter((t) => ids.has(t.phaseId)) };
  } catch {
    return seed();
  }
}

export function save(board: Board): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(board));
  } catch {
    // Storage full or blocked. Export stays available as the escape hatch.
  }
}

export function exportFile(board: Board): void {
  const stamp = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(board, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `routine-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importFile(file: File): Promise<Board> {
  const text = await file.text();
  const parsed: unknown = JSON.parse(text);
  if (!isBoard(parsed)) throw new Error("That file is not a routine board.");
  return parsed;
}
