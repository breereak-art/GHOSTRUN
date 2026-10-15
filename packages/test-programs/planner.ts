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
  let response: Response;
  try {
    response = await fetcher(url, {
      method: "POST",
      redirect: "error",
      signal: AbortSignal.timeout(15000),
      headers: {
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        temperature: 0,
        messages: [
          {
            role: "system",
            content:
              'Write a bounded test program, not a report. Return JSON {"source":"JavaScript source"}. Source must contain only 1 to 8 statements: await ghost.run({faults:[{operator,point,magnitude}],amount:12500});. Only JSON-style string/number/object/array literals are allowed. No imports, variables, functions, loops, computed properties, assertions, filesystem, process, network or other calls. ghost.run executes an isolated synthetic payment fixture; deterministic verification is external to your program. Propose baseline and ambiguous payment outcomes using supported operators.',
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
  } catch {
    throw new Error("PLANNER_TRANSPORT_ERROR");
  }
  if (!response.ok) throw new Error("PLANNER_HTTP_" + response.status);
  const body = JSON.parse(await limitedText(response, 65536));
  const content = body.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length > 32768)
    throw new Error("PLANNER_INVALID_RESPONSE");
  const parsed = JSON.parse(content);
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
