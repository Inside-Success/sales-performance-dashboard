# Ask Sales V5.1 sealed holdout manifest

Date: 2026-07-24

## Candidate boundary

- Runtime: isolated Ask Sales V5.1
- Freeze commit: `45fc2ac`
- Production V3 changed: no
- Candidate changed after Slack answer inspection: no
- Slack access: read-only

## Sealed dataset

- File: `tests/ask-sales-faq/v5-1-post-freeze-slack-holdout-2026-07-24.json`
- Cases: 20
- Source: `#sales-questions-requests` (`C0AUQKNR8CF`)
- Sealed at: `2026-07-24T17:19:23+05:00`
- SHA-256: `47c17252e611c819153d62842e602d7b7a958d8358a8795bd6a87180063644dd`
- Prior test-fixture overlap for the 20 parent Slack timestamps: none found

The candidate was committed before the selected thread replies were opened. This holdout is permanently consumed after its first V3-versus-V5.1 run and must not be reused as promotion evidence for a later tuned candidate.

## Evaluation rule

Manual comparison against the authoritative thread answer is primary. Runtime lane counts and an AI judge may support diagnosis, but neither can overrule a wrong answer, a missing material condition, or an incorrect action owner.
