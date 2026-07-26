/**
 * Board → calendar events (ICS + Google Calendar template links).
 * Delivery of reminders is Google's job once imported / added.
 */
import { addDays, parseDateKey, toDateKey } from "./dates";
import { buildDaySchedule } from "./schedule";
import type { Board, Task } from "../types";
import { taskColor } from "../types";

export type CalEvent = {
  uid: string;
  title: string;
  /** YYYY-MM-DD */
  date: string;
  /** HH:mm local, optional → all-day if missing */
  time?: string;
  /** minutes; default 60 for timed, all-day = 1 day */
  durationMin?: number;
  description?: string;
  /** minutes before start for VALARM / Google popup */
  remindMin?: number;
  /** πD task/sop hex — mapped to nearest Google event colorId on sync */
  color?: string;
};

/**
 * Google Calendar fixed event palette (colorId 1–11).
 * https://developers.google.com/calendar/api/v3/reference/colors
 */
const GOOGLE_EVENT_COLORS: { id: string; hex: string }[] = [
  { id: "1", hex: "#a4bdfc" }, // lavender
  { id: "2", hex: "#7ae7bf" }, // sage
  { id: "3", hex: "#dbadff" }, // grape
  { id: "4", hex: "#ff887c" }, // flamingo
  { id: "5", hex: "#fbd75b" }, // banana
  { id: "6", hex: "#ffb878" }, // tangerine
  { id: "7", hex: "#46d6db" }, // peacock
  { id: "8", hex: "#e1e1e1" }, // graphite
  { id: "9", hex: "#5484ed" }, // blueberry
  { id: "10", hex: "#51b749" }, // basil
  { id: "11", hex: "#dc2127" }, // tomato
];

function hexToRgb(hex: string): [number, number, number] | null {
  const h = hex.replace("#", "").trim();
  if (h.length === 3) {
    const r = parseInt(h[0] + h[0], 16);
    const g = parseInt(h[1] + h[1], 16);
    const b = parseInt(h[2] + h[2], 16);
    return [r, g, b];
  }
  if (h.length < 6) return null;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  if ([r, g, b].some((n) => Number.isNaN(n))) return null;
  return [r, g, b];
}

/** Nearest Google event colorId for a πD hex swatch. */
export function googleColorId(hex: string | undefined): string {
  const rgb = hexToRgb(hex || "#9a9aab");
  if (!rgb) return "8";

  // Explicit πD palette → Google (beats pure RGB distance on neutrals/neons)
  const exact: Record<string, string> = {
    ffb454: "6", // amber → tangerine
    "2ee6d6": "7", // cyan → peacock
    ff6ac1: "3", // magenta → grape
    "5af78e": "10", // green → basil
    ff5c57: "11", // red → tomato
    "57c7ff": "9", // blue → blueberry
    "9a9aab": "8", // neutral → graphite
    "8080c0": "1", // periwinkle → lavender
  };
  const key = (hex || "").replace("#", "").toLowerCase();
  if (exact[key]) return exact[key];

  // Low saturation → graphite (don't snap gray tasks to green)
  const [r, g, b] = rgb;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const sat = max === 0 ? 0 : (max - min) / max;
  if (sat < 0.15) return "8";

  let best = "8";
  let bestD = Infinity;
  for (const c of GOOGLE_EVENT_COLORS) {
    const gr = hexToRgb(c.hex);
    if (!gr) continue;
    const d =
      (r - gr[0]) ** 2 + (g - gr[1]) ** 2 + (b - gr[2]) ** 2;
    if (d < bestD) {
      bestD = d;
      best = c.id;
    }
  }
  return best;
}

const DEFAULT_REMIND_MIN = 15;
const DEFAULT_DURATION_MIN = 60;

export function taskToEvent(task: Task): CalEvent | null {
  if (!task.dueDate || task.done) return null;
  return {
    uid: `task-${task.id}@pid`,
    title: task.title,
    date: task.dueDate,
    time: task.dueTime,
    durationMin: DEFAULT_DURATION_MIN,
    description: task.notes?.trim() || undefined,
    remindMin: DEFAULT_REMIND_MIN,
    color: taskColor(task),
  };
}

