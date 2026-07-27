# Ask Sales V5.10 final unseen gate

## Decision

**Do not promote V5.10 to production.** It is meaningfully better than V3 on this fresh set, but it fails the preregistered correctness and repeatability thresholds. Production V3 remains unchanged.

## What the fresh data says

- V5.10 acceptable: 15/20 (75%)
- V3 acceptable: 12/20 (60%)
- Pairwise: V5.10 won 8, V3 won 1, 11 tied; net V5.10 lead +7
- V5.10 material errors: 2; wrong action owners: 1; false routes: 3
- Repeatability lane and decision-boundary flip rate: 7.69% (preregistered maximum 5%)
- Provider coverage: complete for all 40 paired outputs; no terminal provider failure

This is a genuine improvement, not a production pass. V5.10 answers several fresh questions that V3 routes, and it safely avoids V3's incorrect payment-order and opt-out answers. It still fails because one wrong action owner and one materially outdated package answer are unacceptable for live sales decisions.

## Systemic remaining work

1. Make conflict resolution compare exact decision scope, recency, and authority together so a newer narrow exception can supersede an older broad rule without globally demoting either source.
2. Force deterministic owner routing only for explicit live actions such as generating a Zoom link; keep the answer content model-backed.
3. Stabilize exact-record admission so the same complete controlling record cannot alternate between route and answer.
4. Carry explicit conversation referents such as "the PDF" into follow-up retrieval before entailment.
5. Freeze a successor and require a new source-disjoint gate; do not tune V5.10 on these revealed prompts.

## Why no blind packet was sent

The candidate failed correctness and repeatability prerequisites before human preference could authorize promotion. Preparing another 20-question review would burden the reviewer without changing the decision. A blind packet should be generated only for the next frozen candidate that passes those system gates.

## Prompt-level audit

| Prompt | Better | V3 | V5.10 | Manual source-only finding |
| --- | --- | --- | --- | --- |
| v510final-01 | Tie | acceptable | acceptable | Both correctly keep a DJ-only closer inside the DJ offer boundary. |
| v510final-02 | Tie | acceptable | acceptable | Both correctly count booked leads and leads who showed. |
| v510final-03 | Tie | wrong_action_owner | wrong_action_owner | Both route a live Zoom-link request to Sales Questions instead of Sales Tech. |
| v510final-04 | V5.10 | false_route_wrong_owner | acceptable | V5.10 answers the exact Keap ownership rule; V3 withholds it and sends the rep to Sales Tech. |
| v510final-05 | V5.10 | materially_incorrect | safe_false_route | V3 incorrectly permits signing before payment and introduces an unrelated discount; V5.10 is safer but fails to answer the exact payment-first rule. |
| v510final-06 | Tie | acceptable | acceptable | Both correctly allow filming before PIF when the payment plan is not delinquent. |
| v510final-07 | Tie | materially_incorrect | materially_incorrect | Both prefer an older governed platform boundary and miss the newer exact rule that VIP primarily adds non-guaranteed Amazon Prime while Apple TV submission can be purchased separately. |
| v510final-08 | Tie | acceptable | acceptable | Both correctly prohibit in-person pre-signing studio tours and point to virtual proof. |
| v510final-09 | Tie | acceptable | acceptable | Both correctly state day-before delivery before 9 PM ET, not exactly 24 hours. |
| v510final-10 | V5.10 | materially_incorrect | safe_conflict_route | V3 applies a broad older opt-out cancellation rule and says to cancel. V5.10 detects the conflict and routes safely, but it should resolve the newer, narrower already-scheduled exception and answer. |
| v510final-11 | V5.10 | false_route | acceptable | V5.10 correctly applies the seven-minute pass-off ownership window; V3 withholds the answer. |
| v510final-12 | Tie | acceptable | acceptable | Both correctly route receipt and tax-detail verification to Sales Finance. |
| v510final-13 | V5.10 | acceptable_boundary_weak | acceptable | Both identify Greenlight Requests, but V5.10 clearly states that the passive chatbot cannot create or send the letter itself. |
| v510final-14 | V5.10 | acceptable_incomplete | acceptable | V5.10 gives the complete website, mobile-app, and Roku/Apple/Fire-device answer; V3 omits website and mobile-app options. |
| v510final-conv-01-turn-1 | V5.10 | does_not_answer | acceptable | V5.10 directly allows sharing a relevant platform episode; V3 gives navigation advice and leaves the permission unresolved. |
| v510final-conv-01-turn-2 | V5.10 | false_route | acceptable_overlong | V5.10 preserves the no-metrics/no-ROI boundary, although it adds unnecessary detail. V3 withholds the follow-up answer. |
| v510final-conv-02-turn-1 | Tie | acceptable | acceptable | Both correctly prohibit emailing the slide deck and prefer the approved PDF. |
| v510final-conv-02-turn-2 | V3 | acceptable | followup_false_route | V3 carries the PDF referent and answers the last-resort exception; V5.10 loses the referent and routes. |
| v510final-conv-03-turn-1 | Tie | acceptable | acceptable | Both correctly keep the standard onboarding process for a self-generated lead. |
| v510final-conv-03-turn-2 | Tie | acceptable | acceptable | Both correctly preserve onboarding while telling TEC to record the 20% self-generated commission. |
