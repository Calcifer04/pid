import {
  addDays,
  daysBetween,
  lastSopDoneOnOrBefore,
  pad,
  parseDateKey,
  toDateKey,
} from "./dates";
import type { Cadence } from "../types";
import { ALL_DAYS, WEEKDAYS } from "../types";

/** Human label for SOP board chips. */
export function cadenceLabel(c: Cadence): string {
  switch (c.every) {
    case "day":
      return "daily";
    case "interval":
      return `every ${c.days}d`;
    case "week": {
      if (c.days.length === 7) return "daily";
      if (
        c.days.length === 5 &&
        WEEKDAYS.every((d) => c.days.includes(d))
      )
        return "weekdays";
      if (c.days.length === 2 && c.days.includes(0) && c.days.includes(6))
        return "weekends";
      const names = ["su", "mo", "tu", "we", "th", "fr", "sa"];
      return c.days.map((d) => names[d]).join(" ");
    }
    case "month": {
      const start =
        c.on === "last" ? "last" : c.on.length === 1 ? String(c.on[0]) : c.on.join(",");
      if (c.window && c.window > 1) return `month · ${start}+${c.window}d`;
      if (c.on === "last") return "month · last day";
      return `month · ${start}`;
    }
  }
}

export type CadenceBucket = "daily" | "cycle" | "weekly" | "monthly";

export function cadenceBucket(c: Cadence): CadenceBucket {
  if (c.every === "day") return "daily";
  if (c.every === "interval") return "cycle";
  if (c.every === "month") return "monthly";
  if (c.every === "week" && c.days.length === 7) return "daily";
  return "weekly";
}

/**
 * Calendar-fixed cadences without log. Interval + month windows need `sopVisibleOn`.
 */
export function cadenceOccursOn(c: Cadence, dateKey: string): boolean {
  const d = parseDateKey(dateKey);
  switch (c.every) {
    case "day":
      return true;
    case "interval":
      return true;
    case "week":
      return c.days.includes(d.getDay());
    case "month": {
      if (c.window && c.window > 1) {
        return monthWindowKeys(dateKey, c).includes(dateKey);
      }
      if (c.on === "last") {
        const last = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        return d.getDate() === last;
      }
      return c.on.includes(d.getDate());
    }
  }
}

/**
 * Date keys in the month-window containing `dateKey` (or [] if cadence isn't windowed).
 * Window is clamped to the end of the month.
 */
export function monthWindowKeys(
  dateKey: string,
  c: Extract<Cadence, { every: "month" }>,
): string[] {
  const d = parseDateKey(dateKey);
  const y = d.getFullYear();
  const m = d.getMonth();
  const lastDom = new Date(y, m + 1, 0).getDate();

  let startDay: number;
  if (c.on === "last") startDay = lastDom;
  else startDay = Math.min(...c.on.map((x) => Math.max(1, Math.min(31, x))));

  const win = Math.max(1, c.window ?? 1);
  const keys: string[] = [];
  for (let i = 0; i < win; i++) {
    const day = startDay + i;
    if (day > lastDom) break;
    keys.push(`${y}-${pad(m + 1)}-${pad(day)}`);
  }
  return keys;
}

function completionInKeys(
  sopLog: Record<string, number>,
  sopId: string,
  keys: string[],
): string | null {
  let best: string | null = null;
  for (const k of keys) {
    if (sopLog[`${sopId}:${k}`] && (!best || k > best)) best = k;
  }
  return best;
}

/**
 * Should this SOP appear on `dateKey`?
 *
 * Interval: checkoff clears N days, then resurfaces.
 * Month+window: due from start for `window` days; one checkoff clears the window.
 */
export function sopVisibleOn(
  cadence: Cadence,
  sopId: string,
  dateKey: string,
  sopLog: Record<string, number>,
): { visible: boolean; done: boolean } {
  if (cadence.every === "interval") {
    const n = Math.max(1, cadence.days);
    const last = lastSopDoneOnOrBefore(sopLog, sopId, dateKey);
    if (!last) return { visible: true, done: false };
    if (last === dateKey) return { visible: true, done: true };
    const elapsed = daysBetween(last, dateKey);
    if (elapsed < n) return { visible: false, done: false };
    return { visible: true, done: false };
  }

  if (cadence.every === "month" && cadence.window && cadence.window > 1) {
    const keys = monthWindowKeys(dateKey, cadence);
    if (!keys.includes(dateKey)) return { visible: false, done: false };
    const doneOn = completionInKeys(sopLog, sopId, keys);
    if (!doneOn) return { visible: true, done: false };
    if (doneOn === dateKey) return { visible: true, done: true };
    // Checked earlier in the window → cleared for remaining days
    if (doneOn < dateKey) return { visible: false, done: false };
    // Viewing a day before the completion (history) — show open still
    return { visible: true, done: false };
  }

  const visible = cadenceOccursOn(cadence, dateKey);
  const done = Boolean(sopLog[`${sopId}:${dateKey}`]);
  return { visible, done };
}

