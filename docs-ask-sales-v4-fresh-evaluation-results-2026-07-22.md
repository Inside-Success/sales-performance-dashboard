# Ask Sales V4 Fresh-Source And Production-Log Evaluation Results

Date: 2026-07-22

Status: **diagnostic evaluation complete; keep V3 live; do not promote, merge, or cut over V4 from this evidence.**

## Decision

V4 is not a clear overall replacement for V3 yet.

V4 is materially better at detecting stale or conflicting policy and is much faster in these runs. The clearest example is Money Mondays: current user evidence conflicts with the governed discontinued-program article, V3 repeatedly states the stale article as fact, and V4 safely routes the conflict.

V3 remains better on several established-policy, compound, artifact, and follow-up questions. V4 also made material fresh-question errors, including saying a Call 1 could probably proceed while the prospect was a passenger when the authoritative reply required rescheduling, and stating an unverified cross-channel contact rule after a text opt-out instead of routing the exact conflict.

The largest blocker is not the absence of Pinecone or a conventional vector database. Many authoritative Slack decisions in the fresh set are not in the materialized governed corpus used by either runtime. A retriever cannot recover knowledge that was never governed and published, and a vector index over stale policy can make a stale answer easier to retrieve. The next isolated phase should improve authoritative-source promotion, conflict/supersession handling, partial-answer preservation, clarification behavior, and exact route selection before another untouched evaluation.

## Evaluation Scope

All answer generation used clean dashboard commit `f61c73ec6a4410a13cb81b3a16a4b601e9251389` with implementation fingerprint `ae62a3ec4f4420d78447d97d697066e472e1a0c1b1b698969d89c77855bb86fd` and knowledge version `8c8c677c1209f2d7`.

| Episode | Source | Unique prompts | Runs | Paired outputs | V3 reference |
| --- | --- | ---: | ---: | ---: | --- |
| A | Fresh authoritative Slack threads | 13 | 3 | 39 | Fresh V3 runtime |
| B | Recent production-log questions | 16 | 3 | 48 | Fresh V3 runtime |
| C | Recent production-log questions | 16 | 1 | 16 | Exact stored production V3 answer |
| **Total** |  | **29 unique questions** |  | **103 pairs** |  |

The fresh Slack set contains only redacted questions with reliable threaded replies from approved operational authorities. Slack was read only. The recent production export used the existing one-`SELECT` redacted exporter and contains no viewer identity or free-text feedback.

The two frozen datasets passed source-traceability, count, cross-set-duplicate, and PII checks. The 13 Slack prompts had no exact or near duplicate among 242 prior tracked questions; the closest lexical Jaccard match was 0.2667.

## Provider And Isolation

Episodes A and B gave fresh V3 and V4 the same direct `deepseek-v4-pro` provider, disabled reasoning mode, retry contract, and no alternate-provider fallback. V3 received the provider only through the paired evaluator's dependency-injection option; no V3 runtime, production environment, selector, API, deployment, or knowledge was changed.

Episode C used the exact stored V3 answers and a fresh model-backed V4. Provider parity does not apply to that historical-user-experience comparison.

The user-authorized DeepSeek credential was loaded only from a mode-`600` temporary file outside both repositories. It was not printed, committed, copied into an artifact, or added to production. No Vercel plan, credits, subscription, marketplace product, or provider upgrade was purchased.

An initial no-provider run and a one-case Vercel Gateway smoke are excluded. The first exercised only fail-closed no-model behavior. The second reached Gateway but was rejected because the selected model was unavailable on the current free tier; no upgrade was made. Neither artifact contributes to the results below.

## Generation Reliability

- All **103/103** paired cases completed.
- Fresh V3 recorded **349 successful provider attempts and zero failed attempts** across Episodes A and B.
- V4 recorded **203 successful provider attempts** and one failed validation attempt that recovered on retry; there was no unrecovered V4 generation failure.
- Episode A V4 latency was p50 **12.3 s** and p95 **23.0 s**, versus fresh V3 p50 **22.2 s** and p95 **30.8 s**.
- Episode B V4 latency was p50 **5.4 s** and p95 **15.0 s**, versus fresh V3 p50 **17.6 s** and p95 **29.7 s**.
- Episode C V4 latency was p50 **5.2 s** and p95 **17.4 s**. Stored V3 latency is historical and not a controlled provider-parity comparison.

## Diagnostic Model Scores

