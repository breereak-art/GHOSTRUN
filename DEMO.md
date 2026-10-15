# Signature demonstration

## Preparation

1. Use Node 24+, `npm ci`, `npm run build`.
2. Run `npm test` and `npm run typecheck`.
3. Start `npm start` and open http://127.0.0.1:3000.
4. Dashboard starts with empty persisted data unless you ran a previous campaign. Never present seeded screenshots as live results.

## In the dashboard

1. Create a campaign: Payment Operations vulnerable fixture; network category; budget 24; depth 2; seed 7; trusted-local backend; deterministic planning.
2. Observe baseline PASS in Execution monitor. This is the ordinary cooperating bank.
3. Inspect response-lost in Scenario explorer. The bank persisted a payment, then returned TIMEOUT. The agent recorded failure and retried with a new idempotency key.
4. Open Failure evidence. Inspect the two ledger transactions for the same operation ID and the exact retry tool calls.
5. Check original-world reproduction outcomes, reduction history and separate hardened regression verdict.
6. Download evidence and regression JSON.
7. Replay the artifact with CLI. Run the same artifact with `--hardened`; the hardened fixture reconciles the authoritative bank state using a stable operation key.
8. Coverage reports actual applied categories and remaining untested worlds. Do not call these results a universal safety score.

## Scripted equivalent

`npm run demo` runs the campaign, stores it in SQLite and writes actual evidence to `data/exports/`. Console output summarizes observed results. Run this ahead of judging only if preparation is allowed, and identify it as a prior campaign.

## Distinguish error classes

- Choose CreateOS without a key: infrastructure error, no local fallback.
- A stale-status-only world never reaches status lookup on the vulnerable baseline: inconclusive, not a fabricated pass.
- Too-small target step budget: inconclusive.
- Schema/precondition mismatch: invalid, no target execution.
- Unsupported completion/duplicate transfer: deterministic violation.

## Provider demonstration

A local demonstration is not a sandbox demonstration. Before claiming live CreateOS, configure the token, build the runner and run a campaign through CreateOS. Keep its actual backend metadata, artifacts and cleanup results. Stripe Projects and submission prerequisites are documented separately.

The targets are disclosed seeded-defect fixtures. ELSEWHERE discovers executable conditions within its supported operator library; it is not an unconstrained autonomous research system.
