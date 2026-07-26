import { daily, interval, monthly, weekly } from "../lib/cadence";
import { routineLogKey } from "../lib/dates";
import type { Board, Cadence, Sop, Task } from "../types";
import { COLOR_NAMES, PHASE_COLORS } from "../types";

/**
 * The only language Grok speaks to the app.
 * Server collects these; the client applies them. Nothing else mutates state.
 */
export type Action =
  | {
      type: "add_task";
      title: string;
      phase?: string;
      dueDate?: string;
      dueTime?: string;
      done?: boolean;
      color?: string;
    }
  | {
      type: "update_task";
      id: string;
      title?: string;
      phase?: string;
      dueDate?: string | null;
      dueTime?: string | null;
      done?: boolean;
      /** Identity swatch (own color, not phase). null clears to default. */
      color?: string | null;
    }
  | { type: "delete_task"; id: string }
  | {
      type: "add_sop";
      title: string;
      /** daily | weekdays | weekends | weekly days[] | monthly */
      cadence?:
        | "daily"
        | "weekdays"
        | "weekends"
        | { every: "week"; days: number[] }
        | { every: "month"; on: number[] | "last"; window?: number }
        | { every: "interval"; days: number };
      time?: string;
      phase?: string;
      enabled?: boolean;
    }
  | {
      type: "update_sop";
      id: string;
      title?: string;
      cadence?:
        | "daily"
        | "weekdays"
        | "weekends"
        | { every: "week"; days: number[] }
        | { every: "month"; on: number[] | "last"; window?: number }
        | { every: "interval"; days: number };
      time?: string | null;
      phase?: string | null;
      enabled?: boolean;
    }
  | { type: "delete_sop"; id: string }
  | {
      type: "set_sop_done";
      id: string;
      date: string;
      done: boolean;
    }
  | { type: "add_phase"; name: string }
  | { type: "rename_phase"; id: string; name: string }
  | {
      type: "set_focus";
      /** task:<id> | sop:<id> | bare task/sop id | null to clear */
      id: string | null;
    }
  | { type: "set_pinned"; id: string; pinned: boolean };

export type ApplyResult = {
  board: Board;
  applied: Action[];
  rejected: { action: Action; reason: string }[];
};

export function newId(): string {
  return crypto.randomUUID();
}

export function applyActions(board: Board, actions: Action[]): ApplyResult {
  let next: Board = {
    phases: board.phases.map((p) => ({ ...p })),
    tasks: board.tasks.map((t) => ({ ...t })),
    sops: board.sops.map((r) => ({ ...r, cadence: { ...r.cadence } as Cadence })),
    sopLog: { ...board.sopLog },
    sopPlace: { ...(board.sopPlace ?? {}) },
    theme: board.theme ? { ...board.theme } : undefined,
    focusId: board.focusId,
    focusRun: board.focusRun ? { ...board.focusRun } : undefined,
  };
  const applied: Action[] = [];
  const rejected: ApplyResult["rejected"] = [];

  for (const action of actions) {
    try {
      next = applyOne(next, action);
      applied.push(action);
    } catch (e) {
      rejected.push({
        action,
        reason: e instanceof Error ? e.message : "rejected",
      });
    }
  }
  return { board: next, applied, rejected };
}

