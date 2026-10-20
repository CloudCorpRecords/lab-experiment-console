// Independent prototype. Not affiliated with Periodic Labs. All experiment data is simulated.
// Zero-dependency HTTP server: REST API for hypotheses/runs/scoring plus one static console page.

import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "./store.ts";
import { rankRuns } from "./scoring.ts";
import type { HypothesisStatus, RunStatus } from "./types.ts";

const HERE = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(HERE, "..", "public");

function send(res: ServerResponse, status: number, body: unknown): void {
  const text = typeof body === "string" ? body : JSON.stringify(body);
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(text);
}

function sendHtml(res: ServerResponse, file: string): void {
  res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
  res.end(readFileSync(file, "utf-8"));
}

function readBody(req: IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      const text = Buffer.concat(chunks).toString("utf-8");
      if (!text) return resolve({});
      try {
        resolve(JSON.parse(text));
      } catch {
        reject(new Error("request body is not valid JSON"));
      }
    });
    req.on("error", reject);
  });
}

const CONTENT_TYPES: Record<string, string> = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
};

function serveStatic(res: ServerResponse, path: string): boolean {
  const file = join(PUBLIC_DIR, path === "/" ? "index.html" : path);
  if (!file.startsWith(PUBLIC_DIR) || !existsSync(file) || extname(file) === "") return false;
  res.writeHead(200, { "Content-Type": CONTENT_TYPES[extname(file)] ?? "application/octet-stream" });
  res.end(readFileSync(file));
  return true;
}

export function createApp(store: Store) {
  return createServer(async (req: IncomingMessage, res: ServerResponse) => {
    try {
      const url = new URL(req.url ?? "/", "http://localhost");
      const method = req.method ?? "GET";
      const path = url.pathname;

      if (method === "GET" && !path.startsWith("/api/")) {
        if (serveStatic(res, path)) return;
        return send(res, 404, { error: "not found" });
      }

      // Hypotheses
      if (method === "GET" && path === "/api/hypotheses") {
        return send(res, 200, store.listHypotheses());
      }
      if (method === "POST" && path === "/api/hypotheses") {
        const body = (await readBody(req)) as Record<string, unknown>;
        const h = store.createHypothesis({
          title: String(body.title ?? ""),
          description: body.description !== undefined ? String(body.description) : undefined,
          property: String(body.property ?? ""),
          unit: String(body.unit ?? ""),
          direction: body.direction as "maximize" | "minimize" | "hit-target",
          targetValue: body.targetValue !== undefined ? Number(body.targetValue) : undefined,
        });
        return send(res, 201, h);
      }
      const hypPatch = path.match(/^\/api\/hypotheses\/([\w-]+)$/);
      if (method === "PATCH" && hypPatch) {
        const body = (await readBody(req)) as Record<string, unknown>;
        return send(res, 200, store.updateHypothesisStatus(hypPatch[1], body.status as HypothesisStatus));
      }

      // Runs
      if (method === "GET" && path === "/api/runs") {
        return send(res, 200, store.listRuns(url.searchParams.get("hypothesisId") ?? undefined));
      }
      if (method === "POST" && path === "/api/runs") {
        const body = (await readBody(req)) as Record<string, unknown>;
        const p = (body.parameters ?? {}) as Record<string, unknown>;
        const r = store.createRun({
          hypothesisId: String(body.hypothesisId ?? ""),
          name: String(body.name ?? ""),
          parameters: {
            temperature: Number(p.temperature),
            concentration: Number(p.concentration),
            dwellMinutes: Number(p.dwellMinutes),
          },
        });
        return send(res, 201, r);
      }
      const runPatch = path.match(/^\/api\/runs\/([\w-]+)$/);
      if (runPatch && (method === "PATCH" || method === "GET")) {
        if (method === "GET") {
          const r = store.getRun(runPatch[1]);
          return r ? send(res, 200, r) : send(res, 404, { error: "run not found" });
        }
        const body = (await readBody(req)) as Record<string, unknown>;
        const patch: { status?: RunStatus; outcome?: { value: number } } = {};
        if (body.status !== undefined) patch.status = body.status as RunStatus;
        if (body.outcome !== undefined) {
          const o = body.outcome as Record<string, unknown>;
          patch.outcome = { value: Number(o.value) };
        }
        return send(res, 200, store.updateRun(runPatch[1], patch));
      }

      // Scoring
      const scoring = path.match(/^\/api\/scoring\/([\w-]+)$/);
      if (method === "GET" && scoring) {
        const hyp = store.getHypothesis(scoring[1]);
        if (!hyp) return send(res, 404, { error: "hypothesis not found" });
        return send(res, 200, { hypothesis: hyp, ranking: rankRuns(hyp, store.listRuns()) });
      }

      return send(res, 404, { error: "not found" });
    } catch (err) {
      const message = err instanceof Error ? err.message : "unknown error";
      const status = /not found/i.test(message) ? 404 : 400;
      return send(res, status, { error: message });
    }
  });
}

const launchedDirectly =
  typeof process.argv[1] === "string" &&
  (process.argv[1].endsWith("/src/server.ts") || process.argv[1] === "src/server.ts");
if (launchedDirectly) {
  const store = new Store();
  const port = Number(process.env.PORT ?? 3000);
  createApp(store).listen(port, () => {
    console.log(`Lab experiment console listening on http://localhost:${port}`);
    console.log("SIMULATED DATA: all experiment measurements in this console are synthetic.");
  });
}
