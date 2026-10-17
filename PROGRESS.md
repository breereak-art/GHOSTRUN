# GHOSTRUN implementation progress

> R&D update 2026-10-17: NVIDIA Nemotron generated a validated ghost-js-v1 program that executed in CreateOS with independent invariant checks and confirmed cleanup. See [NVIDIA validation](docs/NVIDIA_VALIDATION.md). Earlier missing-planner notes below are historical.

> Update 2026-10-16: the reviewed fixture runner completed four real CreateOS signature runs with matching replays and verified destruction. See [live validation](docs/LIVE_VALIDATION.md). Earlier missing-credential notes below describe the prior cycle; live AI-generated programs, Stripe provisioning and event eligibility remain unverified.

## Current local build

Working TypeScript MVP: structured exploration, actual fixture execution, deterministic verification, replay, bounded minimization, hardened regression, SQLite persistence and a functional developer dashboard.

This is a local laboratory for bundled synthetic fixtures. Live provider execution and deployment are not complete.

## Repository inspection

- Cloned the empty breereak-art/GHOSTRUN repository.
- Searched the workspace for GHOSTRUN, ELSEWHERE and COUNTERFACTUAL source references. No Build 01 implementation recovered.
- Node 24.12.0, npm 11.6.2 and Git were available.
- No provider credentials detected in the checked environment or workspace-root .env.local. No secret values printed.
- Architecture: one Next.js server/UI, modular engine packages and SQLite.
- Engine foundation committed as `37e040b`; later changes add dashboard, providers, verification and documentation.

## Delivered

1. Strict world and campaign schemas; versioned targets/tools/invariants.
2. Six categories / 16 operators, preconditions, compatibility checks, fingerprints, pruning, deterministic generation, virtual latency and feedback-guided mutation.
3. Reviewed vulnerable and hardened payment fixtures, mocked bank, authorization checks, idempotency behavior, cooperative concurrent attempts and complete traces.
4. Five deterministic invariant checks; PASS / VIOLATION / INCONCLUSIVE / INVALID / INFRA_ERROR separation.
5. Budget accounting across every execution; three-run confirmation; bounded fault and input reduction; minimized replay; hardened regression.
6. SQLite persistence and restart interruption recovery; evidence digest and executable JSON regression exports.
7. Overview, agents, campaign creation, scenario table/inspector, execution monitor, failure evidence and coverage views. Desktop/mobile layouts and keyboard modal handling.
8. CreateOS REST lifecycle adapter with upload, execution, bounded logs, artifact validation and verified cleanup. Missing config never falls back.
9. Optional HTTPS LLM planner with strict typed proposals and model provenance. No live model run claimed.
10. CI workflow, reproducible dependency lockfile and all requested engineering documents.

## Verification actually performed

- `npm test`: **77 tests passed**, eleven test files.
- `npm run typecheck`: passed. Generates Next route types before TypeScript checking for fresh checkouts.
- `npm run build`: passed; reviewed fixture bundle and production Next.js build generated.
- `npm run test:e2e`: **4 browser tests passed**:
  - real campaign creation → scenario trace → evidence download → hardened replay;
  - arbitrary target and cross-origin rejection;
  - responsive navigation/search and no horizontal viewport overflow;
  - visible network error and successful retry recovery.
- Desktop overview, evidence inspector and mobile screenshots captured under ignored `data/` and visually inspected.
- `npm run demo`: 24 actual executions, three confirmed findings, passing hardened reference regressions.
- Exported regression replayed from disk; recorded defects reproduced and hardened replay passed.
- `git diff --check`: passed.
- GitHub CI result must be read from the actual Actions run after push; local checks are not represented as a remote CI result.

## Failures found and resolved

- Initial Windows sandbox prevented esbuild reading ancestors. Retried verified tooling with required filesystem permission.
- Chromium was absent. Installed the test browser and reran.
- Browser campaign creation initially failed because Next normalized req.url to localhost while the browser used 127.0.0.1. Origin checks now validate incoming Host, Origin and allowed loopback/deployment host; dedicated tests cover this.
- Reference transfers now supply an authorization deadline checked at the simulated commit boundary, preventing expiry during injected delay.
- Initial TypeScript signature mismatch fixed; final checks passed.

## Remaining limits / blockers

- No live CreateOS credentials: REST contract tests are mocked, not proof of actual VM execution.
- Stripe Projects authentication/provisioning and hosted deployment not performed.
- No arbitrary external-agent upload; only two reviewed bundled targets. Local mode is not isolation.
- Virtual delays and cooperative concurrency are not distributed-system fidelity.
- LLM planner supports a documented JSON chat contract; provider access remains unverified.
- Several fault classes remain unsupported; coverage documents them explicitly.
- Single-process scheduling and SQLite; hosted multi-user use needs authenticated ingress, durable jobs, ownership and orphan-sandbox reconciliation.
- Event listing describes starting from an empty directory. Prior-code eligibility requires organizer confirmation.
- Optional planner now generates constrained executable test programs; no live model run or sandbox execution has occurred. Event acceptance of this language remains unverified.

## Next highest-value task

Configure CreateOS sandbox access and execute the same signature counterexample remotely, retaining actual artifacts and confirmed cleanup. Then provision/deploy through an authenticated Stripe Projects account after confirming event rules.

## Live-validation cycle after 6af7200

- Rechecked official CreateOS REST lifecycle, execution/files, egress and limits documentation.
- No CREATEOS_SANDBOX_API_KEY or planner credentials found; no values printed.
- Added shared transport with read-back policy/resource checks, bounded output, fixed timeout/heap limits and confirmed destruction.
- Added ghost-js-v1 AST validator, canonical emitter, optional AI planner, sandbox-only harness and independent result verification.
- Added CLI for four fresh signature runs (both variants twice), preserving traces, invariant results and lifecycle evidence.
- Actual live CLI result: blocked, zero experiments. Artifact: data/live-validation/8c732467-8cb4-4e48-9ffe-3a7647abad29.json (ignored local file).
- Actual planner CLI result: PLANNER_UNCONFIGURED; no model-generated source claimed.
- HTTP integration tests are mocks; generated JavaScript was never executed on the host.
- Stripe CLI absent; no provisioning, purchases or charged resources requested.
- Program artifacts are CLI-managed and not yet surfaced in dashboard campaigns.
- Live creation/readiness/upload/execution/retrieval/cleanup and reproduction remain unverified.
- See TEST_PROGRAMS.md for exact configuration and commands. Prior-code eligibility and generated-code qualification require organizer confirmation.
- Final cycle checks: typecheck passed; 77 tests passed; production build passed; four browser tests passed; diff whitespace check passed. Expected blocked CLI exits are not counted as successful live tests.
