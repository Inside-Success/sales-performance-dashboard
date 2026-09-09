# Magic Mike reliability verification

See `../../MAGIC-MIKE-RELIABILITY-RELEASE-2026-09-08.md` for the sanitized release result and remaining upstream limitation.

`retry-policy.cjs` and `pending-page.cjs` are standalone pure functions. The former distinguishes retryable read/compute failures from ambiguous writes; the latter generates bounded, account-separated recent/history keyset pages.

Private local reconstruction and fixture verification:

```sh
python3 scripts/magic-mike-reliability/build-patches.py
node scripts/magic-mike-reliability/test-reliability.cjs
```

These commands require the authorized workspace's `.magic-mike-repair-2026-09-08/` directory beside this repository, including its private `release/` operation files and execution fixtures. They make no API calls. The builder reconstructs local candidates only. Configured workflow exports and call fixtures must not be committed to this public repository.

Do not blindly apply an old patch to a newer graph. This n8n instance publishes active-workflow updates immediately. Retain linked-item identity and checkpointed stage recovery; do not replay an entire scored call to repair delivery or retry an ambiguous non-idempotent write.