These numbers are secondary evidence only. The DeepSeek judge returned a complete strict score for 66 of 103 pairs. Thirty-seven calls failed the exhaustive-count or route-consistency schema. Manual review also found some completed judgments that misread route destinations or treated a generic studio-tour statement as satisfying a request for the current artifact. The scorer is therefore neither complete nor reliable enough to decide promotion.

| Episode | Auto-scored | V3 utility | V4 utility | V3 / V4 / tie | V3 critical unsupported | V4 critical unsupported |
| --- | ---: | ---: | ---: | --- | ---: | ---: |
| A - fresh Slack | 22/39 | 71.9 | 59.4 | 10 / 5 / 7 | 0 | 3 |
| B - logs, fresh runtimes | 32/48 | 64.1 | 66.7 | 6 / 10 / 16 | 5 | 0 |
| C - stored V3 vs fresh V4 | 12/16 | 53.3 | 66.7 | 1 / 4 / 7 | 2 | 0 |

The auto-scored subset suggests that V4 is safer on the production-log conflicts, but it understates V3's advantages because several V3-favorable follow-up cases were not scored and some completed judgments were incorrect. It must not be extrapolated to the unscored cases.

## Source-Backed Engineering Review

An engineering review inspected every one of the 103 captured pairs against the frozen atomic gold and its source context. This review is not an independent blind human or SME score and has no promotion authority. To avoid counting three model variations as three independent business questions, the table below reports a holistic verdict per unique prompt.

| Comparison | V3 better | V4 better | Tie / both insufficient | Total |
| --- | ---: | ---: | ---: | ---: |
| Fresh Slack, fresh V3 vs V4 | 5 | 4 | 4 | 13 |
| Production-log prompts, fresh V3 vs V4 | 7 | 4 | 5 | 16 |
| Actual stored V3 vs fresh V4 | 5 | 4 | 7 | 16 |

### Episode A case-level findings

V3 was better on:

- reality-TV versus documentary boundaries;
- prior cast-member privacy while preserving the unresolved anonymous-example part;
- the Call 1 passenger case, where V3 routed safely and V4 gave the wrong proceed-as-is answer in two of three runs;
- the VIP contract-boundary question, although neither system surfaced the current upgrade form; and
- the cancellation/opt-out compound, where V4 asserted an unverified email prohibition instead of routing the exact cross-channel question.

V4 was better on:

- promotional-asset use, because it avoided V3's adjacent but nonresponsive raw-content guidance;
- duplicate-record handling, although its correct `#sales-tech-requests` route was not stable across all three runs;
- the HubSpot-owner/Keap-notes workflow, where it recovered more of the approved checks; and
- the missed cohort deadline, because it routed rather than repeat V3's outdated three-month wait when fresh authority said six months.

Both were insufficient or equivalent on the two Daymond access/collaboration questions, the phone-plus-Zoom onboarding workaround, and the current upgrade-form artifact. Those authoritative answers were missing from the governed corpus.

### Episode B case-level findings

V4 was better on the ambiguous Lite-to-VIP upgrade, the first two Money Mondays source-conflict turns, and the VIP Tier-1 question where it supplied a useful but incomplete one-platform partial rather than V3's unstable answer.

V3 was better on the Built for More script request, client-recording route destination, current studio-preview artifact boundary, self-generated referral safety, and the first three Mastermind turns. V4 frequently routed Mastermind to sales tech, discarded already known access/fee facts, or added unrelated content.

Both were equivalent or insufficient on the ROE clarification, the corrected ROI answer, the final Money Mondays owner-verification turn, the live revenue goal, and the last Mastermind missed-event question.

### Episode C case-level findings

Compared with the exact responses users received, V4 materially improved the first two Money Mondays turns and gave useful partial help on the VIP Tier-1 question. Its studio response was more relevant than the production pre-audition-video answer, but it still did not provide or correctly route the requested current preview artifact.

Stored V3 was better on the Built for More request, the client-recording route destination, and the first three Mastermind turns. The remaining seven prompts were equivalent or flawed in both systems.

## Root-Cause Diagnosis

The evaluation shows four separate causes that must not be collapsed into one metric:

