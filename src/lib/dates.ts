/** Local calendar helpers. Always local-time — routines are human, not UTC. */

export function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

export function toDateKey(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, n: number): string {
  const d = parseDateKey(key);
  d.setDate(d.getDate() + n);
  return toDateKey(d);
}

export function formatDayLabel(key: string): string {
  const d = parseDateKey(key);
  const today = toDateKey();
  if (key === today) return "today";
  if (key === addDays(today, 1)) return "tomorrow";
  if (key === addDays(today, -1)) return "yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function formatMonthLabel(key: string): string {
  const d = parseDateKey(key);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
}

/** First day of the month containing `key` as YYYY-MM-DD. */
export function startOfMonth(key: string): string {
  const d = parseDateKey(key);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}

/** Shift calendar month by `n` months, clamped to day 1. */
export function addMonths(key: string, n: number): string {
  const d = parseDateKey(key);
  const next = new Date(d.getFullYear(), d.getMonth() + n, 1);
  return toDateKey(next);
}

export type MonthCell = {
  dateKey: string;
  inMonth: boolean;
};

/** Mon-start 6×7 grid covering the month of `anchorKey`. */
export function buildMonthGrid(anchorKey: string): MonthCell[] {
  const d = parseDateKey(anchorKey);
  const first = new Date(d.getFullYear(), d.getMonth(), 1);
  const dow = first.getDay(); // 0=Sun
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  const start = new Date(first);
  start.setDate(first.getDate() + mondayOffset);

  const cells: MonthCell[] = [];
  for (let i = 0; i < 42; i++) {
    const cur = new Date(start);
    cur.setDate(start.getDate() + i);
    cells.push({
      dateKey: toDateKey(cur),
      inMonth: cur.getMonth() === d.getMonth(),
    });
  }
  return cells;
}

/** "07:30" → "7:30", "14:05" → "14:05" — keep it dense. */
export function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
  return `${h}:${pad(m)}`;
}

export function routineLogKey(routineId: string, dateKey: string): string {
  return `${routineId}:${dateKey}`;
}

/** Whole local days between two YYYY-MM-DD keys (can be negative). */
export function daysBetween(a: string, b: string): number {
  const ms = parseDateKey(b).getTime() - parseDateKey(a).getTime();
  return Math.round(ms / 86_400_000);
}

/** Latest completion date for an SOP on or before `onOrBefore`, or null. */
export function lastSopDoneOnOrBefore(
  log: Record<string, number>,
  sopId: string,
  onOrBefore: string,
): string | null {
  const prefix = `${sopId}:`;
  let best: string | null = null;
  for (const key of Object.keys(log)) {
    if (!key.startsWith(prefix)) continue;
    const date = key.slice(prefix.length);
    if (date > onOrBefore) continue;
    if (!best || date > best) best = date;
  }
  return best;
}
