/**
 * Google Calendar sync — OAuth + upsert upcoming board events into one calendar.
 *
 * Env (.env.local):
 *   GOOGLE_CLIENT_ID=
 *   GOOGLE_CLIENT_SECRET=
 *   GOOGLE_REDIRECT_URI=http://127.0.0.1:4000/api/google/callback  (optional)
 *
 * Tokens: data/google-oauth.json
 * Prefs:  data/google-cal.json  { calendarId, calendarSummary?, autoSync? }
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import { dirname, join } from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import { readBoardFile } from "./board-file";
import { seedBoard } from "../store";
import {
  type CalEvent,
  googleColorId,
  upcomingEvents,
} from "../lib/calendar";

const SCOPES = [
  // full calendar: events + calendarList color / metadata
  "https://www.googleapis.com/auth/calendar",
].join(" ");

type TokenBag = {
  access_token: string;
  refresh_token?: string;
  expires_at: number; // epoch ms
  token_type?: string;
  scope?: string;
};

type CalPrefs = {
  calendarId?: string;
  calendarSummary?: string;
  /** debounced push after board writes (client triggers) */
  autoSync?: boolean;
  lastSyncAt?: number;
  lastSyncCount?: number;
  lastError?: string;
};

function dataDir(cwd: string): string {
  return join(cwd, "data");
}

function tokenPath(cwd: string): string {
  return join(dataDir(cwd), "google-oauth.json");
}

function prefsPath(cwd: string): string {
  return join(dataDir(cwd), "google-cal.json");
}

function readJson<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return null;
  }
}

function writeJson(path: string, data: unknown): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(data, null, 2), "utf8");
  renameSync(tmp, path);
}

function clientConfig(): {
  id: string;
  secret: string;
  redirect: string;
} | null {
  const id = process.env.GOOGLE_CLIENT_ID?.trim();
  const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!id || !secret) return null;
  const redirect =
    process.env.GOOGLE_REDIRECT_URI?.trim() ||
    `http://127.0.0.1:${process.env.PID_PORT || 4000}/api/google/callback`;
  return { id, secret, redirect };
}

function readTokens(cwd: string): TokenBag | null {
  return readJson<TokenBag>(tokenPath(cwd));
}

function writeTokens(cwd: string, t: TokenBag): void {
  writeJson(tokenPath(cwd), t);
}

function readPrefs(cwd: string): CalPrefs {
  return readJson<CalPrefs>(prefsPath(cwd)) ?? {};
}

function writePrefs(cwd: string, p: CalPrefs): void {
  writeJson(prefsPath(cwd), p);
}

function json(
  res: ServerResponse,
  status: number,
  body: unknown,
): void {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(body));
}

function redirect(res: ServerResponse, location: string): void {
  res.statusCode = 302;
  res.setHeader("Location", location);
  res.end();
}

async function readBody(req: IncomingMessage): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(c as Buffer);
  return Buffer.concat(chunks).toString("utf8");
}

async function exchangeCode(
  code: string,
  cfg: { id: string; secret: string; redirect: string },
): Promise<TokenBag> {
  const body = new URLSearchParams({
    code,
    client_id: cfg.id,
    client_secret: cfg.secret,
    redirect_uri: cfg.redirect,
    grant_type: "authorization_code",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await r.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    token_type?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };
  if (!r.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `token exchange ${r.status}`,
    );
  }
  return {
    access_token: data.access_token,
    refresh_token: data.refresh_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 30_000,
    token_type: data.token_type,
    scope: data.scope,
  };
}

async function refreshAccess(
  cwd: string,
  cfg: { id: string; secret: string; redirect: string },
  tokens: TokenBag,
): Promise<TokenBag> {
  if (!tokens.refresh_token) {
    throw new Error("no refresh token — reconnect Google");
  }
  const body = new URLSearchParams({
    client_id: cfg.id,
    client_secret: cfg.secret,
    refresh_token: tokens.refresh_token,
    grant_type: "refresh_token",
  });
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const data = (await r.json()) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };
  if (!r.ok || !data.access_token) {
    throw new Error(
      data.error_description || data.error || `refresh failed ${r.status}`,
    );
  }
  const next: TokenBag = {
    ...tokens,
    access_token: data.access_token,
    expires_at: Date.now() + (data.expires_in ?? 3600) * 1000 - 30_000,
  };
  writeTokens(cwd, next);
  return next;
}

