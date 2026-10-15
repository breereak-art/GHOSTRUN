# Architecture

## Assessment

The supplied repository was empty. A bounded workspace source search did not locate the reported Build 01 prototype. This implementation is new; no previous code or test results were recovered.

The smallest credible application is a single Next.js server with a React dashboard, TypeScript engine packages and SQLite. Engine code can run independently through CLI scripts and tests. No agent framework or microservice is necessary for the first demonstrable failure.

## Modules

| Location                    | Responsibility                                                    |
| --------------------------- | ----------------------------------------------------------------- |
| app/                        | Dashboard and HTTP routes                                         |
| apps/api/                   | Campaign lifecycle and single-process queue guard                 |
| packages/core/              | Validated world schema, target/tool contracts and types           |
| packages/fault-operators/   | Operator registry, injection points, compatibility/preconditions  |
| packages/elsewhere/         | Candidate generation, priority, mutation, optional HTTP planner   |
| packages/counterfactual/    | Experiment classification, local and CreateOS backends            |
| examples/payment-agent/     | Bundled target adapters and synthetic dependency semantics        |
| packages/invariant-checker/ | Deterministic independent assertions over observable effects      |
| packages/orchestrator/      | Budget, scheduling, feedback, reproduction, reduction, regression |
| packages/scenario-store/    | Transactional SQLite persistence                                  |
| packages/evidence/          | Evidence and regression exports                                   |

## Flow

Campaign configuration → validated worlds → risk/coverage/novelty queue → execution backend → trace + final state → invariant results → reproduction/reduction → hardened comparison → evidence export.

The baseline executes first. A violation does not immediately become confirmed: the original scenario must reproduce twice more. All these calls consume budget. There is one concurrent campaign and one experiment at a time; a concurrency fault can schedule two cooperative attempts _inside_ the fixture.

## Records and identities

Stable target IDs combine agent name, variant and version. Tool and invariant declarations are code-versioned. Campaigns, runs and counterexamples use UUIDs and wall-clock timestamps. Worlds use canonical SHA-256-derived IDs. Parent IDs and metadata represent scenario mutations.

SQLite stores campaigns, scenarios, runs and counterexamples with relational foreign keys. Campaign snapshots include queue decisions, logical events, invariant results, coverage and planner provenance. Evidence and regression exports are computed from those records. This avoids redundant ORM models for every nested event while keeping full lineage.

Every run identifies its world, target version, purpose and backend. A regression is a different run against a hardened target; it never replaces the original evidence.

## Operational constraints

- Local runner calls only closed, reviewed fixture adapters; no arbitrary executable input.
- Step budget and finite fixture loops bound local execution. Promise timeouts cannot interrupt hostile CPU code, hence local mode is not a security boundary.
- Cloud runner uses fresh VM provisioning and cleanup and never falls back.
- HTTP mutations validate strict schemas and reject cross-origin requests.
- Credential values stay server-side, are not included in target inputs or client metadata.
- React renders untrusted strings as text; no HTML injection.
- JSON exports contain synthetic experiment data only.
- Restart recovery marks queued/running campaigns interrupted. In-flight cloud resource cleanup after a process crash may require operator intervention; auto-pause limits inactivity but is not destruction.
- API polling exposes actual persisted state; it is not a simulated terminal replay.

## Database / hosting migration

SQLite WAL is suitable for this single-user local application. Use a persistent volume for a single Node deployment. For multiple instances, migrate tables to PostgreSQL, replace in-process scheduling with a durable lease-based worker, add organization/user ownership, authentication, cancellation and robust orphan-sandbox reconciliation. Do not deploy SQLite on ephemeral serverless filesystems.

## Deliberate limits

External-agent registration/upload, distributed concurrency, production provider calls, probabilistic confidence claims and automatic production patching are not implemented. The adapter interface is the extension point; new untrusted adapters must use an isolated backend.
