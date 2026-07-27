# Ask Sales V5.11 final unseen gate

## Decision

**Do not replace V3 with V5.11 yet.** V5.11 is better on several exact-answer cases, but this source-disjoint gate does not show production readiness.

- V5.11 acceptable: 17/24 (70.8%)
- V3 acceptable: 16/24 (66.7%)
- Pairwise: V5.11 8 wins, V3 5 wins, 11 ties; net +3
- V5.11 material errors: 2; wrong owners: 1; false routes: 4
- Repeatability: 8.33% lane flips and 16.67% decision-boundary flips; both exceed the 5% gate
- Provider parity: 48/48 primary outputs provider-backed; no terminal failure in the accepted run
- Production V3: unchanged

The improvement is real but not sufficient. V5.11 retrieves exact debit-card, recording, sensitive-story, and promotion-view rules that V3 misses. It still fails on an exact physical-therapist rule, cross-offer ownership, Fulfillment routing, attorney-review intent, and an unsafe guessed delivery range.

## Prompt-level audit

| Prompt | Better | V3 | V5.11 | Manual finding |
| --- | --- | --- | --- | --- |
| v511final-01 | V3 | acceptable | incomplete_false_route | V3 gives the no-pop-in rule and virtual alternative. V5.11 gives a narrower financial-commitment boundary and routes the rest. |
| v511final-02 | Tie | acceptable | acceptable | Both correctly reject the concerning applicant and keep them out of Zoom. |
| v511final-03 | Tie | acceptable | acceptable | Both correctly update Keap ownership to the rep who booked the 20 percent lead. |
| v511final-04 | Tie | acceptable | acceptable | Both preserve the 20 plus 20 limit. |
| v511final-05 | V5.11 | false_finance_route | acceptable | V5.11 answers the exact debit-card rule; V3 withholds it. |
| v511final-06 | Tie | acceptable | acceptable | Both give the correct block, opt-out, and Sales Tech actions. |
| v511final-07 | V5.11 | acceptable_with_unneeded_route | acceptable | Both contain the controlling proof and Sunday deadline; V5.11 is direct and complete. |
| v511final-08 | Tie | acceptable | acceptable | Both correctly allow personal-calendar hours without touching or overlapping master. |
| v511final-09 | Tie | acceptable | acceptable | Both distinguish a social and Google review from a formal full background check. |
| v511final-10 | V5.11 | materially_wrong_approval_boundary | acceptable | V3 says a franchise owner needs no ultimate-owner approval. V5.11 preserves the stricter approval and decision-maker boundary. |
| v511final-11 | V5.11 | false_route_wrong_recording_source | acceptable | V5.11 distinguishes pass-off and dummy recordings. V3 does not answer the ownership procedure. |
| v511final-12 | V5.11 | acceptable_older_rich_route | acceptable_newer_madeline_workaround | The selected Rich thread says Sales Tech; a later authoritative Madeline record supplies the temporary Legacy Makers plus note workaround. This is a corpus-governance conflict, not a simple gold failure; V5.11 uses the newer actionable rule. |
| v511final-13 | Tie | acceptable | acceptable | Both allow an immediate Call 1 reschedule because no first audition occurred. |
| v511final-14 | Tie | false_route | false_route | Both miss Rich's exact yes for a physical therapist who owns three practices. |
| v511final-15 | V5.11 | false_route | acceptable | V5.11 correctly recognizes the sensitive recovery story as potentially suitable; V3 withholds it. |
| v511final-16 | Tie | wrong_action_owner | wrong_action_owner | Both safely avoid inventing a vendor but send the rep to Sales Questions instead of Fulfillment. |
| v511final-17 | V5.11 | materially_wrong_cross_offer_owner | false_route | V3 wrongly says one original rep can sell both offers. V5.11 is safer but misses Rich's first-Call-1 ownership rule. |
| v511final-18 | V3 | acceptable | false_route | V3 answers the American Authors fit; V5.11 withholds it. |
| v511final-conv-01-turn-1 | V3 | acceptable | materially_wrong_decision_focus | V3 tells the rep to walk through the contract live. V5.11 substitutes the generic payment-first sequence and does not answer the attorney-review decision. |
| v511final-conv-01-turn-2 | V3 | acceptable | acceptable_incomplete | Both allow emailing the contract PDF; V3 also preserves the required follow-up call. |
| v511final-conv-02-turn-1 | Tie | acceptable | acceptable | Both accurately distinguish Call 1, Call 2, and onboarding. |
| v511final-conv-02-turn-2 | Tie | acceptable | acceptable | Both carry the onboarding referent and identify the studio team after close. |
| v511final-conv-03-turn-1 | V5.11 | false_route_incomplete | acceptable | V5.11 gives the Facebook-via-ISTV-Instagram and dashboard answer. V3 routes the tracking portion. |
| v511final-conv-03-turn-2 | V3 | acceptable | materially_unsafe_timeline_guess | V3 gives targeting and withholds the unconfirmed timeline. V5.11 correctly caveats Fulfillment but still presents the source author's few-weeks-to-two-month guess as typical. |