async function getAccessToken(
  cwd: string,
  cfg: { id: string; secret: string; redirect: string },
): Promise<string> {
  let tokens = readTokens(cwd);
  if (!tokens) throw new Error("not connected — visit /api/google/auth");
  if (Date.now() >= tokens.expires_at) {
    tokens = await refreshAccess(cwd, cfg, tokens);
  }
  return tokens.access_token;
}

async function gfetch(
  cwd: string,
  cfg: { id: string; secret: string; redirect: string },
  url: string,
  init?: RequestInit,
): Promise<Response> {
  const token = await getAccessToken(cwd, cfg);
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${token}`);
  if (init?.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  let r = await fetch(url, { ...init, headers });
  if (r.status === 401) {
    const tokens = readTokens(cwd);
    if (tokens?.refresh_token) {
      await refreshAccess(cwd, cfg, tokens);
      const token2 = await getAccessToken(cwd, cfg);
      headers.set("Authorization", `Bearer ${token2}`);
      r = await fetch(url, { ...init, headers });
    }
  }
  return r;
}

function toGoogleEvent(ev: CalEvent): Record<string, unknown> {
  const remind = ev.remindMin ?? 15;
  const base: Record<string, unknown> = {
    summary: ev.title,
    description: ev.description ?? "πD",
    iCalUID: ev.uid,
    colorId: googleColorId(ev.color),
    reminders: {
      useDefault: false,
      overrides: [{ method: "popup", minutes: remind }],
    },
    source: {
      title: "πD",
      url: "http://127.0.0.1:4000/",
    },
  };
  if (!ev.time) {
    base.start = { date: ev.date };
    // exclusive end
    const [y, m, d] = ev.date.split("-").map(Number);
    const end = new Date(y, m - 1, d + 1);
    const ey = end.getFullYear();
    const em = String(end.getMonth() + 1).padStart(2, "0");
    const ed = String(end.getDate()).padStart(2, "0");
    base.end = { date: `${ey}-${em}-${ed}` };
  } else {
    const start = `${ev.date}T${ev.time}:00`;
    const [hh, mm] = ev.time.split(":").map(Number);
    const dur = ev.durationMin ?? 60;
    const [y, m, d] = ev.date.split("-").map(Number);
    const endDt = new Date(y, m - 1, d, hh, mm + dur, 0);
    const end = `${endDt.getFullYear()}-${String(endDt.getMonth() + 1).padStart(2, "0")}-${String(endDt.getDate()).padStart(2, "0")}T${String(endDt.getHours()).padStart(2, "0")}:${String(endDt.getMinutes()).padStart(2, "0")}:00`;
    // floating local — no timeZone forces "local" interpretation on some clients;
    // Google prefers explicit timeZone. Use system offset name if available.
    const tz =
      Intl.DateTimeFormat().resolvedOptions().timeZone || "Africa/Johannesburg";
    base.start = { dateTime: start, timeZone: tz };
    base.end = { dateTime: end, timeZone: tz };
  }
  return base;
}

async function findEventByIcalUid(
  cwd: string,
  cfg: { id: string; secret: string; redirect: string },
  calendarId: string,
  iCalUID: string,
): Promise<string | null> {
  const q = new URL(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
  );
  q.searchParams.set("iCalUID", iCalUID);
  q.searchParams.set("maxResults", "1");
  q.searchParams.set("showDeleted", "false");
  const r = await gfetch(cwd, cfg, q.toString());
  if (!r.ok) return null;
  const data = (await r.json()) as { items?: { id?: string }[] };
  return data.items?.[0]?.id ?? null;
}

async function upsertEvent(
  cwd: string,
  cfg: { id: string; secret: string; redirect: string },
  calendarId: string,
  ev: CalEvent,
): Promise<"created" | "updated"> {
  const body = toGoogleEvent(ev);
  const existing = await findEventByIcalUid(cwd, cfg, calendarId, ev.uid);
  if (existing) {
    // PATCH keeps Google metadata; always refresh colorId + times + title
    const patch = {
      summary: body.summary,
      description: body.description,
      start: body.start,
      end: body.end,
      colorId: body.colorId,
      reminders: body.reminders,
      source: body.source,
    };
    const r = await gfetch(
      cwd,
      cfg,
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(existing)}`,
      { method: "PATCH", body: JSON.stringify(patch) },
    );
    if (!r.ok) {
      const t = await r.text();
      throw new Error(`update failed ${r.status}: ${t.slice(0, 200)}`);
    }
    return "updated";
  }
  const r = await gfetch(
    cwd,
    cfg,
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    { method: "POST", body: JSON.stringify(body) },
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`create failed ${r.status}: ${t.slice(0, 200)}`);
  }
  return "created";
}

