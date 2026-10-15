import { operator } from "../../packages/fault-operators/index";
import { Store } from "../../packages/scenario-store/index";
import {
  newCampaign,
  executeCampaign,
  type Campaign,
} from "../../packages/orchestrator/index";
import {
  localBackend,
  runExperiment,
} from "../../packages/counterfactual/index";
import { createOSBackend } from "../../packages/counterfactual/createos";
import { plan } from "../../packages/elsewhere/planner";
import { fingerprint, type World } from "../../packages/core/index";
const globals = globalThis as typeof globalThis & {
  ghostrunStore?: Store;
  ghostrunBusy?: boolean;
};
export function store() {
  if (!globals.ghostrunStore) {
    globals.ghostrunStore = new Store();
    globals.ghostrunStore.recover();
  }
  return globals.ghostrunStore;
}
export function busy() {
  return !!globals.ghostrunBusy;
}
export function launch(input: unknown, world?: World): Campaign {
  if (busy())
    throw new Error("BUSY: one campaign at a time on this development server");
  const c = newCampaign(input);
  store().save(c);
  globals.ghostrunBusy = true;
  setImmediate(async () => {
    try {
      const backend =
        c.config.backend === "createos" ? createOSBackend() : localBackend;
      if (world) {
        c.status = "running";
        const w = structuredClone(world);
        w.parentId = world.id;
        w.agentVersion = c.config.agentVersion;
        w.id = fingerprint(w);
        c.candidates = [
          {
            world: w,
            status: "running",
            reason: "User-requested replay of stored scenario",
            novelty: 1,
          },
        ];
        store().save(c);
        const r = await runExperiment(
          w,
          backend,
          c.config.agentVersion === world.agentVersion
            ? "replay"
            : "regression",
        );
        c.runs = [r];
        c.candidates[0].status = "completed";
        c.candidates[0].runId = r.id;
        c.status = r.verdict === "INFRA_ERROR" ? "error" : "completed";
        c.error = r.error;
        if (r.observation) {
          for (const f of w.faults.filter((f) =>
            r.observation!.appliedFaults.includes(f.operator),
          )) {
            const category = operator(f.operator).category;
            c.coverage.categories[category] =
              (c.coverage.categories[category] ?? 0) + 1;
          }
          c.coverage.transitions = [
            ...new Set(
              r.observation.records.map((x) => "started → " + x.status),
            ),
          ];
          c.coverage.combinations = [
            r.observation.appliedFaults.slice().sort().join(" + ") ||
              "baseline",
          ];
        }
        c.log.push({
          at: new Date().toISOString(),
          message: "User replay completed: " + r.verdict + " via " + r.backend,
        });
      } else {
        let worlds: World[] = [];
        if (c.config.planner === "llm") {
          const p = await plan(c.config);
          worlds = p.worlds;
          c.planner = {
            mode: "llm",
            model: p.model,
            accepted: p.worlds.length,
            rejected: p.rejected,
          };
        }
        await executeCampaign(c, backend, (x) => store().save(x), worlds);
      }
    } catch (e) {
      c.status = "error";
      c.error = e instanceof Error ? e.message : "Campaign failed";
    } finally {
      c.updatedAt = new Date().toISOString();
      store().save(c);
      globals.ghostrunBusy = false;
    }
  });
  return c;
}
