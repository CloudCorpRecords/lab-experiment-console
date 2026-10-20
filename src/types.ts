// Independent prototype. Not affiliated with Periodic Labs. All experiment data is simulated.
// Core domain types for the lab experiment console.

export type Direction = "maximize" | "minimize" | "hit-target";

export type HypothesisStatus = "open" | "in_progress" | "closed";

export type RunStatus = "queued" | "running" | "completed" | "failed";

export interface Hypothesis {
  id: string;
  title: string;
  description: string;
  property: string; // e.g. "conductivity"
  unit: string; // e.g. "mS/cm"
  direction: Direction;
  targetValue: number | null; // required when direction is "hit-target"
  status: HypothesisStatus;
  createdAt: string;
}

export interface RunParameters {
  temperature: number; // degrees Celsius
  concentration: number; // mol/L
  dwellMinutes: number; // minutes
}

export interface MeasuredOutcome {
  value: number;
  unit: string;
  measuredAt: string;
}

export interface Run {
  id: string;
  hypothesisId: string;
  name: string;
  parameters: RunParameters;
  outcome: MeasuredOutcome | null;
  status: RunStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ScoredRun {
  run: Run;
  score: number; // higher is better
  rank: number;
}

export interface StoreData {
  hypotheses: Hypothesis[];
  runs: Run[];
  nextHypothesisId: number;
  nextRunId: number;
}
