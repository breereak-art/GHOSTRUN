// This entrypoint is bundled for upload only. Never invoke generated modules on the host.
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { executePayment } from "../examples/payment-agent/index";
import { validateWorld } from "../packages/fault-operators/index";
const manifest = JSON.parse(readFileSync("/workspace/manifest.json", "utf8"));
const source = readFileSync("/workspace/program.mjs", "utf8");
if (
  !Array.isArray(manifest.calls) ||
  manifest.calls.length < 1 ||
  manifest.calls.length > 8
)
  throw new Error("CALL_LIMIT");
const canonical =
  manifest.calls
    .map((c: unknown) => "await ghost.run(" + JSON.stringify(c) + ");")
    .join("\n") + "\n";
if (
  source !== canonical ||
  createHash("sha256").update(source).digest("hex") !== manifest.hash
)
  throw new Error("SOURCE_MISMATCH");
let cursor = 0;
const observations: unknown[] = [];
Object.defineProperty(globalThis, "ghost", {
  value: Object.freeze({
    run: async (call: unknown) => {
      const index = cursor++;
      if (JSON.stringify(call) !== JSON.stringify(manifest.calls[index]))
        throw new Error("CALL_MISMATCH");
      const checked = validateWorld(manifest.worlds[index]);
      if (!checked.valid) throw new Error("INVALID_WORLD");
      observations.push(await executePayment(checked.world));
    },
  }),
  writable: false,
  configurable: false,
});
const modulePath = "file:///workspace/program.mjs";
await import(modulePath);
if (cursor !== manifest.calls.length) throw new Error("INCOMPLETE_PROGRAM");
writeFileSync(
  "/workspace/program-output.json",
  JSON.stringify({
    hash: manifest.hash,
    observations,
    runtime: process.version,
  }),
);
