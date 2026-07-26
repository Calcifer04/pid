import { useMemo, useState } from "react";
import { boardCardsForPhase } from "../lib/board";
import type { Board } from "../types";
import { Column } from "./Column";

type Props = {
  board: Board;
  /** Day used to materialize due SOPs onto the board (usually today). */
  dayKey: string;
  onAddPhase: () => void;
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
};

export function BoardView({
  board,
  dayKey,
  onAddPhase,
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
}: Props) {
  const [mobilePhaseId, setMobilePhaseId] = useState(
    () => board.phases[0]?.id ?? "",
  );

  // Keep selection valid if phases change
  const activeId = useMemo(() => {
    if (board.phases.some((p) => p.id === mobilePhaseId)) return mobilePhaseId;
    return board.phases[0]?.id ?? "";
  }, [board.phases, mobilePhaseId]);

  const activePhase = board.phases.find((p) => p.id === activeId);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* —— Mobile: one phase at a time —— */}
      <div className="flex min-h-0 flex-1 flex-col md:hidden">
        <div className="shrink-0 overflow-x-auto border-b border-line px-2 py-2">
          <div className="flex w-max items-center gap-1">
            {board.phases.map((p) => {
              const n = boardCardsForPhase(board, p, dayKey).length;
              const on = p.id === activeId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setMobilePhaseId(p.id)}
                  className={[
                    "flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] tracking-wide uppercase transition-colors",
                    on
                      ? "bg-card-hi text-ink"
                      : "text-faint hover:text-muted",
                  ].join(" ")}
                >
                  <span
                    className="size-1.5 rounded-full"
                    style={{
                      backgroundColor: p.color,
                      boxShadow: on ? `0 0 8px ${p.color}` : undefined,
                    }}
                  />
                  {p.name}
                  <span className="text-[11px] text-faint tabular-nums">
                    {n}
                  </span>
                </button>
              );
            })}
            <button
              type="button"
              onClick={onAddPhase}
              className="px-2.5 py-1.5 text-[13px] text-faint"
            >
              +
            </button>
          </div>
        </div>

        {activePhase ? (
          <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
            <Column
              phase={activePhase}
              cards={boardCardsForPhase(board, activePhase, dayKey)}
              onRenameTask={onRenameTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskDone={onToggleTaskDone}
              onToggleSopDone={onToggleSopDone}
              onOpenTask={onOpenTask}
              onOpenSop={onOpenSop}
              onRenamePhase={onRenamePhase}
              onDeletePhase={onDeletePhase}
              onDragStart={onDragStart}
              onDropInPhase={onDropInPhase}
              onDropBefore={onDropBefore}
              mobileFull
            />
          </div>
        ) : (
          <p className="px-4 py-8 text-[13px] text-faint">no phases</p>
        )}
      </div>

      {/* —— Desktop: horizontal columns —— */}
      <div className="hidden min-h-0 flex-1 flex-col md:flex">
        <p className="px-4 pt-3 text-[13px] text-faint">
          due SOPs join this board · drag into{" "}
          <span className="text-muted">doing</span> for in-progress · check off
          when finished
        </p>
        <div className="pid-board-scroll flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-3 pt-2 pb-3">
          {board.phases.map((phase) => (
            <Column
              key={phase.id}
              phase={phase}
              cards={boardCardsForPhase(board, phase, dayKey)}
              onRenameTask={onRenameTask}
              onDeleteTask={onDeleteTask}
              onToggleTaskDone={onToggleTaskDone}
              onToggleSopDone={onToggleSopDone}
              onOpenTask={onOpenTask}
              onOpenSop={onOpenSop}
              onRenamePhase={onRenamePhase}
              onDeletePhase={onDeletePhase}
              onDragStart={onDragStart}
              onDropInPhase={onDropInPhase}
              onDropBefore={onDropBefore}
            />
          ))}
          <button
            type="button"
            onClick={onAddPhase}
            className="h-fit shrink-0 border border-dashed border-line px-3 py-2 text-[13px] text-faint transition-colors hover:border-accent/50 hover:text-accent"
          >
            + phase
          </button>
        </div>
      </div>
    </div>
  );
}
