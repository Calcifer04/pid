import type { View } from "../types";

const VIEW_KEY = "routine.view";
const PHASE_KEY = "routine.capturePhase";

const VIEWS: View[] = ["focus", "today", "week", "calendar", "sop", "board"];

export function loadView(fallback: View = "today"): View {
  try {
    const v = localStorage.getItem(VIEW_KEY);
    // migrate old "routines" → sop
    if (v === "routines") return "sop";
    if (v && (VIEWS as string[]).includes(v)) return v as View;
  } catch {
    /* ignore */
  }
  return fallback;
}

export function saveView(view: View): void {
  try {
    localStorage.setItem(VIEW_KEY, view);
  } catch {
    /* ignore */
  }
}

export function loadPhaseId(fallback: string): string {
  try {
    return localStorage.getItem(PHASE_KEY) ?? fallback;
  } catch {
    return fallback;
  }
}

export function savePhaseId(id: string): void {
  try {
    localStorage.setItem(PHASE_KEY, id);
  } catch {
    /* ignore */
  }
}