function applyOne(board: Board, action: Action): Board {
  switch (action.type) {
    case "add_task": {
      const title = cleanTitle(action.title);
      const phaseId = resolvePhaseId(board, action.phase);
      const task: Task = {
        id: newId(),
        title,
        phaseId,
        createdAt: Date.now(),
        dueDate: action.dueDate || undefined,
        dueTime: action.dueTime || undefined,
        done: Boolean(action.done),
        color: action.color ? resolveColor(action.color) : undefined,
      };
      return { ...board, tasks: [...board.tasks, task] };
    }
    case "update_task": {
      const idx = board.tasks.findIndex((t) => t.id === action.id);
      if (idx < 0) throw new Error(`unknown task ${action.id}`);
      const cur = board.tasks[idx];
      const tasks = board.tasks.slice();
      tasks[idx] = {
        ...cur,
        title:
          action.title !== undefined ? cleanTitle(action.title) : cur.title,
        phaseId:
          action.phase !== undefined
            ? resolvePhaseId(board, action.phase)
            : cur.phaseId,
        dueDate:
          action.dueDate === null
            ? undefined
            : action.dueDate !== undefined
              ? action.dueDate
              : cur.dueDate,
        dueTime:
          action.dueTime === null
            ? undefined
            : action.dueTime !== undefined
              ? action.dueTime
              : cur.dueTime,
        done: action.done !== undefined ? action.done : cur.done,
        color:
          action.color === null
            ? undefined
            : action.color !== undefined
              ? resolveColor(action.color)
              : cur.color,
      };
      return { ...board, tasks };
    }
    case "delete_task": {
      if (!board.tasks.some((t) => t.id === action.id))
        throw new Error(`unknown task ${action.id}`);
      return {
        ...board,
        tasks: board.tasks.filter((t) => t.id !== action.id),
      };
    }
    case "add_sop": {
      const title = cleanTitle(action.title);
      // SOP colors are locked to the palette rotation — not user/Grok mutable.
      const color =
        PHASE_COLORS[board.sops.length % PHASE_COLORS.length] ??
        PHASE_COLORS[0];
      const sop: Sop = {
        id: newId(),
        title,
        color,
        cadence: resolveCadence(action.cadence),
        time: action.time || undefined,
        phaseId: action.phase
          ? resolvePhaseId(board, action.phase)
          : undefined,
        enabled: action.enabled !== false,
        createdAt: Date.now(),
      };
      return { ...board, sops: [...board.sops, sop] };
    }
    case "update_sop": {
      const idx = board.sops.findIndex((r) => r.id === action.id);
      if (idx < 0) throw new Error(`unknown sop ${action.id}`);
      const cur = board.sops[idx];
      const sops = board.sops.slice();
      sops[idx] = {
        ...cur,
        title:
          action.title !== undefined ? cleanTitle(action.title) : cur.title,
        cadence:
          action.cadence !== undefined
            ? resolveCadence(action.cadence)
            : cur.cadence,
        time:
          action.time === null
            ? undefined
            : action.time !== undefined
              ? action.time
              : cur.time,
        phaseId:
          action.phase === null
            ? undefined
            : action.phase !== undefined
              ? resolvePhaseId(board, action.phase)
              : cur.phaseId,
        // color intentionally immutable
        enabled:
          action.enabled !== undefined ? action.enabled : cur.enabled,
      };
      return { ...board, sops };
    }
    case "delete_sop": {
      if (!board.sops.some((r) => r.id === action.id))
        throw new Error(`unknown sop ${action.id}`);
      const log = { ...board.sopLog };
      for (const k of Object.keys(log)) {
        if (k.startsWith(`${action.id}:`)) delete log[k];
      }
      return {
        ...board,
        sops: board.sops.filter((r) => r.id !== action.id),
        sopLog: log,
      };
    }
    case "set_sop_done": {
      if (!board.sops.some((r) => r.id === action.id))
        throw new Error(`unknown sop ${action.id}`);
      const key = routineLogKey(action.id, action.date);
      const log = { ...board.sopLog };
      if (action.done) log[key] = Date.now();
      else delete log[key];
      return { ...board, sopLog: log };
    }
    case "add_phase": {
      const name = cleanTitle(action.name).toLowerCase();
      if (board.phases.some((p) => p.name.toLowerCase() === name))
        throw new Error(`phase exists: ${name}`);
      // Phase colors are locked to the palette — not Grok-mutable.
      return {
        ...board,
        phases: [
          ...board.phases,
          {
            id: newId(),
            name,
            color:
              PHASE_COLORS[board.phases.length % PHASE_COLORS.length] ??
              PHASE_COLORS[0],
          },
        ],
      };
    }
    case "rename_phase": {
      const idx = board.phases.findIndex((p) => p.id === action.id);
      if (idx < 0) throw new Error(`unknown phase ${action.id}`);
      const phases = board.phases.slice();
      phases[idx] = {
        ...phases[idx],
        name: cleanTitle(action.name).toLowerCase(),
      };
      return { ...board, phases };
    }
    case "set_focus": {
      if (action.id === null || action.id === "" || action.id === "clear") {
        return { ...board, focusId: undefined, focusRun: undefined };
      }
      const raw = action.id.trim();
      let key = raw;
      if (!raw.includes(":")) {
        if (board.tasks.some((t) => t.id === raw))
          key = `task:${raw}`;
        else if (board.sops.some((s) => s.id === raw))
          key = `sop:${raw}`;
        else throw new Error(`unknown focus target ${raw}`);
      } else {
        const [kind, id] = raw.split(":");
        if (kind === "task" && !board.tasks.some((t) => t.id === id))
          throw new Error(`unknown task ${id}`);
        if (kind === "sop" && !board.sops.some((s) => s.id === id))
          throw new Error(`unknown sop ${id}`);
      }
      // Keep timer only if it already tracks this target; never auto-start.
      const focusRun =
        board.focusRun?.targetId === key ? board.focusRun : undefined;
      return { ...board, focusId: key, focusRun };
    }
    case "set_pinned": {
      const idx = board.tasks.findIndex((t) => t.id === action.id);
      if (idx < 0) throw new Error(`unknown task ${action.id}`);
      const tasks = board.tasks.slice();
      tasks[idx] = {
        ...tasks[idx],
        pinned: Boolean(action.pinned),
      };
      return { ...board, tasks };
    }
    default: {
      const _x: never = action;
      throw new Error(`unknown action ${JSON.stringify(_x)}`);
    }
  }
}

