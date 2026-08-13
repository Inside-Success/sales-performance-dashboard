# Magic Mike New Session Start Prompt

Copy and paste this into a fresh Codex chat:

```text
We are continuing the complete Magic Mike project inside:

/Users/moonishaider/Desktop/upwork/Inside success tv/lil rudy

Use the relevant skills and MCP tools, and treat this as a continuation rather than a cold start. Your first turn is read-only orientation only. Do not implement, deploy, edit files, trigger workflows, or write to any connected service.

Read these files completely, in order. Prefer the canonical dashboard checkout after PR #167 is merged; until then, the same new files are available in the clean worktree `sales-performance-dashboard-rep-scoring-v7-2026-08-13`:
1. `SESSION-HANDOFF-2026-08-13.md`
2. `AI-CLOSER-SCORECARD-HANDOFF-2026-08-13.md`
3. `MAGIC-MIKE-PROJECT-HANDOFF-2026-07-30.md`
4. `REP-SCORING-V7-1-PRODUCTION-LAUNCH-2026-08-13.md`
5. `docs-hidden-pages-access.md`

Do not overwrite unrelated work while locating or updating the checkout. Inspect `AGENTS.md`, both relevant Git repositories, their current status, and the latest production state before relying on snapshots.

Non-negotiable rules:
- Treat Coaching, AI Closer Scorecard, Ask Sales, hidden pages, n8n, Airtable, Vercel, and connected systems as live production.
- Never run a local development server anywhere in this workspace because it can crash my laptop.
- Preserve dirty/untracked work and rollback paths.
- Do not expose credentials or environment values.
- Slack and Google sources remain read-only unless I explicitly authorize an exact write.
- Use the n8n skills and n8n/global MCP path before touching workflows.
- Do not make any change on your first turn.

In your first response, briefly summarize the complete current state of Magic Mike, including Coaching, Ask Sales, AI Closer Scorecard V7.1, what is live, what is intentionally disabled, manager access, current safety constraints, and genuinely pending decisions. Verify drift-prone production facts read-only, state any discrepancy honestly, and then wait for my next task.
```
