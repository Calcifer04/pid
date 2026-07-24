import {
  formatMonthLabel,
  formatTime,
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
 * Month calendar. Dated tasks + sparse SOP marks (cycles / monthly).
 * High-freq SOPs stay off the grid — they live on Today.
 * Click a day → drill into today view for that date.
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

  // Mon-first header labels
  const headers = [...DOW.slice(1), DOW[0]];

  return (
    <div className="flex h-full min-h-0 flex-col px-3 py-3">
      <header className="mb-3 flex items-center gap-2 px-1">
        <button
          type="button"
          onClick={onPrevMonth}
          className="px-1.5 py-0.5 text-[14px] text-faint transition-colors hover:text-accent"
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
          className="px-1.5 py-0.5 text-[14px] text-faint transition-colors hover:text-accent"
          aria-label="Next month"
        >
          ›
        </button>
        {!thisMonth && (
          <button
            type="button"
            onClick={onThisMonth}
            className="ml-1 px-1.5 py-0.5 text-[14px] tracking-wide text-accent uppercase"
          >
            this month
          </button>
        )}
        <span className="ml-auto text-[14px] text-faint">
          tasks + due marks · dailies on today
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto">
      <div className="grid min-h-full min-w-[560px] flex-1 grid-cols-7 grid-rows-[auto_repeat(6,minmax(0,1fr))] gap-px border border-line bg-line sm:min-w-0">
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
          // Tasks first — they're the real calendar signal; SOPs are sparse marks.
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

              {/* thin day progress */}
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
                    title={
                      e.time
                        ? `${formatTime(e.time)} ${e.title}`
                        : e.title
                    }
                  >
                    {e.time ? (
                      <span className="mr-1 text-muted tabular-nums">
                        {formatTime(e.time)}
                      </span>
                    ) : null}
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
