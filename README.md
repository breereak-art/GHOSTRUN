# GHOSTRUN

**Discover how agents break before those failures reach production.**  
_Let’s see what survives._

GHOSTRUN is a working adversarial experiment laboratory for two bundled, synthetic payment-agent fixtures. ELSEWHERE builds structured worlds; COUNTERFACTUAL executes the agent and checks explicit properties; GHOSTRUN reproduces findings and exports regression artifacts.

## Run locally

Requires Node **24+** (uses Node's experimental built-in SQLite) and npm.

```sh
npm ci
npm run build
npm start
# http://127.0.0.1:3000
```

For development: `npm run dev`. The database is created at `data/ghostrun.sqlite`. No demo statistics are seeded. Start a campaign in the UI or run `npm run demo` to generate actual records.

```sh
npm run typecheck
npm test
npx playwright install chromium
npm run test:e2e
npm run demo
npm run replay -- data/exports/<id>.regression.json
npm run replay -- data/exports/<id>.regression.json --hardened
```

## What works

- 16 typed fault operators across six categories, schema/precondition checks, semantic deduplication, budgeted selection and feedback-guided mutations.
- Vulnerable and hardened payment fixtures with controlled tool interfaces, synthetic bank state, deterministic logical traces and five independent invariant checks.
- Campaign budgets cover **all** discovery, replay, reduction and reference runs.
- Findings require three matching original-world executions to become confirmed.
- Bounded greedy fault deletion and amount reduction, followed by replay of accepted minimized evidence.
- SQLite persistence, JSON evidence with SHA-256 integrity digest, executable JSON regression artifacts.
- Seven functional dashboard views: overview, agents, campaign creation, scenarios, execution monitor, failure evidence and measured coverage.
- Optional server-side LLM planner using a documented JSON chat HTTP contract. Unsupported proposals are rejected.
- CreateOS REST adapter: provision, readiness, upload reviewed runner, execute, retrieve artifact, destroy and verify cleanup. **Contract-tested with mocks; live access not verified.** Missing credentials produce INFRA_ERROR without fallback.

## Boundaries

The sample targets are deliberately simple, programmatic tool-using agents, **not LLM-driven payment agents**. Their seeded implementation defects are disclosed. Discovery is real execution of those defects, not a claim that arbitrary agents are supported.

Trusted-local mode is **not a sandbox**. Only reviewed bundled fixture IDs are accepted. No code upload, shell-command input, arbitrary module import or production banking integration exists. CreateOS currently executes the same reviewed fixture bundle; arbitrary external target adapters are future work.

Latency uses a virtual clock. Concurrency uses deterministic cooperative task interleaving, not distributed transactions. The bank models rejected, committed, pending, lost-confirmation and idempotently deduplicated requests. See [SANDBOX_EXECUTION.md](SANDBOX_EXECUTION.md).

The server is single-process and defaults to loopback. Do not publicly expose it without authenticated ingress, access controls, durable storage and a job worker. It is not production multi-tenant infrastructure. Restarted campaigns are marked interrupted, not silently resumed.

## Environment

Copy `.env.example` to `.env.local` for Next.js. Do not commit it.

- `CREATEOS_SANDBOX_API_KEY`: server-only sandbox token.
- `GHOSTRUN_DB`: SQLite path.
- `PLANNER_API_KEY`, `PLANNER_URL`, `PLANNER_MODEL`: optional planner. The URL is server configuration, not user input. See [SCENARIO_ENGINE.md](SCENARIO_ENGINE.md).
  CLI tools use process environment; Next.js loads `.env.local` automatically. For CLI commands with that file, use `node --env-file=.env.local --import tsx scripts/demo.ts`.

## Architecture and documents

One Next.js application and API, modular TypeScript engine packages, one SQLite store. No microservices.

- [ARCHITECTURE.md](ARCHITECTURE.md)
- [SCENARIO_ENGINE.md](SCENARIO_ENGINE.md)
- [SANDBOX_EXECUTION.md](SANDBOX_EXECUTION.md)
- [EVIDENCE_FORMAT.md](EVIDENCE_FORMAT.md)
- [DEMO.md](DEMO.md)
- [PROGRESS.md](PROGRESS.md)
- [docs/PROVIDERS.md](docs/PROVIDERS.md)

## Hackathon status

Built from an empty GitHub repository; no earlier Build 01 source was recovered. The event listing describes starting from an empty directory. Confirm preparation/prior-code eligibility with the organizers before submitting this work. Live CreateOS access, Stripe Projects provisioning and hosted deployment are not claimed.
