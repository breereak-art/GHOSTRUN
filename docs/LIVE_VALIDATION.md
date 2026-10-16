# Live CreateOS signature validation — 2026-10-16

Executed engine commit `b8cdddcca8dd5d4a0bc3581e172dc067956e5683` without integration code changes.
Commands: `npm run bundle:runner`, `npm run validate:createos`.
The CLI completed successfully with four experiments and exact replay agreement.

| Variant           | Sandbox                       | Verdict   | Cleanup   |
| ----------------- | ----------------------------- | --------- | --------- |
| Vulnerable        | sb-01m51v4svzmwkmf5rg6qw5pyv2 | VIOLATION | destroyed |
| Vulnerable replay | sb-01m51v4y07gzaqx26nwk6xjz6d | VIOLATION | destroyed |
| Hardened          | sb-01m51v542gv72fvwtvfx2qdwfb | PASS      | destroyed |
| Hardened replay   | sb-01m51v5c77p2kpj17msf457aqh | PASS      | destroyed |

All four had successful provisioning, readiness, egress readback, two uploads,
execution, artifact download and cleanup. Every command exited zero with empty
stdout/stderr; evidence was retrieved from the remote observation JSON file.
A separate authenticated GET after completion confirmed each sandbox was destroyed.
No local execution fallback occurred. The bank itself remains a synthetic mock.

The vulnerable trace records a bank commit at event 7, a TIMEOUT at event 9,
a retry at event 11 and a second commit at event 12 for the same operation.
Its ledger contains tx-1 and tx-2. The deterministic verifier detects both
at-most-once and uncertain-is-not-failed violations.

The hardened trace records one commit, then queries bank.status after TIMEOUT
and completes using the existing settlement receipt. All five invariants pass.
Each pair's complete observations, including events and ledger, are identical.
The invariant checker was rerun independently on all four downloaded observations;
its results equal the stored verdicts.

## Evidence

- [Full worlds, traces and lifecycle](evidence/createos-signature-2026-10-16.json)
- [Independent provider cleanup readback and report hash](evidence/createos-cleanup-2026-10-16.json)

The evidence was scanned for the configured credential before preservation.
The ignored local configuration is not committed. Provider cleanup metadata is
restricted to sandbox IDs, lifecycle timestamps and resource/network settings.

## Scope and remaining blockers

This validates the reviewed payment fixture runner, Node image, timeout command,
artifact transfer and cleanup for this signature scenario. Resource and network
settings were read back; denial behavior and forced termination under hostile load
were not independently stress-tested.

The AI-generated program harness has not been executed live, and planner credentials
remain missing. Stripe Projects provisioning, deployment, prior-code eligibility,
and organizer acceptance of the constrained code-generation language remain unresolved.
No Stripe resources were provisioned or purchased during this validation.

Post-validation checks: 77 tests passed; TypeScript checking and production build passed. Credential scan passed across preserved evidence and all 20 generated client files. No integration fixes were required.