1. **Governed-knowledge lag.** Fresh authoritative decisions about Built for More, the six-month deadline, client recording, phone-plus-Zoom onboarding, Daymond access, promotional assets, and other operations had not reached the materialized runtime corpus.
2. **Stale/conflicting policy.** Money Mondays and the three-versus-six-month wait demonstrate that older approved evidence can remain retrievable after operations change. V4's conflict boundary helps, but it cannot supply the new answer until governance publishes it.
3. **Runtime behavior.** V4 over-routes known Mastermind facts, loses useful partial context, sometimes chooses the wrong route, and occasionally converts adjacent evidence into an unsupported operational answer. V3 can over-answer ambiguous product questions and double down on stale evidence.
4. **Conversation quality.** Neither system naturally asks whether `ROE` means `ROI`; V4 follow-up continuity is weaker on the Mastermind sequence. These are systemic clarification and context-retention defects, not missing-vector-index defects.

The existing structured hybrid architecture remains the right base. Product scope, exclusions, blockers, authority, supersession, answerability, route keys, and source lineage are essential safety metadata. A vector index may later improve recall after labeled analysis proves a recall miss, but it cannot replace governance or safely index every Slack reply as answer authority.

## Recommended Next Isolated Phase

Keep V3 as the only production runtime. Do not merge draft PR #70 or expose V4 to normal users.

The next candidate should be a systemic isolated improvement, not a patch for these exact 29 questions:

1. shorten the path from an authoritative Slack thread to a reviewed, conflict-checked, immutable governed release;
2. add explicit freshness/supersession checks so a newer authoritative decision can retire or block stale policy;
3. preserve every supported answer need while routing only the unresolved need;
4. add a true clarification lane for ambiguous products, acronyms, and short typo-like turns;
5. make route selection exact and stable, especially sales policy versus sales tech;
6. strengthen follow-up context so known access/fee facts survive a later unresolved question; and
7. evaluate the systemic changes on a newly collected untouched source set with the same provider parity and source-backed manual review.

These 29 questions must remain evaluation evidence. They must not be copied into synonym lists, exact matchers, hard-coded answer rules, or a tuning replay used as proof of improvement.

## Artifacts And Hashes

Raw answer artifacts remain local and git-ignored because they contain redacted operational questions and answers. Their immutable SHA-256 values are:

| Artifact | SHA-256 |
| --- | --- |
| `fresh-slack-2026-07-22-direct-three-run.json` | `77bc3380f2454de1a629da91886e3540c43978afe0bc0ca838391913d60bb53d` |
| `live-log-fresh-2026-07-22-direct-three-run.json` | `fee197931b61e662ac90a38276f46fdd2c09b48ff46f843becd91ce71bb4d2ae` |
| `live-log-historical-v3-2026-07-22-direct-one-run.json` | `627272f41024072b1b2a65ea1358a579941e803c13f311f43efd6669f6ad559f` |

Frozen dataset hashes:

- fresh Slack: `7d994f94612f70db1d4fb82b15501ee2d539bec8a541b6a8add667de329f8f74`;
- production-log replay: `fdaf638163864d8cfecb978170cedcec2ccc90fe2836ea116fad8cbfa4cdfe8b`; and
- one-`SELECT` production export: `6ffe442b834814d49578006af673c40b583b2cf852960109c410b7b4e7440486`.

## Boundaries Preserved

- V3 production remained the sole live runtime.
- No production deployment, alias, environment, selector, API, page, database row, or knowledge release was changed.
- Slack, Neon, Google, n8n, and other company systems were not written to.
- No local development server was started.
- No subscription, upgrade, credit purchase, or marketplace installation was made.
- The five-case saved holdout remains sealed and unopened.
- The separate policy-matching replacement remains pending and untouched.

The final read-only live check found dashboard `main` still at `1641c3fb9b410aa5a0d43c68b41edb0d04fbfc2b`. Production deployment `dpl_8UxUBMivafKEQN7fiy5aVMdETEFw` remained `READY`, target `production`, on the unchanged rose and main aliases. Dashboard PR #70 and FAQ PR #46 remained open drafts; no branch commit moved a production alias.

Final non-server verification passed the fresh-dataset validator, **374/374** focused V4 tests across 16 files, **610/610** full Ask Sales tests across 31 files, **107/107** static checks, **15/15** isolation checks, TypeScript, scoped ESLint, and an optimized Next.js production build.

This evaluation is stronger generalization evidence than the retained replay, but it is still diagnostic. Production promotion still requires a new untouched set, independent source-only SME gold, a sufficient preregistered sealed holdout, blind human scoring, stakeholder review, and explicit cutover approval.
