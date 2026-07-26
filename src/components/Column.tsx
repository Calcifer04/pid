import { useEffect, useRef, useState } from "react";
import type { BoardCard } from "../lib/board";
import type { Phase } from "../types";
import { taskColor } from "../types";
import { SopCard } from "./SopCard";
import { TaskRow } from "./TaskRow";

type Props = {
  phase: Phase;
  cards: BoardCard[];
  onRenameTask: (id: string, title: string) => void;
  onDeleteTask: (id: string) => void;
  onToggleTaskDone: (id: string) => void;
  onToggleSopDone: (id: string) => void;
  onOpenTask: (id: string) => void;
  onOpenSop: (id: string) => void;
  onRenamePhase: (id: string, name: string) => void;
  onDeletePhase: (id: string) => void;
  onDragStart: (kind: "task" | "sop", id: string) => void;
  onDropInPhase: (phaseId: string) => void;
  onDropBefore: (kind: "task" | "sop", targetId: string) => void;
  /** Full-width list mode for mobile (no fixed column min-width). */
  mobileFull?: boolean;
};

export function Column({
  phase,
  cards,
  onRenameTask,
  onDeleteTask,
  onToggleTaskDone,
  onToggleSopDone,
  onOpenTask,
  onOpenSop,
  onRenamePhase,
  onDeletePhase,
  onDragStart,
  onDropInPhase,
  onDropBefore,
  mobileFull = false,
}: Props) {
  const [renaming, setRenaming] = useState(false);
  const [nameDraft, setNameDraft] = useState(phase.name);
  const [over, setOver] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renaming) {
      nameRef.current?.focus();
      nameRef.current?.select();
    }
  }, [renaming]);

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
        "group/col flex min-h-0 flex-1 flex-col border bg-pane transition-colors",
        mobileFull
          ? "min-w-0 w-full border-0 bg-transparent"
          : "min-w-[min(85vw,280px)] sm:min-w-[260px]",
        over
          ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]"
          : mobileFull
            ? ""
            : "border-line",
      ].join(" ")}
    >
      <header
        className={[
          "flex shrink-0 items-center gap-2.5",
          mobileFull
            ? "h-10 px-1 pb-2"
            : "h-11 border-b border-line px-3",
        ].join(" ")}
      >
        <span
          aria-hidden
          className="size-2 shrink-0 rounded-full"
          style={{
            backgroundColor: phase.color,
            boxShadow: `0 0 8px ${phase.color}`,
          }}
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
            className="min-w-0 flex-1 bg-transparent text-[13px] tracking-[0.14em] text-ink uppercase outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => {
              setNameDraft(phase.name);
              setRenaming(true);
            }}
            className="min-w-0 flex-1 truncate text-left text-[13px] tracking-[0.14em] text-ink uppercase transition-colors hover:text-accent"
          >
            {phase.name}
          </button>
        )}
        <span className="w-5 shrink-0 text-right text-[13px] text-faint tabular-nums">
          {cards.length}
        </span>
        <button
          type="button"
          aria-label={`Delete phase ${phase.name}`}
          onClick={() => onDeletePhase(phase.id)}
          className="w-4 shrink-0 text-[13px] text-faint opacity-0 transition hover:text-accent focus-visible:opacity-100 group-hover/col:opacity-100"
        >
          ×
        </button>
      </header>

      <div
        className={[
          "flex flex-1 flex-col gap-1.5",
          mobileFull
            ? "min-h-0 overflow-visible p-0"
            : "min-h-[200px] overflow-y-auto p-2.5",
        ].join(" ")}
      >
        {cards.map((card) =>
          card.kind === "task" ? (
            <TaskRow
              key={`t:${card.id}`}
              task={card.task}
              color={taskColor(card.task)}
              draggable
              onRename={onRenameTask}
              onDelete={onDeleteTask}
              onToggleDone={onToggleTaskDone}
              onOpen={onOpenTask}
              onDragStart={(id) => onDragStart("task", id)}
              onDropBefore={(id) => onDropBefore("task", id)}
            />
          ) : (
            <SopCard
              key={`s:${card.id}`}
              sop={card.sop}
              done={card.done}
              onToggleDone={onToggleSopDone}
              onOpen={onOpenSop}
              onDragStart={(id) => onDragStart("sop", id)}
              onDropBefore={(id) => onDropBefore("sop", id)}
            />
          ),
        )}
        {cards.length === 0 && (
          <p className="px-1 py-3 text-[13px] text-faint">empty</p>
        )}
      </div>
    </section>
  );
}
