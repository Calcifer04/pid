/**
 * Committed defaults. Secrets never live here — only XAI_API_KEY in env.
 * Override model with XAI_MODEL.
 */
export const ASSIST_CONFIG = {
  /** xAI OpenAI-compatible chat completions */
  baseUrl: "https://api.x.ai/v1",
  /** Fast tool-caller; override via XAI_MODEL */
  model: "grok-4-1-fast-non-reasoning",
  maxToolRounds: 6,
  temperature: 0.2,
} as const;
