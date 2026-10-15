import { createHash } from "node:crypto";
export interface SandboxOptions {
  apiKey?: string;
  fetcher?: typeof fetch;
}
export interface SandboxWorkload {
  files: Record<string, string>;
  artifact: "observation.json" | "program-output.json";
}
export async function limitedText(
  response: Response,
  limit: number,
): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("EMPTY_RESPONSE_BODY");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > limit) throw new Error("RESPONSE_SIZE_LIMIT");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => {});
  }
  return Buffer.concat(chunks).toString("utf8");
}
export async function executeSandbox(
  workload: SandboxWorkload,
  options: SandboxOptions = {},
) {
  const key = options.apiKey ?? process.env.CREATEOS_SANDBOX_API_KEY;
  if (!key?.trim())
    throw new Error(
      "CREATEOS_UNCONFIGURED: set server-side CREATEOS_SANDBOX_API_KEY",
    );
  const fetcher = options.fetcher ?? fetch,
    base = "https://api.sb.createos.sh/v1/sandboxes";
  const allowed = new Set([
    "runner.mjs",
    "world.json",
    "program.mjs",
    "manifest.json",
  ]);
  for (const [name, body] of Object.entries(workload.files))
    if (!allowed.has(name) || Buffer.byteLength(body) > 1048576)
      throw new Error("INVALID_SANDBOX_FILE");
  if (!workload.files["runner.mjs"]) throw new Error("MISSING_SANDBOX_RUNNER");
  let id: string | undefined,
    cleanup = "not-created",
    phase = "provisioning",
    deadline = Date.now() + 90000;
  let command:
    { exitCode: number | null; stdout: string; stderr: string } | undefined;
  const lifecycle: { phase: string; at: string; status: number }[] = [];
  const environment = () => ({
    sandboxId: id,
    cleanup,
    command,
    lifecycle,
    phase,
    shape: "s-1vcpu-1gb",
    rootfs: "devbox:1",
    egress: ["127.0.0.1:9"],
    limits: {
      vcpu: 1,
      memoryMiB: 1024,
      nodeHeapMiB: 128,
      commandWallSeconds: 10,
      sessionDeadlineSeconds: 90,
      artifactBytes: 1048576,
    },
    bundleHash: createHash("sha256")
      .update(workload.files["runner.mjs"])
      .digest("hex"),
  });
  const request = async (path: string, init: RequestInit = {}, cap = 30000) => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new Error("CREATEOS_DEADLINE");
    const response = await fetcher(base + path, {
      ...init,
      redirect: "error",
      headers: { "X-Api-Key": key, ...init.headers },
      signal: AbortSignal.timeout(Math.max(1, Math.min(cap, remaining))),
    });
    lifecycle.push({
      phase,
      at: new Date().toISOString(),
      status: response.status,
    });
    if (!response.ok) throw new Error("CREATEOS_HTTP_" + response.status);
    return response;
  };
  const json = async (path: string, init: RequestInit = {}, cap = 30000) => {
    const response = await request(
      path,
      {
        ...init,
        headers: { "Content-Type": "application/json", ...init.headers },
      },
      cap,
    );
    const envelope = JSON.parse(await limitedText(response, 1048576));
    if (envelope.status !== "success")
      throw new Error("CREATEOS_INVALID_ENVELOPE");
    return envelope.data;
  };
  let raw: string | undefined, error: unknown;
  try {
    const created = await json("", {
      method: "POST",
      body: JSON.stringify({
        shape: "s-1vcpu-1gb",
        rootfs: "devbox:1",
        ingress_enabled: false,
        auto_pause_after_seconds: 60,
        egress: ["127.0.0.1:9"],
      }),
    });
    if (
      typeof created.id !== "string" ||
      !/^sb-[a-zA-Z0-9-]+$/.test(created.id)
    )
      throw new Error("CREATEOS_MISSING_SANDBOX_ID");
    id = created.id;
    phase = "readiness";
    const readyBy = Date.now() + 30000;
    while (true) {
      const state = await json("/" + id, {}, Math.max(1, readyBy - Date.now()));
      if (state.status === "running") {
        if (
          state.shape !== "s-1vcpu-1gb" ||
          state.vcpu !== 1 ||
          state.mem_mib !== 1024 ||
          state.ingress_enabled !== false
        )
          throw new Error("CREATEOS_RESOURCE_POLICY_MISMATCH");
        break;
      }
      if (
        ["failed", "error", "destroyed"].includes(state.status) ||
        Date.now() >= readyBy
      )
        throw new Error("CREATEOS_PROVISIONING_FAILED");
      await new Promise((r) => setTimeout(r, 250));
    }
    phase = "egress-verification";
    const policy = await json("/" + id + "/egress");
    if (JSON.stringify(policy.egress) !== JSON.stringify(["127.0.0.1:9"]))
      throw new Error("CREATEOS_EGRESS_POLICY_MISMATCH");
    phase = "upload";
    for (const [name, body] of Object.entries(workload.files))
      await request(
        "/" + id + "/files?path=" + encodeURIComponent("/workspace/" + name),
        {
          method: "PUT",
          headers: { "Content-Type": "application/octet-stream" },
          body,
        },
      );
    phase = "execution";
    const result = await json(
      "/" + id + "/exec",
      {
        method: "POST",
        body: JSON.stringify({
          cmd: "timeout",
          args: [
            "--signal=KILL",
            "10s",
            "node",
            "--max-old-space-size=128",
            "/workspace/runner.mjs",
          ],
        }),
      },
      15000,
    );
    command = {
      exitCode:
        typeof result.result?.exit_code === "number"
          ? result.result.exit_code
          : null,
      stdout: String(result.result?.stdout ?? "").slice(0, 65536),
      stderr: String(result.result?.stderr ?? "").slice(0, 65536),
    };
    if (command.exitCode !== 0)
      throw new Error("CREATEOS_EXECUTION_FAILED: exit " + command.exitCode);
    phase = "artifact";
    raw = await limitedText(
      await request(
        "/" +
          id +
          "/files?path=" +
          encodeURIComponent("/workspace/" + workload.artifact),
      ),
      1048576,
    );
  } catch (e) {
    error = e;
  } finally {
    if (id) {
      phase = "cleanup";
      deadline = Date.now() + 15000;
      try {
        await json("/" + id, { method: "DELETE" });
        while (Date.now() < deadline) {
          const state = await json("/" + id).catch((e) => {
            if (e instanceof Error && e.message === "CREATEOS_HTTP_404")
              return { status: "destroyed" };
            throw e;
          });
          if (state.status === "destroyed") {
            cleanup = "destroyed";
            break;
          }
          await new Promise((r) => setTimeout(r, 250));
        }
        if (cleanup !== "destroyed") throw new Error("DESTRUCTION_TIMEOUT");
      } catch {
        error = new Error(
          "CREATEOS_CLEANUP_UNCONFIRMED: sandbox " +
            id +
            "; inspect provider dashboard",
        );
        cleanup = "unconfirmed";
      }
    }
  }
  if (error) {
    // Never echo provider response bodies or arbitrary transport error messages.
    const safe =
      error instanceof Error && /^CREATEOS_[A-Z_]+(?::|$)/.test(error.message)
        ? error.message
        : error instanceof Error && /^CREATEOS_HTTP_\d+$/.test(error.message)
          ? error.message
          : "CREATEOS_TRANSPORT_OR_ARTIFACT_ERROR";
    throw Object.assign(new Error(safe), { environment: environment() });
  }
  if (raw === undefined)
    throw Object.assign(new Error("CREATEOS_NO_ARTIFACT"), {
      environment: environment(),
    });
  return { raw, environment: environment() };
}
