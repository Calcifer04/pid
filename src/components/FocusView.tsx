import { useEffect, useState } from "react";
import {
  focusElapsedMs,
  formatElapsed,
  isFocusRunning,
  parseFocusRef,
} from "../lib/focus-run";
import type { Board } from "../types";
import { DEFAULT_TASK_COLOR, taskColor } from "../types";

type Props = {
  board: Board;
  onStart: (kind: "task" | "sop", id: string) => void;
  onPause: () => void;
  onResume: () => void;
  onDone: () => void;
  onClear: () => void;
  onOpenDetail: (kind: "task" | "sop", id: string) => void;
  onPickFromToday: () => void;
};

/** Zen focus. Task color = left edge + thin rule (same language as day rows). */
export function FocusView({
  board,
  onStart,
  onPause,
  onResume,
  onDone,
  onClear,
  onOpenDetail,
  onPickFromToday,
}: Props) {
  const [now, setNow] = useState(() => Date.now());
  const run = board.focusRun;
  const running = isFocusRunning(run);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, [running]);

  const ref = parseFocusRef(run?.targetId ?? board.focusId);
  const task =
    ref?.kind === "task"
      ? board.tasks.find((t) => t.id === ref.id)
      : undefined;
  const sop =
    ref?.kind === "sop" ? board.sops.find((s) => s.id === ref.id) : undefined;

  const title = task?.title ?? sop?.title;
  const color = task ? taskColor(task) : (sop?.color ?? DEFAULT_TASK_COLOR);
  const notes = (task?.notes ?? sop?.notes)?.trim();
  const elapsed = formatElapsed(focusElapsedMs(run, now));
  const hasTarget = Boolean(title && ref);
  const openTasks = board.tasks.filter((t) => !t.done).slice(0, 8);

  return (
    <div className="flex h-full min-h-0 flex-1 flex-col items-center justify-center px-5 py-8 sm:px-10">
      {!hasTarget && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <p className="text-[12px] tracking-[0.14em] text-faint uppercase">
            focus
          </p>
          <h1 className="text-[18px] text-ink sm:text-[20px]">nothing active</h1>
          <p className="max-w-sm text-[13px] text-muted">
            pick something to begin. timer starts with you - pause anytime,
            resume on any machine.
          </p>

          {openTasks.length > 0 ? (
            <ul className="w-full space-y-1 text-left">
              {openTasks.map((t) => {
                const c = taskColor(t);
                return (
                  <li key={t.id}>
                    <button
                      type="button"
                      onClick={() => onStart("task", t.id)}
                      className="group flex w-full items-center gap-3 border border-line border-l-2 bg-pane py-3 pr-3 pl-3 text-left transition-colors hover:bg-card"
                      style={{ borderLeftColor: c }}
                    >
                      <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                        {t.title}
                      </span>
                      <span className="text-[11px] tracking-wide text-faint uppercase opacity-0 transition group-hover:opacity-100">
                        start
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <button
              type="button"
              onClick={onPickFromToday}
              className="border border-line px-4 py-2.5 text-[13px] tracking-wide text-muted uppercase transition-colors hover:text-ink"
            >
              open today
            </button>
          )}
        </div>
      )}

      {hasTarget && ref && (
        <div className="flex w-full max-w-lg flex-col items-center gap-10 text-center">
          <div
            className="w-full border border-line border-l-2 bg-pane px-5 py-6 text-left"
            style={{ borderLeftColor: color }}
          >
            <p className="mb-3 text-[12px] tracking-[0.14em] text-faint uppercase">
              focus
            </p>
            <button
              type="button"
              onClick={() => onOpenDetail(ref.kind, ref.id)}
              className="w-full text-left text-[20px] leading-snug text-ink transition-colors hover:text-muted sm:text-[24px]"
            >
              {title}
            </button>
            {notes && (
              <p className="mt-3 line-clamp-3 text-[13px] text-faint">{notes}</p>
            )}
          </div>

          <div
            className="focus-timer text-ink"
            aria-live="polite"
            aria-label={`elapsed ${elapsed}`}
          >
            {elapsed}
          </div>

          <div
            className="h-px w-16"
            style={{ backgroundColor: color }}
            aria-hidden
          />

          <div className="flex flex-wrap items-center justify-center gap-2">
            {running ? (
              <ZenBtn primary onClick={onPause} color={color}>
                pause
              </ZenBtn>
            ) : (
              <ZenBtn primary onClick={onResume} color={color}>
                {run && (run.accumulatedMs ?? 0) > 0 ? "resume" : "start"}
              </ZenBtn>
            )}
            <ZenBtn onClick={onDone}>done</ZenBtn>
            <ZenBtn muted onClick={onClear}>
              clear
            </ZenBtn>
          </div>

          <p className="text-[11px] tracking-[0.14em] text-faint uppercase">
            {running ? "running" : "paused"}
            <span className="mx-2 opacity-40">·</span>
            space pause
          </p>
        </div>
      )}
    </div>
  );
}

function ZenBtn({
  children,
  onClick,
  primary,
  muted,
  color,
}: {
  children: string;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
  color?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-w-[5.5rem] px-4 py-2.5 text-[13px] tracking-[0.14em] uppercase transition-colors",
        primary
          ? "border text-ink hover:bg-card"
          : muted
            ? "border border-transparent text-faint hover:text-muted"
            : "border border-line text-muted hover:text-ink",
      ].join(" ")}
      style={primary ? { borderColor: color || "var(--color-line)" } : undefined}
    >
      {children}
    </button>
  );
}
