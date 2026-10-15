import { z } from "zod";
export const observationSchema = z.object({
  initial: z.object({
    operationId: z.literal("op-demo-001"),
    recipient: z.literal("Synthetic Studio"),
    account: z.literal("SIM-ALPHA"),
    amount: z.number(),
    approved: z.boolean(),
    authorizationExpiresAt: z.number(),
  }),
  ledger: z
    .array(
      z.object({
        id: z.string(),
        operationId: z.string(),
        account: z.string(),
        amount: z.number(),
        key: z.string(),
        status: z.enum(["settled", "pending"]),
      }),
    )
    .max(200),
  records: z
    .array(
      z.object({
        status: z.enum(["complete", "failed", "pending", "blocked"]),
        account: z.string(),
        receipt: z.string().optional(),
      }),
    )
    .max(200),
  events: z
    .array(
      z.object({
        seq: z.number().int(),
        time: z.number(),
        kind: z.enum([
          "tool.call",
          "tool.response",
          "tool.error",
          "bank.commit",
          "agent.record",
          "authorization",
          "fault.applied",
        ]),
        tool: z.string(),
        data: z.record(z.unknown()),
      }),
    )
    .max(200),
  completed: z.boolean(),
  termination: z.string(),
  appliedFaults: z.array(z.string()).max(16),
});
