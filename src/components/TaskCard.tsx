import { useEffect, useRef, useState } from "react";
import type { Task } from "../types";

type Props = {
  task: Task;
  onRename: (id: string, title: string) => void;
  onDelete: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropBefore: (targetId: string) => void;
};

export function TaskCard({
  task,
  onRename,
  onDelete,
  onDragStart,
  onDropBefore,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(task.title);
  const [over, setOver] = useState(false);
  const inputRef = useRef<HTMLTextAreaElement>(null);

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

  if (editing) {
    return (
      <div className="rounded border border-accent/60 bg-card-hi p-2.5">
        <textarea
          ref={inputRef}
          value={draft}
          rows={2}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setDraft(task.title);
              setEditing(false);
            }
          }}
          className="w-full resize-none bg-transparent text-sm leading-snug outline-none"
        />
      </div>
    );
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart(task.id);
      }}
      onDragOver={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        e.stopPropagation();
        setOver(false);
        onDropBefore(task.id);
      }}
      className={[
        "group relative cursor-grab rounded border bg-card p-2.5 transition-colors active:cursor-grabbing",
        over ? "border-accent" : "border-line hover:border-faint",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => {
          setDraft(task.title);
          setEditing(true);
        }}
        className="block w-full cursor-text text-left text-sm leading-snug text-ink"
      >
        {task.title}
      </button>

      <button
        type="button"
        aria-label={`Delete ${task.title}`}
        onClick={() => onDelete(task.id)}
        className="absolute top-1 right-1 rounded px-1.5 font-mono text-xs text-faint opacity-0 transition group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
      >
        x
      </button>
    </div>
  );
}
