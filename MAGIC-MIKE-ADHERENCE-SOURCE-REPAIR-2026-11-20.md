# Script Adherence source and recovery update

## Source decisions

- Documentary Call 1 Tab 1 now says not to mention a price and removes the earlier minimum. General cost and affordability discussion is still permitted. Show a specific price quoted by the rep as an evidence note outside the adherence percentage.
- Reality Call 1 Tab 1 requires the network introduction and show pitch once the call reaches the presentation opportunity. Advancement does not determine that opportunity. Apply the same observed-opportunity test to group and individual auditions. Preserve observation uncertainty and ignore sequence for playback credit.
- Documentary Call 2 requires the best-fit license presentation and prohibits showing all three prices. Report the latter only when the rep presents all three with transcript evidence. Keep playback credit independent.
- Reality Call 2 retains the approved contract-video and onboarding rules. The reviewer now has two required named output fields for production support. A legacy receipt with one empty, inapplicable support part may be normalized only under a source-bound negative onboarding condition. Exact validation still holds all other malformed output.
- Sources: the four entries in `src/lib/script-adherence/source-manifest.json`, [Sales leadership’s script and resource links](https://istvoffical.slack.com/archives/C0CEUSFRM5Y/p1794310107000349), and the [rep training guide](https://docs.google.com/document/d/1WOiA8L3_kIt1xEDnDun7TPnlyPG11kFBIb5OMnrLwOc/edit?tab=t.0). The audited second tabs are shared explanatory material. Pricing and contract Loom contents could not be verified directly. No scoring policy was inferred from them.

## Release and recovery

Activate v3 from its verified production rollout time. The original business effective date for the Documentary Call 1 price instruction is unknown. Calls starting before the v3 activation continue using the v1/v2 boundary recorded on November 10. Review and publication follow the rubric embedded in the original paid request. Historical call rows, metrics and the scheduled batch workflows carry forward untouched.

The two held Reality Call 2 reviews have matching, settled receipts and source evidence of deferred payment with no production onboarding. Revalidate those receipts without a new provider request. The two older size holds have no paid history, and the current full-source draft and review request builders accept both. Requeue only those exact transcript hashes and let normal batching use their call-date version. Any uncertain paid request, stale owner, accepted result or unexpected hold state stops that specific recovery.

After the live deploy, verify the controls, the original call and metric hashes, the two revalidated scores, the two long-call queue states and team/rep/dashboard totals. To stop selecting v3 for new work, restore the v2 activation fields using a guarded update. Keep all reader and receipt versions deployed once any v3 requests exist.

## Production verification

- PR #473 merged as `61aabf22734008adcb0dda02d0ed1785b674f10f`. Its Vercel deployment `dpl_98xE3sAMdE8oMwauvjkfWPuSQFRR` reached Ready and served both production aliases. The subsequent official coaching commit is a descendant and has no Script Adherence diff.
- Activated v3 at `2026-11-19T21:37:28.113046Z` (November 20 at 2:37 AM Pakistan time). The original v2 cutoff remains in effect for earlier calls.
- Both Reality Call 2 holds revalidated with the original review receipts. Each still has its original two paid request records, and neither recovery incurred a new provider charge. The support row now explicitly records both components as inapplicable.
- The two long transcripts fit the current draft and independent review request builders and were placed in the existing batch queue with their full transcript hashes and no earlier paid requests. Their original call dates select v1.
- All 5,250 existing result hashes and 5,250 existing metric hashes matched after recovery. The signed-in production page showed 5,252 results, 2,823 assessed calls, two in analysis, and zero held. Live aggregate checks reconciled 38,843 completed and 9,928 incomplete actions.
- The 172-test adherence and access suite, TypeScript, scoped lint, production build and Vercel preview passed. Regular API tests validated the two support fields, the distinction between buyer and rep pricing, evidence for all three price options, scoring both omitted videos when an audition continued, and exempting a call that ended before the presentation. The initial schema probe was rejected before generation because OpenAI disallows a description alongside a schema reference. The corrected schema passed. Recorded synthetic test usage is approximately $0.088.
- No live post-activation cohort had published at this checkpoint. The scheduled source refresh will record the reviewed Documentary Call 1 hash on its next normal scan.
