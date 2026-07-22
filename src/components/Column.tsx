import { useEffect, useRef, useState } from "react";
import type { Phase, Task } from "../types";
import { TaskCard } from "./TaskCard";

type Props = {
  phase: Phase;
  tasks: Task[];
  onAddTask: (phaseId: string, title: string) => void;
  onRenameTask: (id: string, title: string) => void;
  onDeleteTask: (id: string) => void;
  onRenamePhase: (id: string, name: string) => void;
  onDeletePhase: (id: string) => void;
  onDragStart: (id: string) => void;
  onDropInPhase: (phaseId: string) => void;
  onDropBefore: (targetId: string) => void;
};

export function Column({
  phase,
  tasks,
  onAddTask,
  onRenameTask,
  onDeleteTask,
  onRenamePhase,
  onDeletePhase,
  onDragStart,
  onDropInPhase,
  onDropBefore,
}: Props) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(phase.name);
  const [over, setOver] = useState(false);
  const addRef = useRef<HTMLTextAreaElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (adding) addRef.current?.focus();
  }, [adding]);

  useEffect(() => {
    if (renaming) {
      nameRef.current?.focus();
      nameRef.current?.select();
    }
  }, [renaming]);

  function commitTask() {
    const title = draft.trim();
    if (title) onAddTask(phase.id, title);
    setDraft("");
    setAdding(false);
  }

  function commitName() {
    const next = nameDraft.trim();
    if (next && next !== phase.name) onRenamePhase(phase.id, next);
    else setNameDraft(phase.name);
    setRenaming(false);
  }

  return (
    <section
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        onDropInPhase(phase.id);
      }}
      className={[
        "group/col relative flex w-[276px] shrink-0 flex-col rounded-md border bg-pane transition-colors",
        over ? "border-accent/70" : "border-line",
      ].join(" ")}
    >
      {/* Signature: the phase label is inset into the pane border, like a multiplexer pane title. */}
      <header className="absolute top-0 left-3 flex -translate-y-1/2 items-center gap-2 bg-ground px-2">
        <span
          aria-hidden
          className="size-1.5 rounded-full"
          style={{ backgroundColor: phase.color }}
        />
        {renaming ? (
          <input
            ref={nameRef}
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") commitName();
              if (e.key === "Escape") {
                setNameDraft(phase.name);
                setRenaming(false);
              }
            }}
            className="w-24 bg-transparent font-mono text-[11px] tracking-[0.14em] uppercase outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(phase.name);
              setRenaming(true);
            }}
            className="font-mono text-[11px] tracking-[0.14em] text-muted uppercase transition-colors hover:text-ink"
          >
            {phase.name}
          </button>
        )}
        <span className="font-mono text-[11px] text-faint tabular-nums">
          {tasks.length}
        </span>
        <button
          type="button"
          aria-label={`Delete phase ${phase.name}`}
          onClick={() => onDeletePhase(phase.id)}
          className="rounded font-mono text-[11px] text-faint opacity-0 transition hover:text-ink group-hover/col:opacity-100 focus-visible:opacity-100"
        >
          x
        </button>
      </header>

      <div className="flex-1 space-y-2 overflow-y-auto p-2.5 pt-5">
        {tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            onRename={onRenameTask}
            onDelete={onDeleteTask}
            onDragStart={onDragStart}
            onDropBefore={onDropBefore}
          />
        ))}

        {adding ? (
          <div className="rounded border border-accent/60 bg-card-hi p-2.5">
            <textarea
              ref={addRef}
              value={draft}
              rows={2}
              placeholder="What needs doing?"
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commitTask}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  commitTask();
                }
                if (e.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              className="w-full resize-none bg-transparent text-sm leading-snug outline-none placeholder:text-faint"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="w-full rounded px-2 py-1.5 text-left font-mono text-[11px] text-faint transition-colors hover:bg-card hover:text-ink"
          >
            + task
          </button>
        )}
      </div>
    </section>
  );
}
