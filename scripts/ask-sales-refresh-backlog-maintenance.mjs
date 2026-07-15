import { neon } from "@neondatabase/serverless";

const APPLY = process.argv.includes("--apply-reviewed-cleanup");
const BASELINE_CUTOFF = "2026-07-15T00:00:00.000Z";
const EXPECTED_BASELINE = 249;
const EXPECTED_NO_CHANGE = 4;
const ACTOR = "codex:user-approved-backlog-cleanup-2026-07-15";

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
const sql = neon(process.env.DATABASE_URL);

const preview = await sql.query(
  `select
     count(*) filter (
       where s.kind = 'google_doc' and c.status = 'needs_review' and c.created_at < $1
     )::int as baseline_candidates,
     count(*) filter (
       where s.kind = 'google_sheet' and c.status = 'needs_review'
         and (c.title || ' ' || c.proposed_policy) ~* '(no change (is )?needed|remains? (active|inactive|unchanged|the same))'
     )::int as no_change_candidates
   from ask_sales_faq_refresh_candidates c
   join ask_sales_faq_refresh_sources s on s.id = c.source_id`,
  [BASELINE_CUTOFF],
);

const counts = preview[0] || { baseline_candidates: 0, no_change_candidates: 0 };
console.log(JSON.stringify({ mode: APPLY ? "apply" : "dry-run", ...counts }));

if (!APPLY) process.exit(0);
if (counts.baseline_candidates !== EXPECTED_BASELINE || counts.no_change_candidates !== EXPECTED_NO_CHANGE) {
  throw new Error(`Safety count mismatch; expected ${EXPECTED_BASELINE} baseline and ${EXPECTED_NO_CHANGE} no-change candidates`);
}

const note = "Initial Google Doc baseline was reviewed against the pre-existing V3 source-coverage ledger. The record is preserved for audit, was not approved or published, and a later source change will return new material to review.";
const noChangeNote = "Screened as a no-change confirmation. The current governed value remains in place; this record was not approved or published.";

const results = await sql.transaction((tx) => [
  tx.query(
    `with eligible as (
       select c.id, c.status as from_status
       from ask_sales_faq_refresh_candidates c
       join ask_sales_faq_refresh_sources s on s.id = c.source_id
       where s.kind = 'google_doc' and c.status = 'needs_review' and c.created_at < $1
     ), updated as (
       update ask_sales_faq_refresh_candidates c
       set status = 'deferred', version = version + 1, review_note = $2,
           reviewed_by = $3, reviewed_at = now(), updated_at = now()
       from eligible e where c.id = e.id
       returning c.id, e.from_status
     ), audited as (
       insert into ask_sales_faq_refresh_audit (entity_type, entity_id, event_type, actor, from_status, to_status, details)
       select 'candidate', id, 'baseline_screened', $3, from_status, 'deferred',
              jsonb_build_object('reason', $2, 'reviewedCandidateSet', true, 'published', false)
       from updated
     ) select count(*)::int as updated_count from updated`,
    [BASELINE_CUTOFF, note, ACTOR],
  ),
  tx.query(
    `with eligible as (
       select c.id, c.status as from_status
       from ask_sales_faq_refresh_candidates c
       join ask_sales_faq_refresh_sources s on s.id = c.source_id
       where s.kind = 'google_sheet' and c.status = 'needs_review'
         and (c.title || ' ' || c.proposed_policy) ~* '(no change (is )?needed|remains? (active|inactive|unchanged|the same))'
     ), updated as (
       update ask_sales_faq_refresh_candidates c
       set status = 'duplicate', version = version + 1, review_note = $1,
           reviewed_by = $2, reviewed_at = now(), updated_at = now()
       from eligible e where c.id = e.id
       returning c.id, e.from_status
     ), audited as (
       insert into ask_sales_faq_refresh_audit (entity_type, entity_id, event_type, actor, from_status, to_status, details)
       select 'candidate', id, 'no_change_screened', $2, from_status, 'duplicate',
              jsonb_build_object('reason', $1, 'published', false)
       from updated
     ) select count(*)::int as updated_count from updated`,
    [noChangeNote, ACTOR],
  ),
]);

console.log(JSON.stringify({
  applied: true,
  baselineUpdated: results[0][0]?.updated_count || 0,
  noChangeUpdated: results[1][0]?.updated_count || 0,
}));
