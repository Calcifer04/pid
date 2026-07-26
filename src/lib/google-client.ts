export type GoogleStatus = {
  configured: boolean;
  connected: boolean;
  calendarId: string | null;
  calendarSummary: string | null;
  autoSync: boolean;
  lastSyncAt: number | null;
  lastSyncCount: number | null;
  lastError: string | null;
  authUrl: string | null;
};

export type GoogleCalendar = {
  id: string;
  summary: string;
  primary: boolean;
};

export async function fetchGoogleStatus(): Promise<GoogleStatus | null> {
  try {
    const r = await fetch("/api/google/status", { cache: "no-store" });
    if (!r.ok) return null;
    return (await r.json()) as GoogleStatus;
  } catch {
    return null;
  }
}

export async function fetchGoogleCalendars(): Promise<GoogleCalendar[]> {
  const r = await fetch("/api/google/calendars", { cache: "no-store" });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `calendars ${r.status}`);
  }
  const data = (await r.json()) as { calendars?: GoogleCalendar[] };
  return data.calendars ?? [];
}

export async function selectGoogleCalendar(
  calendarId: string,
  calendarSummary?: string,
  autoSync?: boolean,
  /** sidebar color #RRGGBB */
  color?: string,
): Promise<void> {
  const r = await fetch("/api/google/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ calendarId, calendarSummary, autoSync, color }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `select ${r.status}`);
  }
}

/** Recolor the selected calendar in Google’s left sidebar. */
export async function setGoogleCalendarColor(color: string): Promise<void> {
  const r = await fetch("/api/google/color", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ color }),
  });
  if (!r.ok) {
    const err = (await r.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `color ${r.status}`);
  }
}

export async function setGoogleAutoSync(autoSync: boolean): Promise<void> {
  const r = await fetch("/api/google/calendar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ autoSync }),
  });
  if (!r.ok) throw new Error("failed to set autoSync");
}

export async function syncGoogleCalendar(days = 21): Promise<{
  created: number;
  updated: number;
  total: number;
}> {
  const r = await fetch("/api/google/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ days }),
  });
  const data = (await r.json()) as {
    error?: string;
    created?: number;
    updated?: number;
    total?: number;
  };
  if (!r.ok) throw new Error(data.error || `sync ${r.status}`);
  return {
    created: data.created ?? 0,
    updated: data.updated ?? 0,
    total: data.total ?? 0,
  };
}
