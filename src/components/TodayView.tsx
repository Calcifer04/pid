import { formatDayLabel, toDateKey } from "../lib/dates";
import type { ScheduleEntry } from "../lib/schedule";
import { ScheduleRow } from "./ScheduleRow";

type Props = {
  dateKey: string;
  timed: ScheduleEntry[];
  anytime: ScheduleEntry[];
  nowMinutes?: number | null;
  onPrevDay: () => void;
  onNextDay: () => void;
  onToday: () => void;
  onToggle: (entry: ScheduleEntry) => void;
  onOpen: (entry: ScheduleEntry) => void;
  onRename: (entry: ScheduleEntry, title: string) => void;
  onSetTime: (entry: ScheduleEntry, time: string | undefined) => void;
  onDeleteTask: (id: string) => void;
  onClearDone: () => void;
};

export function TodayView({
  dateKey,
  timed,
  anytime,
  nowMinutes = null,
  onPrevDay,
  onNextDay,
  onToday,
  onToggle,
  onOpen,
  onRename,
  onSetTime,
  onDeleteTask,
  onClearDone,
}: Props) {
  const total = timed.length + anytime.length;
  const done = [...timed, ...anytime].filter((e) => e.done).length;
  const isToday = dateKey === toDateKey();
  const remaining = total - done;

  return (
    <div className="flex h-full min-h-0 w-full flex-col">
      <header className="flex shrink-0 items-center gap-2.5 px-3 pt-4 pb-3 sm:px-6 sm:pt-5">
        <button
          type="button"
          onClick={onPrevDay}
          className="px-2 py-1 text-[16px] text-faint transition-colors hover:text-accent"
          aria-label="Previous day"
        >
          ‹
        </button>

        <button
          type="button"
          onClick={onToday}
          className="text-[14px] tracking-[0.16em] text-muted uppercase transition-colors hover:text-accent"
          title="Jump to today"
        >
          {formatDayLabel(dateKey)}
        </button>

        <button
          type="button"
          onClick={onNextDay}
          className="px-2 py-1 text-[16px] text-faint transition-colors hover:text-accent"
          aria-label="Next day"
        >
          ›
        </button>

        {!isToday && (
          <button
            type="button"
            onClick={onToday}
            className="ml-1 px-2 py-1 text-[12px] tracking-wide text-accent uppercase"
          >
            jump today
          </button>
        )}

        <div className="ml-auto flex items-center gap-2.5 text-[13px] tabular-nums">
          {done > 0 && (
            <button
              type="button"
              onClick={onClearDone}
              className="text-[12px] tracking-wide text-faint uppercase transition-colors hover:text-accent"
            >
              clear done
            </button>
          )}
          {total > 0 && (
            <span className="text-faint">
              <span className="text-muted">{done}</span>/{total}
              {remaining > 0 && isToday && (
                <span className="text-faint"> · {remaining} left</span>
              )}
            </span>
          )}
        </div>
      </header>

      {/* Thin progress bar for the day */}
      {total > 0 && (
        <div className="mx-3 mb-3 h-px shrink-0 overflow-hidden bg-line sm:mx-6">
          <div
            className="h-full bg-accent transition-all"
            style={{
              width: `${Math.round((done / total) * 100)}%`,
              boxShadow: done > 0 ? "0 0 8px var(--color-accent)" : undefined,
            }}
          />
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-10 sm:px-6 sm:pb-8">
        {total === 0 && (
          <p className="border border-dashed border-line px-3 py-6 text-[14px] text-faint">
            nothing scheduled. press{" "}
            <span className="text-muted">g</span> for πD —{" "}
            <span className="text-muted">add ship api to today</span>
            {isToday ? "" : " for this day"}, or{" "}
            <span className="text-muted">sop gym weekdays at 7:30</span>.
          </p>
        )}

        {timed.length > 0 && (
          <section className="mb-5">
            <h2 className="mb-1 px-1 text-[12px] tracking-[0.14em] text-faint uppercase">
              timeline
            </h2>
            <div className="border border-line bg-pane py-1">
              {interleaveNow(timed, isToday ? nowMinutes : null).map((row) =>
                row.kind === "now" ? (
                  <NowMarker key="now" label={row.label} />
                ) : (
                  <ScheduleRow
                    key={row.entry.key}
                    entry={row.entry}
                    onToggle={() => onToggle(row.entry)}
                    onOpen={() => onOpen(row.entry)}
                    onRename={(title) => onRename(row.entry, title)}
                    onSetTime={(time) => onSetTime(row.entry, time)}
                    onDelete={
                      row.entry.kind === "task"
                        ? () => onDeleteTask(row.entry.id)
                        : undefined
                    }
                  />
                ),
              )}
            </div>
          </section>
        )}

        {anytime.length > 0 && (
          <section className="mb-4">
            <h2 className="mb-1 px-1 text-[12px] tracking-[0.14em] text-faint uppercase">
              anytime
            </h2>
            <div className="border border-line bg-pane py-1">
              {anytime.map((e) => (
                <ScheduleRow
                  key={e.key}
                  entry={e}
                  onToggle={() => onToggle(e)}
                  onOpen={() => onOpen(e)}
                  onRename={(title) => onRename(e, title)}
                  onSetTime={(time) => onSetTime(e, time)}
                  onDelete={
                    e.kind === "task" ? () => onDeleteTask(e.id) : undefined
                  }
                />
              ))}
            </div>
          </section>
        )}

        <p className="mt-4 px-1 pb-2 text-[12px] text-faint">
          <span className="text-muted">f</span> focus ·{" "}
          <span className="text-muted">g</span> πD ·{" "}
          <span className="text-muted">← →</span> views ·{" "}
          <span className="text-muted">0–5</span> jump
        </p>
      </div>
    </div>
  );
}

function NowMarker({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-1">
      <span className="size-1.5 rounded-full bg-accent shadow-[0_0_8px_var(--color-accent)]" />
      <div className="h-px flex-1 bg-accent/40" />
      <span className="text-[10px] tracking-wide text-accent tabular-nums uppercase">
        {label}
      </span>
    </div>
  );
}

type Row =
  | { kind: "entry"; entry: ScheduleEntry }
  | { kind: "now"; label: string };

function interleaveNow(
  timed: ScheduleEntry[],
  nowMinutes: number | null,
): Row[] {
  const rows: Row[] = timed.map((entry) => ({ kind: "entry", entry }));
  if (nowMinutes == null) return rows;

  const hh = Math.floor(nowMinutes / 60);
  const mm = nowMinutes % 60;
  const label = `${hh}:${mm.toString().padStart(2, "0")}`;

  let insertAt = rows.length;
  for (let i = 0; i < timed.length; i++) {
    const t = timed[i].time;
    if (!t) continue;
    const [h, m] = t.split(":").map(Number);
    if (h * 60 + m > nowMinutes) {
      insertAt = i;
      break;
    }
  }

  rows.splice(insertAt, 0, { kind: "now", label });
  return rows;
}
