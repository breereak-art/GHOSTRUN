import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { baseline, fingerprint } from "../packages/core/index";
import { createOSBackend } from "../packages/counterfactual/createos";
import { runExperiment } from "../packages/counterfactual/index";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const runs = [];
if (process.env.CREATEOS_SANDBOX_API_KEY) {
  for (const agent of ["payment-vulnerable@1", "payment-hardened@1"] as const) {
    for (let replay = 0; replay < 2; replay++) {
      const world = baseline(agent, 7);
      world.faults = [
        { operator: "response-lost", point: "bank.transfer", magnitude: 1 },
      ];
      world.id = fingerprint(world);
      runs.push({
        world,
        run: await runExperiment(world, createOSBackend(), "replay"),
      });
    }
  }
}
const ids = runs.map((r) => r.run.environment.sandboxId);
const hasObservations = runs.every(({ run }) => Boolean(run.observation));
const reproduced =
  hasObservations &&
  runs.length === 4 &&
  JSON.stringify(runs[0].run.observation) ===
    JSON.stringify(runs[1].run.observation) &&
  JSON.stringify(runs[2].run.observation) ===
    JSON.stringify(runs[3].run.observation);
const verified =
  reproduced &&
  runs.length === 4 &&
  new Set(ids).size === 4 &&
  runs.every(
    ({ world, run }) =>
      run.environment.cleanup === "destroyed" &&
      run.invariants.some(
        (i) =>
          i.id === "at-most-once" &&
          i.verdict ===
            (world.agentVersion === "payment-vulnerable@1"
              ? "VIOLATION"
              : "PASS"),
      ) &&
      run.verdict ===
        (world.agentVersion === "payment-vulnerable@1" ? "VIOLATION" : "PASS"),
  );
const report = {
  createdAt: new Date().toISOString(),
  backend: "createos",
  reproduced,
  status: verified ? "verified" : runs.length ? "failed" : "blocked",
  reason: runs.length
    ? undefined
    : "CREATEOS_SANDBOX_API_KEY is missing; no sandbox requests or local fallback",
  runs,
};
await mkdir("data/live-validation", { recursive: true });
const path = "data/live-validation/" + randomUUID() + ".json";
await writeFile(path, JSON.stringify(report, null, 2));
console.log(
  JSON.stringify({
    status: report.status,
    experiments: runs.length,
    path,
    verdicts: runs.map((r) => r.run.verdict),
  }),
);
if (!verified) process.exitCode = 1;
