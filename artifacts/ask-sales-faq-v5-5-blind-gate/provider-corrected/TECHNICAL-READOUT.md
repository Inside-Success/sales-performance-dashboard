# Ask Sales V5.5 provider-corrected comparison

Date: 2026-07-26
Status: valid isolated diagnostic; blind human review pending; production promotion blocked

## What this corrects

The first 20-question packet was invalid for system comparison: neither side had a model provider and the candidate side called V5.4 while being labeled V5.5. Those root artifacts remain only for audit.

This corrected run:

- calls the real production V3 runtime and the frozen isolated V5.5 runtime;
- uses the same DeepSeek model and direct provider mode for both systems;
- fails before writing output when either provider is unavailable;
- requires provider-backed output coverage and rejects provider-unavailable fallbacks;
- checks a reverse-order repeatability subset;
- keeps the system mapping hidden in a one-question-at-a-time review.

The questions and verified rules were corrected before the valid provider run. In particular:

- Call 2 starts with the $20,000 Standard package, then moves only to approved higher or lower packages and listed installment plans based on fit and finances. Reps must not show all three prices at once or invent a custom split.
- A doctor may qualify while employed by a hospital or without owning a practice. A nurse is not treated as a doctor. The Zoom transcript records Mike and Rich rejecting practice ownership as a requirement and stating the doctor-versus-nurse boundary.

Dataset SHA-256: `32cb80bf99b6def87aa2715347aa32a4d5b5aebdc9d59a6569e24722bb63605f`

## Provider-backed result

| Measure | Production V3 | Frozen V5.5 |
|---|---:|---:|
| Prompts completed | 20/20 | 20/20 |
| Answer lanes | 16 | 12 |
| Route lanes | 3 | 7 |
| Conversation lanes | 1 | 1 |
| Provider-backed outputs | 20 | 19 |
| Successful provider attempts | 74/74 | 33/34 |
| Terminal provider failures | 0 | 0 |
| Provider-unavailable outputs | 0 | 0 |
| Mean latency | 15,097 ms | 11,074 ms |
| P90 latency | 19,174 ms | 13,188 ms |

V5.5 recovered from its one unsuccessful provider attempt, so there was no terminal transport failure. The two runtimes used the same provider/model; the coverage difference is architectural.

Primary runtime SHA-256: `dbdb92251630c38a6f3a29f5696dd23b7b52a59279d37cec37234e24e8d35781`

## Manual engineering audit

V3 currently has stronger answer coverage. V5.5 routed several questions whose verified rule was present and answerable, including:

- the five-year ISTV placement guarantee;
- the $20,000-first Call 2 quote sequence;
- the same-week Call 2 rule;
- the hospital-employed-doctor eligibility rule;
- the editing timeline.

V5.5 was concise and source-correct on several other rules, including Daymond John cohort handling, ROI boundaries, OnceHub cancellation, cast-member privacy, minors, authors, and live onboarding. It was also faster than V3 in this run.

Both systems mishandled the final chopped-reels follow-up. V5.5 repeated the full-episode rule instead of answering the reels question. V3 produced internally conflicting guidance. This is a follow-up intent-resolution defect, not merely a prose issue.

V3 also has real weaknesses. Its Call 2 pricing response did not state the required exact $20,000 baseline; it added unnecessary volatile detail to one Greenlight route; and its minor-eligibility answer was awkward. This is why the result supports keeping V3 live, not declaring V3 perfect.

## Repeatability hold

The reverse-order subset completed without provider-unavailable output, but V5.5 changed one material decision:

- `call1-pricing-turn-2`: primary run answered; repeat run routed to `#sales-questions-requests`.

The verifier therefore reports `verified_with_promotion_hold`. The sealed scorer independently recomputes this mismatch, cannot pass the technical gate while it remains, and can never authorize production without separate owner approval.

Repeatability runtime SHA-256: `84b64a76c40b5ddc38a56d3a6751de1ef16c01ae5688d4738e022b62ac1e7b53`
Review packet SHA-256: `2005362a7557803f45cf17e223de505ac0f10dc8ee4d803e5e969939266f745a`

## Evidence limits and decision

This is the first valid provider-backed comparison for this 20-question packet, but it is not a fresh unseen promotion holdout. The questions and source gold were exposed during the invalid first review, and the corrected rules were then repaired before this run. The packet is valid for diagnosing the two runtimes and collecting blinded answer preferences; it cannot independently prove production superiority.

Do not replace V3 with V5.5. The current data shows that V5.5 is faster and safer in some answer phrasing, but materially less helpful on source-answerable coverage and not decision-stable enough for production.

## Human review

Open `ASK-SALES-BLIND-REVIEW.html`. It shows one question at a time in four batches of five. The reviewer sees the verified rule, Answer A, Answer B, two short judgments, and an optional note. Backend disposition labels are not shown. Progress is stored locally where browser policy allows and has an in-memory fallback.

After completing all 20 items, export the feedback JSON and score it with:

```bash
pnpm score:ask-sales-faq:v5-5:blind-review -- --dir=artifacts/ask-sales-faq-v5-5-blind-gate/provider-corrected --feedback=/absolute/path/to/ask-sales-blind-review-feedback.json
```

The next runtime change, if separately authorized, should repair V5.5's evidence adjudication/admission and follow-up intent resolution systemically. These 20 prompts must remain regression diagnostics and must not be patched individually or reused as unseen promotion proof.

Production V3, Slack, Google, n8n, the database, authentication, knowledge releases, and the separately saved production policy-matcher replacement remain unchanged. GitHub publication created only automatic Preview record `dpl_HRtikv25vgJhWqEH2uf1bFMNBTuM`; it failed before an application build at 0 ms and has no production alias. Production deployment `dpl_8UxUBMivafKEQN7fiy5aVMdETEFw` remains READY.
