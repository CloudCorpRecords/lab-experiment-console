// Independent prototype. Not affiliated with Periodic Labs. All experiment data is simulated.
// Local JSON store with synthetic seed data. Mutations persist to data.json in the working directory.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type {
  Hypothesis,
  HypothesisStatus,
  MeasuredOutcome,
  Run,
  RunParameters,
  RunStatus,
  StoreData,
} from "./types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const DATA_FILE = join(HERE, "..", "data.json");

function isoNow(): string {
  return new Date().toISOString();
}

function isNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

// Deterministic synthetic generator so seed data looks coherent without any randomness.
// Value is a smooth function of the run index, clearly labeled simulated in the UI.
function syntheticOutcome(hypIndex: number, runIndex: number, property: string): number {
  const x = hypIndex * 7 + runIndex;
  const wave = Math.sin(x * 1.7) * 0.5 + Math.cos(x * 0.9) * 0.5;
  switch (property) {
    case "conductivity":
      return +(2.1 + runIndex * 0.35 + wave * 0.4).toFixed(2); // mS/cm, rising
    case "bandgap":
      return +(1.15 + wave * 0.25 + runIndex * 0.015).toFixed(3); // eV, hovering near 1.34 target
    case "thermal-conductivity":
      return +(3.4 - runIndex * 0.28 + wave * 0.3).toFixed(2); // W/(mK), falling
    case "tensile-strength":
      return +(620 + runIndex * 45 + wave * 30).toFixed(0); // MPa, rising
    default:
      return +(100 + runIndex * 5 + wave * 8).toFixed(2);
  }
}

function seedData(): StoreData {
  const defs: Array<{
    title: string;
    description: string;
    property: string;
    unit: string;
    direction: "maximize" | "minimize" | "hit-target";
    targetValue: number | null;
  }> = [
    {
      title: "Boost ionic conductivity in solid electrolyte",
      description: "Sweep annealing temperature and dopant concentration to raise room-temperature ionic conductivity.",
      property: "conductivity",
      unit: "mS/cm",
      direction: "maximize",
      targetValue: null,
    },
    {
      title: "Hit bandgap target for perovskite absorber",
      description: "Tune composition to land the absorber bandgap at 1.34 eV for the tandem stack.",
      property: "bandgap",
      unit: "eV",
      direction: "hit-target",
      targetValue: 1.34,
    },
    {
      title: "Lower thermal conductivity of thermoelectric",
      description: "Reduce lattice thermal conductivity without collapsing the power factor.",
      property: "thermal-conductivity",
      unit: "W/(mK)",
      direction: "minimize",
      targetValue: null,
    },
    {
      title: "Raise tensile strength of high-entropy alloy",
      description: "Explore dwell time and temperature for grain refinement and strength gains.",
      property: "tensile-strength",
      unit: "MPa",
      direction: "maximize",
      targetValue: null,
    },
  ];

  const hypotheses: Hypothesis[] = defs.map((d, i) => ({
    id: `hyp-${i + 1}`,
    title: d.title,
    description: d.description,
    property: d.property,
    unit: d.unit,
    direction: d.direction,
    targetValue: d.targetValue,
    status: (i < 2 ? "in_progress" : "open") as HypothesisStatus,
    createdAt: isoNow(),
  }));

  const runs: Run[] = [];
  let runCount = 0;
  defs.forEach((d, hi) => {
    const nRuns = 3 + (hi % 2); // 3 or 4 runs each
    for (let r = 0; r < nRuns; r++) {
      runCount += 1;
      const completed = r < nRuns - 1; // last run in each series is still running/queued
      const status: RunStatus = completed ? "completed" : r === nRuns - 1 ? "running" : "queued";
      const outcome: MeasuredOutcome | null = completed
        ? { value: syntheticOutcome(hi, r, d.property), unit: d.unit, measuredAt: isoNow() }
        : null;
      runs.push({
        id: `run-${runCount}`,
        hypothesisId: `hyp-${hi + 1}`,
        name: `${d.property}-r${r + 1}`,
        parameters: {
          temperature: 400 + hi * 150 + r * 25,
          concentration: +(0.5 + r * 0.25).toFixed(2),
          dwellMinutes: 60 + r * 30,
        },
        outcome,
        status,
        createdAt: isoNow(),
        updatedAt: isoNow(),
      });
    }
  });

  return {
    hypotheses,
    runs,
    nextHypothesisId: defs.length + 1,
    nextRunId: runCount + 1,
  };
}

export class Store {
  private data: StoreData;
  private file: string;

  constructor(file: string = DATA_FILE) {
    this.file = file;
    if (existsSync(file)) {
      const raw = readFileSync(file, "utf-8");
      this.data = JSON.parse(raw) as StoreData;
    } else {
      this.data = seedData();
      this.save();
    }
  }

