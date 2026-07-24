import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

export type GrokRefItem = {
  kind: "task" | "sop";
  id: string;
  title: string;
  /** phase name / cadence label */
  hint?: string;
  color: string;
};

type Props = {
  open: boolean;
  busy: boolean;
  ready: boolean;
  source: string;
  reply: string | null;
  error: string | null;
  /** Board items for @ reference picker */
  items: GrokRefItem[];
  onClose: () => void;
  onSubmit: (message: string) => void;
};

/**
 * Centered glass command surface for πD.
 * Open with `g`. `@` pins tasks/SOPs as short chips (ids only in the outbound payload).
 */
export function GrokPanel({
  open,
  busy,
  ready,
  source,
  reply,
  error,
  items,
  onClose,
  onSubmit,
}: Props) {
  const [text, setText] = useState("");
  const [refs, setRefs] = useState<GrokRefItem[]>([]);
  const [picking, setPicking] = useState(false);
  const [query, setQuery] = useState("");
  const [pickIndex, setPickIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      setText("");
      setRefs([]);
      setPicking(false);
      setQuery("");
      setPickIndex(0);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const filtered = useMemo(() => {
    if (!picking) return [] as GrokRefItem[];
    const q = query.toLowerCase();
    const taken = new Set(refs.map((r) => `${r.kind}:${r.id}`));
    const list = items.filter((it) => {
      if (taken.has(`${it.kind}:${it.id}`)) return false;
      if (!q) return true;
      return (
        it.title.toLowerCase().includes(q) ||
        it.kind.startsWith(q) ||
        (it.hint?.toLowerCase().includes(q) ?? false)
      );
    });
    return list.sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "task" ? -1 : 1;
      return a.title.localeCompare(b.title);
    });
  }, [picking, query, items, refs]);

  useEffect(() => {
    setPickIndex(0);
  }, [query, picking]);

  useEffect(() => {
    if (!picking) return;
    const el = listRef.current?.querySelector<HTMLElement>(
      `[data-pick="${pickIndex}"]`,
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [pickIndex, picking, filtered.length]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        if (picking) {
          setPicking(false);
          setQuery("");
          inputRef.current?.focus();
          return;
        }
        onClose();
      }
    }
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [open, onClose, picking]);

  if (!open) return null;

  function submit() {
    const msg = text.trim();
    if ((!msg && refs.length === 0) || busy) return;
    onSubmit(buildOutbound(msg, refs));
    setText("");
    setRefs([]);
    setPicking(false);
    setQuery("");
  }

  function addRef(item: GrokRefItem) {
    setRefs((prev) =>
      prev.some((r) => r.kind === item.kind && r.id === item.id)
        ? prev
        : [...prev, item],
    );
    setPicking(false);
    setQuery("");
    requestAnimationFrame(() => inputRef.current?.focus());
  }

  function removeRef(item: GrokRefItem) {
    setRefs((prev) =>
      prev.filter((r) => !(r.kind === item.kind && r.id === item.id)),
    );
  }

  function onInputKey(e: ReactKeyboardEvent<HTMLInputElement>) {
    if (picking) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (filtered.length)
          setPickIndex((i) => (i + 1) % filtered.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (filtered.length)
          setPickIndex((i) => (i - 1 + filtered.length) % filtered.length);
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        if (filtered[pickIndex]) addRef(filtered[pickIndex]);
        return;
      }
      if (e.key === "Backspace" && query === "") {
        e.preventDefault();
        setPicking(false);
        return;
      }
      return;
    }

    if (e.key === "@") {
      e.preventDefault();
      setPicking(true);
      setQuery("");
      setPickIndex(0);
      return;
    }

    if (e.key === "Backspace" && text === "" && refs.length > 0) {
      e.preventDefault();
      setRefs((prev) => prev.slice(0, -1));
      return;
    }

    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div
      className="pid-overlay fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label="πD assist"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="pid-glass flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[14px] sm:rounded-[14px]">
        <header className="flex items-center gap-2 border-b border-white/5 px-5 py-3">
          <span className="brand-mark brand-mark-ghost text-[15px]" aria-hidden>
            <span className="brand-pi">π</span>D
          </span>
          <span className="text-[12px] text-white/30">
            {busy
              ? "thinking…"
              : ready
                ? source === "pi-oauth"
                  ? "live"
                  : source
                : "offline"}
          </span>
          <span className="ml-auto hidden text-[12px] text-white/25 sm:inline">
            @ pin · ↑↓ · enter ↵ · esc
          </span>
          <button
            type="button"
            onClick={onClose}
            className="ml-auto px-2 py-1 text-[13px] text-white/40 sm:ml-0 sm:hidden"
          >
            close
          </button>
        </header>

        <div className="flex flex-col gap-2.5 px-5 py-4">
          {refs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {refs.map((r) => (
                <button
                  key={`${r.kind}:${r.id}`}
                  type="button"
                  onClick={() => removeRef(r)}
                  title={`${r.kind} · click to remove`}
                  className="group flex max-w-full items-center gap-1.5 border border-white/10 border-l-2 bg-white/5 py-1 pr-1.5 pl-2 text-left transition-colors hover:border-accent/40 hover:bg-white/8"
                  style={{ borderLeftColor: r.color }}
                >
                  <span
                    className="size-2.5 shrink-0 rounded-full"
                    style={{
                      backgroundColor: r.color,
                      boxShadow: `0 0 8px ${r.color}`,
                    }}
                  />
                  <span className="text-[10px] tracking-wide text-white/35 uppercase">
                    {r.kind === "task" ? "t" : "s"}
                  </span>
                  <span className="min-w-0 truncate text-[13px] text-ink">
                    {shortTitle(r.title)}
                  </span>
                  <span className="px-0.5 text-[12px] text-white/25 group-hover:text-accent">
                    ×
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            <span className="select-none text-lg text-accent" aria-hidden>
              ›
            </span>
            {picking ? (
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <span className="text-[17px] text-accent">@</span>
                <input
                  ref={inputRef}
                  value={query}
                  disabled={busy}
                  autoFocus
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={onInputKey}
                  placeholder="filter tasks & sops…"
                  spellCheck={false}
                  className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-white/25 disabled:opacity-50"
                />
              </div>
            ) : (
              <input
                ref={inputRef}
                value={text}
                disabled={busy}
                onChange={(e) => setText(e.target.value)}
                onKeyDown={onInputKey}
                placeholder={
                  ready
                    ? refs.length
                      ? "what about these…"
                      : "ask πD…  @ to pin"
                    : "πD offline — check auth"
                }
                spellCheck={false}
                className="min-w-0 flex-1 bg-transparent text-[17px] text-ink outline-none placeholder:text-white/25 disabled:opacity-50"
              />
            )}
          </div>
        </div>

        {picking && (
          <div
            ref={listRef}
            className="max-h-56 overflow-y-auto border-t border-white/5"
            role="listbox"
            aria-label="Reference picker"
          >
            {filtered.length === 0 ? (
              <p className="px-5 py-3 text-[13px] text-white/30">
                no matches
                {items.length === 0 ? " — board is empty" : ""}
              </p>
            ) : (
              filtered.map((it, i) => {
                const active = i === pickIndex;
                return (
                  <button
                    key={`${it.kind}:${it.id}`}
                    type="button"
                    role="option"
                    aria-selected={active}
                    data-pick={i}
                    onMouseEnter={() => setPickIndex(i)}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      addRef(it);
                    }}
                    className={[
                      "flex w-full items-center gap-2.5 border-l-2 px-5 py-2.5 text-left transition-colors",
                      active ? "bg-white/8" : "hover:bg-white/4",
                    ].join(" ")}
                    style={{ borderLeftColor: it.color }}
                  >
                    <span
                      className="size-3 shrink-0 rounded-full"
                      style={{
                        backgroundColor: it.color,
                        boxShadow: `0 0 ${active ? 10 : 6}px ${it.color}`,
                      }}
                    />
                    <span className="w-10 shrink-0 text-[11px] tracking-wide text-white/35 uppercase">
                      {it.kind}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-[14px] text-ink">
                      {it.title}
                    </span>
                    {it.hint && (
                      <span className="shrink-0 text-[11px] tracking-wide text-white/30 uppercase">
                        {it.hint}
                      </span>
                    )}
                  </button>
                );
              })
            )}
          </div>
        )}

        {(reply || error || busy) && (
          <div className="border-t border-white/5 px-5 py-4">
            {busy && !reply && !error && (
              <p className="text-[14px] text-white/40">working…</p>
            )}
            {error && (
              <p className="text-[14px] text-accent" role="alert">
                {error}
              </p>
            )}
            {reply && !error && (
              <p className="text-[14px] leading-relaxed text-white/70">
                {reply}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Chip label — keep it scannable. */
function shortTitle(title: string, max = 28): string {
  const t = title.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1)}…`;
}

/** Outbound payload: human text + machine refs πD can match to SNAPSHOT ids. */
function buildOutbound(text: string, refs: GrokRefItem[]): string {
  const body = text.trim();
  if (!refs.length) return body;
  const lines = refs.map(
    (r) => `${r.kind}:${r.id} "${r.title.replace(/"/g, "'")}"`,
  );
  const block = `refs:\n${lines.join("\n")}`;
  return body ? `${body}\n\n${block}` : block;
}
