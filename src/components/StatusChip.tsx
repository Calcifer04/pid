/** Footer stat — label + completion bar (fill = real progress, not fake segments). */
export function StatusChip({
  label,
  frac,
  color,
  active,
  title,
  onClick,
}: {
  label: string;
  /** 0..1 completion */
  frac: number;
  color: string;
  active?: boolean;
  title?: string;
  onClick: () => void;
}) {
  const pct = Math.max(0, Math.min(1, Number.isFinite(frac) ? frac : 0));
  const width = `${Math.round(pct * 100)}%`;

  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title ?? label}
      className={[
        "flex items-center gap-2 rounded-sm px-2.5 py-1.5 transition-colors",
        active ? "bg-card-hi" : "hover:bg-card",
      ].join(" ")}
    >
      <span className="flex w-16 flex-col gap-1.5">
        <span
          className="text-[10px] tracking-[0.14em] uppercase"
          style={{ color }}
        >
          {label}
        </span>

        <span
          className="relative h-1.5 w-full overflow-hidden rounded-[1px] bg-line"
          aria-hidden
        >
          <span
            className="absolute inset-y-0 left-0 rounded-[1px] transition-[width] duration-300"
            style={{
              width,
              backgroundColor: color,
              boxShadow: pct > 0 ? `0 0 8px ${color}` : undefined,
              opacity: pct > 0 ? 1 : 0,
            }}
          />
        </span>
      </span>
    </button>
  );
}
