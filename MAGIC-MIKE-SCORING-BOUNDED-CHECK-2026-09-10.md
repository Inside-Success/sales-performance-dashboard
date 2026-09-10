# Bounded scoring factual check — September 10, 2026

Status: isolated evaluation passed; NOT deployed. No historical backfill. Existing production V2 remains active and unchanged. This supersedes the earlier failed Luna evaluation as the latest candidate evidence, not as a release record.

## Approach and results

Sonnet 4.6 remains the primary scorer. A separate Sonnet 4.6 checker sees factual claims and source-numbered transcript turns, without grade/band fields. It cannot rewrite the assessment. A conditional Sonnet 4.6 reassessment considers only disputed fields; code accepts only explicitly approved corrections and preserves unrelated grades, coaching, and metadata. Existing rubric weights, band points and deterministic caps remain unchanged. Terra was not used. Narrow Luna still missed the known Dean errors and was rejected.

Known-three gate passed before expanding. All 20 regression calls received numeric scores (31.2–76), including the previously withheld cases. Five additional eligible, previously unused calls received scores (49.3–81.1). One separately retained unused record was Zoom troubleshooting/rescheduling only and correctly excluded; it was not an eligible sales call withheld for a technical failure. Dean plus the 20 regression and five new eligible calls yielded 26 native n8n cached-runtime matches. Sixteen contract/parser tests passed.

Direct source checks confirmed Dean attribution and prompted-explanation corrections, a fresh $10,000 deposit claim corrected to $9,000, and an unconfirmed follow-up corrected instead of treating it as booked. This is evidence of factual improvement, not a claim that every assertion in every report was independently adjudicated. Numeric shifts versus older retried outputs also reflect using the first primary draft; do not attribute every score movement to factual correction.

The native test used real cached provider outputs; it did not exercise a newly wired end-to-end production reviewer. Actual persistence mapping was checked locally for all 26 results: scored route, exact composite, no observed speaker mismatch, largest string 14,071 characters. An initial test passed the wrong input envelope and only exercised the not-scored route; that assertion was corrected and the real scored-route check completed. No persistence writes occurred.

## Cost and safety

Cumulative estimated provider testing spend $44.9839, plus a separate $1 uncertainty reserve, below the $50 ceiling. This includes prior unsuccessful phases. No further paid tests running. All three temporary workflows are inactive, including Iwz9wODE2yqabCt6. No Slack deliveries, Google document edits, duplicate reports, compliance changes, or backfill were triggered by this evaluation.

Fresh live read: scorer 35bFcPYdHSADpyTN remains version 7090932d-db97-40c2-8723-2071feb8ad1e; provider, persistence and official versions match captured baseline. Natural official execution 702624 succeeded, child scorer 702626 produced valid eligible score 70.8, and the parent reached Slack top-level/thread delivery, document creation and Post to Dashboard. This is existing V2 evidence, not candidate delivery evidence.

## Remaining release gate

The candidate merits controlled integration. It is not ready for historical backfill yet: package the bounded reviewer into the production caller contract, verify provider/reassessment error paths, total cost and latency, and observe end-to-end delivery before backfill approval. Do not disable the live baseline until its tested replacement is published. Backfill still requires explicit user approval. No model can guarantee a valid factual grade for missing or unusable transcripts; eligible sample coverage here was complete without inventing fallback scores.

Implementation components: n8n/scoring-claim-review (bounded application, parser, tests, checker prompt/schema); existing source-evidence contract remains in n8n/scoring-luna-candidate. Private run receipts and transcripts stay outside Git under .magic-mike-scoring-claims-2026-09-10/. This draft branch also contains earlier rejected experiments and must not be merged as an unreviewed production release.