/** Named swatch, #hex, or pass-through hex. */
export function resolveColor(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s) throw new Error("empty color");
  if (COLOR_NAMES[s]) return COLOR_NAMES[s];
  if (/^#[0-9a-f]{3}$/i.test(s)) {
    const [, r, g, b] = s;
    return `#${r}${r}${g}${g}${b}${b}`;
  }
  if (/^#[0-9a-f]{6}$/i.test(s) || /^#[0-9a-f]{8}$/i.test(s)) return s;
  // bare hex without #
  if (/^[0-9a-f]{6}$/i.test(s)) return `#${s}`;
  throw new Error(`unknown color ${raw}`);
}



function cleanTitle(s: string): string {
  const t = s.trim();
  if (!t) throw new Error("empty title");
  if (t.length > 200) return t.slice(0, 200);
  return t;
}

function resolvePhaseId(board: Board, phase?: string): string {
  if (!board.phases.length) throw new Error("no phases");
  if (!phase) return board.phases[0].id;
  const q = phase.trim().toLowerCase();
  const byName = board.phases.find((p) => p.name.toLowerCase() === q);
  if (byName) return byName.id;
  const byId = board.phases.find((p) => p.id === phase);
  if (byId) return byId.id;
  throw new Error(`unknown phase ${phase}`);
}

function resolveCadence(
  c?:
    | "daily"
    | "weekdays"
    | "weekends"
    | { every: "week"; days: number[] }
    | { every: "month"; on: number[] | "last"; window?: number }
    | { every: "interval"; days: number },
): Cadence {
  if (c == null || c === "weekdays") return weekly();
  if (c === "daily") return daily();
  if (c === "weekends") return weekly([0, 6]);
  if (typeof c === "object" && c.every === "week") return weekly(c.days);
  if (typeof c === "object" && c.every === "month")
    return monthly(c.on, c.window);
  if (typeof c === "object" && c.every === "interval")
    return interval(c.days);
  return weekly();
}
