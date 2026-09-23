# Reality-show coaching extension — September 24, 2026

## Scope

Extend the official and self-submitted Call 2 coaching reports and their small in-report chat for the new reality-show offer. Preserve the existing ISTV and Daymond John / Next Level CEO paths. This does not change the main Ask Sales FAQ, compliance checks, numeric scoring, source Google Docs, or delivery topology.

## Sources and decisions

- [Reality Cast Master FAQ](https://docs.google.com/document/d/1flX8PyJiZQYiOrItCfvcRVNpCQM2-FchSLhf2UpvAJU/edit): launch-show examples, Call 1/Call 2 flow, Standard $20,000, VIP $30,000, and generally 7–14 filming days. Moonis explicitly selected the FAQ duration for now.
- [Reality Shows Packages](https://docs.google.com/document/d/1piWUsDLE4ON9kaHybWoXy3xGWu1PsqoeMBNYn4zz38Y/edit): package details.
- [Rudy's reality FAQ discussion](https://istvoffical.slack.com/archives/C09AF0NQJE7/p1788746537690009): reality onboarding and no regular cohort deadline. [Sales leadership](https://istvoffical.slack.com/archives/C0AUQKNR8CF/p1790111428311039) confirmed $20k/$30k; [Sales Ops](https://istvoffical.slack.com/archives/C0AUQKNR8CF/p1790099785592949) confirmed there is no separate $30k license video.
- [Existing ISTV context pack](https://docs.google.com/document/d/1ljBEsaKAIoZ2EIo7s0sP1M_cc2hu-b5uHN2G0uC3r9c/edit) is a distinct, older normal-show source. It was not edited because other consumers include compliance.

The six named launch shows are routing examples, not a closed catalog. Explicit show metadata or title wins. For a future name, repeated reality-format language plus a separate format cue in the transcript can identify it. Weak or conflicting evidence leaves the offer family unknown. A price alone never identifies a show. An explicitly named existing show wins over a passing comparison to a reality show.

## Implementation and rollback

`src/lib/coaching-offer-context.cjs` holds the shared resolver and brief, dated reality coaching reference. The dashboard report chat imports it; `scripts/coaching-release/build-reality-coaching-patch.cjs` embeds the same source into the two n8n coaching request nodes. This avoids independent routing rules between official, manual, and chat paths. Non-reality coaching system prompts are byte-identical to the baseline in offline replay.

Only `MM Build Coaching Request` in official workflow `L8Nn7xncA9ZPDdWA` and `MM Manual Build Structured Coaching` in manual workflow `BMRrGxHyXMcgO6j3` are candidate n8n edits. The generated operation and inverse files, full filtered-node baselines, and private real-call fixtures are in the ignored local `.magic-mike-reality-coaching-2026-09-24/` directory. They are deliberately absent from GitHub. Rollback restores each saved Code node from its inverse operation, then republishes the restored workflow and verifies its active graph. Dashboard rollback uses the prior production deployment.

## Validation gates

Before publication: scoped tests, lint, production build, syntax checks on both generated Code nodes, dry-run n8n updates, and offline replay of real official and self-submitted call states. Check offer classification and compare unchanged request fields; do not send test reports or Slack messages. After publication: read back the active n8n nodes and connections, check validation against the pre-change baseline, verify Vercel production, and observe natural reports rather than triggering duplicate deliveries.

The September 24 baseline n8n validator reports eight pre-existing errors on the official graph and zero on the manual graph; both have zero invalid connections. A later validation must be compared with that baseline rather than described as a new clean pass.

## Results

Release and post-release receipts will be added here after verification.
