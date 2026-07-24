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

/** Minimal 7-day strip. */
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
      <header className="mb-3 flex items-baseline gap-2 px-1">
        <h1 className="text-[13px] tracking-[0.18em] text-muted uppercase">
          week
        </h1>
        <span className="text-[13px] text-faint">
          {formatDayLabel(mondayKey)} – {formatDayLabel(sunday)}
        </span>
      </header>

      <div className="min-h-0 flex-1 overflow-x-auto">
      <div className="grid min-h-full w-full min-w-[640px] grid-cols-7 gap-px border border-line bg-line sm:min-w-0">
        {days.map((day) => {
          const all = [...day.timed, ...day.anytime];
          const done = all.filter((e) => e.done).length;
          const isToday = day.dateKey === today;
          const d = new Date(day.dateKey + "T12:00:00");

          return (
            <section
              key={day.dateKey}
              className={[
                "flex min-h-0 flex-col bg-pane",
                isToday ? "bg-card" : "",
              ].join(" ")}
            >
              <button
                type="button"
                onClick={() => onSelectDay(day.dateKey)}
                className={[
                  "flex items-center justify-between border-b border-line px-2.5 py-2 text-left",
                  isToday ? "border-accent/30" : "",
                ].join(" ")}
              >
                <span
                  className={[
                    "text-[12px] tracking-wide uppercase",
                    isToday ? "text-accent" : "text-faint",
                  ].join(" ")}
                >
                  {d.toLocaleDateString(undefined, { weekday: "short" })}
                </span>
                <span
                  className={[
                    "text-[15px] tabular-nums",
                    isToday ? "text-accent" : "text-muted",
                  ].join(" ")}
                >
                  {d.getDate()}
                </span>
              </button>

              <div className="px-2.5 py-1.5 text-[12px] text-faint tabular-nums">
                {all.length ? `${done}/${all.length}` : "—"}
              </div>

              <div className="min-h-0 flex-1 space-y-1 overflow-y-auto px-1.5 pb-1.5">
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
                          "truncate text-[13px] leading-6 text-ink",
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
