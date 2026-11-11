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
- Recovered 9613 with the same exact report digest and byte-equivalent structured coaching. Reused the four existing analyst/writer/contract-repair/reviewer receipts. The original malformed audit and the first fresh malformed audit remain rejected and retained; neither was changed into approval.
- The generic end-of-input binding clarification produced a valid new full safety audit: exact digest, pass, no findings, both lexical candidates explicitly adjudicated. This is a successful recovery of one known failure, not a fresh holdout or proof that a model can never mistype a value.
- 317 coaching tests across 47 files and TypeScript passed. Compiled core and both actual parent adapters replayed the saved receipts successfully without paid regeneration. Repeating the isolated runner reused the receipt with zero additional charge.
- The recovered report passed the real isolated official ingest and manual callback: one row each, matching reviewed digests, repeated submissions deduplicated and modified unreviewed payloads rejected with HTTP400. Authenticated Chrome Profile2 verified official `/call/206` and manual `/self-report/identity-coaching-v1-9613`; taxonomy, objections-first content, teaching, payment outcome and commitments were present. Screenshot confirmed the left details card. The manual test record does not attach a downloadable source transcript; its full source remains in private evaluation evidence.
- Two new paid safety requests, both settled: $0.009060847 for the rejected format retry and $0.009950857 for the revised audit; total $0.019011704. Their recorded durations were74.239s and 84.559s, with85,504 cache-read tokens each. Cumulative usage-priced estimate $71.350405723 of the $100 ceiling. No additional writer/reviewer/analyst spend, unresolved intents or duplicate charges.
- Four production workflows and the lab transport match their before snapshots for nodes, connections, settings and activation. Lab transport is inactive. Remote main remains `2a45c28c026e7d8f1e7fe15b86e4812c72c76753`. No production write, merge, native Google Doc/Slack delivery or new intake was performed.
- Code `0dfa48bd371f9c4f2c988186a6f1af3c5d02d6c3` deployed READY to the isolated preview; the stable isolated alias points to it. GitHub reliability CI passed in2m15s for this code commit. PR417 remains a draft.

## Honest assessment and next step
The identified audit-format blocker is resolved in the isolated candidate, and the held report is safely recovered. In combination with the preceding full-source coaching review, I recommend this candidate for an authorized production replacement rather than another open-ended prompt/model testing round. No known material defect remains from this bounded work. This does not establish universal superiority or failure-free future operation: malformed or genuinely unsafe responses must still remain held when bounded recovery cannot validate them. Before any approved cutover, refresh the live baseline for concurrent work, apply the candidate with the versioned identity catalog, preserve rollback/in-flight records, and verify live delivery. Production replacement itself is not authorized or performed here.
