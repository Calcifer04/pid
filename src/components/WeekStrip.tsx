import { addDays, parseDateKey, toDateKey } from "../lib/dates";
import { DOW } from "../types";

type Props = {
  dayKey: string;
  onSelect: (key: string) => void;
  /** Optional density dots: dateKey → { total, done } */
  density?: Record<string, { total: number; done: number }>;
};

/** Mon-first week rail around the selected day. */
export function WeekStrip({ dayKey, onSelect, density = {} }: Props) {
  const today = toDateKey();
  const start = startOfWeekMonday(dayKey);
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i));

  return (
    <div className="mb-4 grid grid-cols-7 gap-1">
      {days.map((key) => {
        const d = parseDateKey(key);
        const dow = DOW[d.getDay()];
        const selected = key === dayKey;
        const isToday = key === today;
        const stats = density[key];
        const open = stats ? stats.total - stats.done : 0;

        return (
          <button
            key={key}
            type="button"
            onClick={() => onSelect(key)}
            className={[
              "flex flex-col items-center gap-0.5 border px-1 py-1.5 transition-colors",
              selected
                ? "border-accent/60 bg-card-hi"
                : "border-line bg-pane hover:border-faint",
            ].join(" ")}
          >
            <span
              className={[
                "text-[9px] tracking-wide uppercase",
                selected ? "text-accent" : "text-faint",
              ].join(" ")}
            >
              {dow}
            </span>
            <span
              className={[
                "text-[12px] tabular-nums",
                selected ? "text-ink" : "text-muted",
                isToday && !selected ? "text-accent" : "",
              ].join(" ")}
            >
              {d.getDate()}
            </span>
            <span className="flex h-1 items-center gap-0.5">
              {stats && stats.total > 0 ? (
                <span
                  className="size-1 rounded-full"
                  style={{
                    backgroundColor:
                      open === 0 ? "var(--color-accent)" : "var(--color-muted)",
                    boxShadow:
                      open === 0 ? "0 0 6px var(--color-accent)" : undefined,
                  }}
                />
              ) : (
                <span className="size-1" />
              )}
            </span>
          </button>
        );
      })}
    </div>
  );
}

function startOfWeekMonday(key: string): string {
  const d = parseDateKey(key);
  // JS: 0=Sun … convert so Monday is start
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}
