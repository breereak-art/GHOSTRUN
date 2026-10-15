# COUNTERFACTUAL execution

## Trusted local

Only `payment-vulnerable@1` and `payment-hardened@1` are accepted. They are reviewed programmatic fixtures using in-memory mocks. No uploads, user command strings or dynamic imports are available.

Local mode has a logical step budget and cooperative deadline. It cannot contain hostile code or terminate CPU-blocking JavaScript. It is not a security boundary.

## CreateOS

The adapter uses the official REST API researched on 2026-10-15:

- [Sandbox lifecycle](https://createos.sh/docs/Sandbox/REST-API/Sandboxes/)
- [Execution and files](https://createos.sh/docs/Sandbox/REST-API/Execution-And-Files/)
- [Quickstart](https://createos.sh/docs/Sandbox/Quickstart/)

The server authenticates through X-Api-Key to the fixed official sandbox API host. It provisions a fresh 1 vCPU / 1 GB devbox, disables ingress and restricts egress to 127.0.0.1:9 and reads back the policy. An empty egress list would allow all traffic, so the adapter does not use one.

Build `dist/sandbox-runner.mjs` with `npm run bundle:runner`. The adapter uploads that reviewed bundle and validated world, invokes Node through a ten-second timeout command with a 128 MiB heap limit, downloads JSON output, and deletes the VM in a finally path. It polls to verify destruction. Deletion failure or uncertain cleanup is an infrastructure error containing the sandbox ID for operator recovery.

No token is sent inside the VM. Network and memory controls depend on the provider. The command request has a bounded client deadline; cleanup destroys the sandbox after timeout. A client timeout is not itself proof that the remote process stopped. The adapter verifies cleanup before returning a completed result.

Provisioning timeout before an ID is received or a server crash can leave uncertain resource state. Inspect the provider dashboard; auto-pause reduces idle exposure but does not destroy resources. Durable orphan reconciliation is future work.

Current status: contract tests pass using mocked HTTP. Credentials are absent; provisioning, Node image availability, egress behavior, execution and cleanup have **not** been verified live.

## Banking fidelity

The mock distinguishes rejection before processing; settled commit; committed write with lost response; pending commit; and stable-key deduplication. A repeated idempotency key returns the existing transaction. Vulnerable attempts use new keys; hardened attempts use the authorized operation ID.

Pending operations never become settled without a modeled event. Status reads may be stale. Settlement requires a receipt linked to the ledger; a response shape alone does not establish success.

Faults alter actual tool behavior during execution. Latency is a virtual-clock advance, not wall-clock sleep. Two overlapping attempts are deterministic cooperative tasks, not actual independent banking workers. The fixture tests operational properties within this fidelity boundary.

## Classification

- PASS: completed valid experiment, applied required injections and satisfied properties.
- VIOLATION: a deterministic assertion found an observable property breach.
- INCONCLUSIVE: incomplete execution or unreached injection points without a demonstrated breach.
- INVALID: world schema or preconditions failed before execution.
- INFRA_ERROR: runner/provider failure; never counted as a target violation.

The verifier returns per-property results. Overall verdict can be inconclusive even when observed properties hold because a required fault was not reached.

The hardened fixture also passes an authorization deadline to the mock bank. The bank checks it at commit time, preventing a delayed request from outliving approval. This optional conditional-write semantic is part of the documented synthetic tool contract.
Cloud evidence includes bounded stdout/stderr, exit code, bundle hash and cleanup metadata when available.

Generated test programs use the same lifecycle transport and a separate reviewed harness. See [TEST_PROGRAMS.md](TEST_PROGRAMS.md) for the grammar, limits, CLI and unverified live assumptions.
