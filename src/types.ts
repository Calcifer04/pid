export type View = "focus" | "today" | "week" | "calendar" | "sop" | "board";

export type Phase = {
  id: string;
  name: string;
  color: string;
};

export type Task = {
  id: string;
  title: string;
  phaseId: string;
  createdAt: number;
  /** YYYY-MM-DD — lands on the day schedule */
  dueDate?: string;
  /** HH:mm — optional anchor on that day */
  dueTime?: string;
  /** Quick checkoff without forcing a phase move */
  done?: boolean;
  /** Freeform detail notes */
  notes?: string;
  /**
   * Task identity swatch (gutter/checkbox). Own color only — never phase.
   * Unset → DEFAULT_TASK_COLOR.
   */
  color?: string;
  /** Manual focus — floats to top of desk / today pulse */
  pinned?: boolean;
};

/**
 * How an SOP item repeats. Definitions live on the SOP board;
 * the calendar materializes virtual instances per day (no row cloning).
 */
export type Cadence =
  | { every: "day" }
  | { every: "week"; days: number[] } // 0=Sun … 6=Sat
  /**
   * Day-of-month. Optional `window`: stays due for N days from start
   * (e.g. on:[1], window:5 → scorecards from the 1st, 5 days to finish).
   * One checkoff in the window clears the rest of that month's window.
   */
  | { every: "month"; on: number[] | "last"; window?: number }
  /** After checkoff, stays clear for `days` days, then resurfaces (and stays until done). */
  | { every: "interval"; days: number };

/**
 * SOP item (recurring obligation). Formerly "routine" — same log keys.
 */
export type Sop = {
  id: string;
  title: string;
  color: string;
  cadence: Cadence;
  /** HH:mm optional. Untimed items sit in the anytime stack. */
  time?: string;
  /**
   * Default board column when this SOP is due.
   * Dragging on the board also updates today's placement (see sopPlace).
   */
  phaseId?: string;
  /** Freeform detail notes */
  notes?: string;
  enabled: boolean;
  createdAt: number;
};

/** @deprecated alias — prefer Sop */
export type Routine = Sop;

/**
 * Chrome theme. Lives on the board so disk sync + Grok can both own it.
 * `accent: "rgb"` → cycling phosphor. Otherwise a #hex static accent.
 */
export type Theme = {
  accent: "rgb" | string;
};

/**
 * Live focus timer — lives on the board so every client (PC/laptop/phone)
 * shares the same clock. Wall-clock based: `startedAt` is an epoch ms;
 * elapsed = accumulatedMs + (now - startedAt) while running.
 *
 * Reminders / notifications are NOT local — Google Calendar owns delivery.
 * Dated tasks + due SOPs sync as events with popup reminders via gcal.
 */
export type FocusRun = {
  /** Same shape as focusId: `task:<uuid>` | `sop:<uuid>` */
  targetId: string;
  /** Segment start (ms). null = paused. */
  startedAt: number | null;
  /** Prior segments total (ms). */
  accumulatedMs: number;
};

export type Board = {
  phases: Phase[];
  tasks: Task[];
  /** SOP definitions (daily / weekly / monthly) */
  sops: Sop[];
  /**
   * Completion log keyed `${sopId}:${YYYY-MM-DD}` → completedAt ms.
   * O(1) day checks, no row explosion.
   */
  sopLog: Record<string, number>;
  /**
   * Where a due SOP sits on the kanban for a given day.
   * Keyed `${sopId}:${YYYY-MM-DD}` → phaseId.
   * Lets you pull Infloww into "doing" without cloning a task.
   */
  sopPlace?: Record<string, string>;
  /** Optional chrome theme (accent). Defaults to rgb cycle. */
  theme?: Theme;
  /**
   * Active focus target (`task:<id>` or `sop:<id>`).
   * Today pulse / focus view prefer this when set and still open.
   */
  focusId?: string;
  /** Zen focus timer (synced). */
  focusRun?: FocusRun;
};

/**
 * Neon syntax tokens on void black. Saturated on purpose — the ground is
 * dark enough that these read as punch, not noise.
 */
export const PHASE_COLORS = [
  "#ffb454", // amber
  "#2ee6d6", // cyan
  "#ff6ac1", // magenta
  "#5af78e", // green
  "#ff5c57", // red
  "#57c7ff", // blue
] as const;

/** Quick picks for task identity — independent of column/phase color. */
export const TASK_SWATCHES = PHASE_COLORS;

/** When a task has no color set. Neutral — not a phase hue. */
export const DEFAULT_TASK_COLOR = "#9a9aab";

/** Task gutter/checkbox color. Never falls back to phase. */
export function taskColor(task: { color?: string } | undefined | null): string {
  const c = task?.color?.trim();
  return c || DEFAULT_TASK_COLOR;
}

/** Named swatches Grok / capture can resolve. */
export const COLOR_NAMES: Record<string, string> = {
  amber: "#ffb454",
  orange: "#ffb454",
  cyan: "#2ee6d6",
  teal: "#2ee6d6",
  magenta: "#ff6ac1",
  pink: "#ff6ac1",
  green: "#5af78e",
  red: "#ff5c57",
  blue: "#57c7ff",
  yellow: "#ffb454",
};

/** Old desaturated ramp → new neon. Existing boards pick this up on load. */
export const PHASE_COLOR_MIGRATE: Record<string, string> = {
  "#e8a55c": "#ffb454",
  "#5fb3c4": "#2ee6d6",
  "#b48ead": "#ff6ac1",
  "#8fbf7f": "#5af78e",
  "#c97b7b": "#ff5c57",
  "#7aa2d9": "#57c7ff",
};

export const DOW = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
