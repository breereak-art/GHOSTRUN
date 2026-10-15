import { describe, it, expect } from "vitest";
import { baseline, worldSchema } from "../../packages/core/index";
import { runExperiment } from "../../packages/counterfactual/index";
describe("foundation", () => {
  it("validates baseline and rejects arbitrary targets", () => {
    expect(worldSchema.safeParse(baseline()).success).toBe(true);
    expect(
      worldSchema.safeParse({ ...baseline(), agentVersion: "./untrusted.js" })
        .success,
    ).toBe(false);
  });
  it.each(["payment-vulnerable@1", "payment-hardened@1"] as const)(
    "executes %s baseline",
    async (agent) => {
      const result = await runExperiment(baseline(agent));
      expect(result.verdict).toBe("PASS");
      expect(result.observation?.ledger).toHaveLength(1);
      expect(
        result.observation?.events.some((e) => e.kind === "bank.commit"),
      ).toBe(true);
    },
  );
});
