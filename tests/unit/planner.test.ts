import { it, expect, vi, afterEach } from "vitest";
import { plan } from "../../packages/elsewhere/planner";
const config = {
  agentVersion: "payment-vulnerable@1" as const,
  categories: ["network" as const],
  budget: 10,
  depth: 2,
  seed: 7,
  backend: "trusted-local" as const,
  planner: "llm" as const,
};
afterEach(() => vi.unstubAllEnvs());
function setup() {
  vi.stubEnv("PLANNER_API_KEY", "synthetic-test-key");
  vi.stubEnv("PLANNER_URL", "https://planner.example/chat");
  vi.stubEnv("PLANNER_MODEL", "test-model");
}
it("does not silently claim LLM planning without credentials", async () => {
  vi.stubEnv("PLANNER_API_KEY", "");
  await expect(plan(config)).rejects.toThrow("UNCONFIGURED");
});
it("accepts only typed supported proposals and records model provenance", async () => {
  setup();
  const fetcher = (async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              candidates: [
                {
                  faults: [
                    {
                      operator: "response-lost",
                      point: "bank.transfer",
                      magnitude: 1,
                    },
                  ],
                  reason: "Ambiguous settlement tests retry behavior",
                },
              ],
            }),
          },
        },
      ],
    })) as typeof fetch;
  const p = await plan(config, fetcher);
  expect(p.worlds).toHaveLength(1);
  expect(p.worlds[0].metadata.model).toBe("test-model");
  expect(p.worlds[0].metadata.source).toBe("llm");
});
it("rejects commands and unknown operators", async () => {
  setup();
  const fetcher = (async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              candidates: [
                {
                  faults: [
                    { operator: "shell", point: "scheduler", magnitude: 1 },
                  ],
                  reason: "test",
                  command: "do not execute",
                },
              ],
            }),
          },
        },
      ],
    })) as typeof fetch;
  const p = await plan(config, fetcher);
  expect(p.worlds).toHaveLength(0);
  expect(p.rejected.length).toBeGreaterThan(0);
});
