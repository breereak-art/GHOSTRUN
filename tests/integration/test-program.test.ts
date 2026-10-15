import { it, expect } from "vitest";
import { validateProgram } from "../../packages/test-programs/index";
import { executeProgram } from "../../packages/test-programs/execute";
import { executePayment } from "../../examples/payment-agent/index";
const source =
  'await ghost.run({faults:[{operator:"response-lost",point:"bank.transfer",magnitude:1}]});';
it.each([
  'import "node:fs";',
  'await fetch("https://example.com");',
  "while(true){}",
  'await ghost["run"]({faults:[]});',
  "await ghost.run({...x});",
  "await ghost.run({faults:[],get amount(){return 1}});",
  "await ghost.run({faults:[],__proto__:{}});",
  "await ghost.run({faults:[],amount:process.exit()});",
  "await ghost.run({faults:[],amount:1,amount:2});",
  "await ghost.run({faults:[]});".repeat(9),
])("rejects executable capabilities outside the language: %s", (s) => {
  expect(() => validateProgram(s)).toThrow();
});
it("canonicalizes literals without evaluating code", () => {
  const p = validateProgram(source);
  expect(p.calls).toHaveLength(1);
  expect(p.canonicalSource).toContain('"amount":12500');
  expect(p.provenance.source).toBe("manual");
});
it("rejects unknown operators and invalid preconditions", () => {
  expect(() =>
    validateProgram(
      'await ghost.run({faults:[{operator:"shell",point:"bank.transfer",magnitude:1}]});',
    ),
  ).toThrow();
});
it("never falls back to host execution without credentials", async () => {
  await expect(
    executeProgram(validateProgram(source), "payment-vulnerable@1", {
      apiKey: "",
      bundle: async () => {
        throw new Error("must not load");
      },
    }),
  ).rejects.toThrow("UNCONFIGURED");
});
it.each(["payment-vulnerable@1", "payment-hardened@1"] as const)(
  "verifies mocked remote artifacts independently for %s",
  async (agent) => {
    let manifest: any;
    let destroyed = false;
    let uploads = 0;
    const fetcher = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      expect(init?.redirect).toBe("error");
      let data: unknown = {};
      if (init?.method === "DELETE") {
        destroyed = true;
        data = { status: "destroying" };
      } else if (url.endsWith("/sandboxes")) data = { id: "sb-program" };
      else if (url.endsWith("/egress")) data = { egress: ["127.0.0.1:9"] };
      else if (url.endsWith("/sb-program"))
        data = {
          status: destroyed ? "destroyed" : "running",
          shape: "s-1vcpu-1gb",
          vcpu: 1,
          mem_mib: 1024,
          ingress_enabled: false,
        };
      else if (init?.method === "PUT") {
        uploads++;
        if (decodeURIComponent(url).endsWith("manifest.json"))
          manifest = JSON.parse(String(init.body));
      } else if (url.endsWith("/exec")) {
        expect(JSON.parse(String(init?.body)).cmd).toBe("timeout");
        data = { result: { exit_code: 0 } };
      } else if (url.includes("/files")) {
        // Mock transport uses only the reviewed fixture. Generated source is never imported/evaluated here.
        return Response.json({
          hash: manifest.hash,
          observations: await Promise.all(manifest.worlds.map(executePayment)),
        });
      }
      return Response.json({ status: "success", data });
    }) as typeof fetch;
    const result = await executeProgram(validateProgram(source), agent, {
      apiKey: "synthetic",
      fetcher,
      bundle: async () => "// mocked remote harness",
    });
    expect(result.runs[0].verdict).toBe(
      agent === "payment-vulnerable@1" ? "VIOLATION" : "PASS",
    );
    expect(result.backend).toBe("createos");
    expect(destroyed).toBe(true);
    expect(uploads).toBe(3);
  },
);
