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

/**
 * Zen focus surface — one active item, big timer, almost no chrome.
 * Timer state lives on board.focusRun so PC/laptop stay aligned.
 */
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

  // Open candidates: incomplete tasks first, then anything focused-capable
  const openTasks = board.tasks.filter((t) => !t.done).slice(0, 8);

  return (
    <div className="focus-zen flex h-full min-h-0 flex-1 flex-col items-center justify-center px-5 py-8 sm:px-10">
      {!hasTarget && (
        <div className="flex w-full max-w-md flex-col items-center gap-8 text-center">
          <p className="text-[12px] tracking-[0.28em] text-faint uppercase">
            focus
          </p>
          <h1 className="text-[22px] leading-snug font-medium text-ink sm:text-[28px]">
            nothing active
          </h1>
          <p className="max-w-sm text-[14px] leading-relaxed text-muted">
            pick something to begin. timer starts with you — pause anytime,
            resume later on any machine.
          </p>

          {openTasks.length > 0 ? (
            <ul className="w-full space-y-1.5 text-left">
              {openTasks.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    onClick={() => onStart("task", t.id)}
                    className="group flex w-full items-center gap-3 border border-line bg-pane/60 px-3 py-3 text-left transition-colors hover:border-accent/35 hover:bg-card"
                  >
                    <span
                      className="size-2 shrink-0 rounded-full"
                      style={{
                        backgroundColor: taskColor(t),
                        boxShadow: `0 0 10px ${taskColor(t)}`,
                      }}
                    />
                    <span className="min-w-0 flex-1 truncate text-[15px] text-ink">
                      {t.title}
                    </span>
                    <span className="text-[11px] tracking-wide text-faint uppercase opacity-0 transition group-hover:opacity-100">
                      start
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <button
              type="button"
              onClick={onPickFromToday}
              className="border border-line px-4 py-2.5 text-[13px] tracking-wide text-muted uppercase transition-colors hover:border-accent/40 hover:text-accent"
            >
              open today
            </button>
          )}
        </div>
      )}

      {hasTarget && ref && (
        <div className="flex w-full max-w-lg flex-col items-center gap-10 text-center">
          <div className="flex flex-col items-center gap-4">
            <span
              className="size-2.5 rounded-full"
              style={{
                backgroundColor: color,
                boxShadow: `0 0 18px ${color}`,
              }}
            />
            <button
              type="button"
              onClick={() => onOpenDetail(ref.kind, ref.id)}
              className="max-w-full px-2 text-[22px] leading-snug font-medium text-balance text-ink transition-colors hover:text-accent sm:text-[30px]"
            >
              {title}
            </button>
            {notes && (
              <p className="line-clamp-3 max-w-md text-[13px] leading-relaxed text-faint">
                {notes}
              </p>
            )}
          </div>

          <div
            className="focus-timer tabular-nums tracking-tight text-ink"
            aria-live="polite"
            aria-label={`elapsed ${elapsed}`}
          >
            {elapsed}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-2">
            {running ? (
              <ZenBtn primary onClick={onPause}>
                pause
              </ZenBtn>
            ) : (
              <ZenBtn primary onClick={onResume}>
                {run && (run.accumulatedMs ?? 0) > 0 ? "resume" : "start"}
              </ZenBtn>
            )}
            <ZenBtn onClick={onDone}>done</ZenBtn>
            <ZenBtn muted onClick={onClear}>
              clear
            </ZenBtn>
          </div>

          <p className="text-[11px] tracking-[0.18em] text-faint uppercase">
            {running ? "running" : "paused"} · synced with board
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
}: {
  children: string;
  onClick: () => void;
  primary?: boolean;
  muted?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "min-w-[5.5rem] px-4 py-2.5 text-[13px] tracking-[0.16em] uppercase transition-colors",
        primary
          ? "border border-accent/50 bg-accent/10 text-accent hover:bg-accent/15"
          : muted
            ? "border border-transparent text-faint hover:text-muted"
            : "border border-line text-muted hover:border-accent/35 hover:text-accent",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
