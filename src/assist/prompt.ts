import { cadenceLabel } from "../lib/cadence";
import { routineLogKey } from "../lib/dates";
import type { Board, View } from "../types";
import { taskColor } from "../types";

export type AssistContext = {
  dayKey: string;
  view: View;
  nowIso: string;
};

export function buildSystemPrompt(board: Board, ctx: AssistContext): string {
  const phases = board.phases.map((p) => ({
    id: p.id,
    name: p.name,
    color: p.color,
  }));
  const tasks = board.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    phase: board.phases.find((p) => p.id === t.phaseId)?.name ?? t.phaseId,
    color: taskColor(t),
    colorOwn: t.color ?? null,
    dueDate: t.dueDate ?? null,
    dueTime: t.dueTime ?? null,
    done: Boolean(t.done),
  }));
  const sops = board.sops.map((s) => ({
    id: s.id,
    title: s.title,
    color: s.color,
    cadence: s.cadence,
    cadenceLabel: cadenceLabel(s.cadence),
    time: s.time ?? null,
    enabled: s.enabled,
    doneOnDayKey: Boolean(board.sopLog[routineLogKey(s.id, ctx.dayKey)]),
  }));
  const theme = board.theme ?? { accent: "rgb" };

  return [
    "You are πD — the assist layer for this board.",
    "πD has two layers:",
    "1) SOP board — recurring obligations (add_sop). High-freq (daily/weekdays) surface on Today only; calendar shows tasks + sparse due marks (cycles/monthly).",
    "2) Tasks — one-shot work with optional dueDate/dueTime.",
    "Mutate ONLY via tools. Never invent ids — copy from SNAPSHOT.",
    "Short titles. Dates YYYY-MM-DD, times HH:mm 24h, local.",
    "week days: 0=Sun … 6=Sat. month on: day-of-month ints or 'last'.",
    "interval cadence {every:'interval',days:N}: after checkoff, hidden until day N, then due again (min every N days). Use for 'every 3 days' style work.",
    "month window {every:'month',on:[1],window:5}: appears from the 1st for 5 days; one checkoff clears the rest of that window. Use for 'start of month, give myself 5 days' (e.g. Scorecards).",
    "When user says SOP/habit/routine/recurring → add_sop. One-off → add_task.",
    "Colors: ONLY tasks are recolorable (update_task / add_task color). Phase + SOP colors are LOCKED — never try to change them.",
    "Task color is its OWN identity (amber|cyan|magenta|green|red|blue|#hex) — never phase/column color. null clears to default neutral.",
    "User messages may end with a refs: block (task:<uuid> \"title\" / sop:<uuid> \"title\") from the @ picker — those ids are authoritative.",
    "Focus: set_focus to put one item on the desk widget; set_pinned on tasks for sticky priority. Clear focus with set_focus id=null.",
    "Auto desk order (if no focus): pinned → URGENT → doing → timed → today → tasks before SOPs.",
    "Speak as πD. After tools, one short plain sentence confirming changes.",
    "",
    `now=${ctx.nowIso}`,
    `dayKey=${ctx.dayKey}`,
    `view=${ctx.view}`,
    "",
    "SNAPSHOT:",
    JSON.stringify({ theme, phases, tasks, sops }),
  ].join("\n");
}
