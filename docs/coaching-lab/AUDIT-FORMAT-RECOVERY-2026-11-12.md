# Isolated terminal audit recovery — November 12

## Scope and cause
The identity-coaching candidate's call 9613 was held because the final safety response echoed the wrong immutable candidate digest. The request identity and provider receipt were confirmed and settled, but the response could not authorize publication. The prior pass/no-findings statement was not accepted or silently corrected.

## Change
The opt-in `interaction-identity-v1` transition may discard a confirmed, normally completed, exact-request safety receipt with a well-formed but mismatched digest and request one new full safety audit. This uses the existing per-candidate format-repair allowance, not an additional retry loop. The new request has its own durable identity and usage accounting. Its full source, governed policy and candidate are unchanged; it receives no previous verdict to imitate.

The isolated safety prompt also repeats the exact machine binding after the complete source and metadata, beside the output instructions. The first new audit repeated the original transposition; it was rejected and retained. That result motivated this generic output-format clarification, not a call-specific hash, waived check or altered coaching. A separately identified audit of this revised prompt is evaluated against the same candidate.

Strict safety acceptance remains unchanged. Wrong outer request identity, missing provider receipt, refusal, unknown outcome, invalid digest and repeated format failure stay held. Genuine findings from the new audit still use the existing bounded prose repair and independent recheck. Production defaults are unchanged; only the isolated opt-in protocol receives this recovery behavior.

## Verification plan
- Regression tests for fresh audit, exact candidate/source preservation, stable serialized requests, repeated-failure hold, original default hold, unknown/refused/wrong-request holds and real findings routing.
- Recover only the saved 9613 candidate; reuse the existing analyst, writer, writer-contract-repair and reviewer receipts. No coaching regeneration or new cohort.
- Replay the actual compiled core and official/manual parent adapters using saved receipts; verify isolated hosted persistence, duplicate delivery and tamper rejection.
- Compare production workflow state before/after, settle costs and stop the isolated provider transport. Keep PR417 unmerged.

## Results
Pending completion of the one bounded audit and connected verification. Test progress is not a report acceptance claim.
