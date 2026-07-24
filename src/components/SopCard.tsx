import { formatTime } from "../lib/dates";
import type { Sop } from "../types";

type Props = {
  sop: Sop;
  done: boolean;
  draggable?: boolean;
  onToggleDone: (id: string) => void;
  onOpen?: (id: string) => void;
  onDragStart?: (id: string) => void;
  onDropBefore?: (targetId: string) => void;
};

/** Single-line board card — matches TaskRow geometry. */
export function SopCard({
  sop,
  done,
  draggable = true,
  onToggleDone,
  onOpen,
  onDragStart,
  onDropBefore,
}: Props) {
  const color = sop.color;

  return (
    <div
      draggable={draggable}
      onDragStart={
        draggable
          ? (e) => {
              e.dataTransfer.effectAllowed = "move";
              e.dataTransfer.setData("text/plain", `sop:${sop.id}`);
              onDragStart?.(sop.id);
            }
          : undefined
      }
      onDragOver={
        draggable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
            }
          : undefined
      }
      onDrop={
        draggable
          ? (e) => {
              e.preventDefault();
              e.stopPropagation();
              onDropBefore?.(sop.id);
            }
          : undefined
      }
      className={[
        "group flex h-11 items-center gap-2.5 border-l-2 pr-2 pl-2.5 transition-colors",
        draggable ? "cursor-grab active:cursor-grabbing" : "",
        done ? "opacity-45" : "hover:bg-card",
      ].join(" ")}
      style={{ borderLeftColor: color }}
    >
      <button
        type="button"
        aria-label={done ? "Mark not done" : "Mark done"}
        onClick={() => onToggleDone(sop.id)}
        className="flex size-4 shrink-0 items-center justify-center border transition-colors"
        style={{
          borderColor: color,
          backgroundColor: done ? color : "transparent",
          boxShadow: done ? `0 0 6px ${color}` : undefined,
        }}
      />

      <button
        type="button"
        onClick={() => onOpen?.(sop.id)}
        className={[
          "min-w-0 flex-1 truncate text-left text-[14px] leading-6",
          done ? "text-muted line-through" : "text-ink",
        ].join(" ")}
        title={sop.title}
      >
        {sop.title}
      </button>

      {sop.time && (
        <span className="shrink-0 text-[12px] text-muted tabular-nums">
          {formatTime(sop.time)}
        </span>
      )}

      <span className="shrink-0 text-[11px] tracking-wider text-faint uppercase">
        sop
      </span>
    </div>
  );
}
