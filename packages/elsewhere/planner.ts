import { z } from "zod";
import {
  baseline,
  faultSchema,
  fingerprint,
  tools,
  invariantIds,
  type CampaignConfig,
  type World,
} from "../core/index";
import { registry, validateWorld } from "../fault-operators/index";
import { withFaults } from "./index";
const proposals = z
  .object({
    candidates: z
      .array(
        z
          .object({
            faults: z.array(faultSchema).min(1).max(4),
            reason: z.string().max(500),
          })
          .strict(),
      )
      .max(12),
  })
  .strict();
export async function plan(
  config: CampaignConfig,
  fetcher: typeof fetch = fetch,
): Promise<{ worlds: World[]; rejected: string[]; model: string }> {
  const {
    PLANNER_API_KEY: key,
    PLANNER_URL: url,
    PLANNER_MODEL: model,
  } = process.env;
  if (!key || !url || !model)
    throw new Error(
      "PLANNER_UNCONFIGURED: deterministic mode remains available",
    );
  if (new URL(url).protocol !== "https:")
    throw new Error("Planner endpoint must use HTTPS");
  const response = await fetcher(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer " + key,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
    body: JSON.stringify({
      model,
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Propose test data only. Return JSON {candidates:[{faults:[{operator,point,magnitude}],reason}]}. Use only supplied operator IDs and injection points. Never produce commands or code. At most 12 candidates.",
        },
        {
          role: "user",
          content: JSON.stringify({
            tools,
            invariants: invariantIds,
            operators: registry.filter((o) =>
              config.categories.includes(o.category),
            ),
            seed: config.seed,
          }),
        },
      ],
    }),
  });
  if (!response.ok) throw new Error("PLANNER_HTTP_" + response.status);
  const result = await response.json();
  const content = result.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.length > 32000)
    throw new Error("PLANNER_INVALID_RESPONSE");
  const checked = proposals.safeParse(JSON.parse(content));
  if (!checked.success)
    return {
      worlds: [],
      model,
      rejected: checked.error.issues.map(
        (i) => i.path.join(".") + ": " + i.message,
      ),
    };
  const worlds: World[] = [],
    rejected: string[] = [];
  for (const proposal of checked.data.candidates) {
    const w = withFaults(
      baseline(config.agentVersion, config.seed),
      proposal.faults,
      "llm",
    );
    w.metadata = { source: "llm", reason: proposal.reason, depth: 1, model };
    w.id = fingerprint(w);
    const validation = validateWorld(w);
    if (
      w.faults.some(
        (f) =>
          !config.categories.includes(
            registry.find((o) => o.id === f.operator)!.category,
          ),
      )
    ) {
      rejected.push("Proposal outside selected categories");
      continue;
    }
    if (validation.valid) worlds.push(w);
    else rejected.push(...validation.reasons);
  }
  return { worlds, rejected, model };
}
