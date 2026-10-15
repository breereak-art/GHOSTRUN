import ts from "typescript";
import { z } from "zod";
import { createHash } from "node:crypto";
import {
  baseline,
  faultSchema,
  fingerprint,
  type AgentVersion,
  type World,
} from "../core/index";
import { validateWorld } from "../fault-operators/index";

export const callSchema = z
  .object({
    faults: z.array(faultSchema).max(4),
    amount: z.number().int().min(1).max(1000000).default(12500),
  })
  .strict();
export interface ValidatedProgram {
  schemaVersion: 1;
  language: "ghost-js-v1";
  source: string;
  sourceHash: string;
  canonicalSource: string;
  canonicalHash: string;
  calls: z.infer<typeof callSchema>[];
  provenance: { source: "llm" | "manual"; model?: string; createdAt: string };
}
const hash = (s: string) => createHash("sha256").update(s).digest("hex");
function literal(node: ts.Expression, depth = 0): unknown {
  if (depth > 8) throw new Error("PROGRAM_LITERAL_DEPTH");
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isArrayLiteralExpression(node)) {
    if (node.elements.length > 8) throw new Error("PROGRAM_ARRAY_LIMIT");
    return node.elements.map((n) => literal(n as ts.Expression, depth + 1));
  }
  if (ts.isObjectLiteralExpression(node)) {
    const value: Record<string, unknown> = Object.create(null);
    if (node.properties.length > 8) throw new Error("PROGRAM_OBJECT_LIMIT");
    for (const p of node.properties) {
      if (
        !ts.isPropertyAssignment(p) ||
        (!ts.isIdentifier(p.name) && !ts.isStringLiteral(p.name))
      )
        throw new Error("PROGRAM_LITERAL_ONLY");
      const key = p.name.text;
      if (
        ["__proto__", "constructor", "prototype"].includes(key) ||
        Object.hasOwn(value, key)
      )
        throw new Error("PROGRAM_UNSAFE_KEY");
      value[key] = literal(p.initializer, depth + 1);
    }
    return value;
  }
  throw new Error("PROGRAM_LITERAL_ONLY");
}
export function validateProgram(
  source: string,
  provenance: ValidatedProgram["provenance"] = {
    source: "manual",
    createdAt: new Date().toISOString(),
  },
): ValidatedProgram {
  provenance = z
    .object({
      source: z.enum(["llm", "manual"]),
      model: z.string().min(1).max(200).optional(),
      createdAt: z.string().datetime(),
    })
    .strict()
    .parse(provenance);
  if (provenance.source === "llm" && !provenance.model)
    throw new Error("PROGRAM_MODEL_REQUIRED");
  if (typeof source !== "string" || Buffer.byteLength(source) > 16384)
    throw new Error("PROGRAM_SOURCE_LIMIT");
  const tree = ts.createSourceFile(
    "planner.mjs",
    source,
    ts.ScriptTarget.ES2022,
    true,
    ts.ScriptKind.JS,
  );
  const diagnostics = (
    tree as ts.SourceFile & { parseDiagnostics: readonly ts.Diagnostic[] }
  ).parseDiagnostics;
  if (diagnostics.length) throw new Error("PROGRAM_SYNTAX");
  if (tree.statements.length < 1 || tree.statements.length > 8)
    throw new Error("PROGRAM_CALL_LIMIT");
  const calls = tree.statements.map((statement) => {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isAwaitExpression(statement.expression)
    )
      throw new Error("PROGRAM_STATEMENT_NOT_ALLOWED");
    const call = statement.expression.expression;
    if (
      !ts.isCallExpression(call) ||
      call.questionDotToken ||
      call.typeArguments ||
      call.arguments.length !== 1 ||
      !ts.isPropertyAccessExpression(call.expression) ||
      call.expression.questionDotToken ||
      !ts.isIdentifier(call.expression.expression) ||
      call.expression.expression.text !== "ghost" ||
      call.expression.name.text !== "run"
    )
      throw new Error("PROGRAM_CAPABILITY_NOT_ALLOWED");
    const checked = callSchema.safeParse(literal(call.arguments[0]));
    if (!checked.success) throw new Error("PROGRAM_INVALID_CALL");
    const w = worldForCall(checked.data, "payment-vulnerable@1");
    const valid = validateWorld(w);
    if (!valid.valid)
      throw new Error("PROGRAM_INVALID_WORLD: " + valid.reasons.join("; "));
    return checked.data;
  });
  // Emit only canonical allowlisted statements, never evaluate the input AST.
  const canonicalSource =
    calls.map((c) => "await ghost.run(" + JSON.stringify(c) + ");").join("\n") +
    "\n";
  return {
    schemaVersion: 1,
    language: "ghost-js-v1",
    source,
    sourceHash: hash(source),
    canonicalSource,
    canonicalHash: hash(canonicalSource),
    calls,
    provenance,
  };
}
export function worldForCall(
  call: z.infer<typeof callSchema>,
  agent: AgentVersion,
): World {
  const w = baseline(agent, 7);
  w.faults = call.faults;
  w.initialState.amount = call.amount;
  w.events = call.faults.some((f) => f.operator === "concurrent-attempts")
    ? ["attempt-1", "attempt-2"]
    : ["attempt-1"];
  w.metadata = {
    source: "deterministic",
    depth: 0,
    reason: "Validated ghost-js-v1 capability call",
  };
  w.budget = { maxSteps: 100, timeoutMs: 2000 };
  w.id = fingerprint(w);
  return w;
}
