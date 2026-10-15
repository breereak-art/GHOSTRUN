import {
  baseline,
  fingerprint,
  type AgentVersion,
  type Category,
  type World,
  type Run,
} from "../core/index";
import { registry, operator, validateWorld } from "../fault-operators/index";
export function withFaults(
  parent: World,
  faults: World["faults"],
  source: World["metadata"]["source"] = "mutation",
): World {
  const w = structuredClone(parent);
  w.parentId = parent.id;
  w.faults = faults;
  w.events = faults.some((f) => f.operator === "concurrent-attempts")
    ? ["attempt-1", "attempt-2"]
    : ["attempt-1"];
  w.metadata = {
    reason:
      source === "minimization"
        ? "Remove unnecessary fault while preserving violation"
        : "Concrete operator transformation",
    source,
    depth:
      source === "minimization"
        ? parent.metadata.depth
        : parent.metadata.depth + 1,
  };
  w.id = fingerprint(w);
  return w;
}
export function generate(
  agent: AgentVersion,
  seed: number,
  categories: Category[],
): World[] {
  const root = baseline(agent, seed);
  return [
    root,
    ...registry
      .filter((o) => categories.includes(o.category))
      .map((o) => {
        const w = withFaults(
          root,
          [
            {
              operator: o.id,
              point: o.point,
              magnitude: o.id === "delay" ? 125 * (1 + (seed % 4)) : 1,
            },
          ],
          "deterministic",
        );
        w.metadata.reason = o.description + "; precondition: " + o.precondition;
        return w;
      }),
  ];
}
export function mutate(
  world: World,
  run: Run,
  categories: Category[],
  maxDepth: number,
): World[] {
  if (
    world.metadata.depth >= maxDepth ||
    !run.observation?.completed ||
    run.verdict === "INFRA_ERROR"
  )
    return [];
  const retry =
    run.observation.events.filter(
      (e) => e.kind === "tool.call" && e.tool === "bank.transfer",
    ).length > 1;
  const relevant = registry.filter(
    (o) =>
      categories.includes(o.category) &&
      !world.faults.some((f) => f.operator === o.id),
  );
  const ranked = relevant.sort(
    (a, b) =>
      Number(retry && ["state", "concurrency"].includes(b.category)) -
        Number(retry && ["state", "concurrency"].includes(a.category)) ||
      b.risk - a.risk,
  );
  return ranked
    .slice(0, 5)
    .map((o) =>
      withFaults(world, [
        ...world.faults,
        {
          operator: o.id,
          point: o.point,
          magnitude: o.id === "delay" ? 500 : 1,
        },
      ]),
    )
    .concat(
      world.faults.some((f) => f.operator === "delay")
        ? [
            withFaults(
              world,
              world.faults.map((f) =>
                f.operator === "delay"
                  ? { ...f, magnitude: Math.min(5000, f.magnitude * 2) }
                  : f,
              ),
            ),
          ]
        : [],
    );
}
export function behavior(run: Run): string {
  return JSON.stringify({
    tools: run.observation?.events
      .filter((e) => e.kind === "tool.call")
      .map((e) => e.tool),
    records: run.observation?.records.map((r) => r.status),
    commits: run.observation?.ledger.length,
    verdict: run.verdict,
  });
}
export function priority(w: World, tested: Map<Category, number>, novelty = 1) {
  const ops = w.faults.map((f) => operator(f.operator));
  const risk = ops.length ? Math.max(...ops.map((o) => o.risk)) : 1;
  const coverage = ops.length
    ? Math.max(...ops.map((o) => 1 / (1 + (tested.get(o.category) ?? 0))))
    : 1;
  const cost = 1 + ops.reduce((s, o) => s + o.cost, 0);
  const score = (risk * novelty * coverage) / cost;
  return {
    score,
    risk,
    novelty,
    coverage,
    cost,
    reason: `risk ${risk} × novelty ${novelty.toFixed(2)} × coverage ${coverage.toFixed(2)} ÷ cost ${cost}`,
  };
}
export function prune(w: World, seen: Set<string>): string | undefined {
  const validation = validateWorld(w);
  if (!validation.valid) return validation.reasons.join("; ");
  const key = fingerprint(w);
  if (seen.has(key)) return "Semantically equivalent world already considered";
  return undefined;
}
