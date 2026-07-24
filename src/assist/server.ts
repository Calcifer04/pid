/**
 * Vite-dev/preview middleware body. Not imported by the browser bundle.
 * Grok proposes tool calls → we parse to Action[] → client applies.
 *
 * Auth preference: pi OAuth (Grok Pro) → env API key → browser header key.
 */
import type { IncomingMessage, ServerResponse } from "node:http";
import { resolveAuth } from "./auth";
import { ASSIST_CONFIG } from "./config";
import { buildSystemPrompt } from "./prompt";
import { ASSIST_TOOLS, toolCallToAction } from "./tools";
import type { Action } from "./actions";
import type { Board, View } from "../types";

type ChatMessage =
  | {
      role: "system" | "user" | "assistant";
      content: string | null;
      tool_calls?: ToolCall[];
    }
  | { role: "tool"; tool_call_id: string; content: string };

type ToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export async function handleAssistRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method === "GET") {
    const auth = await resolveAuth(null);
    json(res, 200, {
      configured: Boolean(auth.token),
      model: auth.model,
      source: auth.source,
    });
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "method not allowed" });
    return;
  }

  let body: {
    message?: string;
    board?: Board;
    dayKey?: string;
    view?: View;
  };
  try {
    body = JSON.parse(await readBody(req)) as typeof body;
  } catch {
    json(res, 400, { error: "invalid json" });
    return;
  }

  const headerKey = headerValue(req, "x-routine-xai-key");
  const auth = await resolveAuth(headerKey);
  if (!auth.token) {
    json(res, 503, {
      error:
        "πD offline — no auth. Log into xAI in pi (/login xai subscription), or paste an API key via the footer.",
    });
    return;
  }

  const message = body.message?.trim();
  if (!message) {
    json(res, 400, { error: "message required" });
    return;
  }
  if (!body.board || !body.dayKey || !body.view) {
    json(res, 400, { error: "board, dayKey, view required" });
    return;
  }

  try {
    const result = await runGrokAssist({
      token: auth.token,
      model: auth.model,
      message,
      board: body.board,
      dayKey: body.dayKey,
      view: body.view,
    });
    json(res, 200, { ...result, source: auth.source });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "assist failed";
    json(res, 502, { error: msg, source: auth.source });
  }
}

function headerValue(req: IncomingMessage, name: string): string | undefined {
  const raw = req.headers[name];
  if (Array.isArray(raw)) return raw[0];
  return raw;
}

export async function runGrokAssist(input: {
  token: string;
  model: string;
  message: string;
  board: Board;
  dayKey: string;
  view: View;
}): Promise<{ reply: string; actions: Action[] }> {
  const actions: Action[] = [];
  const messages: ChatMessage[] = [
    {
      role: "system",
      content: buildSystemPrompt(input.board, {
        dayKey: input.dayKey,
        view: input.view,
        nowIso: new Date().toISOString(),
      }),
    },
    { role: "user", content: input.message },
  ];

  for (let round = 0; round < ASSIST_CONFIG.maxToolRounds; round++) {
    const data = await chatCompletion({
      token: input.token,
      model: input.model,
      messages,
    });
    const choice = data.choices?.[0]?.message;
    if (!choice) throw new Error("empty model response");

    const toolCalls = choice.tool_calls ?? [];
    if (toolCalls.length === 0) {
      return {
        reply: (choice.content ?? "").trim() || quietReply(actions),
        actions,
      };
    }

    messages.push({
      role: "assistant",
      content: choice.content ?? null,
      tool_calls: toolCalls,
    });

    for (const call of toolCalls) {
      const parsed = toolCallToAction(
        call.function.name,
        call.function.arguments,
      );
      if ("error" in parsed) {
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify({ ok: false, error: parsed.error }),
        });
        continue;
      }
      actions.push(parsed);
      messages.push({
        role: "tool",
        tool_call_id: call.id,
        content: JSON.stringify({ ok: true }),
      });
    }
  }

  return { reply: quietReply(actions), actions };
}

async function chatCompletion(input: {
  token: string;
  model: string;
  messages: ChatMessage[];
}): Promise<{
  choices?: {
    message?: { content?: string | null; tool_calls?: ToolCall[] };
  }[];
}> {
  const res = await fetch(`${ASSIST_CONFIG.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${input.token}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: input.model,
      temperature: ASSIST_CONFIG.temperature,
      messages: input.messages,
      tools: ASSIST_TOOLS,
      tool_choice: "auto",
    }),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`xAI ${res.status}: ${text.slice(0, 280)}`);
  }
  return JSON.parse(text) as {
    choices?: {
      message?: { content?: string | null; tool_calls?: ToolCall[] };
    }[];
  };
}

function quietReply(actions: Action[]): string {
  if (!actions.length) return "nothing changed.";
  const counts = new Map<string, number>();
  for (const a of actions) {
    counts.set(a.type, (counts.get(a.type) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([t, n]) => `${t.replaceAll("_", " ")}×${n}`)
    .join(", ");
}

function json(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json; charset=utf-8");
  res.setHeader("cache-control", "no-store");
  res.end(JSON.stringify(body));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c) =>
      chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)),
    );
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}
