import type { Board, View } from "../types";
import type { Action } from "./actions";

const KEY_STORAGE = "routine.xaiKey";

export type AssistStatus = {
  configured: boolean;
  model: string;
  /** pi-oauth | env-key | header-key | none */
  source?: string;
  /** true if only browser-stored key */
  localKey?: boolean;
};

export type AssistRequest = {
  message: string;
  board: Board;
  dayKey: string;
  view: View;
};

export type AssistResponse = {
  reply: string;
  actions: Action[];
};

export function loadLocalApiKey(): string {
  try {
    return localStorage.getItem(KEY_STORAGE)?.trim() ?? "";
  } catch {
    return "";
  }
}

export function saveLocalApiKey(key: string): void {
  try {
    const k = key.trim();
    if (k) localStorage.setItem(KEY_STORAGE, k);
    else localStorage.removeItem(KEY_STORAGE);
  } catch {
    /* ignore */
  }
}

export async function fetchAssistStatus(): Promise<AssistStatus> {
  const res = await fetch("/api/assist", { method: "GET" });
  if (!res.ok) throw new Error(`assist status ${res.status}`);
  const s = (await res.json()) as AssistStatus;
  const local = Boolean(loadLocalApiKey());
  const configured = s.configured || local;
  return {
    ...s,
    configured,
    source: s.configured ? s.source : local ? "header-key" : s.source ?? "none",
    localKey: !s.configured && local,
  };
}

export async function runAssist(
  req: AssistRequest,
  signal?: AbortSignal,
): Promise<AssistResponse> {
  const headers: Record<string, string> = {
    "content-type": "application/json",
  };
  const local = loadLocalApiKey();
  if (local) headers["x-routine-xai-key"] = local;

  const res = await fetch("/api/assist", {
    method: "POST",
    headers,
    body: JSON.stringify(req),
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    reply?: string;
    actions?: Action[];
    error?: string;
  };
  if (!res.ok) {
    throw new Error(body.error || `assist failed (${res.status})`);
  }
  return {
    reply: body.reply ?? "",
    actions: Array.isArray(body.actions) ? body.actions : [],
  };
}

/** Capture lines that should go to Grok instead of the local parser. */
export function isAssistCapture(raw: string): boolean {
  return /^(g|grok|ask)\s+/i.test(raw.trim());
}

export function stripAssistPrefix(raw: string): string {
  return raw.trim().replace(/^(g|grok|ask)\s+/i, "").trim();
}
