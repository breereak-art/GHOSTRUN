import { readFileSync } from "node:fs";
import { fingerprint, worldSchema } from "../packages/core/index";
import { runExperiment, localBackend } from "../packages/counterfactual/index";
import { createOSBackend } from "../packages/counterfactual/createos";
const file = process.argv[2];
if (!file)
  throw new Error("Usage: npm run replay -- artifact.json [--hardened]");
const artifact = JSON.parse(readFileSync(file, "utf8"));
const world = worldSchema.parse(artifact.world);
const hardened = process.argv.includes("--hardened");
if (hardened) {
  world.agentVersion = "payment-hardened@1";
  world.id = fingerprint(world);
}
const result = await runExperiment(
  world,
  artifact.backend === "createos" ? createOSBackend() : localBackend,
  hardened ? "regression" : "replay",
);
console.log(JSON.stringify(result, null, 2));
const violations = result.invariants
  .filter((i) => i.verdict === "VIOLATION")
  .map((i) => i.id);
const passed = hardened
  ? result.verdict === "PASS"
  : result.verdict === "VIOLATION" &&
    Array.isArray(artifact.expectedViolationIds) &&
    artifact.expectedViolationIds.every((id: string) =>
      violations.includes(id as (typeof violations)[number]),
    );
if (!passed) process.exitCode = 1;
