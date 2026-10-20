// Independent prototype. Not affiliated with Periodic Labs. All experiment data is simulated.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Store } from "../src/store.ts";
import { createApp } from "../src/server.ts";

let base = "";
let close: () => void = () => {};
let dir = "";

async function j(method: string, path: string, body?: unknown) {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json();
  return { status: res.status, data };
}

before(async () => {
  dir = mkdtempSync(join(tmpdir(), "lab-server-"));
  const store = new Store(join(dir, "data.json"));
  const server = createApp(store);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : 0;
  base = `http://localhost:${port}`;
  close = () => server.close();
});

after(() => {
  close();
  rmSync(dir, { recursive: true, force: true });
});

test("GET / serves the console page", async () => {
  const res = await fetch(base + "/");
  assert.equal(res.status, 200);
  const text = await res.text();
  assert.ok(text.includes("SIMULATED DATA"));
});

test("full flow: create hypothesis, add run, update status, score it", async () => {
  const { data: hyp, status: s1 } = await j("POST", "/api/hypotheses", {
    title: "Bandgap hunt",
    property: "bandgap",
    unit: "eV",
    direction: "hit-target",
    targetValue: 1.34,
    description: "find the composition",
  });
  assert.equal(s1, 201);
  const { data: r1 } = await j("POST", "/api/runs", {
    hypothesisId: hyp.id,
    name: "bg-1",
    parameters: { temperature: 450, concentration: 0.8, dwellMinutes: 120 },
  });
  assert.equal(r1.status, "queued");
  const { data: r2 } = await j("PATCH", `/api/runs/${r1.id}`, { status: "running" });
  assert.equal(r2.status, "running");
  const { data: r3 } = await j("PATCH", `/api/runs/${r1.id}`, { outcome: { value: 1.31 } });
  assert.equal(r3.status, "completed");
  assert.equal(r3.outcome.value, 1.31);
  const { data: runs } = await j("GET", `/api/runs?hypothesisId=${hyp.id}`);
  assert.ok(runs.some((r: { id: string }) => r.id === r1.id));
  const { data: scored } = await j("GET", `/api/scoring/${hyp.id}`);
  assert.equal(scored.ranking.length, 1);
  assert.equal(scored.ranking[0].rank, 1);
  assert.equal(scored.hypothesis.id, hyp.id);
});

test("POST /api/runs rejects bad parameters with 400", async () => {
  const { status } = await j("POST", "/api/runs", {
    hypothesisId: "hyp-1",
    name: "bad",
    parameters: { temperature: "hot", concentration: 1, dwellMinutes: 1 },
  });
  assert.equal(status, 400);
});

test("POST /api/runs for unknown hypothesis returns 404", async () => {
  const { status } = await j("POST", "/api/runs", {
    hypothesisId: "hyp-nope",
    name: "x",
    parameters: { temperature: 1, concentration: 1, dwellMinutes: 1 },
  });
  assert.equal(status, 404);
});

test("PATCH /api/runs/:id rejects invalid status", async () => {
  const { status } = await j("PATCH", "/api/runs/run-1", { status: "teleported" });
  assert.equal(status, 400);
});

test("GET /api/scoring/:id returns 404 for unknown hypothesis", async () => {
  const { status } = await j("GET", "/api/scoring/hyp-nope");
  assert.equal(status, 404);
});

test("GET /api/runs/:id returns 404 for unknown run", async () => {
  const { status } = await j("GET", "/api/runs/run-nope");
  assert.equal(status, 404);
});
