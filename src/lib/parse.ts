import { daily, interval, monthly, weekly } from "./cadence";
import type { Cadence, View } from "../types";
import { DOW, WEEKDAYS } from "../types";

export type CaptureResult =
  | {
      kind: "task";
      title: string;
      dueDate?: string;
      dueTime?: string;
    }
  | {
      kind: "sop";
      title: string;
      time?: string;
      cadence: Cadence;
    };

/**
 * Lightweight capture grammar. Title is whatever is left after tokens.
 *
 *   @7:30  @7pm                 → time
 *   @today @tomorrow @mon       → task due date
 *   @daily @weekdays @weekends  → sop cadence
 *   @every:3 @3d                 → interval (clear N days after checkoff)
 *   @monthly @month:1 @month:15 @month:last
 *   @month:1+5                      → month window (start+days to finish)
 *   leading `r ` or `s `        → force sop
 */
export function parseCapture(
  raw: string,
  view: View,
  todayKey: string,
  tomorrowKey: string,
): CaptureResult | null {
  let text = raw.trim();
  if (!text) return null;

  let forceSop = view === "sop";
  if (/^(r|s|sop)\s+/i.test(text)) {
    forceSop = true;
    text = text.replace(/^(r|s|sop)\s+/i, "");
  }

  let dueTime: string | undefined;
  let dueDate: string | undefined;
  let cadence: Cadence | undefined;
  let weekDays: number[] | undefined;

  const tokens = text.split(/\s+/);
  const kept: string[] = [];

  for (const tok of tokens) {
    if (!tok.startsWith("@")) {
      kept.push(tok);
      continue;
    }
    const body = tok.slice(1).toLowerCase();

    if (body === "today") {
      dueDate = todayKey;
      continue;
    }
    if (body === "tomorrow" || body === "tmr" || body === "tom") {
      dueDate = tomorrowKey;
      continue;
    }
    if (body === "daily") {
      cadence = daily();
      forceSop = true;
      continue;
    }
    // @every:3  @every3  @3d  @3day  @3days
    const everyN = body.match(/^(?:every:?(\d+)|(\d+)d(?:ays?)?)$/);
    if (everyN) {
      const n = Number(everyN[1] ?? everyN[2]);
      if (n >= 1) {
        cadence = interval(n);
        forceSop = true;
        continue;
      }
    }
    if (body === "weekdays" || body === "weekday" || body === "wd") {
      cadence = weekly([...WEEKDAYS]);
      forceSop = true;
      continue;
    }
    if (body === "weekends" || body === "weekend") {
      cadence = weekly([0, 6]);
      forceSop = true;
      continue;
    }
    if (body === "monthly" || body === "month") {
      cadence = monthly([1]);
      forceSop = true;
      continue;
    }
    if (body === "month:last" || body === "monthly:last") {
      cadence = monthly("last");
      forceSop = true;
      continue;
    }
    // @month:1+5  @monthly:1+5  — start day + window length
    const monthWin = body.match(/^month(?:ly)?:(\d{1,2})\+(\d{1,2})$/);
    if (monthWin) {
      cadence = monthly([Number(monthWin[1])], Number(monthWin[2]));
      forceSop = true;
      continue;
    }
    const monthDay = body.match(/^month(?:ly)?:(\d{1,2})$/);
    if (monthDay) {
      cadence = monthly([Number(monthDay[1])]);
      forceSop = true;
      continue;
    }

    const dow = DOW.indexOf(body as (typeof DOW)[number]);
    if (dow >= 0) {
      if (forceSop || view === "sop") {
        weekDays = weekDays ?? [];
        if (!weekDays.includes(dow)) weekDays.push(dow);
        forceSop = true;
      } else {
        dueDate = nextWeekday(todayKey, dow);
      }
      continue;
    }

    const time = parseTimeToken(body);
    if (time) {
      dueTime = time;
      continue;
    }

    kept.push(tok);
  }

  const title = kept.join(" ").trim();
  if (!title) return null;

  if (forceSop) {
    let c = cadence;
    if (!c && weekDays?.length) c = weekly(weekDays);
    if (!c) c = weekly([...WEEKDAYS]);
    // If both weekDays and cadence week, merge days
    if (weekDays?.length && c.every === "week") {
      c = weekly([...new Set([...c.days, ...weekDays])]);
    }
    return { kind: "sop", title, time: dueTime, cadence: c };
  }

  return { kind: "task", title, dueDate, dueTime };
}

function parseTimeToken(body: string): string | undefined {
  const m = body.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3]?.toLowerCase();
  if (Number.isNaN(h) || Number.isNaN(min) || min > 59) return undefined;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (!ap && h > 23) return undefined;
  if (h > 23) return undefined;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}

function nextWeekday(todayKey: string, target: number): string {
  const [y, m, d] = todayKey.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  const delta = (target - dt.getDay() + 7) % 7;
  dt.setDate(dt.getDate() + (delta === 0 ? 0 : delta));
  const yy = dt.getFullYear();
  const mm = (dt.getMonth() + 1).toString().padStart(2, "0");
  const dd = dt.getDate().toString().padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
