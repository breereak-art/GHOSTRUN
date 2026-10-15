import { readFile } from "node:fs/promises";
import type { Backend } from "./index";
import { observationSchema } from "./observation";
import { executeSandbox, type SandboxOptions } from "./sandbox";
export function createOSBackend(
  options: SandboxOptions & { bundle?: () => Promise<string> } = {},
): Backend {
  return {
    name: "createos",
    async execute(world) {
      if (!options.apiKey && !process.env.CREATEOS_SANDBOX_API_KEY)
        throw new Error(
          "CREATEOS_UNCONFIGURED: set server-side CREATEOS_SANDBOX_API_KEY",
        );
      const bundle = await (options.bundle?.() ??
        readFile("dist/sandbox-runner.mjs", "utf8"));
      const result = await executeSandbox(
        {
          files: { "runner.mjs": bundle, "world.json": JSON.stringify(world) },
          artifact: "observation.json",
        },
        options,
      );
      try {
        const observation = observationSchema.parse(JSON.parse(result.raw));
        if (
          JSON.stringify(observation.initial) !==
          JSON.stringify(world.initialState)
        )
          throw new Error("INITIAL_STATE_MISMATCH");
        return { observation, environment: result.environment };
      } catch {
        throw Object.assign(new Error("CREATEOS_INVALID_OBSERVATION"), {
          environment: result.environment,
        });
      }
    },
  };
}
