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
  const dueSops = board.sops.filter((s) => s.enabled).length;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <p className="px-4 pt-3 text-[13px] text-faint">
        due SOPs join this board · drag into{" "}
        <span className="text-muted">doing</span> for in-progress · check off
        when finished
        {dueSops === 0 ? " · no sops yet" : ""}
      </p>
      <div className="flex min-h-0 flex-1 items-stretch gap-3 overflow-x-auto px-3 pt-2 pb-3">
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
          className="h-fit shrink-0 border border-dashed border-line px-3 py-2 text-[13px] text-faint transition-colors hover:border-accent/50 hover:text-accent hover:shadow-[0_0_12px_-4px_var(--color-accent)]"
        >
          + phase
        </button>
      </div>
    </div>
  );
}
