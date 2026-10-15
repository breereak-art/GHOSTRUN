import { it, expect } from "vitest";
import { baseline } from "../../packages/core/index";
import { executePayment } from "../../examples/payment-agent/index";
import { verify } from "../../packages/invariant-checker/index";
it("does not accept a fabricated receipt as completion evidence", async () => {
  const w = baseline(),
    obs = await executePayment(w);
  obs.events.find((e) => e.kind === "agent.record")!.data.receipt =
    "nonexistent";
  expect(
    verify(w, obs).find((i) => i.id === "completion-evidence")?.verdict,
  ).toBe("VIOLATION");
});
it("requires observed confirmation, not merely a settled ledger", async () => {
  const w = baseline(),
    obs = await executePayment(w);
  obs.events = obs.events.filter(
    (e) => !(e.kind === "tool.response" && e.tool === "bank.transfer"),
  );
  expect(
    verify(w, obs).find((i) => i.id === "completion-evidence")?.verdict,
  ).toBe("VIOLATION");
});
