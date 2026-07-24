import { useEffect, useRef, useState } from "react";
import { formatTime } from "../lib/dates";
import type { ScheduleEntry } from "../lib/schedule";

type Props = {
  entry: ScheduleEntry;
  onToggle: () => void;
  onOpen?: () => void;
  onRename?: (title: string) => void;
  onSetTime?: (time: string | undefined) => void;
  onDelete?: () => void;
};

/** Unified day-schedule row for tasks + SOPs. */
export function ScheduleRow({
  entry,
  onToggle,
  onOpen,
  onRename,
  onSetTime,
  onDelete,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(entry.title);
  const [editingTime, setEditingTime] = useState(false);
  const [timeDraft, setTimeDraft] = useState(entry.time ?? "");
  const inputRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  useEffect(() => {
    if (editingTime) {
      timeRef.current?.focus();
      timeRef.current?.select();
    }
  }, [editingTime]);

  function commitTitle() {
    const next = draft.trim();
    if (next && next !== entry.title) onRename?.(next);
    else setDraft(entry.title);
    setEditing(false);
  }

  function commitTime() {
    const raw = timeDraft.trim();
    if (!raw) {
      onSetTime?.(undefined);
      setEditingTime(false);
      return;
    }
    const parsed = parseLooseTime(raw);
    if (parsed) onSetTime?.(parsed);
    else setTimeDraft(entry.time ?? "");
    setEditingTime(false);
  }

  return (
    <div
      className={[
        "group flex h-11 items-center gap-2.5 border-l-2 pr-2 pl-2.5 transition-colors hover:bg-card",
        entry.done ? "opacity-45" : "",
      ].join(" ")}
      style={{ borderLeftColor: entry.color }}
    >
      <button
        type="button"
        aria-label={entry.done ? "Mark not done" : "Mark done"}
        onClick={onToggle}
        className="flex size-4 shrink-0 items-center justify-center border transition-colors"
        style={{
          borderColor: entry.color,
          backgroundColor: entry.done ? entry.color : "transparent",
          boxShadow: entry.done ? `0 0 6px ${entry.color}` : undefined,
        }}
      />

      {editingTime && onSetTime ? (
        <input
          ref={timeRef}
          value={timeDraft}
          onChange={(e) => setTimeDraft(e.target.value)}
          onBlur={commitTime}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTime();
            }
            if (e.key === "Escape") {
              setTimeDraft(entry.time ?? "");
              setEditingTime(false);
            }
          }}
          placeholder="7:30"
          className="w-14 shrink-0 bg-transparent text-[13px] text-muted tabular-nums outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            if (!onSetTime) return;
            setTimeDraft(entry.time ?? "");
            setEditingTime(true);
          }}
          className={[
            "w-12 shrink-0 text-left text-[13px] tabular-nums",
            onSetTime ? "cursor-text hover:underline" : "",
            entry.time ? "text-muted" : "text-faint",
          ].join(" ")}
          title={onSetTime ? "set time" : undefined}
        >
          {entry.time ? formatTime(entry.time) : "·"}
        </button>
      )}

      {editing && onRename ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commitTitle();
            }
            if (e.key === "Escape") {
              setDraft(entry.title);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            if (onOpen) onOpen();
            else if (onRename) {
              setDraft(entry.title);
              setEditing(true);
            }
          }}
          onDoubleClick={() => {
            if (!onRename) return;
            setDraft(entry.title);
            setEditing(true);
          }}
          className={[
            "min-w-0 flex-1 truncate text-left text-[14px] leading-6",
            entry.done ? "text-muted line-through" : "text-ink",
            onOpen || onRename ? "cursor-pointer" : "",
          ].join(" ")}
          title={entry.title}
        >
          {entry.title}
        </button>
      )}

      {/* Fixed-width trailing meta so rows share one right edge (no "CYCLE" shove). */}
      <span
        className="w-12 shrink-0 truncate text-right text-[11px] tracking-wide text-faint uppercase"
        title={
          entry.kind === "sop"
            ? (entry.bucket ?? "sop")
            : (entry.phaseName ?? undefined)
        }
      >
        {entry.kind === "sop"
          ? shortBucket(entry.bucket)
          : (entry.phaseName ?? "")}
      </span>

      <span className="inline-flex w-5 shrink-0 justify-end">
        {onDelete ? (
          <button
            type="button"
            aria-label={`Delete ${entry.title}`}
            onClick={onDelete}
            className="px-1 text-[13px] text-faint opacity-0 transition hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
          >
            ×
          </button>
        ) : null}
      </span>
    </div>
  );
}

/** Keep sop tags short so they don't dominate the row. */
function shortBucket(bucket?: string): string {
  switch (bucket) {
    case "daily":
      return "day";
    case "cycle":
      return "cyc";
    case "weekly":
      return "wk";
    case "monthly":
      return "mo";
    default:
      return "sop";
  }
}

function parseLooseTime(raw: string): string | undefined {
  const body = raw.trim().toLowerCase().replace(/\s+/g, "");
  const m = body.match(/^(\d{1,2})(?::?(\d{2}))?(am|pm)?$/);
  if (!m) return undefined;
  let h = Number(m[1]);
  const min = m[2] ? Number(m[2]) : 0;
  const ap = m[3];
  if (Number.isNaN(h) || Number.isNaN(min) || min > 59) return undefined;
  if (ap === "pm" && h < 12) h += 12;
  if (ap === "am" && h === 12) h = 0;
  if (h > 23) return undefined;
  return `${h.toString().padStart(2, "0")}:${min.toString().padStart(2, "0")}`;
}
