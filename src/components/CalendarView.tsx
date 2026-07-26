import {
  formatMonthLabel,
  parseDateKey,
  startOfMonth,
  toDateKey,
  type MonthCell,
} from "../lib/dates";
import type { ScheduleEntry } from "../lib/schedule";
import { DOW } from "../types";

type DayData = {
  timed: ScheduleEntry[];
  anytime: ScheduleEntry[];
};

type Props = {
  /** Any day inside the visible month */
  monthKey: string;
  cells: MonthCell[];
  /** dateKey → schedule for that day */
  days: Record<string, DayData>;
  onSelectDay: (key: string) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onThisMonth: () => void;
};

const MAX_PILLS = 3;

/**
 * Month calendar.
 * Mobile: compact day grid (number + dots) that fits the phone.
 * Desktop: richer cells with task pills.
 */
export function CalendarView({
  monthKey,
  cells,
  days,
  onSelectDay,
  onPrevMonth,
  onNextMonth,
  onThisMonth,
}: Props) {
  const today = toDateKey();
  const monthStart = startOfMonth(monthKey);
  const thisMonth = startOfMonth(today) === monthStart;
  const headers = [...DOW.slice(1), DOW[0]];

  // Days in this month that have work — for mobile agenda strip under grid
  const monthItems = cells
    .filter((c) => c.inMonth)
    .map((c) => {
      const block = days[c.dateKey] ?? { timed: [], anytime: [] };
      const all = [...block.timed, ...block.anytime];
      return { dateKey: c.dateKey, all };
    })
    .filter((d) => d.all.length > 0);

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-3 sm:px-3">
      <header className="mb-3 flex items-center gap-2 px-0.5">
        <button
          type="button"
          onClick={onPrevMonth}
          className="px-2 py-1 text-[18px] text-faint transition-colors hover:text-accent"
          aria-label="Previous month"
        >
          ‹
        </button>
        <button
          type="button"
          onClick={onThisMonth}
          className="text-[14px] tracking-[0.14em] text-muted uppercase transition-colors hover:text-accent"
          title="Jump to this month"
        >
          {formatMonthLabel(monthKey)}
        </button>
        <button
          type="button"
          onClick={onNextMonth}
          className="px-2 py-1 text-[18px] text-faint transition-colors hover:text-accent"
          aria-label="Next month"
        >
          ›
        </button>
        {!thisMonth && (
          <button
            type="button"
            onClick={onThisMonth}
            className="ml-1 px-1.5 py-0.5 text-[12px] tracking-wide text-accent uppercase"
          >
            now
          </button>
        )}
        <span className="ml-auto hidden text-[13px] text-faint sm:inline">
          tap a day
        </span>
      </header>

      {/* —— Mobile compact grid —— */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="grid shrink-0 grid-cols-7 gap-y-1 border border-line bg-pane px-1 pt-2 pb-1">
          {headers.map((h) => (
            <div
              key={h}
              className="pb-1 text-center text-[11px] tracking-wide text-faint uppercase"
            >
              {h.slice(0, 2)}
            </div>
          ))}
          {cells.map((cell) => {
            const block = days[cell.dateKey] ?? { timed: [], anytime: [] };
            const all = [...block.timed, ...block.anytime];
            const open = all.filter((e) => !e.done);
            const isToday = cell.dateKey === today;
            const dayNum = parseDateKey(cell.dateKey).getDate();
            // up to 3 color dots
            const dots = open.slice(0, 3);

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => onSelectDay(cell.dateKey)}
                className={[
                  "flex flex-col items-center gap-0.5 rounded-md py-1.5 transition-colors",
                  !cell.inMonth ? "opacity-25" : "",
                  isToday ? "bg-card-hi" : "active:bg-card",
                ].join(" ")}
              >
                <span
                  className={[
                    "flex size-8 items-center justify-center text-[15px] tabular-nums",
                    isToday
                      ? "rounded-full bg-accent font-medium text-ground"
                      : "text-ink",
                  ].join(" ")}
                >
                  {dayNum}
                </span>
                <span className="flex h-1.5 items-center gap-0.5">
                  {dots.map((e) => (
                    <span
                      key={e.key}
                      className="size-1 rounded-full"
                      style={{ backgroundColor: e.color }}
                    />
                  ))}
                  {open.length === 0 && all.length > 0 && (
                    <span className="size-1 rounded-full bg-line" />
                  )}
                </span>
              </button>
            );
          })}
        </div>

        {/* Simple vertical agenda of days that have items */}
        <div className="mt-3 min-h-0 flex-1 space-y-2 overflow-y-auto pb-6">
          {monthItems.length === 0 && (
            <p className="px-1 py-4 text-center text-[13px] text-faint">
              nothing dated this month
            </p>
          )}
          {monthItems.map(({ dateKey, all }) => {
            const d = parseDateKey(dateKey);
            const isToday = dateKey === today;
            const done = all.filter((e) => e.done).length;
            return (
              <button
                key={dateKey}
                type="button"
                onClick={() => onSelectDay(dateKey)}
                className={[
                  "flex w-full flex-col gap-1.5 border border-line bg-pane px-3 py-2.5 text-left transition-colors active:bg-card",
                  isToday ? "border-accent/40" : "",
                ].join(" ")}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span
                    className={[
                      "text-[13px] tracking-wide uppercase",
                      isToday ? "text-accent" : "text-muted",
                    ].join(" ")}
                  >
                    {d.toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </span>
                  <span className="text-[12px] text-faint tabular-nums">
                    {done}/{all.length}
                  </span>
                </div>
                <div className="flex flex-col gap-1">
                  {all.slice(0, 4).map((e) => (
                    <span
                      key={e.key}
                      className={[
                        "truncate border-l-2 pl-2 text-[14px] leading-snug",
                        e.done
                          ? "text-muted line-through opacity-50"
                          : "text-ink",
                      ].join(" ")}
                      style={{ borderLeftColor: e.color }}
                    >
                      {e.title}
                    </span>
                  ))}
                  {all.length > 4 && (
                    <span className="pl-2 text-[12px] text-faint">
                      +{all.length - 4} more
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* —— Desktop rich grid —— */}
      <div className="hidden min-h-0 flex-1 overflow-x-auto md:block">
        <div className="grid min-h-full min-w-0 flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-px border border-line bg-line">
          {headers.map((h) => (
            <div
              key={h}
              className="bg-pane px-2 py-1.5 text-[14px] tracking-wide text-faint uppercase"
            >
              {h}
            </div>
          ))}

          {cells.map((cell) => {
            const block = days[cell.dateKey] ?? { timed: [], anytime: [] };
            const raw = [...block.timed, ...block.anytime];
            const all = [
              ...raw.filter((e) => e.kind === "task"),
              ...raw.filter((e) => e.kind === "sop"),
            ];
            const done = all.filter((e) => e.done).length;
            const isToday = cell.dateKey === today;
            const dayNum = parseDateKey(cell.dateKey).getDate();
            const pills = all.slice(0, MAX_PILLS);
            const more = all.length - pills.length;

            return (
              <button
                key={cell.dateKey}
                type="button"
                onClick={() => onSelectDay(cell.dateKey)}
                className={[
                  "flex min-h-[110px] flex-1 flex-col gap-0.5 bg-pane p-2 text-left transition-colors",
                  "hover:bg-card focus-visible:bg-card",
                  !cell.inMonth ? "opacity-35" : "",
                  isToday ? "ring-1 ring-inset ring-accent/60" : "",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-1">
                  <span
                    className={[
                      "text-[13px] tabular-nums",
                      isToday ? "text-accent" : "text-muted",
                    ].join(" ")}
                  >
                    {dayNum}
                  </span>
                  {all.length > 0 && (
                    <span className="text-[9px] text-faint tabular-nums">
                      {done}/{all.length}
                    </span>
                  )}
                </div>

                {all.length > 0 && (
                  <div className="mb-0.5 h-px overflow-hidden bg-line">
                    <div
                      className="h-full bg-accent/80"
                      style={{
                        width: `${Math.round((done / all.length) * 100)}%`,
                      }}
                    />
                  </div>
                )}

                <div className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-hidden">
                  {pills.map((e) => (
                    <span
                      key={e.key}
                      className={[
                        "truncate border-l-2 bg-card px-1 text-[13px] leading-[1.4]",
                        e.done
                          ? "text-muted line-through opacity-45"
                          : "text-ink",
                      ].join(" ")}
                      style={{ borderLeftColor: e.color }}
                      title={e.title}
                    >
                      {e.title}
                    </span>
                  ))}
                  {more > 0 && (
                    <span className="px-1 text-[9px] text-faint">+{more}</span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
