# ELSEWHERE scenario engine

## Worlds

Schema version 1 requires target version, objective, synthetic initial payment state, typed fault operators, injection points, event order, mock version/clock, five invariants, deterministic seed, execution budget, parent linkage and provenance metadata. Unknown fields and unsupported target versions are rejected.

Operator preconditions and transformation descriptions live in `packages/fault-operators`; concrete transformations are implemented by the reviewed payment fixture's controlled tools. Unsupported commands cannot be represented.

## Supported operators

| Category      | Operators                                                             |
| ------------- | --------------------------------------------------------------------- |
| Network       | timeout-before, response-lost, connection-refused, delay, unavailable |
| Data          | missing-receipt, invalid-status, conflicting-recipient                |
| State         | stale-status, partial-commit, pending                                 |
| Authorization | missing-approval, expired-approval, forged-approval                   |
| Agent         | injected-instruction                                                  |
| Concurrency   | concurrent-attempts                                                   |

Only one fault from each exclusive transformation group may occur in a world. Approval faults require an initial approval. Injection points must match the operator. Concurrent execution requires exactly two scheduled attempts.

Not implemented: arbitrary malformed schemas, duplicated lookup lists, independent memory poisoning, misleading tool-description replacement, out-of-order remote completion, cross-service partial transactions and stochastic network delivery. These are coverage gaps, not tested features.

## Exploration

1. Generate control and selected single-fault worlds.
2. Validate preconditions; fingerprint semantically relevant fields.
3. Execute baseline first.
4. Rank remaining candidates using expected risk × observed-parent novelty × category coverage value / estimated cost.
5. Detect novelty from actual tool-call order, recorded statuses, bank commit count and verdict.
6. For novel behavior or violations, combine up to five additional operators, prioritizing state/concurrency interactions when retries are observed.
7. Prune incompatible/duplicate worlds and stop at total execution budget.

Risk and cost are inspectable registry values. Novelty is 1 by default, 1.5 for novel-parent mutations. Coverage value is inverse observed category exposure. This is an engineering heuristic, not a research-backed optimal search claim. The UI records each candidate's score components or pruning reason.

The seed sets deterministic delay magnitudes; no random LLM story is involved. Same configuration produces the same logical worlds and fixture traces (UUIDs, durations and wall-clock timestamps differ). Virtual time is explicit in trace events. The scheduler orders ties deterministically.

## Reduction

Confirmed findings undergo greedy fault deletion and payment-amount boundary reduction. Each accepted reduction must preserve all originally violated invariant IDs. The smaller accepted world is replayed before promotion. Reference execution uses the hardened target and the same environment. Budget exhaustion may leave a finding unconfirmed or unreduced. Global minimality is never claimed.

## Optional LLM planner

Without credentials, choose deterministic mode. Selecting LLM mode without credentials produces an explicit configuration error; no AI contribution is claimed.

Configure a trusted HTTPS `PLANNER_URL` implementing a JSON chat contract:

- Request: `{model, temperature:0, messages:[{role,content}]}`.
- Response: `{choices:[{message:{content:"JSON string"}}]}`.
- Content: `{candidates:[{faults:[{operator,point,magnitude}],reason}]}`.

The request contains only the bundled synthetic tool contracts, declared invariants, selected supported operators and seed. The planner receives no local paths, source files, credentials or real payment data. No model output becomes executable code.

At most 12 proposals and four faults per proposal are accepted. Strict schema checks reject unknown fields, operators, invalid points, excluded categories and incompatible transformations. Model name, source and proposal rationale remain in worlds; accepted/rejected counts are in the campaign. Transport failures remain visible. Current tests use synthetic HTTP responses; no live LLM call has been validated.

## Coverage

Counts represent observed fault injections, including repeated executions. Transitions are observed agent record statuses. Combinations come from faults actually applied, not merely configured. Unreached injection points produce INCONCLUSIVE when there is no concrete violation. Pruned and queued worlds are excluded from tested exposure. No percentage claims universal agent safety.
