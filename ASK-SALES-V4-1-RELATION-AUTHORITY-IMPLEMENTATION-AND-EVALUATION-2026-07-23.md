# Ask Sales V4.1 Relation And Authority Implementation And Evaluation

Date: 2026-07-23

Status: **implemented, verified, frozen, and evaluated in isolation. V4.1 is directionally and materially better than V3/current V4 on the replacement sealed diagnostic, but it still fails the production-promotion gate. V3 remains live and unchanged.**

## Release Boundary

- Branch: `agent/ask-sales-v4-1-relation-authority-2026-07-23`
- Draft dashboard PR: [#72](https://github.com/Inside-Success/sales-performance-dashboard/pull/72)
- Frozen implementation commit: `bdee9db7764c28ed77df82ef2e96f256fabb4e9d`
- Frozen implementation tree: `60747fa96ae3f9121e6b0e8c3d6615172bd2953b`
- Production selector, API, page, database, Neon, Slack, n8n, Google, feedback, and conversation persistence changed: no
- Local development server started: no
- Deployment or production cutover performed: no
- Existing V3 production and frozen V4 were not changed
- The separately saved V3 policy-matching replacement remains pending and was not mixed into this work

Generated evaluation artifacts remain local and untracked because they contain internal questions, sources, and answers.

## Problem Addressed

The prior systemic V4 improved knowledge access but still allowed broad semantic similarity to connect the wrong subject, relation, condition, or requested action. It also lacked an explicit, claim-scoped way to decide which source controlled when old, new, broad, exact, and partially overlapping Slack decisions conflicted.

V4.1 addresses those problems systemically rather than adding answer text for individual benchmark questions.

## Implementation

### Typed relationship matching

V4.1 models and checks the requested decision before permitting an answer:

- subject and product scope;
- relation type, including eligibility, permission, prohibition, requirement, procedure, timing, ownership, artifact, and routing;
- request kind: knowledge, operational action, current lookup, or artifact request;
- decision polarity and deontic force; and
- material conditions, exclusions, and boundaries.

Broad similarity is no longer enough on its own. A candidate must be compatible with the same bounded decision, and an exact claim-scoped authority resolution may override only that bounded relation check.

### Claim-scoped authority and conflict resolution

The authority register contains 22 source-resolved decisions. Each resolution records:

- exact match groups and product scope;
- controlling policy IDs;
- excluded policy IDs;
- resolved blocked topics;
- effective date, authority basis, and source IDs; and
- one globally retired source whose compiled decision exceeded the authoritative reply.

This prevents a newer answer from replacing unrelated parts of an older policy and prevents an older broad rule from resurfacing after an exact correction. Controlling sources are preserved through retrieval caps so source balancing cannot silently remove part of a multi-source decision.

### Grounding and completeness guards

The runtime now includes deterministic checks for several recurring failure shapes:

- documentary-only guidance cannot be attributed to podcast structure;
- a documentary answer cannot satisfy a podcast-only need;
- freelancing alone cannot become a blanket established-business prerequisite;
- freelancer qualification must preserve business, offer, ownership, and broader-fit factors;
- existing-client cross-show guidance must preserve the Keap/original-rep assignment check;
- exact no-launch and early-stage eligibility decisions keep their controlling conditions; and
- same-artifact and multi-source exact recovery may restore only a controlling, relation-compatible sentence.

Exact-source recovery still passes deterministic condition, polarity, scope, and relation checks. It is not a general bypass around model validation.

### Route ownership

The runtime has explicit route ownership for the core live-action channels:

- finance actions: `#sales-finance-requests`;
- greenlight letters and current greenlight status: `#greenlight-requests`;
- unresolved policy questions: `#sales-questions-requests`; and
- system, access, automation, recording, and tool failures: `#sales-tech-requests`.

The replacement sealed test shows this taxonomy is present but not yet enforced reliably enough in every compound or ambiguous request.

### Additional authoritative knowledge

The supplied Mike/Rich meeting transcript and screenshots now produce 10 evidence records and 9 bounded policies. They include the Call 1 pricing exception, practice-ownership correction, lead ownership, same-day onboarding, upgrade-form requirement, approved app wording, main-ISTV reapplication minimum, DJ no-cohort/no-discount boundary, and approved-payment-plan boundary.

## Knowledge Verification

All 504 operational answer policies were replayed against their exact Slack source thread:

| Verdict | Count |
| --- | ---: |
| Supported | 492 |
| Partial | 10 |
| Unsupported | 2 |
| Verification failures | 0 |

The 12 partial or unsupported records remain withheld from confident answering.

Verification artifact SHA-256: `27183157d79ace52b6c5a64c870ffca3fc03cb0b7c3aa36ff7407f6818336fa5`

This verifies source fidelity. It does not prove that retrieval will select the right policy for every new wording.

## Development Diagnostics

### Retained 78

The final retained replay completed all 78 cases with 231 successful provider calls and zero failures:

- 32 answer;
- 3 artifact;
- 17 conversation;
- 5 partial; and
- 21 route.

The dual-pass diagnostic judge scored V3 at 68.6, current V4 at 91.4, and V4.1 at 78.5. Manual inspection found that one alleged critical V4.1 error was actually backed by an exact, independently verified Madeline source that was newer or more complete than the retained gold. This is why retained replay remains regression evidence rather than promotion evidence.

Retained replay SHA-256: `612b79bc60ead9a4ef6aacbaacbdf74d079d0544f0e3a8a2763113f9a4f958ce`

### Final completeness probe

Five previously failing decision shapes all answered cleanly after the systemic fixes:

1. early-stage/no-launch handling;
2. podcast versus documentary separation;
3. freelancer qualification factors;
4. existing-client cross-show/original-rep handling; and
5. OnceHub public-window versus Google Calendar fallback.

Probe SHA-256: `2e79366060531fa8c61ec4cc5fdcbd0f2273497cca633e7aef01a7d7ab3707ea`

## Candidate Freeze And Replacement Holdout

An earlier 67-case candidate was invalidated before use because metadata from it was accidentally viewed before the implementation freeze. It is not reported as valid evidence.

After freezing commit `bdee9db`, a replacement 50-case holdout was generated with a new salt. It excluded:

- the original 60-case sealed evaluation; and
- 147 cases from the two invalidated sets.

The replacement contains 30 expected-answer and 20 expected-route/live cases.

Dataset SHA-256: `c14eb9a6453043a0adf7ff7b5e4e2cc630a9bbd80624a0a67778a9d018ed2db2`

### Raw behavior

- V4.1 lanes: 14 answer, 1 artifact, 8 partial, 27 route
- Current V4 reference: 14 answer, 5 clarify, 17 partial, 14 route
- Provider attempts: 192 successful, 0 failed
- Fallbacks: 0
- Latency: p50 20.5 seconds, p95 36.7 seconds

Lane movement is not correctness. The conservative lane mix explains both V4.1's safety gain and its remaining false-abstention problem.

### Dual-pass diagnostic judge

| System | Weighted utility | Critical unsupported |
| --- | ---: | ---: |
| V3 | 49.3 | 2 |
| Current V4 | 51.3 | 2 |
| V4.1 | **58.6** | **0** |

Among the 35 cases where both passes agreed on a preference, the consensus was V3 5, current V4 0, V4.1 8, and tie 22. The remaining 15 did not reach a two-pass preference consensus.

- Preference agreement: 70.00%
- Per-need status agreement: 72.13%
- Runtime artifact SHA-256: `44932992736689d5fd7bc799fe853a6b55fed281897834b9a778a299dd59a2cc`
- Judge artifact SHA-256: `20e78b905d762d30a23a2098ad8839a2275c455036c755d91630990a73afc06c`

The judge is useful for triage, not release approval. Its disagreements and stale/exhaustiveness assumptions are too substantial to treat 58.6 as ground truth.

## Manual Audit Of All 50 Sealed Cases

Every question, atomic gold need, V3 answer, current-V4 answer, V4.1 answer, selected source, route, and both judge rationales was reviewed manually.

| Manual outcome | Cases | Meaning |
| --- | ---: | --- |
| Fully correct or appropriately routed | 19 | Correct answer or justified live/action route |
| Useful and materially correct partial | 11 | Helpful, but omitted a requested component or added nonessential detail |
| Safe abstention or suboptimal route | 17 | Did not assert a wrong policy, but routed an answerable need or chose an imprecise owner |
| Materially wrong or misleading | 3 | Wrong relationship, wrong operational framing, or unrelated answer |

The three material failures were:

1. a greenlight-process question received EOD wording plus `#sales-questions-requests` instead of a reliable greenlight-workflow answer/owner;
2. a request for the Monday greenlit-but-uncommitted email link matched an unrelated self-booked prospect pre-call template; and
3. a statement about the 7-minute pass-off window matched the unrelated rule that licensing details are discussed on a 30-minute Zoom call.

Other important findings:

- V4.1 safely routed a Call 1 abandonment categorization that V3/current V4 answered incorrectly as `no-show`; the sealed source says `disqualified`.
- V4.1 safely routed a Cast Member HQ example request that current V4 answered with an unrelated testimonials link.
- The apparent daily-stats umbrella error was a judge/gold limitation: the selected answer is directly supported by a Madeline-approved source.
- Advice to use pass-off/dummy calls is also authoritative, but it only partially answered a gold need focused on the daily dial list.
- Several policy questions still route to Finance merely because payment words appear in the scenario. Route ownership therefore needs stronger request-kind enforcement.
- Several exact, answerable rules still fail closed, including adult-business eligibility, post-payment redlines, Call 1 rescheduling, cohort start date, and greenlit-missed-deadline reapplication.

## Verification

| Check | Result |
| --- | --- |
| Focused authority/runtime/facts | 107/107 passed |
| Full Ask Sales Vitest | 37 files, 734/734 passed |
| Isolation validator | 15/15 passed |
| Fresh-evaluation validator | passed: 13 fresh prompts and 16 replay prompts, including PII/source traceability |
| TypeScript | passed |
| ESLint | passed with zero warnings/errors |
| `git diff --check` | passed |
| Optimized Next.js build | passed |
| JSON bundle validation | passed |
| Secret/path scan | no secret-shaped provider key, private key, or workstation path in the frozen candidate |
| Local development server | not run |

## Honest Decision

V4.1 confirms that the architecture is headed in the right direction. It improves source authority, condition preservation, relationship typing, and safety in a way that is meaningful rather than question-specific. On the untouched replacement set, it scored 9.3 utility points above V3 and 7.3 above current V4, while reducing judge-flagged critical unsupported answers from two to zero.

It is **not ready to replace V3**. Three material failures in 50 untouched cases are incompatible with a production policy assistant, and 17 additional safe-but-unhelpful cases show that route precision and answer recall remain too weak. The right conclusion is neither “give up on V4” nor “ship V4.1.” Preserve V4.1 as the new isolated baseline and keep V3 live.

The next candidate should be V4.2 and should make only systemic changes:

1. hard-reject incompatible measurement/timing objects such as `7-minute pass-off window` versus `30-minute licensing call`;
2. add document/artifact lifecycle identity so pre-call templates cannot satisfy post-greenlight Monday-letter requests;
3. enforce request-kind before topic words so policy questions do not become Finance actions;
4. enforce the greenlight/Finance/Sales Tech/policy route-owner map on compound needs;
5. improve exact-answer recall without weakening the condition, authority, and conflict gates; and
6. treat these 50 cases as development evidence only, then freeze and evaluate on a newly untouched holdout with blind SME scoring.

No merge, deployment, cutover, or production replacement is authorized by this result.
