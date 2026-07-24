import type { Action } from "./actions";

/** OpenAI/xAI function tools. Names map 1:1 to Action.type. */
export const ASSIST_TOOLS = [
  {
    type: "function" as const,
    function: {
      name: "add_task",
      description: "Create a one-shot task (not recurring).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          phase: { type: "string" },
          dueDate: { type: "string", description: "YYYY-MM-DD" },
          dueTime: { type: "string", description: "HH:mm 24h" },
          done: { type: "boolean" },
          color: {
            type: "string",
            description:
              "Task identity color (own, not phase): amber|cyan|magenta|green|red|blue or #hex.",
          },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_task",
      description:
        "Update a task by id. null clears dueDate/dueTime/color (color null → default neutral, not phase).",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          phase: { type: "string" },
          dueDate: { type: ["string", "null"] },
          dueTime: { type: ["string", "null"] },
          done: { type: "boolean" },
          color: {
            type: ["string", "null"],
            description:
              "Task identity (own, not phase): amber|cyan|magenta|green|red|blue or #hex. null clears to default.",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_task",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_sop",
      description:
        "Create a recurring SOP item that materializes on the calendar. Use for daily/weekly/monthly obligations.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          title: { type: "string" },
          cadence: {
            description:
              "daily | weekdays | weekends | {every:'interval',days:N} clears N days after checkoff | {every:'week',days:[0-6]} | {every:'month',on:[1-31]|'last'}",
            oneOf: [
              {
                type: "string",
                enum: ["daily", "weekdays", "weekends"],
              },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  every: { type: "string", const: "interval" },
                  days: {
                    type: "integer",
                    minimum: 1,
                    description:
                      "Minimum days between completions. Checkoff hides until day N.",
                  },
                },
                required: ["every", "days"],
              },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  every: { type: "string", const: "week" },
                  days: {
                    type: "array",
                    items: { type: "integer", minimum: 0, maximum: 6 },
                  },
                },
                required: ["every", "days"],
              },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  every: { type: "string", const: "month" },
                  on: {
                    oneOf: [
                      {
                        type: "array",
                        items: {
                          type: "integer",
                          minimum: 1,
                          maximum: 31,
                        },
                      },
                      { type: "string", const: "last" },
                    ],
                  },
                  window: {
                    type: "integer",
                    minimum: 1,
                    description:
                      "Days from start to stay due. 5 = start of month + 5 days to finish.",
                  },
                },
                required: ["every", "on"],
              },
            ],
          },
          time: { type: "string", description: "HH:mm 24h" },
          phase: { type: "string", description: "default board column name" },
          enabled: { type: "boolean" },
        },
        required: ["title"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "update_sop",
      description: "Update an SOP by id. null time clears it. Color is locked.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          cadence: {
            oneOf: [
              {
                type: "string",
                enum: ["daily", "weekdays", "weekends"],
              },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  every: { type: "string", const: "interval" },
                  days: { type: "integer", minimum: 1 },
                },
                required: ["every", "days"],
              },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  every: { type: "string", const: "week" },
                  days: {
                    type: "array",
                    items: { type: "integer", minimum: 0, maximum: 6 },
                  },
                },
                required: ["every", "days"],
              },
              {
                type: "object",
                additionalProperties: false,
                properties: {
                  every: { type: "string", const: "month" },
                  on: {
                    oneOf: [
                      {
                        type: "array",
                        items: {
                          type: "integer",
                          minimum: 1,
                          maximum: 31,
                        },
                      },
                      { type: "string", const: "last" },
                    ],
                  },
                  window: {
                    type: "integer",
                    minimum: 1,
                    description:
                      "Days from start to stay due. 5 = start of month + 5 days to finish.",
                  },
                },
                required: ["every", "on"],
              },
            ],
          },
          time: { type: ["string", "null"] },
          phase: { type: ["string", "null"] },
          enabled: { type: "boolean" },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "delete_sop",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { id: { type: "string" } },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_sop_done",
      description: "Check/uncheck an SOP instance for one calendar day.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          date: { type: "string", description: "YYYY-MM-DD" },
          done: { type: "boolean" },
        },
        required: ["id", "date", "done"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "add_phase",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "rename_phase",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          name: { type: "string" },
        },
        required: ["id", "name"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_focus",
      description:
        "Pin the desk/today focus to one item. id: task uuid, sop uuid, 'task:uuid', 'sop:uuid', or null to clear.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: {
            type: ["string", "null"],
            description: "task/sop id or null to clear focus",
          },
        },
        required: ["id"],
      },
    },
  },
  {
    type: "function" as const,
    function: {
      name: "set_pinned",
      description: "Pin/unpin a task so it ranks above normal auto-focus.",
      parameters: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          pinned: { type: "boolean" },
        },
        required: ["id", "pinned"],
      },
    },
  },
] as const;

const ACTION_TYPES = new Set([
  "add_task",
  "update_task",
  "delete_task",
  "add_sop",
  "update_sop",
  "delete_sop",
  "set_sop_done",
  "add_phase",
  "rename_phase",
  "set_focus",
  "set_pinned",
]);

export function toolCallToAction(
  name: string,
  argsJson: string,
): Action | { error: string } {
  if (!ACTION_TYPES.has(name)) return { error: `unknown tool ${name}` };
  let args: Record<string, unknown>;
  try {
    args = JSON.parse(argsJson || "{}") as Record<string, unknown>;
  } catch {
    return { error: "invalid json arguments" };
  }
  return { type: name, ...args } as Action;
}
