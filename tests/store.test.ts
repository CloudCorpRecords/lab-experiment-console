// Independent prototype. Not affiliated with Periodic Labs. All experiment data is simulated.
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.ts";

function freshStore() {
  const dir = mkdtempSync(join(tmpdir(), "lab-store-"));
  const store = new Store(join(dir, "data.json"));
  return { store, dir };
}

test("seed data contains hypotheses and runs with simulated outcomes", () => {
  const { store, dir } = freshStore();
  try {
    const hyps = store.listHypotheses();
    assert.ok(hyps.length >= 4, "expected at least 4 seeded hypotheses");
    const runs = store.listRuns();
    assert.ok(runs.length > hyps.length, "expected multiple runs per hypothesis");
    const completed = runs.filter((r) => r.status === "completed");
    assert.ok(completed.length > 0, "expected some completed runs");
    for (const r of completed) assert.ok(r.outcome !== null, "completed seed runs carry an outcome");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("createRun persists and is retrievable", () => {
  const { store, dir } = freshStore();
  try {
    const hyp = store.listHypotheses()[0];
    const before = store.listRuns(hyp.id).length;
    const run = store.createRun({
      hypothesisId: hyp.id,
      name: "conductivity-r99",
      parameters: { temperature: 700, concentration: 1.5, dwellMinutes: 180 },
    });
    assert.equal(run.status, "queued");
    assert.equal(run.outcome, null);
    assert.equal(store.listRuns(hyp.id).length, before + 1);
    assert.equal(store.getRun(run.id)?.name, "conductivity-r99");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("createRun rejects unknown hypothesis and bad parameters", () => {
  const { store, dir } = freshStore();
  try {
    const hyp = store.listHypotheses()[0];
    assert.throws(() => store.createRun({ hypothesisId: "hyp-nope", name: "x", parameters: { temperature: 1, concentration: 1, dwellMinutes: 1 } }), /hypothesis not found/);
    assert.throws(() => store.createRun({ hypothesisId: hyp.id, name: "x", parameters: { temperature: NaN, concentration: 1, dwellMinutes: 1 } }), /must be numbers/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("updateRun status change persists; outcome flips status to completed", () => {
  const { store, dir } = freshStore();
  try {
    const hyp = store.listHypotheses()[0];
    const run = store.createRun({ hypothesisId: hyp.id, name: "r-flip", parameters: { temperature: 500, concentration: 0.75, dwellMinutes: 90 } });
    store.updateRun(run.id, { status: "running" });
    assert.equal(store.getRun(run.id)?.status, "running");
    const done = store.updateRun(run.id, { outcome: { value: 3.21 } });
    assert.equal(done.status, "completed");
    assert.equal(done.outcome?.value, 3.21);
    assert.equal(done.outcome?.unit, hyp.unit);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("updateRun rejects invalid status and unknown run", () => {
  const { store, dir } = freshStore();
  try {
    const run = store.listRuns()[0];
    assert.throws(() => store.updateRun(run.id, { status: "exploded" as never }), /invalid run status/);
    assert.throws(() => store.updateRun("run-nope", { status: "failed" }), /run not found/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("createHypothesis validates hit-target targetValue", () => {
  const { store, dir } = freshStore();
  try {
    assert.throws(
      () => store.createHypothesis({ title: "t", property: "p", unit: "u", direction: "hit-target" }),
      /targetValue is required/
    );
    const h = store.createHypothesis({ title: "t2", property: "p", unit: "u", direction: "hit-target", targetValue: 1.5 });
    assert.equal(h.targetValue, 1.5);
    assert.equal(h.status, "open");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("mutations persist across store instances (same file)", () => {
  const dir = mkdtempSync(join(tmpdir(), "lab-persist-"));
  try {
    const file = join(dir, "data.json");
    const s1 = new Store(file);
    const hyp = s1.listHypotheses()[0];
    const run = s1.createRun({ hypothesisId: hyp.id, name: "persist-me", parameters: { temperature: 600, concentration: 1, dwellMinutes: 60 } });
    const s2 = new Store(file);
    assert.equal(s2.getRun(run.id)?.name, "persist-me");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
