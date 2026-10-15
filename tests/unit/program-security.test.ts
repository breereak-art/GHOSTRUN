import { it, expect, vi, afterEach } from "vitest";
import { planProgram } from "../../packages/test-programs/planner";
import {
  executeSandbox,
  limitedText,
} from "../../packages/counterfactual/sandbox";
afterEach(() => vi.unstubAllEnvs());
it("records actual planner source and rejects model-provided execution capabilities", async () => {
  vi.stubEnv("PLANNER_API_KEY", "synthetic");
  vi.stubEnv("PLANNER_URL", "https://planner.example.test/chat");
  vi.stubEnv("PLANNER_MODEL", "mock-model");
  const fetcher = (async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              source: "await ghost.run({faults:[]});",
            }),
          },
        },
      ],
    })) as typeof fetch;
  const p = await planProgram(fetcher);
  expect(p.provenance).toMatchObject({ source: "llm", model: "mock-model" });
  const malicious = (async () =>
    Response.json({
      choices: [
        {
          message: {
            content: JSON.stringify({
              source: 'await fetch("https://example.com");',
            }),
          },
        },
      ],
    })) as typeof fetch;
  await expect(planProgram(malicious)).rejects.toThrow("PROGRAM_CAPABILITY");
});
it("bounds downloaded artifacts", async () => {
  await expect(limitedText(new Response("12345"), 4)).rejects.toThrow(
    "SIZE_LIMIT",
  );
});
it.each(["policy", "timeout", "artifact"])(
  "cleans up and rejects %s failure without fallback",
  async (failure) => {
    let destroyed = false;
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      let data: unknown = {};
      if (init?.method === "DELETE") {
        destroyed = true;
        data = { status: "destroying" };
      } else if (url.endsWith("/sandboxes")) data = { id: "sb-errors" };
      else if (url.endsWith("/sb-errors"))
        data = {
          status: destroyed ? "destroyed" : "running",
          shape: "s-1vcpu-1gb",
          vcpu: 1,
          mem_mib: 1024,
          ingress_enabled: false,
        };
      else if (url.endsWith("/egress"))
        data = { egress: failure === "policy" ? [] : ["127.0.0.1:9"] };
      else if (url.endsWith("/exec")) {
        if (failure === "timeout") throw new Error("private transport detail");
        data = { result: { exit_code: 0 } };
      } else if (url.includes("/files") && init?.method !== "PUT")
        return new Response("x".repeat(1048577));
      return Response.json({ status: "success", data });
    }) as typeof fetch;
    await expect(
      executeSandbox(
        { files: { "runner.mjs": "// trusted" }, artifact: "observation.json" },
        { apiKey: "synthetic", fetcher },
      ),
    ).rejects.toMatchObject({ environment: { cleanup: "destroyed" } });
    expect(destroyed).toBe(true);
  },
);
