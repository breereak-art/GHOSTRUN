# NVIDIA Nemotron live R&D validation — 2026-10-17

This work validates the existing GHOSTRUN R&D repository. No source or credentials
were copied into ghostrun-hackathon, and this is not a claim of hackathon eligibility.

## Configuration

Use the existing server-only PLANNER_API_KEY, PLANNER_URL and PLANNER_MODEL in
ignored .env.local. The endpoint is https://integrate.api.nvidia.com/v1/chat/completions
and model is nvidia/nemotron-3.5-super-vl-120b-a12b.
No extra provider SDK is required.

The model-specific request profile applies only to this exact model on
integrate.api.nvidia.com. It explicitly sets stream=false, max_tokens=2048,
temperature=1, top_p=0.95, seed=42 and chat_template_kwargs.enable_thinking=false,
with a bounded 90-second deadline. Other providers keep a 15-second deadline.
Only choices[0].message.content is parsed; reasoning_content is never executable input.
Truncated output and malformed JSON are rejected explicitly. The AST validator,
capability allowlist, resource limits and deterministic verifier are unchanged.

## Actual results

The text-only smoke request returned HTTP 200, GHOSTRUN_OK, and finish_reason=stop.
The message contained content, role and reasoning_content fields, compatible with
the chat-completions parser.

The original planner failed with a confirmed TimeoutError at 15,008 ms.
With the provider profile, model replies arrived but some generated programs failed
syntax checks or exceeded array limits (one tried 15 faults in one call).
These rejections were not executed. The prompt was clarified to request separate
single-fault experiments and single-quoted JavaScript literals. No invalid output
was repaired into a passing program, and no validator rule was weakened.

A subsequent HTTP 200 response generated four valid calls in 17,472 ms.
The planner chose baseline, response-lost, missing-approval and conflicting-recipient.
The exact validated canonical program ran in a real CreateOS VM:

| Case                  | Vulnerable fixture outcome                  |
| --------------------- | ------------------------------------------- |
| Baseline              | PASS, one bank commit                       |
| response-lost         | VIOLATION, two commits for one operation    |
| missing-approval      | PASS, payment blocked                       |
| conflicting-recipient | VIOLATION, unauthorized destination account |

Sandbox: sb-01m55gvzfvx50z04q44prm75mh.
Process exit code: 0. Backend: createos. Cleanup: destroyed, independently
confirmed by a later provider GET. No generated source executed on the host.
The downloaded observations were rechecked with the deterministic verifier and
bound to the original generated program hash.

[Evidence: model response, validated program, worlds, traces and cleanup](evidence/nvidia-program-2026-10-17.json)

## Limits

This confirms one successful AI-generated program and one live sandbox execution.
It does not establish a generation success rate or reproducibility across model calls.
Invalid model outputs remain possible and fail closed. No rate-limit response was
observed live; classification is unit-tested. A hardened live run of this generated
program was not performed. Stripe hackathon eligibility is a separate question.

Official references:

- https://build.nvidia.com/nvidia/nemotron-3.5-super-vl-120b-a12b
- https://build.nvidia.com/nvidia/nemotron-3.5-super-vl-120b-a12b/modelcard

Verification: 82 unit/integration tests passed; typecheck and production build passed.
