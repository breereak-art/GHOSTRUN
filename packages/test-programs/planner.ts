import { validateProgram } from "./index";
import { registry } from "../fault-operators/index";
import { tools, invariantIds } from "../core/index";
import { limitedText } from "../counterfactual/sandbox";
export async function planProgram(fetcher: typeof fetch = fetch) {
  const {
    PLANNER_API_KEY: key,
    PLANNER_URL: url,
    PLANNER_MODEL: model,
  } = process.env;
  if (!key || !url || !model) throw new Error("PLANNER_UNCONFIGURED");
  if (new URL(url).protocol !== "https:")
    throw new Error("PLANNER_HTTPS_REQUIRED");
  const nvidiaNemotron =
    new URL(url).hostname === "integrate.api.nvidia.com" &&
    model === "nvidia/nemotron-3.5-super-vl-120b-a12b";
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(nvidiaNemotron ? 90000 : 15000),
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: nvidiaNemotron ? 1 : 0,
        stream: false,
        max_tokens: 2048,
        ...(nvidiaNemotron
          ? {
              top_p: 0.95,
              seed: 42,
              chat_template_kwargs: { enable_thinking: false },
            }
          : {}),
        messages: [
          {
            role: "system",
            content:
              "Write a bounded test program, not a report. Return exactly one JSON object with the single key source and a string value containing JavaScript. No markdown. Generate 2 to 4 separate statements: one baseline and other independent single-fault experiments you select from the provided operator registry for ambiguous payment outcomes. Each statement must be await ghost.run({faults:[],amount:12500}); or the same call with EXACTLY ONE fault object {operator,point,magnitude}. Do not combine faults or copy the whole registry into one call. Use each operator's exact id and point. Magnitude is an integer 1..5000; use 1 unless latency calls for more. Put SINGLE QUOTES around JavaScript string values so they need no escaping inside the outer JSON string. Never put literal backslashes before JavaScript quotes. Only JSON-style string/number/object/array literals are allowed. No imports, variables, functions, loops, computed properties, assertions, filesystem, process, network or other calls. The host verifies invariants independently; do not return verdicts.",
          },
          {
            role: "user",
            content: JSON.stringify({
              tools,
              invariants: invariantIds,
              operators: registry,
            }),
          },
        ],
      }),
    });
  } catch (error) {
    throw new Error(
      error instanceof Error &&
        (error.name === "TimeoutError" || error.name === "AbortError")
        ? "PLANNER_TIMEOUT"
        : "PLANNER_TRANSPORT_ERROR",
    );
  }
  if (!response.ok) throw new Error("PLANNER_HTTP_" + response.status);
  const body = JSON.parse(await limitedText(response, 65536));
  if (body.choices?.[0]?.finish_reason === "length")
    throw new Error("PLANNER_OUTPUT_TRUNCATED");
  // Reasoning is not executable output. Only final content enters validation.
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length > 32768)
    throw new Error("PLANNER_INVALID_RESPONSE");
  let parsed;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error("PLANNER_INVALID_JSON");
  }
  if (
    !parsed ||
    typeof parsed.source !== "string" ||
    Object.keys(parsed).some((k) => k !== "source")
  )
    throw new Error("PLANNER_INVALID_PROGRAM_ENVELOPE");
  return validateProgram(parsed.source, {
    source: "llm",
    model,
    createdAt: new Date().toISOString(),
  });
}
