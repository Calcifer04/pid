import type { Board, FocusRun } from "../types";

/** Elapsed ms for a focus run at wall-clock `now`. */
export function focusElapsedMs(run: FocusRun | undefined, now = Date.now()): number {
  if (!run) return 0;
  const base = Math.max(0, run.accumulatedMs || 0);
  if (run.startedAt == null) return base;
  return base + Math.max(0, now - run.startedAt);
}

export function formatElapsed(ms: number): string {
  const totalSec = Math.floor(Math.max(0, ms) / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) {
    return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  }
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function parseFocusRef(
  ref: string | undefined,
): { kind: "task" | "sop"; id: string } | null {
  if (!ref?.trim()) return null;
  const raw = ref.trim();
  if (raw.startsWith("task:")) return { kind: "task", id: raw.slice(5) };
  if (raw.startsWith("sop:")) return { kind: "sop", id: raw.slice(4) };
  return null;
}

export function focusRef(kind: "task" | "sop", id: string): string {
  return `${kind}:${id}`;
}

export function isFocusRunning(run: FocusRun | undefined): boolean {
  return Boolean(run && run.startedAt != null);
}

/** Start or switch focus onto target. Resets timer when target changes. */
export function startFocusRun(
  board: Board,
  targetId: string,
  now = Date.now(),
): Board {
  const cur = board.focusRun;
  if (cur?.targetId === targetId && cur.startedAt != null) {
    return { ...board, focusId: targetId };
  }
  if (cur?.targetId === targetId && cur.startedAt == null) {
    // resume
    return {
      ...board,
      focusId: targetId,
      focusRun: {
        targetId,
        startedAt: now,
        accumulatedMs: cur.accumulatedMs || 0,
      },
    };
  }
  return {
    ...board,
    focusId: targetId,
    focusRun: {
      targetId,
      startedAt: now,
      accumulatedMs: 0,
    },
  };
}

export function pauseFocusRun(board: Board, now = Date.now()): Board {
  const cur = board.focusRun;
  if (!cur || cur.startedAt == null) return board;
  return {
    ...board,
    focusRun: {
      ...cur,
      startedAt: null,
      accumulatedMs: focusElapsedMs(cur, now),
    },
  };
}

export function clearFocusRun(board: Board): Board {
  if (!board.focusRun && !board.focusId) return board;
  return { ...board, focusId: undefined, focusRun: undefined };
}