/** Timed / dated open items for the next `days` days (local). */
export function upcomingEvents(board: Board, days = 21): CalEvent[] {
  const start = toDateKey();
  const out: CalEvent[] = [];
  const seen = new Set<string>();

  // Dated tasks (may fall outside schedule build if undated phase junk)
  for (const t of board.tasks) {
    const ev = taskToEvent(t);
    if (!ev) continue;
    if (ev.date < start) continue;
    const end = addDays(start, days);
    if (ev.date > end) continue;
    seen.add(ev.uid);
    out.push(ev);
  }

  // Day schedule catches due SOPs + tasks placed on days
  for (let i = 0; i < days; i++) {
    const key = addDays(start, i);
    const day = buildDaySchedule(board, key, "agenda");
    for (const e of [...day.timed, ...day.anytime]) {
      if (e.done) continue;
      const uid =
        e.kind === "task" ? `task-${e.id}@pid` : `sop-${e.id}-${key}@pid`;
      if (seen.has(uid)) continue;
      // tasks without dueDate still appear via schedule — include if timed or anytime that day
      if (e.kind === "task") {
        const t = board.tasks.find((x) => x.id === e.id);
        if (t?.dueDate && t.dueDate !== key) {
          // already handled by dueDate pass if in range
        }
      }
      seen.add(uid);
      const task =
        e.kind === "task"
          ? board.tasks.find((x) => x.id === e.id)
          : undefined;
      const sop =
        e.kind === "sop" ? board.sops.find((x) => x.id === e.id) : undefined;
      out.push({
        uid,
        title: e.title,
        date: key,
        time: e.time,
        durationMin: DEFAULT_DURATION_MIN,
        description:
          e.kind === "sop"
            ? `πD SOP · ${e.title}`
            : task?.notes?.trim() || undefined,
        remindMin: DEFAULT_REMIND_MIN,
        color: task ? taskColor(task) : sop?.color || e.color,
      });
    }
  }

  out.sort((a, b) => {
    const c = a.date.localeCompare(b.date);
    if (c !== 0) return c;
    return (a.time ?? "99:99").localeCompare(b.time ?? "99:99");
  });
  return out;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

/** Local wall time → ICS floating local (no Z) so Google treats as civil time. */
function icsLocal(date: string, time?: string): string {
  const [y, m, d] = date.split("-");
  if (!time) return `${y}${m}${d}`;
  const [hh, mm] = time.split(":");
  return `${y}${m}${d}T${pad(Number(hh))}${pad(Number(mm))}00`;
}

function icsEnd(ev: CalEvent): string {
  if (!ev.time) {
    // all-day end is exclusive next day
    return icsLocal(addDays(ev.date, 1));
  }
  const start = parseDateKey(ev.date);
  const [hh, mm] = ev.time.split(":").map(Number);
  start.setHours(hh, mm, 0, 0);
  start.setMinutes(start.getMinutes() + (ev.durationMin ?? DEFAULT_DURATION_MIN));
  return `${start.getFullYear()}${pad(start.getMonth() + 1)}${pad(start.getDate())}T${pad(start.getHours())}${pad(start.getMinutes())}00`;
}

function escapeIcs(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

function foldIcs(line: string): string {
  if (line.length <= 75) return line;
  const parts: string[] = [];
  let rest = line;
  parts.push(rest.slice(0, 75));
  rest = rest.slice(75);
  while (rest.length) {
    parts.push(" " + rest.slice(0, 74));
    rest = rest.slice(74);
  }
  return parts.join("\r\n");
}

/** RFC5545 VCALENDAR with DISPLAY alarms. */
export function toIcs(events: CalEvent[], calName = "πD"): string {
  const now = new Date();
  const stamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//piD//routine//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcs(calName)}`,
  ];

  for (const ev of events) {
    const allDay = !ev.time;
    const dtStart = icsLocal(ev.date, ev.time);
    const dtEnd = icsEnd(ev);
    const remind = ev.remindMin ?? DEFAULT_REMIND_MIN;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${ev.uid}`);
    lines.push(`DTSTAMP:${stamp}`);
    if (allDay) {
      lines.push(`DTSTART;VALUE=DATE:${dtStart}`);
      lines.push(`DTEND;VALUE=DATE:${dtEnd}`);
    } else {
      lines.push(`DTSTART:${dtStart}`);
      lines.push(`DTEND:${dtEnd}`);
    }
    lines.push(foldIcs(`SUMMARY:${escapeIcs(ev.title)}`));
    if (ev.description) {
      lines.push(foldIcs(`DESCRIPTION:${escapeIcs(ev.description)}`));
    }
    lines.push("BEGIN:VALARM");
    lines.push(`TRIGGER:-PT${Math.max(0, remind)}M`);
    lines.push("ACTION:DISPLAY");
    lines.push(foldIcs(`DESCRIPTION:${escapeIcs(ev.title)}`));
    lines.push("END:VALARM");
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n") + "\r\n";
}

/** One-shot “Add to Google Calendar” URL (opens create form in browser). */
export function googleTemplateUrl(ev: CalEvent): string {
  const params = new URLSearchParams();
  params.set("action", "TEMPLATE");
  params.set("text", ev.title);
  if (ev.description) params.set("details", ev.description);

  if (!ev.time) {
    const end = addDays(ev.date, 1).replace(/-/g, "");
    const start = ev.date.replace(/-/g, "");
    params.set("dates", `${start}/${end}`);
  } else {
    const start = icsLocal(ev.date, ev.time);
    const end = icsEnd(ev);
    params.set("dates", `${start}/${end}`);
  }

  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}

export function downloadIcs(filename: string, ics: string): void {
  const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
