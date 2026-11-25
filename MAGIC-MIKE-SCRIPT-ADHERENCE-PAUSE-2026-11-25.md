# Script Adherence pause

Script Adherence is paused at Moonis’s request on November 25, 2026. The shared dashboard navigation omits the feature. Both the summary and rep detail return Not Found before reading adherence data, including for signed-in managers and owners. The dashboard visibility switch is `scriptAdherenceVisible` in `src/lib/script-adherence/visibility.ts`.

Production processing uses `script_adherence_control.enabled=false`, an empty canary list and the existing Batch transport. The dedicated daily coverage workflow `hb3M0O7fYx04oVEs` and bounded worker `WqvZP7IX0YwlxfTZ` are inactive. The dedicated provider checker `8OFKaWAX89AsgpoG` can collect receipts for work accepted before the pause. Two provider batches were active when the pause began. New scoring requests are gated by the processing control. Retain any unresolved receipts for reconciliation.

Keep saved results, metrics, source transcripts, jobs, workflow definitions, provider receipts and coverage cursors. The manual coaching transcript fallback continues to read its existing transcript archive under its own authorization.

To restore, verify provider and queue state first. Review the saved coverage cursor and agree on how to handle the paused period before restarting the daily scan because it can catch up from that cursor. Re-enable only the dedicated workflows and processing control, and restore dashboard visibility through the normal GitHub release. Verify coverage, new submissions and access independently.
