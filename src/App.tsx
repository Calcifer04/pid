import { useEffect, useMemo, useRef, useState } from "react";
import { applyActions } from "./assist/actions";
import {
  fetchAssistStatus,
  loadLocalApiKey,
  runAssist,
  saveLocalApiKey,
} from "./assist/client";
import { BoardView } from "./components/BoardView";
import { CalendarView } from "./components/CalendarView";
import {
  DetailPanel,
  type DetailTarget,
} from "./components/DetailPanel";
import { FocusView } from "./components/FocusView";
import { GrokPanel, type GrokRefItem } from "./components/GrokPanel";
import { SopView } from "./components/SopView";
import { StatusChip } from "./components/StatusChip";
import { TodayView } from "./components/TodayView";
import { WeekView } from "./components/WeekView";
import { cadenceLabel } from "./lib/cadence";
import {
  downloadIcs,
  toIcs,
  upcomingEvents,
} from "./lib/calendar";
import {
  clearFocusRun,
  focusRef,
  pauseFocusRun,
  startFocusRun,
} from "./lib/focus-run";
import {
  fetchGoogleCalendars,
  fetchGoogleStatus,
  selectGoogleCalendar,
  setGoogleAutoSync,
  setGoogleCalendarColor,
  syncGoogleCalendar,
  type GoogleStatus,
} from "./lib/google-client";
import {
  addDays,
  addMonths,
  buildMonthGrid,
  formatDayLabel,
  formatTime,
  parseDateKey,
  routineLogKey,
  toDateKey,
} from "./lib/dates";
import { loadView, saveView } from "./lib/prefs";
import { buildDaySchedule, type ScheduleEntry } from "./lib/schedule";
import {
  exportFile,
  fetchSharedBoard,
  importFile,
  loadLocal,
  newId,
  pickRicher,
  pushSharedBoard,
  saveLocal,
} from "./store";
import type { Board, Cadence, Sop, Task, View } from "./types";
import { PHASE_COLORS, taskColor } from "./types";

