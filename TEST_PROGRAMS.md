# Sandbox-only generated test programs

The optional planner now writes JavaScript in a closed language, `ghost-js-v1`.
This is a constrained test-program generator, not a general autonomous coding agent.
Whether this meets the event requirement remains an organizer decision.

## Configuration and execution

From the repository directory in PowerShell, create a local configuration file only if absent:

```powershell
if (!(Test-Path .env.local)) { Copy-Item .env.example .env.local }
notepad .env.local
```

Set `CREATEOS_SANDBOX_API_KEY` to your sandbox token inside that file.
For AI generation also set `PLANNER_API_KEY`, `PLANNER_URL`, and `PLANNER_MODEL`.
The planner URL must be an HTTPS chat-completions-compatible endpoint accepting
`model`, `temperature`, and `messages`, and returning `choices[0].message.content`.
Credentials stay server-side; never paste them into source or evidence.

```sh
npm ci
npm run bundle:runner
npm run validate:createos
npm run program:plan
npm run program:run -- data/programs/PROGRAM-ID.json
npm run program:run -- data/programs/PROGRAM-ID.json hardened
```

The plan command prints the saved program path. Use that path for both variants.
The live validation command runs the signature response-lost world twice per variant,
each in a fresh sandbox, and retains worlds, traces, deterministic verdicts, lifecycle,
exit codes and cleanup metadata under ignored `data/live-validation/`.
It verifies four different sandbox IDs and exact observation replay agreement.
Missing credentials produce a blocked report with zero experiments and nonzero exit.

## Language and trust boundary

Example **manual fixture**, not an AI-generated result:

```javascript
await ghost.run({
  faults: [{ operator: "response-lost", point: "bank.transfer", magnitude: 1 }],
  amount: 12500,
});
```

Only 1–8 awaited direct calls to `ghost.run` with bounded JSON-style literal arguments
are accepted. No variables, imports, loops, functions, computed properties, spread,
getters, prototype keys, process, filesystem, network, or arbitrary assertions.
The TypeScript parser inspects syntax on the host; it never evaluates generated code.
Validated calls are re-emitted canonically. Original/canonical SHA-256 digests,
source, calls, model name and generation time are retained.

The reviewed runner exposes a frozen capability inside CreateOS and imports only
the canonical uploaded program there. Each capability call must match its manifest
entry; it executes a reviewed synthetic fixture with the corresponding validated world.
The program cannot supply verifier outcomes. Returned observations are schema-checked,
bound to initial inputs, and checked independently by the host invariant checker.
This is designed around closed capabilities, not around attempting to safely evaluate
arbitrary JavaScript in Node. Expanding the grammar requires security review.

Limits: 16 KiB source, eight calls, four faults per call, 100 fixture steps per call,
one vCPU, 1 GiB sandbox memory, 128 MiB Node heap, ten-second process wall limit,
90-second request lifecycle deadline plus 15 seconds for cleanup, 1 MiB artifacts.
Ingress is disabled. Nonempty egress permits only `127.0.0.1:9`; readiness and
egress settings are read back before execution. This restricts external access but
does not mean all loopback communication is prohibited.
The image must support Node and the Ubuntu `timeout` command. Missing tools,
nonzero exit, timeout, malformed artifacts, or unconfirmed destruction are infrastructure errors.
There is no local fallback or local generated-program runner.

## Validation status, 2026-10-15

CreateOS and planner credentials were absent. The live-validation CLI recorded
`blocked`, zero experiments; planner CLI recorded `PLANNER_UNCONFIGURED`.
No real sandbox creation, execution, artifacts, cleanup, or fresh-sandbox reproduction
has been verified. No live model-generated program has been claimed.
Tests exercise HTTP contracts with mocked responses and reviewed local fixtures;
they never execute generated source on the host. Both remote runner bundles compile.
Live image availability, provider policy enforcement, and timeout utility remain unverified.
Crash/orphan reconciliation is still manual through the provider dashboard.

## Event and provisioning

The [event listing](https://partiful.com/e/2XkERymWxVwoegfRNOTv) asks for agents
writing/running code in CreateOS and mentions starting empty and using Stripe Projects.
Prior-code eligibility and acceptance of this constrained language need organizer confirmation.
See [provider research](docs/PROVIDERS.md). No Stripe resources were provisioned,
and no paid service was purchased. Authentication, account credits/plan costs,
submission eligibility, deployment and live execution remain blockers.

Official contracts reviewed:
[Sandboxes](https://createos.sh/docs/Sandbox/REST-API/Sandboxes/),
[Execution/files](https://createos.sh/docs/Sandbox/REST-API/Execution-And-Files/),
[Egress](https://createos.sh/docs/Sandbox/REST-API/Egress/),
[Limits](https://createos.sh/docs/Sandbox/Limits/).
