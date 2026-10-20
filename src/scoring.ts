// Independent prototype. Not affiliated with Periodic Labs. All experiment data is simulated.
// Scoring: ranks completed runs with measured outcomes against the hypothesis target.
// Higher score is always better; ties share a rank (dense ranking).

import type { Hypothesis, Run, ScoredRun } from "./types.ts";

export function scoreRun(hyp: Hypothesis, run: Run): number {
  if (run.outcome === null) throw new Error("cannot score a run with no measured outcome");
  const v = run.outcome.value;
  switch (hyp.direction) {
    case "maximize":
      return v;
    case "minimize":
      return -v;
    case "hit-target": {
      const t = hyp.targetValue as number;
      return -Math.abs(v - t);
    }
  }
}

export function rankRuns(hyp: Hypothesis, runs: Run[]): ScoredRun[] {
  const eligible = runs.filter(
    (r) => r.hypothesisId === hyp.id && r.status === "completed" && r.outcome !== null
  );
  const scored: ScoredRun[] = eligible.map((run) => ({
    run,
    score: scoreRun(hyp, run),
    rank: 0,
  }));
  scored.sort((a, b) => b.score - a.score);
  let rank = 0;
  let lastScore: number | null = null;
  for (const s of scored) {
    if (lastScore === null || s.score !== lastScore) {
      rank += 1;
    }
    s.rank = rank;
    lastScore = s.score;
  }
  return scored;
}
