/**
 * GET /api/calendar.ics?days=21
 * ICS of upcoming dated/timed board items (import into Google Calendar).
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { readBoardFile } from "./board-file";
import { seedBoard } from "../store";
import { toIcs, upcomingEvents } from "../lib/calendar";

export async function handleCalendarRequest(
  req: IncomingMessage,
  res: ServerResponse,
  cwd = process.cwd(),
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    res.statusCode = 405;
    res.end("method not allowed");
    return;
  }

  const url = new URL(req.url ?? "/", "http://local");
  const daysRaw = Number(url.searchParams.get("days") || 21);
  const days = Number.isFinite(daysRaw)
    ? Math.min(90, Math.max(1, Math.floor(daysRaw)))
    : 21;

  const board = readBoardFile(cwd) ?? seedBoard();
  const events = upcomingEvents(board, days);
  const body = toIcs(events, "πD");

  res.statusCode = 200;
  res.setHeader("Content-Type", "text/calendar; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="pid-upcoming.ics"`,
  );
  res.setHeader("Cache-Control", "no-store");
  res.end(body);
}
