import { useMemo, useState } from "react";
import {
  cadenceBucket,
  cadenceLabel,
  daily,
  interval,
  monthly,
  nextIntervalDue,
  sopVisibleOn,
  weekly,
  type CadenceBucket,
} from "../lib/cadence";
import { formatDayLabel, formatTime, toDateKey } from "../lib/dates";
import type { Cadence, Sop } from "../types";
import { DOW, WEEKDAYS } from "../types";

type Props = {
  sops: Sop[];
  sopLog: Record<string, number>;
  onToggleEnabled: (id: string) => void;
  onSetCadence: (id: string, cadence: Cadence) => void;
  onDelete: (id: string) => void;
  onOpen?: (id: string) => void;
};

const COLS: {
  id: CadenceBucket;
  label: string;
  hint: string;
}[] = [
  { id: "daily", label: "daily", hint: "every day" },
  {
    id: "cycle",
    label: "cycle",
    hint: "every N days — checkoff clears until then",
  },
  { id: "weekly", label: "weekly", hint: "specific weekdays" },
  { id: "monthly", label: "monthly", hint: "day of month" },
];

/**
 * SOP board: definitions only. Calendar views materialize instances.
 * Mobile = tab + vertical list. Desktop = 4 columns.
 */
export function SopView({
  sops,
  sopLog,
  onToggleEnabled,
  onSetCadence,
  onDelete,
  onOpen,
}: Props) {
  const today = toDateKey();
  const [tab, setTab] = useState<CadenceBucket>("daily");

  const counts = useMemo(() => {
    const m: Record<CadenceBucket, number> = {
      daily: 0,
      cycle: 0,
      weekly: 0,
      monthly: 0,
    };
    for (const s of sops) m[cadenceBucket(s.cadence)]++;
    return m;
  }, [sops]);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      {/* —— Mobile —— */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="shrink-0 overflow-x-auto border-b border-line px-2 py-2">
          <div className="flex w-max gap-1">
            {COLS.map((col) => {
              const on = tab === col.id;
              return (
                <button
                  key={col.id}
                  type="button"
                  onClick={() => setTab(col.id)}
                  className={[
                    "rounded-full px-3 py-1.5 text-[13px] tracking-wide uppercase transition-colors",
                    on
                      ? "bg-card-hi text-accent"
                      : "text-faint hover:text-muted",
                  ].join(" ")}
                >
                  {col.label}
                  <span className="ml-1.5 text-[11px] text-faint tabular-nums">
                    {counts[col.id]}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
          {sops.filter((s) => cadenceBucket(s.cadence) === tab).length === 0 && (
            <p className="px-1 py-6 text-center text-[13px] text-faint">
              {COLS.find((c) => c.id === tab)?.hint}
            </p>
          )}
          {sops
            .filter((s) => cadenceBucket(s.cadence) === tab)
            .map((s) => (
              <SopDefCard
                key={s.id}
                sop={s}
                column={tab}
                status={statusLine(s, sopLog, today)}
                onToggleEnabled={() => onToggleEnabled(s.id)}
                onSetCadence={(c) => onSetCadence(s.id, c)}
                onDelete={() => onDelete(s.id)}
                onOpen={() => onOpen?.(s.id)}
                compact
              />
            ))}
        </div>
      </div>

      {/* —— Desktop columns —— */}
      <div className="pid-sop-scroll hidden h-full min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-3 pt-3 pb-3 md:flex">
        {COLS.map((col) => {
          const items = sops.filter((s) => cadenceBucket(s.cadence) === col.id);
          return (
            <section
              key={col.id}
              className="flex min-h-0 min-w-[240px] flex-1 flex-col border border-line bg-pane"
            >
              <header className="flex h-11 shrink-0 items-center gap-2 border-b border-line px-3">
                <span className="text-[13px] tracking-[0.16em] text-accent uppercase">
                  {col.label}
                </span>
                <span className="text-[13px] text-faint tabular-nums">
                  {items.length}
                </span>
              </header>

              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2.5">
                {items.length === 0 && (
                  <p className="px-2 py-3 text-[13px] text-faint">{col.hint}</p>
                )}
                {items.map((s) => (
                  <SopDefCard
                    key={s.id}
                    sop={s}
                    column={col.id}
                    status={statusLine(s, sopLog, today)}
                    onToggleEnabled={() => onToggleEnabled(s.id)}
                    onSetCadence={(c) => onSetCadence(s.id, c)}
                    onDelete={() => onDelete(s.id)}
                    onOpen={() => onOpen?.(s.id)}
                  />
                ))}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

function statusLine(
  sop: Sop,
  sopLog: Record<string, number>,
  today: string,
): string | null {
  if (!sop.enabled) return "disabled";
  const vis = sopVisibleOn(sop.cadence, sop.id, today, sopLog);
  if (vis.done) return "done today";
  if (vis.visible) return "due today";
  if (sop.cadence.every === "interval") {
    const prefix = `${sop.id}:`;
    let last: string | null = null;
    for (const k of Object.keys(sopLog)) {
      if (!k.startsWith(prefix)) continue;
      const d = k.slice(prefix.length);
      if (!last || d > last) last = d;
    }
    if (last) {
      const next = nextIntervalDue(last, sop.cadence.days);
      return `cleared · back ${formatDayLabel(next)}`;
    }
  }
  return "not on today";
}

function SopDefCard({
  sop,
  column,
  status,
  onToggleEnabled,
  onSetCadence,
  onDelete,
  onOpen,
  compact = false,
}: {
  sop: Sop;
  column: CadenceBucket;
  status: string | null;
  onToggleEnabled: () => void;
  onSetCadence: (c: Cadence) => void;
  onDelete: () => void;
  onOpen?: () => void;
  compact?: boolean;
}) {
  const n = sop.cadence.every === "interval" ? sop.cadence.days : 3;

  return (
    <div
      className={[
        "border border-line bg-card",
        compact ? "px-3 py-2.5" : "px-2 py-1.5",
        sop.enabled ? "" : "opacity-40",
      ].join(" ")}
    >
      <div className="group flex min-h-10 items-center gap-2.5">
        <button
          type="button"
          aria-label={sop.enabled ? "Disable" : "Enable"}
          onClick={onToggleEnabled}
          className="size-3 shrink-0 rounded-full"
          style={{
            backgroundColor: sop.color,
            boxShadow: sop.enabled ? `0 0 8px ${sop.color}` : undefined,
          }}
        />
        <button
          type="button"
          onClick={() => onOpen?.()}
          className="min-w-0 flex-1 truncate text-left text-[15px] text-ink"
          title={sop.title}
        >
          {sop.title}
        </button>
        {sop.time && (
          <span className="text-[13px] text-muted tabular-nums">
            {formatTime(sop.time)}
          </span>
        )}
        <button
          type="button"
          aria-label={`Delete ${sop.title}`}
          onClick={onDelete}
          className={[
            "px-1 text-[15px] text-faint transition hover:text-accent",
            compact
              ? "opacity-70"
              : "opacity-0 focus-visible:opacity-100 group-hover:opacity-100",
          ].join(" ")}
        >
          ×
        </button>
      </div>

      <div className="mt-1 flex flex-wrap items-center gap-1 pl-5">
        <span className="text-[11px] tracking-wide text-faint uppercase">
          {cadenceLabel(sop.cadence)}
        </span>
        {status && (
          <span className="text-[11px] tracking-wide text-muted lowercase">
            · {status}
          </span>
        )}
      </div>

      {column === "daily" && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
          <Chip
            active
            color={sop.color}
            onClick={() => onSetCadence(daily())}
            label="every day"
          />
          <Chip
            active={false}
            color={sop.color}
            onClick={() => onSetCadence(interval(3))}
            label="→ 3d cycle"
          />
        </div>
      )}

      {column === "cycle" && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
          {[2, 3, 5, 7, 14].map((d) => (
            <Chip
              key={d}
              active={n === d}
              color={sop.color}
              label={`${d}d`}
              onClick={() => onSetCadence(interval(d))}
            />
          ))}
        </div>
      )}

      {column === "weekly" && (
        <div className="mt-2 flex flex-wrap gap-1.5 pl-5">
          {DOW.map((label, i) => {
            const days =
              sop.cadence.every === "week" ? sop.cadence.days : [...WEEKDAYS];
            const on = days.includes(i);
            return (
              <button
                key={label}
                type="button"
                onClick={() => {
                  const base = on
                    ? days.filter((d) => d !== i)
                    : [...days, i].sort();
                  onSetCadence(weekly(base.length ? base : [i]));
                }}
                className="min-w-8 px-2 py-1 text-[12px] tracking-wide uppercase transition-colors"
                style={
                  on
                    ? {
                        color: sop.color,
                        backgroundColor: "var(--color-card-hi)",
                      }
                    : { color: "var(--color-faint)" }
                }
              >
                {label}
              </button>
            );
          })}
        </div>
      )}

      {column === "monthly" && (
        <div className="mt-2 flex flex-col gap-1.5 pl-5">
          <div className="flex flex-wrap gap-1.5">
            {[1, 15, "last" as const].map((d) => {
              const cur = sop.cadence.every === "month" ? sop.cadence.on : [1];
              const active =
                d === "last"
                  ? cur === "last"
                  : Array.isArray(cur) && cur.includes(d);
              const win =
                sop.cadence.every === "month" ? sop.cadence.window : undefined;
              return (
                <Chip
                  key={String(d)}
                  active={active}
                  color={sop.color}
                  label={d === "last" ? "last" : String(d)}
                  onClick={() =>
                    onSetCadence(monthly(d === "last" ? "last" : [d], win))
                  }
                />
              );
            })}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {[1, 3, 5, 7].map((w) => {
              const curWin =
                sop.cadence.every === "month" ? sop.cadence.window ?? 1 : 1;
              const on =
                sop.cadence.every === "month"
                  ? sop.cadence.on
                  : ([1] as number[]);
              return (
                <Chip
                  key={w}
                  active={curWin === w}
                  color={sop.color}
                  label={w === 1 ? "1d" : `+${w}d`}
                  onClick={() =>
                    onSetCadence(
                      monthly(on === "last" ? "last" : on, w > 1 ? w : undefined),
                    )
                  }
                />
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({
  label,
  active,
  color,
  onClick,
}: {
  label: string;
  active: boolean;
  color: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="px-2 py-1 text-[12px] tracking-wide uppercase"
      style={
        active
          ? { color, backgroundColor: "var(--color-card-hi)" }
          : { color: "var(--color-faint)" }
      }
    >
      {label}
    </button>
  );
}
