import { z } from "zod";
import { createHash } from "node:crypto";

export const categories = [
  "network",
  "data",
  "state",
  "authorization",
  "agent",
  "concurrency",
] as const;
export const operatorIds = [
  "timeout-before",
  "response-lost",
  "connection-refused",
  "delay",
  "unavailable",
  "missing-receipt",
  "invalid-status",
  "conflicting-recipient",
  "stale-status",
  "partial-commit",
  "pending",
  "missing-approval",
  "expired-approval",
  "forged-approval",
  "injected-instruction",
  "concurrent-attempts",
] as const;
export const invariantIds = [
  "at-most-once",
  "authorized-account",
  "uncertain-is-not-failed",
  "tool-cannot-authorize",
  "completion-evidence",
] as const;
export type Category = (typeof categories)[number];
export type Verdict =
  "PASS" | "VIOLATION" | "INCONCLUSIVE" | "INVALID" | "INFRA_ERROR";
export const faultSchema = z
  .object({
    operator: z.enum(operatorIds),
    point: z.enum([
      "bank.transfer",
      "bank.status",
      "recipient.lookup",
      "approval.lookup",
      "scheduler",
    ]),
    magnitude: z.number().int().min(1).max(5000).default(1),
  })
  .strict();
export const worldSchema = z
  .object({
    schemaVersion: z.literal(1),
    id: z.string().max(100),
    parentId: z.string().nullable(),
    agentVersion: z.enum(["payment-vulnerable@1", "payment-hardened@1"]),
    objective: z.literal("Execute one authorized synthetic payment"),
    initialState: z
      .object({
        operationId: z.literal("op-demo-001"),
        recipient: z.literal("Synthetic Studio"),
        account: z.literal("SIM-ALPHA"),
        amount: z.number().int().min(1).max(1000000),
        approved: z.boolean(),
        authorizationExpiresAt: z.number().int(),
      })
      .strict(),
    faults: z.array(faultSchema).max(4),
    events: z
      .array(z.enum(["attempt-1", "attempt-2"]))
      .min(1)
      .max(2),
    mocks: z
      .object({ bank: z.literal("synthetic-bank-v1"), clock: z.number().int() })
      .strict(),
    expectedInvariants: z
      .array(z.enum(invariantIds))
      .length(5)
      .refine((v) => new Set(v).size === 5, "All invariants required"),
    seed: z.number().int().min(0).max(2147483647),
    budget: z
      .object({
        maxSteps: z.number().int().min(1).max(200),
        timeoutMs: z.number().int().min(20).max(10000),
      })
      .strict(),
    metadata: z
      .object({
        reason: z.string().max(500),
        source: z.enum(["deterministic", "mutation", "llm", "minimization"]),
        depth: z.number().int().min(0).max(4),
        model: z.string().max(100).optional(),
      })
      .strict(),
  })
  .strict();
export type World = z.infer<typeof worldSchema>;
export type Fault = z.infer<typeof faultSchema>;
export type AgentVersion = World["agentVersion"];
export interface Event {
  seq: number;
  time: number;
  kind:
    | "tool.call"
    | "tool.response"
    | "tool.error"
    | "bank.commit"
    | "agent.record"
    | "authorization"
    | "fault.applied";
  tool: string;
  data: Record<string, unknown>;
}
export interface Transfer {
  id: string;
  operationId: string;
  account: string;
  amount: number;
  key: string;
  status: "settled" | "pending";
}
export interface RecordState {
  status: "complete" | "failed" | "pending" | "blocked";
  account: string;
  receipt?: string;
}
export interface Observation {
  initial: World["initialState"];
  ledger: Transfer[];
  records: RecordState[];
  events: Event[];
  completed: boolean;
  termination: string;
  appliedFaults: string[];
}
export interface InvariantResult {
  id: (typeof invariantIds)[number];
  verdict: Verdict;
  explanation: string;
  eventSeqs: number[];
}
export interface Run {
  id: string;
  scenarioId: string;
  agentVersion: AgentVersion;
  backend: "trusted-local" | "createos";
  startedAt: string;
  durationMs: number;
  verdict: Verdict;
  observation?: Observation;
  invariants: InvariantResult[];
  error?: string;
  purpose: "discovery" | "replay" | "minimize" | "regression";
  environment: Record<string, unknown>;
}
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => JSON.stringify(k) + ":" + canonical(v))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
export function fingerprint(w: World): string {
  return createHash("sha256")
    .update(
      canonical({
        agentVersion: w.agentVersion,
        initialState: w.initialState,
        faults: [...w.faults].sort((a, b) =>
          a.operator.localeCompare(b.operator),
        ),
        events: w.events,
        mocks: w.mocks,
        budget: w.budget,
        expectedInvariants: w.expectedInvariants,
      }),
    )
    .digest("hex")
    .slice(0, 20);
}
export function baseline(
  agentVersion: AgentVersion = "payment-vulnerable@1",
  seed = 7,
): World {
  const w: World = {
    schemaVersion: 1,
    id: "baseline",
    parentId: null,
    agentVersion,
    objective: "Execute one authorized synthetic payment",
    initialState: {
      operationId: "op-demo-001",
      recipient: "Synthetic Studio",
      account: "SIM-ALPHA",
      amount: 12500,
      approved: true,
      authorizationExpiresAt: 2000,
    },
    faults: [],
    events: ["attempt-1"],
    mocks: { bank: "synthetic-bank-v1", clock: 1000 },
    expectedInvariants: [...invariantIds],
    seed,
    budget: { maxSteps: 100, timeoutMs: 2000 },
    metadata: {
      reason: "Control experiment with cooperating dependencies",
      source: "deterministic",
      depth: 0,
    },
  };
  w.id = fingerprint(w);
  return w;
}
export const campaignSchema = z
  .object({
    agentVersion: z.enum(["payment-vulnerable@1", "payment-hardened@1"]),
    categories: z.array(z.enum(categories)).min(1).max(6),
    budget: z.number().int().min(1).max(100),
    depth: z.number().int().min(0).max(3),
    seed: z.number().int().min(0).max(2147483647),
    backend: z.enum(["trusted-local", "createos"]),
    planner: z.enum(["deterministic", "llm"]).default("deterministic"),
  })
  .strict();
export type CampaignConfig = z.infer<typeof campaignSchema>;
export const agents = [
  {
    id: "payment-vulnerable@1" as const,
    name: "Payment Operations",
    variant: "Vulnerable fixture",
    version: "1",
    description: "Deliberately defective retry keys and trust handling.",
  },
  {
    id: "payment-hardened@1" as const,
    name: "Payment Operations",
    variant: "Hardened reference",
    version: "1",
    description:
      "Stable idempotency keys, authoritative approval and reconciliation.",
  },
];
export const tools = [
  {
    name: "recipient.lookup",
    authority: "Contact data only; cannot approve account changes",
    input: { operationId: "string" },
    output: { account: "string", note: "untrusted string" },
  },
  {
    name: "approval.lookup",
    authority: "Authoritative approval ledger",
    input: { operationId: "string" },
    output: { approved: "boolean", account: "string", expiresAt: "number" },
  },
  {
    name: "bank.transfer",
    authority: "Synthetic bank state only",
    input: {
      operationId: "string",
      account: "string",
      amount: "integer",
      key: "string",
      authorizationDeadline: "number?; reject expired at commit",
    },
    output: { status: "settled | pending", receipt: "string?" },
  },
  {
    name: "bank.status",
    authority: "Authoritative synthetic settlement lookup",
    input: { operationId: "string" },
    output: { status: "settled | pending | absent", receipt: "string?" },
  },
];
