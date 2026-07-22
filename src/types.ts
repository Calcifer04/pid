export type Phase = {
  id: string;
  name: string;
  color: string;
};

export type Task = {
  id: string;
  title: string;
  phaseId: string;
  createdAt: number;
};

export type Board = {
  phases: Phase[];
  tasks: Task[];
};

/**
 * Syntax-token hues rather than one neon accent: amber, cyan, magenta, green,
 * red, blue. Desaturated enough to sit quietly on the near-black ground.
 */
export const PHASE_COLORS = [
  "#e8a55c",
  "#5fb3c4",
  "#b48ead",
  "#8fbf7f",
  "#c97b7b",
  "#7aa2d9",
] as const;