/** Next date an interval item becomes due after completion on `doneOn`. */
export function nextIntervalDue(doneOn: string, days: number): string {
  return addDays(doneOn, Math.max(1, days));
}

/**
 * High-frequency cadences — belong on Today, not as calendar pills.
 * daily / every 1d / weekdays (5+) / every-day week.
 */
export function isHighFreqCadence(c: Cadence): boolean {
  if (c.every === "day") return true;
  if (c.every === "interval" && c.days <= 1) return true;
  if (c.every === "week" && c.days.length >= 5) return true;
  return false;
}

/**
 * Interval mark for agenda views (calendar / week):
 * - never done → only today (anchor), not every cell
 * - next due day only
 * - if overdue, collapse onto today (not every day since due)
 * - completion day still shows as done
 */
export function intervalAgendaOn(
  days: number,
  sopId: string,
  dateKey: string,
  sopLog: Record<string, number>,
  todayKey: string = toDateKey(),
): { visible: boolean; done: boolean } {
  const n = Math.max(1, days);
  if (sopLog[`${sopId}:${dateKey}`]) {
    return { visible: true, done: true };
  }

  // Latest completion on or before this day (completion-on-dateKey already returned).
  const last = lastSopDoneOnOrBefore(sopLog, sopId, dateKey);
  if (!last) {
    // No history: one anchor on today, not the whole month.
    return { visible: dateKey === todayKey, done: false };
  }

  const next = addDays(last, n);
  if (dateKey === next) return { visible: true, done: false };

  // Overdue: due date slipped past → surface only on real today.
  if (next < todayKey && dateKey === todayKey) {
    return { visible: true, done: false };
  }

  return { visible: false, done: false };
}

/**
 * Should this SOP appear as a calendar/week mark?
 * High-freq → never. Interval → next-due (or today if overdue).
 * Sparse week/month → same as execute visibility.
 */
export function sopAgendaOn(
  cadence: Cadence,
  sopId: string,
  dateKey: string,
  sopLog: Record<string, number>,
  todayKey: string = toDateKey(),
): { visible: boolean; done: boolean } {
  if (isHighFreqCadence(cadence)) {
    return { visible: false, done: false };
  }
  if (cadence.every === "interval") {
    return intervalAgendaOn(cadence.days, sopId, dateKey, sopLog, todayKey);
  }
  return sopVisibleOn(cadence, sopId, dateKey, sopLog);
}

export function daily(): Cadence {
  return { every: "day" };
}

export function interval(days: number): Cadence {
  return { every: "interval", days: Math.max(1, Math.floor(days)) };
}

export function weekly(days: number[] = [...WEEKDAYS]): Cadence {
  const uniq = [...new Set(days.filter((x) => x >= 0 && x <= 6))].sort();
  return { every: "week", days: uniq.length ? uniq : [...WEEKDAYS] };
}

export function monthly(
  on: number[] | "last",
  window?: number,
): Cadence {
  if (on === "last") {
    return window && window > 1
      ? { every: "month", on: "last", window }
      : { every: "month", on: "last" };
  }
  const uniq = [
    ...new Set(on.filter((x) => x >= 1 && x <= 31)),
  ].sort((a, b) => a - b);
  const base = uniq.length ? uniq : [1];
  return window && window > 1
    ? { every: "month", on: base, window }
    : { every: "month", on: base };
}

/** Lift legacy `days[]` routines into Cadence. */
export function cadenceFromLegacyDays(days: number[] | undefined): Cadence {
  if (!days || days.length === 0) return daily();
  if (days.length === 7 && ALL_DAYS.every((d) => days.includes(d)))
    return daily();
  return weekly(days);
}

export function datesInMonth(
  year: number,
  monthIndex: number,
  c: Cadence,
  sopId?: string,
  sopLog?: Record<string, number>,
): string[] {
  const out: string[] = [];
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    const key = toDateKey(d);
    if (sopId && sopLog) {
      if (sopVisibleOn(c, sopId, key, sopLog).visible) out.push(key);
    } else if (cadenceOccursOn(c, key)) {
      out.push(key);
    }
  }
  return out;
}