export default function App() {
  // Start from local cache so first paint isn't empty; hydrate from disk next.
  const [board, setBoard] = useState<Board>(() => loadLocal());
  const [hydrated, setHydrated] = useState(false);
  const [dataPath, setDataPath] = useState<string | null>(null);
  const [view, setView] = useState<View>(() => loadView("today"));
  const [dayKey, setDayKey] = useState(() => toDateKey());
  const [now, setNow] = useState(() => new Date());
  const [error, setError] = useState<string | null>(null);
  const [assistReply, setAssistReply] = useState<string | null>(null);
  const [assistBusy, setAssistBusy] = useState(false);
  const [assistOn, setAssistOn] = useState(false);
  const [assistSource, setAssistSource] = useState<string>("none");
  const [grokOpen, setGrokOpen] = useState(false);
  const [detail, setDetail] = useState<DetailTarget | null>(null);
  const [gcal, setGcal] = useState<GoogleStatus | null>(null);
  const [gcalBusy, setGcalBusy] = useState(false);
  const dragRef = useRef<{ kind: "task" | "sop"; id: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const assistAbort = useRef<AbortController | null>(null);
  const skipPush = useRef(true);
  const deskBoot = useRef(false);
  const gcalBoot = useRef(false);

  const realToday = toDateKey(now);
  const mondayKey = useMemo(() => startOfWeekMonday(dayKey), [dayKey]);

  // Desktop / deep-link: ?g=1 opens assist, ?q= pre-fills and sends once hydrated.
  useEffect(() => {
    if (deskBoot.current || !hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const openG = params.has("g") || params.get("assist") === "1";
    const q = params.get("q")?.trim() ?? params.get("query")?.trim() ?? "";
    if (!openG && !q) return;
    deskBoot.current = true;
    setGrokOpen(true);
    // strip query so refresh doesn't re-fire
    window.history.replaceState({}, "", window.location.pathname);
    if (q) {
      void (async () => {
        setAssistBusy(true);
        setError(null);
        setAssistReply(null);
        try {
          const { reply, actions } = await runAssist({
            message: q,
            board,
            dayKey,
            view,
          });
          if (actions.length) {
            const result = applyActions(board, actions);
            setBoard(result.board);
            setAssistReply(
              result.rejected.length
                ? `${reply} · ${result.rejected.length} skipped`
                : reply || `${result.applied.length} change(s)`,
            );
          } else {
            setAssistReply(reply || "no changes");
          }
          setAssistOn(true);
        } catch (e) {
          setError(e instanceof Error ? e.message : "assist failed");
          setAssistOn(false);
        } finally {
          setAssistBusy(false);
        }
      })();
    }
  }, [hydrated, board, dayKey, view]);

  // Shared file on disk (via Vite) so Zen / Chrome / wmux all see the same board.
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const local = loadLocal();
      const remote = await fetchSharedBoard();
      if (cancelled) return;
      if (remote) {
        const merged = pickRicher(remote.board, local);
        setBoard(merged);
        setDataPath(remote.path);
        saveLocal(merged);
        // If browser cache was richer (e.g. Infloww only in wmux), lift it to disk.
        if (pickRicher(merged, remote.board) === merged) {
          void pushSharedBoard(merged);
        }
      } else {
        // Server down — stay on localStorage only.
        setBoard(local);
        setDataPath(null);
      }
      setHydrated(true);
      // Don't echo the hydrate write as a user edit.
      skipPush.current = true;
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Drive chrome accent from board.theme (rgb cycle by default).
  useEffect(() => {
    const accent = board.theme?.accent?.trim() || "rgb";
    const root = document.documentElement;
    if (accent === "rgb") {
      root.dataset.accent = "rgb";
      root.style.removeProperty("--color-accent");
    } else {
      root.dataset.accent = "static";
      root.style.setProperty("--color-accent", accent);
    }
  }, [board.theme?.accent]);

  useEffect(() => {
    if (!hydrated) return;
    saveLocal(board);
    if (skipPush.current) {
      skipPush.current = false;
      return;
    }
    const t = window.setTimeout(() => {
      void pushSharedBoard(board).then((ok) => {
        if (!ok) {
          /* file API optional when offline; local cache still holds */
        }
      });
      // Auto-push dated items into the chosen Google calendar.
      if (gcal?.connected && gcal.calendarId && gcal.autoSync) {
        void syncGoogleCalendar(21)
          .then((r) => {
            setGcal((s) =>
              s
                ? {
                    ...s,
                    lastSyncAt: Date.now(),
                    lastSyncCount: r.total,
                    lastError: null,
                  }
                : s,
            );
          })
          .catch(() => {
            /* status bar only on manual sync */
          });
      }
    }, 250);
    return () => window.clearTimeout(t);
  }, [board, hydrated, gcal?.connected, gcal?.calendarId, gcal?.autoSync]);
  useEffect(() => {
    saveView(view);
  }, [view]);
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => {
    void fetchAssistStatus()
      .then((s) => {
        setAssistOn(s.configured);
        setAssistSource(s.source ?? (s.configured ? "unknown" : "none"));
      })
      .catch(() => {
        setAssistOn(false);
        setAssistSource("none");
      });
    void fetchGoogleStatus().then(setGcal);
  }, []);

  // OAuth return: /?gcal=connected|error
  useEffect(() => {
    if (gcalBoot.current || !hydrated) return;
    const params = new URLSearchParams(window.location.search);
    const g = params.get("gcal");
    if (!g) return;
    gcalBoot.current = true;
    window.history.replaceState({}, "", window.location.pathname);
    void fetchGoogleStatus().then((s) => {
      setGcal(s);
      if (g === "connected") {
        setAssistReply("google calendar connected — pick a calendar (gcal)");
        setError(null);
      } else {
        setError(params.get("msg") || "google auth failed");
      }
    });
  }, [hydrated]);

  const day = useMemo(
    () => buildDaySchedule(board, dayKey),
    [board, dayKey],
  );

  const weekDays = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const key = addDays(mondayKey, i);
      // Agenda mode: no daily SOP spam — next-due / sparse only.
      const d = buildDaySchedule(board, key, "agenda");
      return { dateKey: key, timed: d.timed, anytime: d.anytime };
    });
  }, [board, mondayKey]);

  const monthCells = useMemo(() => buildMonthGrid(dayKey), [dayKey]);

  const monthDays = useMemo(() => {
    const map: Record<
      string,
      { timed: ReturnType<typeof buildDaySchedule>["timed"]; anytime: ReturnType<typeof buildDaySchedule>["anytime"] }
    > = {};
    for (const cell of monthCells) {
      map[cell.dateKey] = buildDaySchedule(board, cell.dateKey, "agenda");
    }
    return map;
  }, [board, monthCells]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  const grokItems = useMemo<GrokRefItem[]>(() => {
    const phaseName = (id: string) =>
      board.phases.find((p) => p.id === id)?.name;
    const tasks: GrokRefItem[] = board.tasks.map((t) => ({
      kind: "task",
      id: t.id,
      title: t.title,
      hint: phaseName(t.phaseId),
      color: taskColor(t),
    }));
    const sops: GrokRefItem[] = board.sops.map((s) => ({
      kind: "sop",
      id: s.id,
      title: s.title,
      hint: cadenceLabel(s.cadence),
      color: s.color,
    }));
    return [...tasks, ...sops];
  }, [board.tasks, board.sops, board.phases]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      // Ctrl/Cmd+G always opens Grok glass (even from an input).
      if ((e.ctrlKey || e.metaKey) && (e.key === "g" || e.key === "G")) {
        e.preventDefault();
        setError(null);
        setAssistReply(null);
        setGrokOpen(true);
        return;
      }

      if (isTypingTarget(e.target)) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      // Bare `g` opens the glass panel when not typing.
      if (e.key === "g" || e.key === "G") {
        e.preventDefault();
        setError(null);
        setAssistReply(null);
        setGrokOpen(true);
        return;
      }

      const order: View[] = [
        "focus",
        "today",
        "week",
        "calendar",
        "sop",
        "board",
      ];

      if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const i = order.indexOf(view);
        const at = i < 0 ? 0 : i;
        const next =
          e.key === "ArrowRight"
            ? order[(at + 1) % order.length]
            : order[(at - 1 + order.length) % order.length];
        setView(next);
        return;
      }

      if (e.key === "0" || e.key === "f" || e.key === "F") {
        e.preventDefault();
        setView("focus");
      } else if (e.key === "1") {
        e.preventDefault();
        setView("today");
      } else if (e.key === "2") {
        e.preventDefault();
        setView("week");
      } else if (e.key === "3") {
        e.preventDefault();
        setView("calendar");
      } else if (e.key === "4") {
        e.preventDefault();
        setView("sop");
      } else if (e.key === "5") {
        e.preventDefault();
        setView("board");
      } else if (e.key === " ") {
        if (view !== "focus") return;
        e.preventDefault();
        setBoard((b) => {
          if (!b.focusRun?.targetId && !b.focusId) return b;
          if (b.focusRun?.startedAt != null) return pauseFocusRun(b);
          const target = b.focusRun?.targetId ?? b.focusId;
          if (!target) return b;
          return startFocusRun(b, target);
        });
      } else if (e.key === "[") {
        if (view !== "today" && view !== "week" && view !== "calendar") return;
        e.preventDefault();
        setDayKey((d) =>
          view === "calendar"
            ? addMonths(d, -1)
            : addDays(d, view === "week" ? -7 : -1),
        );
      } else if (e.key === "]") {
        if (view !== "today" && view !== "week" && view !== "calendar") return;
        e.preventDefault();
        setDayKey((d) =>
          view === "calendar"
            ? addMonths(d, 1)
            : addDays(d, view === "week" ? 7 : 1),
        );
      } else if (e.key === "t" || e.key === "T") {
        if (view !== "today" && view !== "week" && view !== "calendar") return;
        e.preventDefault();
        setDayKey(toDateKey());
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [view]);

  async function commitAssist(message: string) {
    if (!message) return;
    assistAbort.current?.abort();
    const ac = new AbortController();
    assistAbort.current = ac;
    setAssistBusy(true);
    setError(null);
    setAssistReply(null);
    try {
      const { reply, actions } = await runAssist(
        { message, board, dayKey, view },
        ac.signal,
      );
      if (actions.length) {
        const result = applyActions(board, actions);
        setBoard(result.board);
        setAssistReply(
          result.rejected.length
            ? `${reply} · ${result.rejected.length} skipped`
            : reply || `${result.applied.length} change(s)`,
        );
      } else {
        setAssistReply(reply || "no changes");
      }
      setAssistOn(true);
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      setError(e instanceof Error ? e.message : "assist failed");
      setAssistOn(false);
    } finally {
      setAssistBusy(false);
    }
  }

  function renameTask(id: string, title: string) {
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => (t.id === id ? { ...t, title } : t)),
    }));
  }

  function patchTask(id: string, patch: Partial<Task>) {
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.map((t) => {
        if (t.id !== id) return t;
        const next = { ...t, ...patch };
        // Explicit clear — undefined from picker means inherit phase again.
        if ("color" in patch && patch.color === undefined) delete next.color;
        return next;
      }),
    }));
  }

  function patchSop(id: string, patch: Partial<Sop>) {
    setBoard((b) => ({
      ...b,
      sops: b.sops.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    }));
  }

  function openEntry(entry: ScheduleEntry) {
    setDetail({ kind: entry.kind, id: entry.id });
  }

  function deleteTask(id: string) {
    setBoard((b) => {
      const ref = focusRef("task", id);
      const clearing =
        b.focusId === ref || b.focusRun?.targetId === ref;
      return {
        ...b,
        tasks: b.tasks.filter((t) => t.id !== id),
        focusId: clearing ? undefined : b.focusId,
        focusRun: clearing ? undefined : b.focusRun,
      };
    });
  }

  function toggleTaskDone(id: string) {
    setBoard((b) => {
      const tasks = b.tasks.map((t) =>
        t.id === id ? { ...t, done: !t.done } : t,
      );
      const t = tasks.find((x) => x.id === id);
      const ref = focusRef("task", id);
      // Completing the focused task ends the run.
      if (t?.done && (b.focusId === ref || b.focusRun?.targetId === ref)) {
        return {
          ...b,
          tasks,
          focusId: undefined,
          focusRun: undefined,
        };
      }
      return { ...b, tasks };
    });
  }

  function beginFocus(kind: "task" | "sop", id: string) {
    setBoard((b) => startFocusRun(b, focusRef(kind, id)));
    setView("focus");
    setDetail(null);
  }

  function pauseFocus() {
    setBoard((b) => pauseFocusRun(b));
  }

  function resumeFocus() {
    setBoard((b) => {
      const target = b.focusRun?.targetId ?? b.focusId;
      if (!target) return b;
      return startFocusRun(b, target);
    });
  }

  function clearFocus() {
    setBoard((b) => clearFocusRun(b));
  }

  function completeFocus() {
    setBoard((b) => {
      const target = b.focusRun?.targetId ?? b.focusId;
      if (!target) return clearFocusRun(b);
      let next = clearFocusRun(b);
      if (target.startsWith("task:")) {
        const id = target.slice(5);
        next = {
          ...next,
          tasks: next.tasks.map((t) =>
            t.id === id ? { ...t, done: true } : t,
          ),
        };
      } else if (target.startsWith("sop:")) {
        const id = target.slice(4);
        next = {
          ...next,
          sopLog: {
            ...next.sopLog,
            [routineLogKey(id, dayKey)]: Date.now(),
          },
        };
      }
      return next;
    });
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
        ...b,
        phases: b.phases.filter((p) => p.id !== id),
        tasks: b.tasks.map((t) =>
          t.phaseId === id ? { ...t, phaseId: fallback.id } : t,
        ),
      };
    });
  }

  function placeSopOnBoard(
    b: Board,
    sopId: string,
    phaseId: string,
    date = dayKey,
  ): Board {
    const key = `${sopId}:${date}`;
    return {
      ...b,
      // Remember preferred home column for next time it's due.
      sops: b.sops.map((s) =>
        s.id === sopId ? { ...s, phaseId } : s,
      ),
      sopPlace: { ...(b.sopPlace ?? {}), [key]: phaseId },
    };
  }

  function dropInPhase(nextPhaseId: string) {
    const drag = dragRef.current;
    if (!drag) return;
    if (drag.kind === "task") {
      setBoard((b) => {
        const moving = b.tasks.find((t) => t.id === drag.id);
        if (!moving) return b;
        const rest = b.tasks.filter((t) => t.id !== drag.id);
        return {
          ...b,
          tasks: [...rest, { ...moving, phaseId: nextPhaseId }],
        };
      });
    } else {
      setBoard((b) => placeSopOnBoard(b, drag.id, nextPhaseId));
    }
    dragRef.current = null;
  }

  function dropBefore(kind: "task" | "sop", targetId: string) {
    const drag = dragRef.current;
    if (!drag || (drag.kind === kind && drag.id === targetId)) return;

    if (drag.kind === "task" && kind === "task") {
      setBoard((b) => {
        const moving = b.tasks.find((t) => t.id === drag.id);
        const target = b.tasks.find((t) => t.id === targetId);
        if (!moving || !target) return b;
        const rest = b.tasks.filter((t) => t.id !== drag.id);
        const at = rest.findIndex((t) => t.id === targetId);
        const next = [...rest];
        next.splice(at, 0, { ...moving, phaseId: target.phaseId });
        return { ...b, tasks: next };
      });
    } else if (drag.kind === "sop") {
      // Land the SOP on the target's column (task or sop).
      setBoard((b) => {
        let phaseId: string | undefined;
        if (kind === "task") {
          phaseId = b.tasks.find((t) => t.id === targetId)?.phaseId;
        } else {
          const targetSop = b.sops.find((s) => s.id === targetId);
          if (targetSop) {
            const key = `${targetId}:${dayKey}`;
            phaseId =
              b.sopPlace?.[key] ??
              targetSop.phaseId ??
              b.phases[0]?.id;
          }
        }
        if (!phaseId) return b;
        return placeSopOnBoard(b, drag.id, phaseId);
      });
    } else if (drag.kind === "task" && kind === "sop") {
      setBoard((b) => {
        const moving = b.tasks.find((t) => t.id === drag.id);
        if (!moving) return b;
        const targetSop = b.sops.find((s) => s.id === targetId);
        if (!targetSop) return b;
        const key = `${targetId}:${dayKey}`;
        const phaseId =
          b.sopPlace?.[key] ?? targetSop.phaseId ?? b.phases[0]?.id;
        if (!phaseId) return b;
        const rest = b.tasks.filter((t) => t.id !== drag.id);
        return {
          ...b,
          tasks: [...rest, { ...moving, phaseId }],
        };
      });
    }
    dragRef.current = null;
  }

  function toggleSopDoneOnDay(id: string, onDate = dayKey) {
    const key = routineLogKey(id, onDate);
    setBoard((b) => {
      const log = { ...b.sopLog };
      const turningDone = !log[key];
      if (turningDone) log[key] = Date.now();
      else delete log[key];

      let next: Board = { ...b, sopLog: log };
      if (turningDone) {
        const donePhase = b.phases.find(
          (p) => p.name.toLowerCase() === "done",
        );
        if (donePhase) next = placeSopOnBoard(next, id, donePhase.id, onDate);
      }
      return next;
    });
  }

  function toggleSchedule(entry: ScheduleEntry, onDate = dayKey) {
    if (entry.kind === "task") {
      toggleTaskDone(entry.id);
      return;
    }
    toggleSopDoneOnDay(entry.id, onDate);
  }

  function renameSchedule(entry: ScheduleEntry, title: string) {
    if (entry.kind === "task") renameTask(entry.id, title);
    else {
      setBoard((b) => ({
        ...b,
        sops: b.sops.map((s) => (s.id === entry.id ? { ...s, title } : s)),
      }));
    }
  }

  function setScheduleTime(entry: ScheduleEntry, time: string | undefined) {
    if (entry.kind === "task") {
      setBoard((b) => ({
        ...b,
        tasks: b.tasks.map((t) =>
          t.id === entry.id ? { ...t, dueTime: time } : t,
        ),
      }));
    } else {
      setBoard((b) => ({
        ...b,
        sops: b.sops.map((s) =>
          s.id === entry.id ? { ...s, time } : s,
        ),
      }));
    }
  }

  function clearDoneForDay() {
    setBoard((b) => ({
      ...b,
      tasks: b.tasks.filter((t) => {
        if (!t.done) return true;
        // Dated completions for the viewed day.
        if (t.dueDate === dayKey) return false;
        // Undated work parked on today/doing only clears on real today.
        if (!t.dueDate && dayKey === realToday) {
          const phase = b.phases.find((p) => p.id === t.phaseId);
          const n = phase?.name.toLowerCase();
          if (n === "today" || n === "doing") return false;
        }
        return true;
      }),
    }));
  }

  function toggleSopEnabled(id: string) {
    setBoard((b) => ({
      ...b,
      sops: b.sops.map((s) =>
        s.id === id ? { ...s, enabled: !s.enabled } : s,
      ),
    }));
  }

  function setSopCadence(id: string, cadence: Cadence) {
    setBoard((b) => ({
      ...b,
      sops: b.sops.map((s) => (s.id === id ? { ...s, cadence } : s)),
    }));
  }

  function deleteSop(id: string) {
    setBoard((b) => {
      const log = { ...b.sopLog };
      for (const k of Object.keys(log)) {
        if (k.startsWith(`${id}:`)) delete log[k];
      }
      const place = { ...(b.sopPlace ?? {}) };
      for (const k of Object.keys(place)) {
        if (k.startsWith(`${id}:`)) delete place[k];
      }
      return {
        ...b,
        sops: b.sops.filter((s) => s.id !== id),
        sopLog: log,
        sopPlace: place,
      };
    });
  }

  async function onPickFile(file: File | undefined) {
    if (!file) return;
    try {
      setBoard(await importFile(file));
      setError(null);
    } catch {
      setError("that file is not a πD board. nothing was changed.");
    }
    if (fileRef.current) fileRef.current.value = "";
  }

  async function onGcalClick(e?: {
    shiftKey?: boolean;
    altKey?: boolean;
    ctrlKey?: boolean;
    metaKey?: boolean;
  }) {
    const shift = Boolean(e?.shiftKey);
    const alt = Boolean(e?.altKey);
    const ctrl = Boolean(e?.ctrlKey || e?.metaKey);

    // Connected shortcuts first (before bare shift→ICS)
    if (gcal?.configured && gcal.connected && gcal.calendarId) {
      // Recolor sidebar
      if (shift && alt) {
        const pick = window.prompt(
          "Calendar SIDEBAR color only (not task dots).\nGoogle always needs one — use gray so event/task colors stand out.\n\n#b8b8b8 neutral · #2ee6d6 cyan · #ffb454 amber · #030304 near-black",
          "#b8b8b8",
        );
        if (pick == null || !pick.trim()) return;
        const color = pick.trim().startsWith("#")
          ? pick.trim()
          : `#${pick.trim()}`;
        try {
          await setGoogleCalendarColor(color);
          setAssistReply(`gcal · sidebar color ${color}`);
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "color failed");
        }
        return;
      }
      // Toggle auto-sync
      if (ctrl && !alt && !shift) {
        try {
          const next = !gcal.autoSync;
          await setGoogleAutoSync(next);
          setGcal({ ...gcal, autoSync: next });
          setAssistReply(
            next
              ? "gcal auto-sync on — board saves push to Google"
              : "gcal auto-sync off",
          );
          setError(null);
        } catch (err) {
          setError(err instanceof Error ? err.message : "auto-sync failed");
        }
        return;
      }
    }

    // ICS dump (no OAuth or explicit shift without alt)
    if ((shift && !alt) || !gcal?.configured) {
      const events = upcomingEvents(board, 21);
      downloadIcs("pid-upcoming.ics", toIcs(events));
      setAssistReply(
        events.length
          ? `ics · ${events.length} events downloaded`
          : "ics · nothing dated in the next 21 days",
      );
      setError(null);
      return;
    }

    if (!gcal.connected) {
      window.location.href = "/api/google/auth";
      return;
    }

    // Pick / change calendar
    if ((alt && !shift) || !gcal.calendarId) {
      setGcalBusy(true);
      try {
        const list = await fetchGoogleCalendars();
        if (!list.length) {
          setError("no writable google calendars");
          return;
        }
        const lines = list
          .map(
            (c, i) =>
              `${i + 1}. ${c.summary}${c.primary ? " (primary)" : ""}`,
          )
          .join("\n");
        const pick = window.prompt(
          `Google calendar number (or paste id):\n\n${lines}`,
          gcal.calendarId ||
            String(list.findIndex((c) => c.primary) + 1 || 1),
        );
        if (pick == null || !pick.trim()) return;
        const trimmed = pick.trim();
        const asNum = Number(trimmed);
        const chosen =
          Number.isFinite(asNum) && asNum >= 1 && asNum <= list.length
            ? list[asNum - 1]
            : list.find((c) => c.id === trimmed);
        if (!chosen) {
          setError("unknown calendar");
          return;
        }
        // Neutral sidebar so per-task event colors read clearly in Google
        await selectGoogleCalendar(
          chosen.id,
          chosen.summary,
          gcal.autoSync,
          "#b8b8b8",
        );
        setGcal({
          ...gcal,
          calendarId: chosen.id,
          calendarSummary: chosen.summary,
        });
        setAssistReply(
          `gcal · using ${chosen.summary} (neutral sidebar — task colors on events; shift+alt+gcal to change sidebar)`,
        );
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "calendar list failed");
      } finally {
        setGcalBusy(false);
      }
      return;
    }

    // Sync now
    setGcalBusy(true);
    try {
      const r = await syncGoogleCalendar(21);
      setGcal({
        ...gcal,
        lastSyncAt: Date.now(),
        lastSyncCount: r.total,
        lastError: null,
      });
      setAssistReply(
        `gcal · ${r.total} events (${r.created} new, ${r.updated} updated) → ${gcal.calendarSummary || "calendar"}`,
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "sync failed");
    } finally {
      setGcalBusy(false);
    }
  }

  const views: { id: View; label: string; key: string }[] = [
    { id: "focus", label: "focus", key: "0" },
    { id: "today", label: "today", key: "1" },
    { id: "week", label: "week", key: "2" },
    { id: "calendar", label: "cal", key: "3" },
    { id: "sop", label: "sop", key: "4" },
    { id: "board", label: "board", key: "5" },
  ];

  const action =
    "px-2.5 py-2 text-[13px] text-muted transition-colors hover:bg-card-hi hover:text-accent";

  const doneDay =
    day.timed.filter((e) => e.done).length +
    day.anytime.filter((e) => e.done).length;
  const totalDay = day.timed.length + day.anytime.length;

  const dayEntries = [...day.timed, ...day.anytime];
  const sopDue = dayEntries.filter((e) => e.kind === "sop");
  const sopDueDone = sopDue.filter((e) => e.done).length;
  const sopEnabled = board.sops.filter((s) => s.enabled).length;
  // One-shots on *this day* only — whole-board backlog isn't a completion metric.
  const tasksToday = dayEntries.filter((e) => e.kind === "task");
  const tasksTodayDone = tasksToday.filter((e) => e.done).length;

  const colToday = "var(--color-accent)";
  const colSop = "#2ee6d6";
  const colTasks = "#ffb454";

  return (
    <div className="pid-shell flex h-full flex-col bg-ground">
      <GrokPanel
        open={grokOpen}
        busy={assistBusy}
        ready={assistOn}
        source={assistSource}
        reply={assistReply}
        error={error}
        items={grokItems}
        onClose={() => setGrokOpen(false)}
        onSubmit={(msg) => {
          void commitAssist(msg);
        }}
      />

      <nav className="pid-nav flex items-center gap-0.5 overflow-x-auto border-b border-line px-2 py-1.5 sm:gap-1 sm:px-4 sm:py-2">
        {views.map((v) => {
          const active = view === v.id;
          return (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              className={[
                "shrink-0 px-2.5 py-2.5 text-[13px] tracking-wide uppercase transition-colors sm:py-1.5",
                active
                  ? view === "focus"
                    ? "bg-card-hi text-ink"
                    : "bg-card-hi text-accent"
                  : "text-faint hover:text-muted",
              ].join(" ")}
            >
              <span className="mr-1.5 hidden text-[12px] text-faint tabular-nums sm:inline">
                {v.key}
              </span>
              {v.label}
            </button>
          );
        })}
      </nav>

      <div className="relative flex min-h-0 flex-1 flex-col md:flex-row">
        <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-auto">
          {view === "focus" && (
            <FocusView
              board={board}
              onStart={beginFocus}
              onPause={pauseFocus}
              onResume={resumeFocus}
              onDone={completeFocus}
              onClear={clearFocus}
              onOpenDetail={(kind, id) => setDetail({ kind, id })}
              onPickFromToday={() => setView("today")}
            />
          )}
          {view === "today" && (
            <TodayView
              dateKey={dayKey}
              timed={day.timed}
              anytime={day.anytime}
              nowMinutes={dayKey === realToday ? nowMinutes : null}
              onPrevDay={() => setDayKey((d) => addDays(d, -1))}
              onNextDay={() => setDayKey((d) => addDays(d, 1))}
              onToday={() => setDayKey(toDateKey())}
              onToggle={(e) => toggleSchedule(e, dayKey)}
              onOpen={openEntry}
              onRename={renameSchedule}
              onSetTime={setScheduleTime}
              onDeleteTask={deleteTask}
              onClearDone={clearDoneForDay}
            />
          )}
          {view === "week" && (
            <WeekView
              mondayKey={mondayKey}
              days={weekDays}
              onSelectDay={(key) => {
                setDayKey(key);
                setView("today");
              }}
              onToggle={(date, entry) => toggleSchedule(entry, date)}
              onOpen={openEntry}
              onRename={renameSchedule}
              onSetTime={setScheduleTime}
              onDeleteTask={deleteTask}
            />
          )}
          {view === "calendar" && (
            <CalendarView
              monthKey={dayKey}
              cells={monthCells}
              days={monthDays}
              onSelectDay={(key) => {
                setDayKey(key);
                setView("today");
              }}
              onPrevMonth={() => setDayKey((d) => addMonths(d, -1))}
              onNextMonth={() => setDayKey((d) => addMonths(d, 1))}
              onThisMonth={() => setDayKey(toDateKey())}
            />
          )}
          {view === "sop" && (
            <SopView
              sops={board.sops}
              sopLog={board.sopLog}
              onToggleEnabled={toggleSopEnabled}
              onSetCadence={setSopCadence}
              onDelete={deleteSop}
              onOpen={(id) => setDetail({ kind: "sop", id })}
            />
          )}
          {view === "board" && (
            <BoardView
              board={board}
              dayKey={dayKey}
              onAddPhase={addPhase}
              onRenameTask={renameTask}
              onDeleteTask={deleteTask}
              onToggleTaskDone={toggleTaskDone}
              onToggleSopDone={(id) => toggleSopDoneOnDay(id, dayKey)}
              onOpenTask={(id) => setDetail({ kind: "task", id })}
              onOpenSop={(id) => setDetail({ kind: "sop", id })}
              onRenamePhase={renamePhase}
              onDeletePhase={deletePhase}
              onDragStart={(kind, id) => {
                dragRef.current = { kind, id };
              }}
              onDropInPhase={dropInPhase}
              onDropBefore={dropBefore}
            />
          )}
        </main>

        {detail && (
          <>
            <button
              type="button"
              className="detail-backdrop"
              aria-label="Close detail"
              onClick={() => setDetail(null)}
            />
            <DetailPanel
              target={detail}
              task={
                detail.kind === "task"
                  ? board.tasks.find((t) => t.id === detail.id)
                  : undefined
              }
              sop={
                detail.kind === "sop"
                  ? board.sops.find((s) => s.id === detail.id)
                  : undefined
              }
              phases={board.phases}
              onClose={() => setDetail(null)}
              onPatchTask={patchTask}
              onPatchSop={patchSop}
              onDeleteTask={(id) => {
                deleteTask(id);
                setDetail(null);
              }}
              onDeleteSop={(id) => {
                deleteSop(id);
                setDetail(null);
              }}
              onToggleTaskDone={toggleTaskDone}
              onToggleSopDone={(id) => toggleSopDoneOnDay(id, dayKey)}
              onStartFocus={beginFocus}
            />
          </>
        )}
      </div>

      {(error || assistReply) && (
        <p
          role={error ? "alert" : "status"}
          className={[
            "mx-4 mb-2 border bg-pane px-3 py-1.5 text-[11px]",
            error
              ? "border-accent/50 text-accent shadow-[0_0_12px_-4px_var(--color-accent)]"
              : "border-line text-muted",
          ].join(" ")}
        >
          {error ?? (
            <>
              <span className="brand-mark brand-mark-ghost mr-2 text-[12px]">
                <span className="brand-pi">π</span>D
              </span>
              {assistReply}
            </>
          )}
        </p>
      )}

      <footer className="pid-footer flex shrink-0 flex-wrap items-center gap-y-1 border-t border-line bg-pane text-[13px]">
        <button
          type="button"
          className="brand-mark brand-mark-fill text-[14px]"
          title={
            dataPath
              ? `πD · ${dataPath} · shift-click for API key`
              : "πD · browser cache · shift-click for API key"
          }
          onClick={(e) => {
            if (!e.shiftKey) return;
            const next = window.prompt(
              "Optional API key fallback (browser only). Empty clears key.",
              loadLocalApiKey() ? "••••••••" : "",
            );
            if (next === null) return;
            if (next.trim() === "••••••••") return;
            saveLocalApiKey(next);
            void fetchAssistStatus()
              .then((s) => {
                setAssistOn(s.configured);
                setAssistSource(
                  s.source ?? (s.configured ? "unknown" : "none"),
                );
              })
              .catch(() => {
                setAssistOn(Boolean(loadLocalApiKey()));
                setAssistSource(loadLocalApiKey() ? "header-key" : "none");
              });
            setAssistReply(
              next.trim() ? "api key saved as fallback" : "api key cleared",
            );
            setError(null);
          }}
        >
          <span className="brand-pi">π</span>D
        </button>

        <div className="flex items-center gap-1 overflow-x-auto px-2">
          <StatusChip
            label={formatDayLabel(dayKey)}
            frac={totalDay > 0 ? doneDay / totalDay : 0}
            color={colToday}
            active={view === "today"}
            title={
              totalDay > 0
                ? `today ${doneDay}/${totalDay} done`
                : "today — nothing scheduled"
            }
            onClick={() => {
              setDayKey(toDateKey());
              setView("today");
            }}
          />
          <StatusChip
            label="sop"
            frac={sopDue.length > 0 ? sopDueDone / sopDue.length : 0}
            color={colSop}
            active={view === "sop"}
            title={
              sopDue.length > 0
                ? `sops ${sopDueDone}/${sopDue.length} due today · ${sopEnabled} enabled`
                : sopEnabled
                  ? `${sopEnabled} sops · none due today`
                  : "no sops"
            }
            onClick={() => setView("sop")}
          />
          <StatusChip
            label="tasks"
            frac={
              tasksToday.length > 0
                ? tasksTodayDone / tasksToday.length
                : 0
            }
            color={colTasks}
            active={view === "board"}
            title={
              tasksToday.length > 0
                ? `tasks today ${tasksTodayDone}/${tasksToday.length} done`
                : "no one-shot tasks on this day"
            }
            onClick={() => setView("board")}
          />
        </div>

        <div className="ml-auto flex items-center">
          <span
            className="px-3 text-[13px] tabular-nums text-accent"
            style={{
              textShadow:
                "0 0 12px color-mix(in srgb, var(--color-accent) 55%, transparent)",
            }}
            title={assistBusy ? "πD thinking…" : assistOn ? `πD · ${assistSource}` : "πD offline"}
          >
            {formatTime(
              `${now.getHours().toString().padStart(2, "0")}:${now
                .getMinutes()
                .toString()
                .padStart(2, "0")}`,
            )}
          </span>
          <button
            type="button"
            disabled={gcalBusy}
            onClick={(ev) => void onGcalClick(ev)}
            className={action}
            title={
              gcal?.connected && gcal.calendarId
                ? `Sync → ${gcal.calendarSummary || gcal.calendarId}\nclick=sync · alt=pick · ctrl=auto · shift+alt=sidebar color · shift=ICS`
                : gcal?.configured
                  ? "Connect / set up Google Calendar"
                  : "ICS export (set GOOGLE_CLIENT_* in .env.local for auto-sync)"
            }
          >
            {gcalBusy
              ? "gcal…"
              : gcal?.connected && gcal.calendarId
                ? gcal.autoSync
                  ? "gcal·auto"
                  : "gcal·sync"
                : "gcal"}
          </button>
          <button
            type="button"
            onClick={() => exportFile(board)}
            className={`${action} pid-footer-extra`}
          >
            export
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className={`${action} pid-footer-extra`}
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
      </footer>
    </div>
  );
}

function startOfWeekMonday(key: string): string {
  const d = parseDateKey(key);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return toDateKey(d);
}

function isTypingTarget(t: EventTarget | null): boolean {
  if (!(t instanceof HTMLElement)) return false;
  const tag = t.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || t.isContentEditable;
}
