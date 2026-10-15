import { it, expect } from "vitest";
import { categories } from "../../packages/core/index";
import { generate } from "../../packages/elsewhere/index";
import { runExperiment } from "../../packages/counterfactual/index";

for (const world of generate("payment-hardened@1", 7, [...categories])) {
  it(
    "reference matrix: " + (world.faults[0]?.operator ?? "baseline"),
    async () => {
      const result = await runExperiment(world);
      expect(["PASS", "INCONCLUSIVE"]).toContain(result.verdict);
      expect(result.observation?.completed).toBe(true);
      expect(result.invariants.some((i) => i.verdict === "VIOLATION")).toBe(
        false,
      );
    },
  );
}
