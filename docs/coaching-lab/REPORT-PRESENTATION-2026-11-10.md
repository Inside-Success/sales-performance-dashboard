# Coaching report presentation — November 10, 2026

## Scope

User-authorized presentation follow-up to the November 9 coaching release. Manual reports now use a left-hand details card and right-hand report on desktop, with a single column on narrow screens. Existing status polling, failure/paste-required panels, report links, chat and feedback controls remain in place.

New-generation objections render directly from the validated, source-bound reviewed record. Each shows the existing Objection Library category, handling and resolution, followed by clearly labelled buyer concern, actual response, assessment (How you handled it), transferable teaching (Take into your next call), and optional example wording. Empty optional fields are omitted. No model output is parsed to guess these boundaries. Legacy report readers and presentation remain supported.

This changes dashboard presentation only: no saved report text, native Google Docs, prompts, classification, provider calls, n8n workflows, recovery, database schema or analytics calculations change. Next steps remain conditional with the existing Agreed/Promised/Suggested distinctions. A report without next-step evidence is not given invented tasks.

## Verification

- Targeted ESLint passed.
- 28 checks passed across foundations consumers, historical report display, objection insights and manual timeout behavior. Assertions cover official/manual wording preservation and visible categories/handling/resolution without leaking internal evidence IDs.
- Optimized Next.js build and TypeScript passed.
- Hosted deployment and authenticated visual checks pending at initial commit; append observed results after release.

## Rollback

Revert this presentation commit through GitHub if needed. The previous app commit is 55b340edad0a66211e9ba75924b280220d9a4efe. This release has no data migration or workflow change, and requires no report regeneration. Keep the existing v3 readers and production generation flag.
