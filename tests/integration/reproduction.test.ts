import { it, expect } from "vitest";
import {
  newCampaign,
  executeCampaign,
} from "../../packages/orchestrator/index";
import { executePayment } from "../../examples/payment-agent/index";
const config = {
  agentVersion: "payment-vulnerable@1",
  categories: ["network"],
  budget: 4,
  depth: 0,
  seed: 7,
  backend: "trusted-local",
};
it("reports nonreproducing failures as unstable", async () => {
  let calls = 0;
  const c = newCampaign(config);
  await executeCampaign(c, {
    name: "trusted-local",
    execute: async (w) => {
      calls++;
      return {
        observation: await executePayment(
          calls > 2 ? { ...w, agentVersion: "payment-hardened@1" } : w,
        ),
        environment: { fixture: "replay-instability-test" },
      };
    },
  });
  expect(c.runs).toHaveLength(4);
  expect(c.counterexamples[0].status).toBe("unstable");
  expect(c.counterexamples[0].reproduced).toBe(1);
  expect(c.counterexamples[0].regressionRunId).toBeUndefined();
});
it("does not confirm a single observation after budget exhaustion", async () => {
  const c = newCampaign({ ...config, budget: 2 });
  await executeCampaign(c);
  expect(c.runs).toHaveLength(2);
  expect(c.counterexamples[0].status).toBe("unconfirmed");
});
