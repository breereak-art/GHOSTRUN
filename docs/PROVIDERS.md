# Providers and hackathon readiness

Research date: 2026-10-15.

## CreateOS

Official docs:

- https://createos.sh/docs/Sandbox/Quickstart/
- https://createos.sh/docs/Sandbox/REST-API/Sandboxes/
- https://createos.sh/docs/Sandbox/REST-API/Execution-And-Files/

The repository contains a real REST integration implementation, not an invented SDK wrapper. Its HTTP contract tests use mocks. No live credentials were found in the checked session environment or root .env.local. Configure server-only CREATEOS_SANDBOX_API_KEY to validate the integration. Missing auth is explicitly unconfigured.

## Stripe Projects

Stripe Projects provisions infrastructure and credentials; it is not a requirement to process real payments in this product.

Verified official sources:

- https://projects.dev/developers/
- https://projects.dev/hackathon
- https://projects.dev/hackathon-participants
- https://createos.sh/blogs/deploy-ai-infrastructure-seconds-stripe-projects

Documented provisioning path:

```sh
stripe plugin install projects
stripe projects init ghostrun
stripe projects catalog
stripe projects add createos/project
stripe projects env --pull
```

Use an authenticated account and inspect the catalog/plan before provisioning. Service availability, credits and cost must be confirmed in that account. Do not assume a general CreateOS project token is automatically a sandbox token. Never commit generated credentials or the Projects vault.

No service was provisioned or billed during this build. Stripe Projects authentication, account eligibility and actual deployment are outstanding.

## Hosting

This version requires a persistent Node 24 process and writable SQLite volume. Build with npm ci and npm run build. Start behind authenticated ingress with a production process manager. Loopback is the default intentionally. A public multi-user deployment requires authentication/ownership, durable background jobs and cloud cleanup reconciliation before exposing API endpoints.

## Event requirements and prior work

The organizer-attributed event listing describes:

- CreateOS × Stripe Projects online hackathon, October 17.
- An agent that writes and executes code in CreateOS Sandbox.
- Starting from an empty directory, and stack setup through Stripe Projects.
- Submissions through the Stripe Projects leaderboard.

Sources:

- https://partiful.com/e/2XkERymWxVwoegfRNOTv
- https://luma.com/6stm74wk (registration page was inaccessible to the research tool)
- https://projects.dev/hackathon-participants

Detailed rules permitting prior-developed code were not available from the reviewed official material. Confirm with organizers before finalizing a submission. This repository's dates truthfully identify pre-event preparation.

The optional planner now emits validated executable ghost-js-v1 source, with a CreateOS-only runtime. See TEST_PROGRAMS.md. No live model or sandbox execution has been verified; qualification as agent-generated executable code and prior-code eligibility remain organizer decisions. Stripe CLI was not available in the inspected environment; no provisioning was attempted.

## Submission blockers

- Event approval and prior-code eligibility.
- Live sandbox credentials, access and execution verification.
- Stripe Projects authenticated provisioning.
- Hosted deployment with appropriate access controls and persistent storage.
- Event-specific generated-code requirement and final judging criteria.
