import { existsSync } from "node:fs";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { planProgram } from "../packages/test-programs/planner";
import { executeProgram } from "../packages/test-programs/execute";
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
await mkdir("data/programs", { recursive: true });
const mode = process.argv[2];
try {
  const result =
    mode === "plan"
      ? await planProgram()
      : mode === "run"
        ? await executeProgram(
            JSON.parse(await readFile(process.argv[3], "utf8")),
            process.argv[4] === "hardened"
              ? "payment-hardened@1"
              : "payment-vulnerable@1",
          )
        : undefined;
  if (!result) throw new Error("Use plan or run <program.json> [hardened]");
  const path = "data/programs/" + randomUUID() + ".json";
  await writeFile(path, JSON.stringify(result, null, 2));
  console.log(path);
} catch (e) {
  const report = {
    backend: "createos",
    status:
      e instanceof Error &&
      (e.message.startsWith("PROGRAM_") ||
        e.name === "ZodError" ||
        e instanceof SyntaxError)
        ? "INVALID"
        : "INFRA_ERROR",
    error: e instanceof Error ? e.message : "PROGRAM_FAILED",
    environment:
      e instanceof Error && "environment" in e ? e.environment : undefined,
  };
  const path = "data/programs/" + randomUUID() + ".json";
  await writeFile(path, JSON.stringify(report, null, 2));
  console.log(
    JSON.stringify({ status: report.status, path, error: report.error }),
  );
  process.exitCode = 1;
}
