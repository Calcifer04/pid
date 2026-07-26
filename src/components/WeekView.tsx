import { addDays, formatDayLabel, formatTime, toDateKey } from "../lib/dates";
import type { ScheduleEntry } from "../lib/schedule";

type DayBlock = {
  dateKey: string;
  timed: ScheduleEntry[];
  anytime: ScheduleEntry[];
};

type Props = {
  mondayKey: string;
  days: DayBlock[];
  onSelectDay: (key: string) => void;
  onToggle: (dateKey: string, entry: ScheduleEntry) => void;
  onOpen: (entry: ScheduleEntry) => void;
  onRename: (entry: ScheduleEntry, title: string) => void;
  onSetTime: (entry: ScheduleEntry, time: string | undefined) => void;
  onDeleteTask: (id: string) => void;
};

/**
 * Week grid on md+, stacked day list on small screens (flipped axis).
 */
export function WeekView({
  mondayKey,
  days,
  onSelectDay,
  onToggle,
  onOpen,
}: Props) {
  const today = toDateKey();
  const sunday = addDays(mondayKey, 6);

  return (
    <div className="flex h-full min-h-0 flex-col px-2 py-3 sm:px-3">
      <header className="mb-3 flex shrink-0 items-baseline gap-2 px-1">
        <h1 className="text-[13px] tracking-[0.18em] text-muted uppercase">
          week
        </h1>
        <span className="text-[13px] text-faint">
          {formatDayLabel(mondayKey)} – {formatDayLabel(sunday)}
        </span>
      </header>

      {/*
        Mobile: vertical stack (one day per row).
        md+: classic 7-column week strip.
      */}
      <div className="min-h-0 flex-1 overflow-y-auto md:overflow-x-auto md:overflow-y-hidden">
        <div
          className={[
            "flex flex-col gap-px border border-line bg-line",
            "md:grid md:min-h-full md:w-full md:grid-cols-7 md:flex-none",
          ].join(" ")}
        >
          {days.map((day) => {
            const all = [...day.timed, ...day.anytime];
            const done = all.filter((e) => e.done).length;
            const isToday = day.dateKey === today;
            const d = new Date(day.dateKey + "T12:00:00");
            const weekday = d.toLocaleDateString(undefined, {
              weekday: "short",
            });

            return (
              <section
                key={day.dateKey}
                className={[
                  "flex bg-pane",
                  /* mobile: horizontal day band */
                  "flex-row items-stretch",
                  /* desktop: column day cell */
                  "md:min-h-0 md:flex-col",
                  isToday ? "bg-card" : "",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => onSelectDay(day.dateKey)}
                  className={[
                    "flex shrink-0 text-left transition-colors",
                    /* mobile: left rail */
                    "w-[4.5rem] flex-col items-start justify-center gap-0.5 border-r border-line px-2.5 py-3",
                    /* desktop: top header */
                    "md:w-auto md:flex-row md:items-center md:justify-between md:border-r-0 md:border-b md:px-2.5 md:py-2",
                    isToday ? "border-accent/30 md:border-accent/30" : "",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "text-[12px] tracking-wide uppercase",
                      isToday ? "text-accent" : "text-faint",
                    ].join(" ")}
                  >
                    {weekday}
                  </span>
                  <span
                    className={[
                      "text-[17px] tabular-nums md:text-[15px]",
                      isToday ? "text-accent" : "text-muted",
                    ].join(" ")}
                  >
                    {d.getDate()}
                  </span>
                  <span className="mt-1 text-[11px] text-faint tabular-nums md:hidden">
                    {all.length ? `${done}/${all.length}` : "—"}
                  </span>
                </button>

                <div className="hidden px-2.5 py-1.5 text-[12px] text-faint tabular-nums md:block">
                  {all.length ? `${done}/${all.length}` : "—"}
                </div>

                <div
                  className={[
                    "min-w-0 flex-1 space-y-1 px-2 py-2",
                    "md:min-h-0 md:overflow-y-auto md:px-1.5 md:pb-1.5 md:pt-0",
                  ].join(" ")}
                >
                  {all.length === 0 && (
                    <p className="px-1 py-1 text-[12px] text-faint md:hidden">
                      empty
                    </p>
                  )}
                  {all.map((e) => (
                    <div
                      key={e.key}
                      className={[
                        "flex w-full items-start gap-1.5 border-l-2 px-2 py-1.5",
                        e.done ? "opacity-40" : "bg-card/50",
                      ].join(" ")}
                      style={{ borderLeftColor: e.color }}
                    >
                      <button
                        type="button"
                        aria-label={e.done ? "Mark not done" : "Mark done"}
                        onClick={() => onToggle(day.dateKey, e)}
                        className="mt-0.5 flex size-3.5 shrink-0 border"
                        style={{
                          borderColor: e.color,
                          backgroundColor: e.done ? e.color : "transparent",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => onOpen(e)}
                        title={[
                          e.title,
                          e.phaseName ? `board: ${e.phaseName}` : null,
                        ]
                          .filter(Boolean)
                          .join(" · ")}
                        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
                      >
                        <span
                          className={[
                            "text-[13px] leading-6 text-ink",
                            /* allow wrap on mobile row layout */
                            "md:truncate",
                            e.done ? "line-through text-muted" : "",
                          ].join(" ")}
                        >
                          {e.time ? (
                            <span className="mr-1 text-muted tabular-nums">
                              {formatTime(e.time)}
                            </span>
                          ) : null}
                          {e.title}
                        </span>
                        {e.phaseName && (
                          <span className="truncate text-[10px] tracking-wide text-faint uppercase">
                            {e.phaseName}
                          </span>
                        )}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </div>
  );
}
