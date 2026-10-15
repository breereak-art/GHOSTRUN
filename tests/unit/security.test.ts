import { it, expect } from "vitest";
import { allowedRequest } from "../../apps/api/security";
it("accepts browser loopback host despite Next URL normalization", () => {
  expect(
    allowedRequest(
      new Request("http://localhost:3100/api/campaigns", {
        headers: { host: "127.0.0.1:3100", origin: "http://127.0.0.1:3100" },
      }),
    ),
  ).toBe(true);
});
it("rejects hostile origins and DNS rebinding hosts", () => {
  expect(
    allowedRequest(
      new Request("http://localhost:3100/api/campaigns", {
        headers: { host: "127.0.0.1:3100", origin: "https://evil.example" },
      }),
    ),
  ).toBe(false);
  expect(
    allowedRequest(
      new Request("http://evil.example/api/campaigns", {
        headers: { host: "evil.example", origin: "http://evil.example" },
      }),
    ),
  ).toBe(false);
});
