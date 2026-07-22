import { useEffect, useRef, useState } from "react";
import { Column } from "./components/Column";
import { exportFile, importFile, load, newId, save } from "./store";
import type { Board } from "./types";
import { PHASE_COLORS } from "./types";

export default function App() {
  const [board, setBoard] = useState<Board>(load);
  const [error, setError] = useState<string | null>(null);
  const dragId = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    save(board);
  }, [board]);

  function addTask(phaseId: string, title: string) {
    setBoard((b) => ({
      ...b,
      tasks: [...b.tasks, { id: newId(), title, phaseId, createdAt: Date.now() }],
    }));
  }

  function renameTask(id: string, title: string) {
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.id === id ? { ...t, title } : t)),
    }));
  }

  function deleteTask(id: string) {
    setBoard((b) => ({ ...b, tasks: b.tasks.filter((t) => t.id !== id) }));
  }

  function addPhase() {
    setBoard((b) => ({
      ...b,
      phases: [
        ...b.phases,
        {
          id: newId(),
          name: "new phase",
          color: PHASE_COLORS[b.phases.length % PHASE_COLORS.length],
        },
      ],
    }));
  }

  function renamePhase(id: string, name: string) {
    setBoard((b) => ({
      ...b,
      phases: b.phases.map((p) => (p.id === id ? { ...p, name } : p)),
    }));
  }

  function deletePhase(id: string) {
    setBoard((b) => {
      if (b.phases.length <= 1) return b;
      const fallback = b.phases.find((p) => p.id !== id);
      if (!fallback) return b;
      return {
        phases: b.phases.filter((p) => p.id !== id),
        // Tasks survive the phase they were in; they fall back to the first remaining one.
        tasks: b.tasks.map((t) =>
          t.phaseId === id ? { ...t, phaseId: fallback.id } : t,
        ),
      };
    });
  }

  function dropInPhase(phaseId: string) {
    const id = dragId.current;
    if (!id) return;
    setBoard((b) => {
      const moving = b.tasks.find((t) => t.id === id);
      if (!moving) return b;
      const rest = b.tasks.filter((t) => t.id !== id);
      return { ...b, tasks: [...rest, { ...moving, phaseId }] };
    });
    dragId.current = null;
  }

  function dropBefore(targetId: string) {
    const id = dragId.current;
    if (!id || id === targetId) return;
    setBoard((b) => {
      const moving = b.tasks.find((t) => t.id === id);
      const target = b.tasks.find((t) => t.id === targetId);
      if (!moving || !target) return b;
      const rest = b.tasks.filter((t) => t.id !== id);
      const at = rest.findIndex((t) => t.id === targetId);
      const next = [...rest];
      next.splice(at, 0, { ...moving, phaseId: target.phaseId });
      return { ...b, tasks: next };
    });
    dragId.current = null;
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    try {
      setBoard(await importFile(file));
      setError(null);
    } catch {
      setError("That file is not a routine board. Nothing was changed.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="flex h-full flex-col bg-ground">
      <header className="flex shrink-0 flex-wrap items-center gap-x-4 gap-y-2 px-6 py-4">
        <h1 className="flex items-baseline gap-1.5 font-mono text-sm tracking-[0.14em] text-ink lowercase">
          routine
          <span aria-hidden className="inline-block h-3.5 w-1.5 bg-accent" />
        </h1>

        <span className="font-mono text-[11px] text-faint tabular-nums">
          {board.tasks.length} {board.tasks.length === 1 ? "task" : "tasks"}
        </span>

        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={addPhase}
            className="rounded px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:bg-pane hover:text-ink"
          >
            + phase
          </button>
          <button
            type="button"
            onClick={() => exportFile(board)}
            className="rounded px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:bg-pane hover:text-ink"
          >
            export
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="rounded px-2 py-1 font-mono text-[11px] text-muted transition-colors hover:bg-pane hover:text-ink"
          >
            import
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => void onPickFile(e.target.files?.[0])}
          />
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="mx-6 mb-3 rounded border border-accent/40 bg-pane px-3 py-2 font-mono text-[11px] text-accent"
        >
          {error}
        </p>
      )}

      <main className="flex flex-1 gap-4 overflow-x-auto px-6 pt-3 pb-6">
        {board.phases.map((phase) => (
          <Column
            key={phase.id}
            phase={phase}
            tasks={board.tasks.filter((t) => t.phaseId === phase.id)}
            onAddTask={addTask}
            onRenameTask={renameTask}
            onDeleteTask={deleteTask}
            onRenamePhase={renamePhase}
            onDeletePhase={deletePhase}
            onDragStart={(id) => (dragId.current = id)}
            onDropInPhase={dropInPhase}
            onDropBefore={dropBefore}
          />
        ))}

        <button
          type="button"
          onClick={addPhase}
          className="h-fit shrink-0 rounded-md border border-dashed border-line px-4 py-3 font-mono text-[11px] text-faint transition-colors hover:border-faint hover:text-ink"
        >
          + phase
        </button>
      </main>
    </div>
  );
}
