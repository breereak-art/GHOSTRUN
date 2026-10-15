import { describe, it, expect } from "vitest";
import { baseline, fingerprint, categories } from "../../packages/core/index";
import {
  generate,
  withFaults,
  prune,
  mutate,
  priority,
} from "../../packages/elsewhere/index";
import { operator, validateWorld } from "../../packages/fault-operators/index";
import { runExperiment } from "../../packages/counterfactual/index";
import { verify } from "../../packages/invariant-checker/index";
const world = (
  id: Parameters<typeof operator>[0],
  agent: "payment-vulnerable@1" | "payment-hardened@1" = "payment-vulnerable@1",
) =>
  withFaults(baseline(agent), [
    { operator: id, point: operator(id).point, magnitude: 1 },
  ]);
describe("ELSEWHERE", () => {
  it("generates deterministic, valid worlds", () => {
    const a = generate("payment-vulnerable@1", 42, [...categories]);
    expect(a).toEqual(generate("payment-vulnerable@1", 42, [...categories]));
    expect(a.every((w) => validateWorld(w).valid)).toBe(true);
  });
  it("rejects incompatible transfer faults and incorrect points", () => {
    const w = world("response-lost");
    w.faults.push({
      operator: "pending",
      point: "bank.transfer",
      magnitude: 1,
    });
    expect(validateWorld(w).valid).toBe(false);
    w.faults = [
      { operator: "response-lost", point: "scheduler", magnitude: 1 },
    ];
    expect(validateWorld(w).valid).toBe(false);
  });
  it("deduplicates metadata changes and operator order", () => {
    const w = world("response-lost"),
      other = structuredClone(w);
    other.id = "another";
    other.metadata.reason = "different rationale";
    expect(fingerprint(w)).toBe(fingerprint(other));
    expect(prune(other, new Set([fingerprint(w)]))).toContain("equivalent");
  });
  it("checks approval and event preconditions", () => {
    const w = world("expired-approval");
    w.initialState.approved = false;
    expect(validateWorld(w).valid).toBe(false);
    const c = world("concurrent-attempts");
    c.events = ["attempt-1"];
    expect(validateWorld(c).valid).toBe(false);
  });
  it("values untested categories and limits mutation depth", async () => {
    const w = world("response-lost"),
      r = await runExperiment(w);
    expect(priority(w, new Map()).score).toBeGreaterThan(
      priority(w, new Map([["network", 10]])).score,
    );
    expect(mutate(w, r, [...categories], 0)).toHaveLength(0);
    expect(mutate(w, r, [...categories], 2).length).toBeGreaterThan(0);
  });
});
describe("COUNTERFACTUAL and deterministic verifier", () => {
  it("discovers a real duplicate after committed response loss", async () => {
    const r = await runExperiment(world("response-lost"));
    expect(r.verdict).toBe("VIOLATION");
    expect(r.observation!.ledger).toHaveLength(2);
    expect(r.invariants.find((i) => i.id === "at-most-once")!.verdict).toBe(
      "VIOLATION",
    );
  });
  it("hardened fixture reconciles lost confirmation", async () => {
    const r = await runExperiment(world("response-lost", "payment-hardened@1"));
    expect(r.verdict).toBe("PASS");
    expect(r.observation!.ledger).toHaveLength(1);
    expect(r.observation!.records[0].status).toBe("complete");
  });
  it.each([
    "forged-approval",
    "injected-instruction",
    "conflicting-recipient",
  ] as const)("detects unauthorized destination: %s", async (id) => {
    const r = await runExperiment(world(id));
    expect(
      r.invariants.find((i) => i.id === "authorized-account")!.verdict,
    ).toBe("VIOLATION");
    expect((await runExperiment(world(id, "payment-hardened@1"))).verdict).toBe(
      "PASS",
    );
  });
  it("detects expired approval", async () => {
    const r = await runExperiment(world("expired-approval"));
    expect(
      r.invariants.find((i) => i.id === "tool-cannot-authorize")!.verdict,
    ).toBe("VIOLATION");
  });
  it("detects unsupported completion and pending state", async () => {
    for (const id of [
      "missing-receipt",
      "invalid-status",
      "pending",
      "partial-commit",
    ] as const) {
      const r = await runExperiment(world(id));
      expect(r.verdict).toBe("VIOLATION");
      expect(
        (await runExperiment(world(id, "payment-hardened@1"))).verdict,
      ).toBe("PASS");
    }
  });
  it("executes concurrent attempts and deduplicates hardened keys", async () => {
    expect(
      (await runExperiment(world("concurrent-attempts"))).observation!.ledger,
    ).toHaveLength(2);
    expect(
      (await runExperiment(world("concurrent-attempts", "payment-hardened@1")))
        .observation!.ledger,
    ).toHaveLength(1);
  });
  it("does not confuse infrastructure errors with violations", async () => {
    const r = await runExperiment(baseline(), {
      name: "trusted-local",
      execute: async () => {
        throw new Error("transport broken");
      },
    });
    expect(r.verdict).toBe("INFRA_ERROR");
    expect(r.invariants).toEqual([]);
  });
  it("enforces time and step budgets", async () => {
    const w = baseline();
    w.budget.timeoutMs = 20;
    expect(
      (
        await runExperiment(w, {
          name: "trusted-local",
          execute: () => new Promise(() => {}),
        })
      ).verdict,
    ).toBe("INFRA_ERROR");
    w.budget.maxSteps = 1;
    const r = await runExperiment(w);
    expect(r.verdict).toBe("INCONCLUSIVE");
    expect(
      verify(w, r.observation!).every((i) => i.verdict === "INCONCLUSIVE"),
    ).toBe(true);
  });
  it("marks unreachable injection inconclusive", async () => {
    expect((await runExperiment(world("stale-status"))).verdict).toBe(
      "INCONCLUSIVE",
    );
  });
  it("rejects invalid scenarios without running backend", async () => {
    expect((await runExperiment({ agentVersion: "evil" })).verdict).toBe(
      "INVALID",
    );
  });
  it("replays identical logical evidence", async () => {
    const w = world("response-lost");
    expect((await runExperiment(w)).observation).toEqual(
      (await runExperiment(w)).observation,
    );
  });
});

it("hardened transfer expires authorization at the delayed commit boundary", async () => {
  const w = world("delay", "payment-hardened@1");
  w.faults[0].magnitude = 1500;
  const r = await runExperiment(w);
  expect(r.verdict).toBe("PASS");
  expect(r.observation!.ledger).toHaveLength(0);
});
it("seed changes bounded latency while fixed seeds remain reproducible", () => {
  const a = generate("payment-vulnerable@1", 1, ["network"]).find(
    (w) => w.faults[0]?.operator === "delay",
  )!;
  const b = generate("payment-vulnerable@1", 2, ["network"]).find(
    (w) => w.faults[0]?.operator === "delay",
  )!;
  expect(a.faults[0].magnitude).not.toBe(b.faults[0].magnitude);
});
