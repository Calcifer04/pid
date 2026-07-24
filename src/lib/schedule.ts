import { phaseIdForSopOnDay } from "./board";
import { sopAgendaOn, sopVisibleOn } from "./cadence";
import { addDays, routineLogKey, toDateKey } from "./dates";
import type { Board, Task } from "../types";
import { taskColor } from "../types";

export type ScheduleEntry = {
  key: string;
  kind: "task" | "sop";
  id: string;
  title: string;
  color: string;
  time?: string;
  done: boolean;
  bucket?: "daily" | "cycle" | "weekly" | "monthly";
  /** Board column this item sits in */
  phaseId?: string;
  phaseName?: string;
  phaseColor?: string;
};

/**
 * execute — Today / board / desk: full due list (fill-forward intervals).
 * agenda — Calendar / week: sparse marks only (no daily spam).
 */
export type ScheduleMode = "execute" | "agenda";

export function sopOccursOn(
  sop: Board["sops"][number],
  dateKey: string,
  sopLog: Record<string, number>,
): boolean {
  if (!sop.enabled) return false;
  return sopVisibleOn(sop.cadence, sop.id, dateKey, sopLog).visible;
}

export function buildDaySchedule(
  board: Board,
  dateKey: string,
  mode: ScheduleMode = "execute",
): {
  timed: ScheduleEntry[];
  anytime: ScheduleEntry[];
} {
  const phaseMeta = (phaseId: string | undefined) => {
    if (!phaseId) return {};
    const p = board.phases.find((x) => x.id === phaseId);
    if (!p) return {};
    return { phaseId: p.id, phaseName: p.name, phaseColor: p.color };
  };

  const timed: ScheduleEntry[] = [];
  const anytime: ScheduleEntry[] = [];

  for (const s of board.sops) {
    if (!s.enabled) continue;
    const vis =
      mode === "agenda"
        ? sopAgendaOn(s.cadence, s.id, dateKey, board.sopLog)
        : sopVisibleOn(s.cadence, s.id, dateKey, board.sopLog);
    if (!vis.visible) continue;

    const bucket =
      s.cadence.every === "day"
        ? "daily"
        : s.cadence.every === "interval"
          ? "cycle"
          : s.cadence.every === "month"
            ? "monthly"
            : s.cadence.every === "week" && s.cadence.days.length === 7
              ? "daily"
              : "weekly";

    const phaseId = phaseIdForSopOnDay(board, s, dateKey);
    const entry: ScheduleEntry = {
      key: `s:${s.id}`,
      kind: "sop",
      id: s.id,
      title: s.title,
      color: s.color,
      time: s.time,
      done: vis.done,
      bucket,
      ...phaseMeta(phaseId),
    };
    (s.time ? timed : anytime).push(entry);
  }

  // Phases that mean "on the day board" even without a dueDate stamp.
  // Only apply this for the real calendar today — past/future days stay strict.
  const realToday = toDateKey();
  const dayPhaseIds = new Set(
    board.phases
      .filter((p) => {
        const n = p.name.toLowerCase();
        return n === "today" || n === "doing";
      })
      .map((p) => p.id),
  );

  for (const t of board.tasks) {
    const dated = t.dueDate === dateKey;
    const onDayPhase =
      !t.dueDate &&
      dateKey === realToday &&
      dayPhaseIds.has(t.phaseId) &&
      !t.done;
    if (!dated && !onDayPhase) continue;

    const phase = phaseMeta(t.phaseId);
    const entry: ScheduleEntry = {
      key: `t:${t.id}`,
      kind: "task",
      id: t.id,
      title: t.title,
      color: taskColor(t),
      time: t.dueTime,
      done: Boolean(t.done),
      ...phase,
    };
    (t.dueTime ? timed : anytime).push(entry);
  }

  timed.sort(byOpenThenTime);
  anytime.sort(byOpenThenTitle);
  return { timed, anytime };
}

export function buildWeekDensity(
  board: Board,
  mondayKey: string,
): Record<string, { total: number; done: number }> {
  const out: Record<string, { total: number; done: number }> = {};
  for (let i = 0; i < 7; i++) {
    const key = addDays(mondayKey, i);
    const day = buildDaySchedule(board, key);
    const all = [...day.timed, ...day.anytime];
    out[key] = {
      total: all.length,
      done: all.filter((e) => e.done).length,
    };
  }
  return out;
}

function byOpenThenTime(a: ScheduleEntry, b: ScheduleEntry): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  const ta = a.time ?? "";
  const tb = b.time ?? "";
  if (ta !== tb) return ta < tb ? -1 : 1;
  return a.title.localeCompare(b.title);
}

function byOpenThenTitle(a: ScheduleEntry, b: ScheduleEntry): number {
  if (a.done !== b.done) return a.done ? 1 : -1;
  return a.title.localeCompare(b.title);
}

export function openTasksInPhase(tasks: Task[], phaseId: string): Task[] {
  return tasks.filter((t) => t.phaseId === phaseId && !t.done);
}

export { routineLogKey };
