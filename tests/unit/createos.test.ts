import { it, expect } from "vitest";
import { baseline } from "../../packages/core/index";
import { createOSBackend } from "../../packages/counterfactual/createos";
import { runExperiment } from "../../packages/counterfactual/index";
import { executePayment } from "../../examples/payment-agent/index";
it("classifies missing CreateOS credentials without local execution", async () => {
  const r = await runExperiment(baseline(), createOSBackend({ apiKey: "" }));
  expect(r.verdict).toBe("INFRA_ERROR");
  expect(r.error).toContain("UNCONFIGURED");
  expect(r.observation).toBeUndefined();
});
it("uses documented REST operations, retrieves artifact and confirms destruction", async () => {
  const observation = await executePayment(baseline());
  const calls: { url: string; method: string; body?: string }[] = [];
  let destroyed = false;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input),
      method = init?.method ?? "GET";
    calls.push({
      url,
      method,
      body: typeof init?.body === "string" ? init.body : undefined,
    });
    let data: unknown = {};
    if (url.endsWith("/sandboxes") && method === "POST")
      data = { id: "sb-test" };
    else if (url.endsWith("/sb-test") && method === "DELETE") {
      destroyed = true;
      data = { status: "destroying" };
    } else if (url.endsWith("/sb-test"))
      data = { status: destroyed ? "destroyed" : "running" };
    else if (url.includes("/exec"))
      data = { result: { exit_code: 0, stdout: "", stderr: "" } };
    else if (url.includes("/files") && method === "GET")
      return new Response(JSON.stringify(observation));
    return Response.json({ status: "success", data });
  }) as typeof fetch;
  const r = await runExperiment(
    baseline(),
    createOSBackend({
      apiKey: "synthetic-test-token",
      fetcher,
      bundle: async () => "// test bundle",
    }),
  );
  expect(r.verdict).toBe("PASS");
  expect(r.backend).toBe("createos");
  expect(r.environment.cleanup).toBe("destroyed");
  expect(calls.filter((c) => c.method === "PUT")).toHaveLength(2);
  expect(calls.some((c) => c.method === "DELETE")).toBe(true);
  expect(JSON.parse(calls[0].body!).egress).toEqual(["127.0.0.1"]);
  expect(
    JSON.parse(calls.find((c) => c.url.endsWith("/exec"))!.body!).cmd,
  ).toBe("node");
});
it("cleans up after a failed command and reports infrastructure error", async () => {
  let destroyed = false;
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    let data: unknown = {};
    if (init?.method === "DELETE") {
      destroyed = true;
      data = { status: "destroying" };
    } else if (url.endsWith("/sandboxes")) data = { id: "sb-test" };
    else if (url.endsWith("/sb-test"))
      data = { status: destroyed ? "destroyed" : "running" };
    else if (url.endsWith("/exec"))
      data = { result: { exit_code: 1, stderr: "failure" } };
    return Response.json({ status: "success", data });
  }) as typeof fetch;
  const r = await runExperiment(
    baseline(),
    createOSBackend({ apiKey: "test", fetcher, bundle: async () => "" }),
  );
  expect(destroyed).toBe(true);
  expect(r.verdict).toBe("INFRA_ERROR");
  expect(r.invariants).toEqual([]);
});
it("does not claim successful cleanup after provider deletion failure", async () => {
  const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
    if (init?.method === "DELETE") return new Response("", { status: 503 });
    const url = String(input);
    const data = url.endsWith("/sandboxes")
      ? { id: "sb-test" }
      : url.endsWith("/exec")
        ? { result: { exit_code: 1 } }
        : { status: "running" };
    return Response.json({ status: "success", data });
  }) as typeof fetch;
  const r = await runExperiment(
    baseline(),
    createOSBackend({ apiKey: "test", fetcher, bundle: async () => "" }),
  );
  expect(r.verdict).toBe("INFRA_ERROR");
  expect(r.error).toContain("CLEANUP_UNCONFIRMED");
});
