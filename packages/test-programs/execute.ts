import { readFile } from "node:fs/promises";
import { validateProgram, worldForCall, type ValidatedProgram } from "./index";
import { executeSandbox, type SandboxOptions } from "../counterfactual/sandbox";
import { observationSchema } from "../counterfactual/observation";
import { runExperiment } from "../counterfactual/index";
import type { AgentVersion } from "../core/index";
export async function executeProgram(
  input: ValidatedProgram,
  agent: AgentVersion,
  options: SandboxOptions & { bundle?: () => Promise<string> } = {},
) {
  const program = validateProgram(input.source, input.provenance);
  const worlds = program.calls.map((c) => worldForCall(c, agent));
  if (!options.apiKey && !process.env.CREATEOS_SANDBOX_API_KEY)
    throw new Error("CREATEOS_UNCONFIGURED");
  const bundle = await (options.bundle?.() ??
    readFile("dist/program-runner.mjs", "utf8"));
  const result = await executeSandbox(
    {
      files: {
        "runner.mjs": bundle,
        "program.mjs": program.canonicalSource,
        "manifest.json": JSON.stringify({
          calls: program.calls,
          worlds,
          hash: program.canonicalHash,
        }),
      },
      artifact: "program-output.json",
    },
    options,
  );
  try {
    const output = JSON.parse(result.raw);
    if (
      output.hash !== program.canonicalHash ||
      !Array.isArray(output.observations) ||
      output.observations.length !== worlds.length
    )
      throw new Error("INVALID");
    const observations = output.observations.map((item: unknown, i: number) => {
      const observation = observationSchema.parse(item);
      if (
        JSON.stringify(observation.initial) !==
        JSON.stringify(worlds[i].initialState)
      )
        throw new Error("INITIAL_STATE_MISMATCH");
      return observation;
    });
    const runs = await Promise.all(
      worlds.map((world, i) =>
        runExperiment(world, {
          name: "createos",
          execute: async () => ({
            observation: observations[i],
            environment: result.environment,
          }),
        }),
      ),
    );
    return {
      backend: "createos" as const,
      program,
      worlds,
      runs,
      rawArtifact: output,
      environment: result.environment,
    };
  } catch {
    throw Object.assign(new Error("CREATEOS_INVALID_PROGRAM_ARTIFACT"), {
      environment: result.environment,
    });
  }
}
