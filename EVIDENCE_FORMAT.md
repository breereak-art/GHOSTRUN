# Evidence and replay

Every run records an ID, scenario ID, target version, backend, timestamp, duration, purpose, verdict, invariant results, environment information and optional error.

An observation includes initial synthetic inputs, final bank ledger, agent status records, logical events, completion status, termination reason and applied faults.

Events have monotonically increasing sequence IDs, virtual clock values, kind, tool and JSON data:
`tool.call`, `tool.response`, `tool.error`, `bank.commit`, `agent.record`, `authorization`, `fault.applied`.

Invariant results include ID, verdict, explanation and supporting event sequence IDs. Violations are independently computed from observed records, commits and permissions; no LLM judges them.

## Counterexamples

A candidate violation begins unconfirmed. Three matching original-world executions (original + two replays) are required for confirmed status. Nonmatching replay produces unstable status. Too little remaining budget leaves it unconfirmed. This is observed reproducibility, not a calibrated probability.

Reduction preserves the original invariant signature. The minimized-world ID references a stored executable scenario. Original and reduced run IDs remain linked. Hardened regression is a separate run and may pass, fail or remain inconclusive.

## Evidence export

`GET /api/campaigns/:id/export?kind=evidence&counterexample=:id` returns campaign configuration, counterexample metadata, the minimized world, relevant run evidence, limitations and a SHA-256 digest of the canonical JSON payload excluding the digest field. The digest detects accidental edits; it is not an authenticity signature.

## Regression export

`kind=regression` returns a versioned JSON artifact containing a validated world, expected violated invariant IDs and original backend.

```sh
npm run replay -- artifact.json
npm run replay -- artifact.json --hardened
```

The first command exits nonzero unless the recorded violations reproduce. Hardened replay exits nonzero unless the complete valid experiment passes. Requested CreateOS replay never silently switches to local. Use the same source version/dependency lockfile to reproduce. No uploaded regression content is executable code; it must pass the world schema and closed target registry.

Exports include synthetic state and untrusted simulated strings verbatim as data. Do not import real credentials or financial records into these fixtures.
