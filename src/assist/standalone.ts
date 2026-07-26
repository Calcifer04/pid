/**
 * Production HTTP server for Tauri / npm start.
 * Serves dist/ + same /api/* handlers as the Vite plugin.
 *
 *   node dist-server/pid-server.mjs
 *   PID_PORT=4000 PID_ROOT=/path/to/project
 */
import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, join, normalize, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { handleAssistRequest } from "./server";
import { handleBoardRequest } from "./board-file";
import { handleCalendarRequest } from "./calendar-api";
import { handleGoogleRequest } from "./google-cal";

const ROOT = process.env.PID_ROOT?.trim() || process.cwd();
const HOST = process.env.PID_HOST?.trim() || "127.0.0.1";
const PORT = Number(process.env.PID_PORT || 4000);
const DIST = join(ROOT, "dist");

// Lift .env.local-style keys if present (Tauri / plain node)
try {
  const envPath = join(ROOT, ".env.local");
  if (existsSync(envPath)) {
    const { readFileSync } = await import("node:fs");
    for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith("#") || !t.includes("=")) continue;
      const i = t.indexOf("=");
      const k = t.slice(0, i).trim();
      let v = t.slice(i + 1).trim();
      if (
        (v.startsWith('"') && v.endsWith('"')) ||
        (v.startsWith("'") && v.endsWith("'"))
      ) {
        v = v.slice(1, -1);
      }
      if (k && !process.env[k]) process.env[k] = v;
    }
  }
} catch {
  /* optional */
}

const MIME: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
  ".json": "application/json",
  ".map": "application/json",
  ".woff2": "font/woff2",
};

function send(res: ServerResponse, status: number, body: string, type: string) {
  res.statusCode = status;
  res.setHeader("content-type", type);
  res.setHeader("cache-control", "no-store");
  res.end(body);
}

function safeJoin(base: string, reqPath: string): string | null {
  const decoded = decodeURIComponent(reqPath.split("?")[0] || "/");
  const rel = decoded === "/" ? "/index.html" : decoded;
  const full = normalize(join(base, rel));
  if (!full.startsWith(normalize(base + sep)) && full !== normalize(base)) {
    return null;
  }
  return full;
}

async function handleApi(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  const url = req.url ?? "";
  if (url.startsWith("/api/assist")) {
    await handleAssistRequest(req, res);
    return true;
  }
  if (url.startsWith("/api/board")) {
    await handleBoardRequest(req, res, ROOT);
    return true;
  }
  if (url.startsWith("/api/calendar") || url.startsWith("/api/calendar.ics")) {
    await handleCalendarRequest(req, res, ROOT);
    return true;
  }
  if (url.startsWith("/api/google")) {
    await handleGoogleRequest(req, res, ROOT);
    return true;
  }
  return false;
}

function serveStatic(req: IncomingMessage, res: ServerResponse): void {
  if (!existsSync(DIST)) {
    send(
      res,
      503,
      "dist/ missing — run npm run build",
      "text/plain; charset=utf-8",
    );
    return;
  }

  let file = safeJoin(DIST, req.url ?? "/");
  if (!file) {
    res.statusCode = 403;
    res.end("forbidden");
    return;
  }

  if (!existsSync(file) || statSync(file).isDirectory()) {
    // SPA fallback
    file = join(DIST, "index.html");
  }
  if (!existsSync(file)) {
    res.statusCode = 404;
    res.end("not found");
    return;
  }

  const ext = extname(file).toLowerCase();
  res.statusCode = 200;
  res.setHeader("content-type", MIME[ext] || "application/octet-stream");
  if (ext === ".html") res.setHeader("cache-control", "no-store");
  createReadStream(file).pipe(res);
}

const server = createServer((req, res) => {
  void (async () => {
    try {
      if (req.url?.startsWith("/api/")) {
        const hit = await handleApi(req, res);
        if (hit) return;
      }
      if (req.method === "GET" || req.method === "HEAD") {
        serveStatic(req, res);
        return;
      }
      res.statusCode = 405;
      res.end("method not allowed");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "error";
      if (!res.headersSent) send(res, 500, msg, "text/plain; charset=utf-8");
    }
  })();
});

server.listen(PORT, HOST, () => {
  const url = `http://${HOST === "0.0.0.0" ? "127.0.0.1" : HOST}:${PORT}/`;
  console.log(`πD server ${url}`);
  console.log(`  root ${ROOT}`);
  // signal for Tauri
  console.log(`PID_SERVER_READY ${PORT}`);
});

process.on("SIGTERM", () => server.close(() => process.exit(0)));
process.on("SIGINT", () => server.close(() => process.exit(0)));

// keep import side-effect free for bundlers that tree-shake
void pathToFileURL;
