/**
 * Resolve a bearer token for xAI.
 * Prefer pi's OAuth (Grok Pro / subscription) over Console API keys.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ASSIST_CONFIG } from "./config";

const XAI_CLIENT_ID = "b1a00492-073a-47ea-816f-4c329264a828";
const XAI_TOKEN_URL = "https://auth.x.ai/oauth2/token";
const REFRESH_SKEW_MS = 5 * 60 * 1000;

export type AuthSource = "pi-oauth" | "env-key" | "header-key" | "none";

export type ResolvedAuth = {
  token: string | null;
  source: AuthSource;
  model: string;
};

type PiXaiOAuth = {
  type: "oauth";
  access: string;
  refresh: string;
  expires: number;
};

type PiAuthFile = {
  xai?:
    | PiXaiOAuth
    | { type: "api_key"; key: string }
    | Record<string, unknown>;
};

function piAuthPath(): string {
  return (
    process.env.PI_AUTH_PATH?.trim() ||
    join(homedir(), ".pi", "agent", "auth.json")
  );
}

function readPiAuth(): PiAuthFile | null {
  const path = piAuthPath();
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PiAuthFile;
  } catch {
    return null;
  }
}

function writePiXaiOAuth(next: PiXaiOAuth): void {
  const path = piAuthPath();
  if (!existsSync(path)) return;
  try {
    const raw = JSON.parse(readFileSync(path, "utf8")) as PiAuthFile;
    raw.xai = next;
    writeFileSync(path, JSON.stringify(raw, null, 2), "utf8");
  } catch {
    // Non-fatal — in-memory token still works this process.
  }
}

async function refreshPiOAuth(refresh: string): Promise<PiXaiOAuth | null> {
  try {
    const res = await fetch(XAI_TOKEN_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        client_id: XAI_CLIENT_ID,
        refresh_token: refresh,
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      access_token?: string;
      refresh_token?: string;
      expires_in?: number;
    };
    if (!body.access_token) return null;
    const expiresIn =
      typeof body.expires_in === "number" && body.expires_in > 0
        ? body.expires_in
        : 3600;
    const next: PiXaiOAuth = {
      type: "oauth",
      access: body.access_token,
      refresh: body.refresh_token || refresh,
      expires: Date.now() + expiresIn * 1000 - REFRESH_SKEW_MS,
    };
    writePiXaiOAuth(next);
    return next;
  } catch {
    return null;
  }
}

async function resolvePiOAuth(): Promise<string | null> {
  const file = readPiAuth();
  const xai = file?.xai;
  if (!xai || typeof xai !== "object") return null;

  if ((xai as { type?: string }).type === "api_key") {
    // pi stored a console key — same credit problem; skip for pro path
    const key = (xai as { key?: string }).key?.trim();
    return key || null;
  }

  if ((xai as { type?: string }).type !== "oauth") return null;
  let oauth = xai as PiXaiOAuth;
  if (!oauth.access || !oauth.refresh) return null;

  if (typeof oauth.expires === "number" && Date.now() >= oauth.expires) {
    const refreshed = await refreshPiOAuth(oauth.refresh);
    if (!refreshed) return null;
    oauth = refreshed;
  }
  return oauth.access;
}

/**
 * Order:
 * 1) pi OAuth (Grok Pro / subscription) — preferred
 * 2) XAI_API_KEY / GROK_API_KEY env
 * 3) request header key (browser paste)
 */
export async function resolveAuth(
  headerKey?: string | null,
): Promise<ResolvedAuth> {
  const model =
    process.env.XAI_MODEL?.trim() || ASSIST_CONFIG.model;

  // Prefer subscription unless explicitly forced to API key.
  const forceKey = process.env.ROUTINE_ASSIST_AUTH === "api-key";

  if (!forceKey) {
    const pi = await resolvePiOAuth();
    if (pi) return { token: pi, source: "pi-oauth", model };
  }

  const envKey =
    process.env.XAI_API_KEY?.trim() ||
    process.env.GROK_API_KEY?.trim() ||
    null;
  if (envKey) return { token: envKey, source: "env-key", model };

  const hdr = headerKey?.trim() || null;
  if (hdr) return { token: hdr, source: "header-key", model };

  if (forceKey) {
    const pi = await resolvePiOAuth();
    if (pi) return { token: pi, source: "pi-oauth", model };
  }

  return { token: null, source: "none", model };
}
