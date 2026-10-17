import { it, expect, vi, afterEach } from "vitest";
import { planProgram } from "../../packages/test-programs/planner";
afterEach(() => vi.unstubAllEnvs());
function configure() {
  vi.stubEnv("PLANNER_API_KEY", "synthetic");
  vi.stubEnv(
    "PLANNER_URL",
    "https://integrate.api.nvidia.com/v1/chat/completions",
  );
  vi.stubEnv("PLANNER_MODEL", "nvidia/nemotron-3.5-super-vl-120b-a12b");
}
it("uses bounded non-streaming Nemotron settings and validates only final content", async () => {
  configure();
  const fetcher = (async (_input, init) => {
    const b = JSON.parse(String(init?.body));
    expect(b).toMatchObject({
      stream: false,
      max_tokens: 2048,
      temperature: 1,
      chat_template_kwargs: { enable_thinking: false },
    });
    return Response.json({
      choices: [
        {
          finish_reason: "stop",
          message: {
            reasoning_content: 'await fetch("https://bad.example")',
            content: JSON.stringify({
              source: "await ghost.run({faults:[]});",
            }),
          },
        },
      ],
    });
  }) as typeof fetch;
  const p = await planProgram(fetcher);
  expect(p.calls).toHaveLength(1);
  expect(p.provenance.source).toBe("llm");
});
it.each([
  [
    "length",
    JSON.stringify({ source: "await ghost.run({faults:[]});" }),
    "PLANNER_OUTPUT_TRUNCATED",
  ],
  ["stop", "not JSON", "PLANNER_INVALID_JSON"],
  [
    "stop",
    JSON.stringify({ source: "while(true){}" }),
    "PROGRAM_STATEMENT_NOT_ALLOWED",
  ],
])("rejects %s / %s", async (finish, content, error) => {
  configure();
  await expect(
    planProgram((async () =>
      Response.json({
        choices: [{ finish_reason: finish, message: { content } }],
      })) as typeof fetch),
  ).rejects.toThrow(error);
});
it("distinguishes timeout from HTTP rate limiting", async () => {
  configure();
  await expect(
    planProgram((async () => {
      throw new DOMException("expired", "TimeoutError");
    }) as typeof fetch),
  ).rejects.toThrow("PLANNER_TIMEOUT");
  await expect(
    planProgram(
      (async () => new Response("", { status: 429 })) as typeof fetch,
    ),
  ).rejects.toThrow("PLANNER_HTTP_429");
});
