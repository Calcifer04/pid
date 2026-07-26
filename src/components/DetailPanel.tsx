import {
  useEffect,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { cadenceLabel } from "../lib/cadence";
import { googleTemplateUrl, taskToEvent } from "../lib/calendar";
import { formatTime } from "../lib/dates";
import type { Phase, Sop, Task } from "../types";
import {
  DEFAULT_TASK_COLOR,
  TASK_SWATCHES,
  taskColor,
} from "../types";

export type DetailTarget =
  | { kind: "task"; id: string }
  | { kind: "sop"; id: string };

type Props = {
  target: DetailTarget;
  task?: Task;
  sop?: Sop;
  phases: Phase[];
  onClose: () => void;
  onPatchTask: (id: string, patch: Partial<Task>) => void;
  onPatchSop: (id: string, patch: Partial<Sop>) => void;
  onDeleteTask: (id: string) => void;
  onDeleteSop: (id: string) => void;
  onToggleTaskDone: (id: string) => void;
  onToggleSopDone: (id: string) => void;
  /** Open zen focus + start timer on this item. */
  onStartFocus?: (kind: "task" | "sop", id: string) => void;
};

/**
 * Right-side detail pane — title, notes, meta. Click outside / Esc closes.
 */
export function DetailPanel({
  target,
  task,
  sop,
  phases,
  onClose,
  onPatchTask,
  onPatchSop,
  onDeleteTask,
  onDeleteSop,
  onToggleTaskDone,
  onToggleSopDone,
  onStartFocus,
}: Props) {
  const isTask = target.kind === "task";
  const title = isTask ? task?.title : sop?.title;
  const color = isTask ? taskColor(task) : (sop?.color ?? "#8b8b9a");
  const notes = (isTask ? task?.notes : sop?.notes) ?? "";

  const [titleDraft, setTitleDraft] = useState(title ?? "");
  const [notesDraft, setNotesDraft] = useState(notes);

  useEffect(() => {
    setTitleDraft(title ?? "");
    setNotesDraft(notes);
  }, [target.kind, target.id, title, notes]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  if (isTask && !task) return null;
  if (!isTask && !sop) return null;

  function commitTitle() {
    const next = titleDraft.trim();
    if (!next || next === title) {
      setTitleDraft(title ?? "");
      return;
    }
    if (isTask) onPatchTask(target.id, { title: next });
    else onPatchSop(target.id, { title: next });
  }

  function commitNotes() {
    if (notesDraft === notes) return;
    if (isTask) onPatchTask(target.id, { notes: notesDraft });
    else onPatchSop(target.id, { notes: notesDraft });
  }

  return (
    <aside className="detail-panel flex h-full w-full max-w-md shrink-0 flex-col border-l border-line bg-pane">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <span
          className="size-2.5 shrink-0 rounded-full"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        <span className="text-[12px] tracking-[0.16em] text-faint uppercase">
          {isTask ? "task" : "sop"}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto px-2 py-1 text-[13px] text-faint transition-colors hover:text-accent"
        >
          esc
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto px-4 py-4">
        <input
          value={titleDraft}
          onChange={(e) => setTitleDraft(e.target.value)}
          onBlur={commitTitle}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
          }}
          className="w-full bg-transparent text-[18px] text-ink outline-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          {onStartFocus && (
            <button
              type="button"
              onClick={() =>
                onStartFocus(isTask ? "task" : "sop", target.id)
              }
              className="border border-accent/45 bg-accent/10 px-2.5 py-1.5 text-[13px] text-accent transition-colors hover:bg-accent/15"
            >
              start focus
            </button>
          )}
          <button
            type="button"
            onClick={() =>
              isTask
                ? onToggleTaskDone(target.id)
                : onToggleSopDone(target.id)
            }
            className="border border-line px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
          >
            {isTask
              ? task!.done
                ? "mark open"
                : "mark done"
              : "toggle done today"}
          </button>

          {isTask && (
            <select
              value={task!.phaseId}
              onChange={(e) =>
                onPatchTask(target.id, { phaseId: e.target.value })
              }
              className="border border-line bg-card px-2 py-1.5 text-[13px] text-muted outline-none"
            >
              {phases.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {isTask && (
          <Field label="color">
            <TaskColorPicker
              value={task!.color}
              onChange={(next) => onPatchTask(target.id, { color: next })}
            />
          </Field>
        )}

        <div className="grid grid-cols-2 gap-3 text-[13px]">
          {isTask ? (
            <>
              <Field label="due date">
                <input
                  type="date"
                  value={task!.dueDate ?? ""}
                  onChange={(e) =>
                    onPatchTask(target.id, {
                      dueDate: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-transparent text-ink outline-none"
                />
              </Field>
              <Field label="time">
                <input
                  type="time"
                  value={task!.dueTime ?? ""}
                  onChange={(e) =>
                    onPatchTask(target.id, {
                      dueTime: e.target.value || undefined,
                    })
                  }
                  className="w-full bg-transparent text-ink outline-none"
                />
              </Field>
              {task!.dueDate && !task!.done && (
                <div className="col-span-2">
                  <a
                    href={googleTemplateUrl(taskToEvent(task!)!)}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-block border border-line px-2.5 py-1.5 text-[13px] text-muted transition-colors hover:border-accent/40 hover:text-accent"
                    title="Open Google Calendar create form with this task"
                  >
                    add to Google Calendar
                  </a>
                </div>
              )}
            </>
          ) : (
            <>
              <Field label="cadence">
                <span className="text-muted">
                  {cadenceLabel(sop!.cadence)}
                </span>
              </Field>
              <Field label="time">
                <span className="text-muted">
                  {sop!.time ? formatTime(sop!.time) : "—"}
                </span>
              </Field>
            </>
          )}
        </div>

        <Field label="notes">
          <textarea
            value={notesDraft}
            onChange={(e) => setNotesDraft(e.target.value)}
            onBlur={commitNotes}
            rows={12}
            placeholder="details, links, checklist…"
            spellCheck={false}
            className="mt-1 min-h-[200px] w-full resize-y bg-card/40 px-3 py-2.5 text-[14px] leading-relaxed text-ink outline-none placeholder:text-faint"
          />
        </Field>
      </div>

      <footer className="border-t border-line px-4 py-3">
        <button
          type="button"
          onClick={() => {
            if (isTask) onDeleteTask(target.id);
            else onDeleteSop(target.id);
            onClose();
          }}
          className="text-[13px] text-faint transition-colors hover:text-accent"
        >
          delete {isTask ? "task" : "sop"}
        </button>
      </footer>
    </aside>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[11px] tracking-[0.14em] text-faint uppercase">
        {label}
      </span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

/** Task identity color — custom hex, not tied to phase/column. */
function TaskColorPicker({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (color: string | undefined) => void;
}) {
  const current = (value?.trim() || DEFAULT_TASK_COLOR).toLowerCase();
  const isPreset = TASK_SWATCHES.some((c) => c.toLowerCase() === current);
  const hexValid = /^#[0-9a-f]{6}$/i.test(current)
    ? current
    : DEFAULT_TASK_COLOR;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-1.5">
        {TASK_SWATCHES.map((c) => {
          const active = current === c.toLowerCase();
          return (
            <button
              key={c}
              type="button"
              title={c}
              aria-label={`Color ${c}`}
              aria-pressed={active}
              onClick={() => onChange(c)}
              className={[
                "size-6 border transition-shadow",
                active
                  ? "border-ink/80 shadow-[0_0_10px_var(--swatch)]"
                  : "border-transparent hover:border-muted",
              ].join(" ")}
              style={
                {
                  backgroundColor: c,
                  "--swatch": c,
                } as CSSProperties
              }
            />
          );
        })}
        <label
          className={[
            "relative size-6 cursor-pointer border",
            !isPreset
              ? "border-ink/80 shadow-[0_0_10px_var(--swatch)]"
              : "border-line hover:border-muted",
          ].join(" ")}
          style={
            {
              background: !isPreset
                ? hexValid
                : "conic-gradient(#ffb454, #2ee6d6, #ff6ac1, #5af78e, #ff5c57, #57c7ff, #ffb454)",
              "--swatch": hexValid,
            } as CSSProperties
          }
          title="Custom color"
        >
          <input
            type="color"
            value={hexValid}
            onChange={(e) => onChange(e.target.value.toLowerCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
            aria-label="Custom color"
          />
        </label>
      </div>
      <div className="flex items-center gap-2">
        <span
          className="size-3 shrink-0 rounded-full"
          style={{
            backgroundColor: hexValid,
            boxShadow: `0 0 8px ${hexValid}`,
          }}
        />
        <input
          type="text"
          value={value?.trim() || ""}
          placeholder={DEFAULT_TASK_COLOR}
          spellCheck={false}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) {
              onChange(undefined);
              return;
            }
            const hex = raw.startsWith("#") ? raw : `#${raw}`;
            if (/^#[0-9a-fA-F]{3,8}$/.test(hex)) onChange(hex.toLowerCase());
            else onChange(raw);
          }}
          className="w-28 border border-line bg-card px-2 py-1 text-[12px] text-muted tabular-nums outline-none focus:border-accent/40 focus:text-ink"
        />
        {value && (
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="text-[11px] tracking-wide text-faint uppercase transition-colors hover:text-accent"
          >
            reset
          </button>
        )}
      </div>
    </div>
  );
}
