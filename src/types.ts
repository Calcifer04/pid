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

/** Muted dot colors for phases. Quiet enough to sit next to the amber accent. */
export const PHASE_COLORS = [
  "#f0a868",
  "#6fb3c4",
  "#9a8cc9",
  "#7fb08a",
  "#c98a9a",
  "#8a93a6",
] as const;