async function patchCalendarColor(
  cwd: string,
  cfg: { id: string; secret: string; redirect: string },
  calendarId: string,
  backgroundColor: string,
): Promise<void> {
  // calendarList entry owns the sidebar swatch (not the same as event colorId).
  const r = await gfetch(
    cwd,
    cfg,
    `https://www.googleapis.com/calendar/v3/users/me/calendarList/${encodeURIComponent(calendarId)}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        backgroundColor,
        foregroundColor: "#000000",
      }),
    },
  );
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`calendar color ${r.status}: ${t.slice(0, 180)}`);
  }
}

export async function syncToGoogle(
  cwd: string,
  days = 21,
): Promise<{
  ok: true;
  created: number;
  updated: number;
  total: number;
  calendarId: string;
}> {
  const cfg = clientConfig();
  if (!cfg) throw new Error("GOOGLE_CLIENT_ID / SECRET not set");
  const prefs = readPrefs(cwd);
  if (!prefs.calendarId) throw new Error("no calendar selected");
  const board = readBoardFile(cwd) ?? seedBoard();
  const events = upcomingEvents(board, days);
  let created = 0;
  let updated = 0;
  for (const ev of events) {
    const op = await upsertEvent(cwd, cfg, prefs.calendarId, ev);
    if (op === "created") created++;
    else updated++;
  }
  writePrefs(cwd, {
    ...prefs,
    lastSyncAt: Date.now(),
    lastSyncCount: events.length,
    lastError: undefined,
  });
  return {
    ok: true,
    created,
    updated,
    total: events.length,
    calendarId: prefs.calendarId,
  };
}

export async function handleGoogleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  cwd = process.cwd(),
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url ?? "/", "http://local");
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const cfg = clientConfig();

  // GET /api/google/status
  if (path.endsWith("/status") && req.method === "GET") {
    const tokens = readTokens(cwd);
    const prefs = readPrefs(cwd);
    json(res, 200, {
      configured: Boolean(cfg),
      connected: Boolean(tokens?.refresh_token || tokens?.access_token),
      calendarId: prefs.calendarId ?? null,
      calendarSummary: prefs.calendarSummary ?? null,
      autoSync: Boolean(prefs.autoSync),
      lastSyncAt: prefs.lastSyncAt ?? null,
      lastSyncCount: prefs.lastSyncCount ?? null,
      lastError: prefs.lastError ?? null,
      authUrl: cfg ? "/api/google/auth" : null,
    });
    return;
  }

  // GET /api/google/auth
  if (path.endsWith("/auth") && req.method === "GET") {
    if (!cfg) {
      json(res, 400, {
        error:
          "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env.local (see README).",
      });
      return;
    }
    const q = new URLSearchParams({
      client_id: cfg.id,
      redirect_uri: cfg.redirect,
      response_type: "code",
      scope: SCOPES,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });
    redirect(
      res,
      `https://accounts.google.com/o/oauth2/v2/auth?${q.toString()}`,
    );
    return;
  }

  // GET /api/google/callback?code=
  if (path.endsWith("/callback") && req.method === "GET") {
    if (!cfg) {
      res.statusCode = 400;
      res.end("Google OAuth not configured");
      return;
    }
    const err = url.searchParams.get("error");
    if (err) {
      redirect(res, `/?gcal=error&msg=${encodeURIComponent(err)}`);
      return;
    }
    const code = url.searchParams.get("code");
    if (!code) {
      redirect(res, "/?gcal=error&msg=missing_code");
      return;
    }
    try {
      const existing = readTokens(cwd);
      const tokens = await exchangeCode(code, cfg);
      // keep prior refresh_token if Google omits it on re-auth
      if (!tokens.refresh_token && existing?.refresh_token) {
        tokens.refresh_token = existing.refresh_token;
      }
      writeTokens(cwd, tokens);
      redirect(res, "/?gcal=connected");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "oauth_failed";
      redirect(res, `/?gcal=error&msg=${encodeURIComponent(msg)}`);
    }
    return;
  }

  // POST /api/google/disconnect
  if (path.endsWith("/disconnect") && req.method === "POST") {
    try {
      if (existsSync(tokenPath(cwd))) {
        writeJson(tokenPath(cwd), {});
      }
    } catch {
      /* ignore */
    }
    const prefs = readPrefs(cwd);
    writePrefs(cwd, {
      ...prefs,
      // keep calendarId preference
    });
    // wipe tokens file content
    writeJson(tokenPath(cwd), { revoked: true });
    json(res, 200, { ok: true });
    return;
  }

  // GET /api/google/calendars
  if (path.endsWith("/calendars") && req.method === "GET") {
    if (!cfg) {
      json(res, 400, { error: "not configured" });
      return;
    }
    try {
      const r = await gfetch(
        cwd,
        cfg,
        "https://www.googleapis.com/calendar/v3/users/me/calendarList?minAccessRole=writer",
      );
      if (!r.ok) {
        const t = await r.text();
        json(res, r.status, { error: t.slice(0, 300) });
        return;
      }
      const data = (await r.json()) as {
        items?: {
          id?: string;
          summary?: string;
          primary?: boolean;
          accessRole?: string;
        }[];
      };
      const calendars = (data.items ?? [])
        .filter((c) => c.id)
        .map((c) => ({
          id: c.id!,
          summary: c.summary ?? c.id!,
          primary: Boolean(c.primary),
        }));
      json(res, 200, { calendars, selected: readPrefs(cwd).calendarId ?? null });
    } catch (e) {
      json(res, 401, {
        error: e instanceof Error ? e.message : "list failed",
      });
    }
    return;
  }

  // POST /api/google/calendar  { calendarId, calendarSummary?, autoSync?, color? }
  if (
    (path.endsWith("/calendar") || path.endsWith("/select")) &&
    req.method === "POST"
  ) {
    try {
      const body = JSON.parse(await readBody(req)) as {
        calendarId?: string;
        calendarSummary?: string;
        autoSync?: boolean;
        /** sidebar color hex, e.g. #2ee6d6 */
        color?: string;
      };
      const prefs = readPrefs(cwd);
      const next: CalPrefs = {
        ...prefs,
        calendarId:
          typeof body.calendarId === "string" && body.calendarId.trim()
            ? body.calendarId.trim()
            : prefs.calendarId,
        calendarSummary:
          typeof body.calendarSummary === "string"
            ? body.calendarSummary
            : prefs.calendarSummary,
        autoSync:
          typeof body.autoSync === "boolean" ? body.autoSync : prefs.autoSync,
      };
      writePrefs(cwd, next);

      // Optional: paint the calendar in Google’s left sidebar
      const color =
        typeof body.color === "string" && /^#[0-9a-fA-F]{6}$/.test(body.color)
          ? body.color
          : null;
      if (cfg && next.calendarId && color) {
        try {
          await patchCalendarColor(cwd, cfg, next.calendarId, color);
        } catch (e) {
          json(res, 200, {
            ok: true,
            ...next,
            colorWarning:
              e instanceof Error ? e.message : "color update failed",
          });
          return;
        }
      }

      json(res, 200, { ok: true, ...next, color: color ?? undefined });
    } catch {
      json(res, 400, { error: "invalid json" });
    }
    return;
  }

  // POST /api/google/color  { color: "#2ee6d6" } — recolor selected calendar sidebar
  if (path.endsWith("/color") && req.method === "POST") {
    if (!cfg) {
      json(res, 400, { error: "not configured" });
      return;
    }
    const prefs = readPrefs(cwd);
    if (!prefs.calendarId) {
      json(res, 400, { error: "no calendar selected" });
      return;
    }
    try {
      const body = JSON.parse(await readBody(req)) as { color?: string };
      const color = body.color?.trim() || "#2ee6d6";
      if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
        json(res, 400, { error: "color must be #RRGGBB" });
        return;
      }
      await patchCalendarColor(cwd, cfg, prefs.calendarId, color);
      json(res, 200, { ok: true, calendarId: prefs.calendarId, color });
    } catch (e) {
      json(res, 500, {
        error: e instanceof Error ? e.message : "color failed",
      });
    }
    return;
  }

  // POST /api/google/sync  { days?: number }
  if (path.endsWith("/sync") && req.method === "POST") {
    if (!cfg) {
      json(res, 400, { error: "not configured" });
      return;
    }
    try {
      let days = 21;
      try {
        const body = JSON.parse(await readBody(req)) as { days?: number };
        if (typeof body.days === "number") days = body.days;
      } catch {
        /* empty body ok */
      }
      const result = await syncToGoogle(cwd, days);
      json(res, 200, result);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "sync failed";
      const prefs = readPrefs(cwd);
      writePrefs(cwd, { ...prefs, lastError: msg });
      json(res, 500, { error: msg });
    }
    return;
  }

  json(res, 404, { error: "unknown google route" });
}