  private save(): void {
    writeFileSync(this.file, JSON.stringify(this.data, null, 2), "utf-8");
  }

  listHypotheses(): Hypothesis[] {
    return this.data.hypotheses.map((h) => ({ ...h }));
  }

  getHypothesis(id: string): Hypothesis | undefined {
    const h = this.data.hypotheses.find((x) => x.id === id);
    return h ? { ...h } : undefined;
  }

  createHypothesis(input: {
    title: string;
    description?: string;
    property: string;
    unit: string;
    direction: "maximize" | "minimize" | "hit-target";
    targetValue?: number;
  }): Hypothesis {
    if (!input.title || !input.title.trim()) throw new Error("title is required");
    if (!input.property || !input.property.trim()) throw new Error("property is required");
    if (!input.unit || !input.unit.trim()) throw new Error("unit is required");
    if (input.direction === "hit-target" && !isNumber(input.targetValue)) {
      throw new Error("targetValue is required for hit-target hypotheses");
    }
    const h: Hypothesis = {
      id: `hyp-${this.data.nextHypothesisId++}`,
      title: input.title.trim(),
      description: (input.description ?? "").trim(),
      property: input.property.trim(),
      unit: input.unit.trim(),
      direction: input.direction,
      targetValue: input.direction === "hit-target" ? (input.targetValue as number) : null,
      status: "open",
      createdAt: isoNow(),
    };
    this.data.hypotheses.push(h);
    this.save();
    return { ...h };
  }

  updateHypothesisStatus(id: string, status: HypothesisStatus): Hypothesis {
    const valid: HypothesisStatus[] = ["open", "in_progress", "closed"];
    if (!valid.includes(status)) throw new Error(`invalid hypothesis status: ${status}`);
    const h = this.data.hypotheses.find((x) => x.id === id);
    if (!h) throw new Error(`hypothesis not found: ${id}`);
    h.status = status;
    this.save();
    return { ...h };
  }

  listRuns(hypothesisId?: string): Run[] {
    const runs = hypothesisId
      ? this.data.runs.filter((r) => r.hypothesisId === hypothesisId)
      : this.data.runs;
    return runs.map((r) => ({ ...r, parameters: { ...r.parameters }, outcome: r.outcome ? { ...r.outcome } : null }));
  }

  getRun(id: string): Run | undefined {
    const r = this.data.runs.find((x) => x.id === id);
    return r ? { ...r, parameters: { ...r.parameters }, outcome: r.outcome ? { ...r.outcome } : null } : undefined;
  }

  createRun(input: { hypothesisId: string; name: string; parameters: RunParameters }): Run {
    const h = this.data.hypotheses.find((x) => x.id === input.hypothesisId);
    if (!h) throw new Error(`hypothesis not found: ${input.hypothesisId}`);
    if (!input.name || !input.name.trim()) throw new Error("name is required");
    const p = input.parameters ?? {};
    if (!isNumber(p.temperature) || !isNumber(p.concentration) || !isNumber(p.dwellMinutes)) {
      throw new Error("parameters.temperature, parameters.concentration and parameters.dwellMinutes must be numbers");
    }
    const run: Run = {
      id: `run-${this.data.nextRunId++}`,
      hypothesisId: input.hypothesisId,
      name: input.name.trim(),
      parameters: { temperature: p.temperature, concentration: p.concentration, dwellMinutes: p.dwellMinutes },
      outcome: null,
      status: "queued",
      createdAt: isoNow(),
      updatedAt: isoNow(),
    };
    this.data.runs.push(run);
    this.save();
    return { ...run, parameters: { ...run.parameters } };
  }

  updateRun(
    id: string,
    patch: { status?: RunStatus; outcome?: { value: number } }
  ): Run {
    const r = this.data.runs.find((x) => x.id === id);
    if (!r) throw new Error(`run not found: ${id}`);
    if (patch.status !== undefined) {
      const valid: RunStatus[] = ["queued", "running", "completed", "failed"];
      if (!valid.includes(patch.status)) throw new Error(`invalid run status: ${patch.status}`);
      r.status = patch.status;
    }
    if (patch.outcome !== undefined) {
      if (!isNumber(patch.outcome.value)) throw new Error("outcome.value must be a number");
      const h = this.data.hypotheses.find((x) => x.id === r.hypothesisId);
      r.outcome = {
        value: patch.outcome.value,
        unit: h ? h.unit : "",
        measuredAt: isoNow(),
      };
      if (r.status !== "completed") r.status = "completed";
    }
    r.updatedAt = isoNow();
    this.save();
    return { ...r, parameters: { ...r.parameters }, outcome: r.outcome ? { ...r.outcome } : null };
  }
}
