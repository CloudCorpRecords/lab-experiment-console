// Independent prototype. Not affiliated with Periodic Labs. All experiment data is simulated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rankRuns, scoreRun } from "../src/scoring.ts";
import type { Hypothesis, Run } from "../src/types.ts";

function hyp(direction: "maximize" | "minimize" | "hit-target", targetValue: number | null = null): Hypothesis {
  return {
    id: "hyp-1",
    title: "t",
    description: "",
    property: "p",
    unit: "u",
    direction,
    targetValue,
    status: "open",
    createdAt: new Date().toISOString(),
  };
}

function run(id: string, value: number | null, status: "queued" | "running" | "completed" | "failed"): Run {
  return {
    id,
    hypothesisId: "hyp-1",
    name: id,
    parameters: { temperature: 500, concentration: 1, dwellMinutes: 60 },
    outcome: value === null ? null : { value, unit: "u", measuredAt: new Date().toISOString() },
    status,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

test("maximize ranks highest value first", () => {
  const h = hyp("maximize");
  const ranked = rankRuns(h, [run("a", 1, "completed"), run("b", 5, "completed"), run("c", 3, "completed")]);
  assert.deepEqual(ranked.map((s) => s.run.id), ["b", "c", "a"]);
  assert.deepEqual(ranked.map((s) => s.rank), [1, 2, 3]);
});

test("minimize ranks lowest value first", () => {
  const h = hyp("minimize");
  const ranked = rankRuns(h, [run("a", 9, "completed"), run("b", 2, "completed")]);
  assert.equal(ranked[0].run.id, "b");
});

test("hit-target ranks by closeness to target", () => {
  const h = hyp("hit-target", 1.34);
  const ranked = rankRuns(h, [run("a", 1.1, "completed"), run("b", 1.33, "completed"), run("c", 2.0, "completed")]);
  assert.deepEqual(ranked.map((s) => s.run.id), ["b", "a", "c"]);
});

test("ties share the same rank", () => {
  const h = hyp("maximize");
  const ranked = rankRuns(h, [run("a", 5, "completed"), run("b", 5, "completed"), run("c", 1, "completed")]);
  assert.deepEqual(ranked.map((s) => s.rank), [1, 1, 2]);
});

test("incomplete runs and runs without outcomes are excluded", () => {
  const h = hyp("maximize");
  const ranked = rankRuns(h, [
    run("a", 100, "running"),
    run("b", null, "completed"),
    run("c", 1, "completed"),
  ]);
  assert.deepEqual(ranked.map((s) => s.run.id), ["c"]);
});

test("runs from other hypotheses are excluded", () => {
  const h = hyp("maximize");
  const other = { ...run("zzz", 999, "completed"), hypothesisId: "hyp-2" };
  const ranked = rankRuns(h, [run("a", 1, "completed"), other]);
  assert.deepEqual(ranked.map((s) => s.run.id), ["a"]);
});

test("scoreRun throws for a run with no outcome", () => {
  assert.throws(() => scoreRun(hyp("maximize"), run("x", null, "completed")), /no measured outcome/);
});
