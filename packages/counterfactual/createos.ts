import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { z } from "zod";
import type { Backend } from "./index";
import type { Observation } from "../core/index";

const observationSchema = z.object({
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
export function createOSBackend(
  options: {
    apiKey?: string;
    fetcher?: typeof fetch;
    bundle?: () => Promise<string>;
  } = {},
): Backend {
  const apiKey = options.apiKey ?? process.env.CREATEOS_SANDBOX_API_KEY;
  const fetcher = options.fetcher ?? fetch;
  return {
    name: "createos",
    async execute(world) {
      if (!apiKey)
        throw new Error(
          "CREATEOS_UNCONFIGURED: set server-side CREATEOS_SANDBOX_API_KEY",
        );
      const bundle = await (options.bundle?.() ??
        readFile("dist/sandbox-runner.mjs", "utf8"));
      const base = "https://api.sb.createos.sh/v1/sandboxes";
      let id: string | undefined;
      let cleanup = "not-created";
      let executionError: unknown;
      let observation: Observation | undefined;
      let command:
        { exitCode: number | null; stdout: string; stderr: string } | undefined;
      // Provisioning has a separate bounded deadline from the target command.
      const request = async (
        path: string,
        init: RequestInit = {},
        timeout = 30000,
      ) => {
        const response = await fetcher(base + path, {
          ...init,
          headers: { "X-Api-Key": apiKey, ...init.headers },
          signal: AbortSignal.timeout(timeout),
        });
        if (!response.ok) throw new Error("CREATEOS_HTTP_" + response.status);
        return response;
      };
      const json = async (
        path: string,
        init: RequestInit = {},
        timeout = 30000,
      ) => {
        const response = await request(
          path,
          {
            ...init,
            headers: { "Content-Type": "application/json", ...init.headers },
          },
          timeout,
        );
        const envelope = await response.json();
        if (envelope.status !== "success")
          throw new Error("CREATEOS_INVALID_ENVELOPE");
        return envelope.data;
      };
      try {
        const created = await json("", {
          method: "POST",
          body: JSON.stringify({
            shape: "s-1vcpu-1gb",
            rootfs: "devbox:1",
            ingress_enabled: false,
            auto_pause_after_seconds: 60,
            egress: ["127.0.0.1"],
          }),
        });
        if (
          typeof created.id !== "string" ||
          !/^sb-[a-zA-Z0-9-]+$/.test(created.id)
        )
          throw new Error("CREATEOS_MISSING_SANDBOX_ID");
        id = created.id;
        const deadline = Date.now() + 30000;
        while (true) {
          const state = await json("/" + id);
          if (state.status === "running") break;
          if (
            ["failed", "error", "destroyed"].includes(state.status) ||
            Date.now() > deadline
          )
            throw new Error("CREATEOS_PROVISIONING_FAILED");
          await new Promise((r) => setTimeout(r, 500));
        }
        for (const [path, body] of [
          ["/workspace/runner.mjs", bundle],
          ["/workspace/world.json", JSON.stringify(world)],
        ]) {
          await request("/" + id + "/files?path=" + encodeURIComponent(path), {
            method: "PUT",
            headers: { "Content-Type": "application/octet-stream" },
            body,
          });
        }
        const executed = await json(
          "/" + id + "/exec",
          {
            method: "POST",
            body: JSON.stringify({
              cmd: "node",
              args: ["/workspace/runner.mjs"],
            }),
          },
          world.budget.timeoutMs,
        );
        command = {
          exitCode:
            typeof executed.result?.exit_code === "number"
              ? executed.result.exit_code
              : null,
          stdout: String(executed.result?.stdout ?? "").slice(0, 65536),
          stderr: String(executed.result?.stderr ?? "").slice(0, 65536),
        };
        if (executed.result?.exit_code !== 0)
          throw new Error(
            "CREATEOS_EXECUTION_FAILED: exit " +
              String(executed.result?.exit_code),
          );
        const output = await request(
          "/" +
            id +
            "/files?path=" +
            encodeURIComponent("/workspace/observation.json"),
        );
        const raw = await output.text();
        if (raw.length > 1000000)
          throw new Error("CREATEOS_ARTIFACT_TOO_LARGE");
        observation = observationSchema.parse(JSON.parse(raw));
        // Only the reviewed bundled runner is deployed; no target-controlled commands.
      } catch (e) {
        executionError = e;
      } finally {
        if (id) {
          try {
            await json("/" + id, { method: "DELETE" });
            const until = Date.now() + 15000;
            while (Date.now() < until) {
              const state = await request("/" + id).catch((e) => {
                if (e instanceof Error && e.message === "CREATEOS_HTTP_404")
                  return null;
                throw e;
              });
              if (!state || (await state.json()).data?.status === "destroyed") {
                cleanup = "destroyed";
                break;
              }
              await new Promise((r) => setTimeout(r, 500));
            }
            if (cleanup !== "destroyed")
              throw new Error("Cleanup did not reach destroyed state");
          } catch {
            throw Object.assign(
              new Error(
                "CREATEOS_CLEANUP_UNCONFIRMED: sandbox " +
                  id +
                  "; inspect provider dashboard",
              ),
              {
                environment: { sandboxId: id, cleanup: "unconfirmed", command },
              },
            );
          }
        }
      }
      if (executionError)
        throw Object.assign(
          executionError instanceof Error
            ? executionError
            : new Error("CREATEOS_EXECUTION_FAILED"),
          { environment: { sandboxId: id, cleanup, command } },
        );
      if (!observation) throw new Error("CREATEOS_NO_OBSERVATION");
      return {
        observation,
        environment: {
          sandboxId: id,
          shape: "s-1vcpu-1gb",
          rootfs: "devbox:1",
          cleanup,
          command,
          egress: ["127.0.0.1"],
          fixtureVersion: "1",
          bundleHash: createHash("sha256").update(bundle).digest("hex"),
        },
      };
    },
  };
}
