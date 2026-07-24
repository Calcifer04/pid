import { sopVisibleOn } from "./cadence";
import type { Board, Phase, Sop, Task } from "../types";

export type BoardCard =
  | { kind: "task"; id: string; task: Task }
  | {
      kind: "sop";
      id: string;
      sop: Sop;
      done: boolean;
      phaseId: string;
    };

export function sopPlaceKey(sopId: string, dateKey: string): string {
  return `${sopId}:${dateKey}`;
}

/** Prefer an explicit done/today/doing column when placing a due SOP. */
export function defaultPhaseForSop(board: Board, sop: Sop): string {
  if (sop.phaseId && board.phases.some((p) => p.id === sop.phaseId)) {
    return sop.phaseId;
  }
  const byName = (n: string) =>
    board.phases.find((p) => p.name.toLowerCase() === n)?.id;
  return (
    byName("today") ??
    byName("doing") ??
    byName("inbox") ??
    board.phases[0]?.id ??
    ""
  );
}

export function phaseIdForSopOnDay(
  board: Board,
  sop: Sop,
  dateKey: string,
): string {
  const placed = board.sopPlace?.[sopPlaceKey(sop.id, dateKey)];
  if (placed && board.phases.some((p) => p.id === placed)) return placed;
  return defaultPhaseForSop(board, sop);
}

/**
 * Due SOP instances for `dateKey`, joined onto board columns.
 * Done items only stay visible if parked on a phase named "done".
 */
export function boardCardsForPhase(
  board: Board,
  phase: Phase,
  dateKey: string,
): BoardCard[] {
  const cards: BoardCard[] = [];

  for (const task of board.tasks) {
    if (task.phaseId === phase.id) {
      cards.push({ kind: "task", id: task.id, task });
    }
  }

  const isDonePhase = phase.name.toLowerCase() === "done";

  for (const sop of board.sops) {
    if (!sop.enabled) continue;
    const vis = sopVisibleOn(sop.cadence, sop.id, dateKey, board.sopLog);
    if (!vis.visible) continue;

    const phaseId = phaseIdForSopOnDay(board, sop, dateKey);
    if (phaseId !== phase.id) continue;

    // Hide completed SOPs from active columns; keep them on "done".
    if (vis.done && !isDonePhase) continue;
    if (!vis.done && isDonePhase) continue;

    cards.push({
      kind: "sop",
      id: sop.id,
      sop,
      done: vis.done,
      phaseId,
    });
  }

  // Open work first, SOPs slightly before plain tasks of same done-ness.
  cards.sort((a, b) => {
    const da = a.kind === "task" ? Boolean(a.task.done) : a.done;
    const db = b.kind === "task" ? Boolean(b.task.done) : b.done;
    if (da !== db) return da ? 1 : -1;
    if (a.kind !== b.kind) return a.kind === "sop" ? -1 : 1;
    const ta = a.kind === "task" ? a.task.title : a.sop.title;
    const tb = b.kind === "task" ? b.task.title : b.sop.title;
    return ta.localeCompare(tb);
  });

  return cards;
}

export function countCardsInPhase(
  board: Board,
  phase: Phase,
  dateKey: string,
): number {
  return boardCardsForPhase(board, phase, dateKey).length;
}
