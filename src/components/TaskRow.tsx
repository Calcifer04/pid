import { useEffect, useRef, useState } from "react";
import { formatTime } from "../lib/dates";
import type { Task } from "../types";

type Props = {
  task: Task;
  color: string;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onToggleDone?: (id: string) => void;
  onOpen?: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDropBefore?: (targetId: string) => void;
  draggable?: boolean;
};

/** Compact single-line row. Phase color = gutter + checkbox only. */
export function TaskRow({
  task,
  color,
  onRename,
  onDelete,
  onToggleDone,
  onOpen,
  onDragStart,
  onDropBefore,
  draggable = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  function commit() {
    const next = draft.trim();
    if (next && next !== task.title) onRename(task.id, next);
    else setDraft(task.title);
    setEditing(false);
  }

  return (
    <div
      draggable={draggable && !editing}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              onDragStart?.(task.id);
            }
          : undefined
      }
      onDragOver={
        draggable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              setOver(true);
            }
          : undefined
      }
      onDragLeave={draggable ? () => setOver(false) : undefined}
      onDrop={
        draggable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              setOver(false);
              onDropBefore?.(task.id);
            }
          : undefined
      }
      className={[
        "group flex h-11 items-center gap-2.5 border-l-2 pr-2 pl-2.5 transition-colors",
        over ? "border-l-accent bg-card-hi" : "bg-transparent hover:bg-card",
        draggable ? "cursor-grab active:cursor-grabbing" : "",
        task.done ? "opacity-45" : "",
      ].join(" ")}
      style={{ borderLeftColor: over ? undefined : color }}
    >
      {onToggleDone && (
        <button
          type="button"
          aria-label={task.done ? "Mark not done" : "Mark done"}
          onClick={() => onToggleDone(task.id)}
          className="flex size-4 shrink-0 items-center justify-center border transition-colors"
          style={{
            borderColor: color,
            backgroundColor: task.done ? color : "transparent",
            boxShadow: task.done ? `0 0 6px ${color}` : undefined,
          }}
        />
      )}

      {editing ? (
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-[14px] text-ink outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            if (onOpen) onOpen(task.id);
            else {
              setDraft(task.title);
              setEditing(true);
            }
          }}
          onDoubleClick={() => {
            setDraft(task.title);
            setEditing(true);
          }}
          className={[
            "min-w-0 flex-1 truncate text-left text-[14px] leading-6",
            task.done ? "text-muted line-through" : "text-ink",
          ].join(" ")}
          title={task.title}
        >
          {task.title}
        </button>
      )}

      {task.dueTime && (
        <span className="shrink-0 text-[12px] text-faint tabular-nums">
          {formatTime(task.dueTime)}
        </span>
      )}

      <button
        type="button"
        aria-label={`Delete ${task.title}`}
        onClick={() => onDelete(task.id)}
        className="shrink-0 px-1 text-[13px] text-faint opacity-0 transition hover:text-accent focus-visible:opacity-100 group-hover:opacity-100"
      >
        ×
      </button>
    </div>
  );
}
