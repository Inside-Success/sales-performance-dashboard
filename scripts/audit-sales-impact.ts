/** Read-only production reconciliation. Run with Vercel production env injection. No source writes. */
import { neon } from "@neondatabase/serverless";
import {
  analyzeSalesImpact,
  type ImpactReport,
  type ImpactOpen,
  type ImpactSale,
} from "../src/lib/sales-impact-analysis";
const sql = neon(process.env.DATABASE_URL!);
const now = new Date();
const [reports, opens, snapshots] = await Promise.all([
  sql.query(
    "select id,rep_slug,rep_name,created_at::text,call_date::text from performance_calls where created_at<=$1::timestamptz",
    [now.toISOString()],
  ),
  sql.query(
    `select e.report_id,e.viewer_rep_slug as rep_slug,e.created_at::text from dashboard_usage_events e join performance_calls c on c.id=e.report_id where e.event_name='report_detail_viewed' and e.source='official_report' and e.viewer_is_mapped and e.viewer_rep_slug=c.rep_slug and e.created_at>=c.created_at and e.created_at<=$1::timestamptz`,
    [now.toISOString()],
  ),
  sql.query(
    "select created_at::text,rows,row_count from sales_performance_snapshots order by created_at desc limit 1",
    [],
  ),
]);
const snapshot = snapshots[0];
const sales = snapshot.rows as ImpactSale[];
console.log(
  JSON.stringify({
    auditAt: now.toISOString(),
    snapshotAt: snapshot.created_at,
    sourceRows: snapshot.row_count,
    reports: reports.length,
    eligibleOpenEvents: opens.length,
    snapshotFields: Object.keys(sales[0] || {}),
  }),
);
for (const days of [7, 14, 30, 90]) {
  const begin = performance.now();
  const a = analyzeSalesImpact(
    reports as ImpactReport[],
    opens as ImpactOpen[],
    sales,
    days,
    now,
  );
  const result = await sql.query(
    `select count(*)::int as opened from (select distinct e.viewer_rep_slug,e.report_id from dashboard_usage_events e join performance_calls c on c.id=e.report_id where e.event_name='report_detail_viewed' and e.source='official_report' and e.viewer_is_mapped and e.viewer_rep_slug=c.rep_slug and e.created_at>=c.created_at and (e.created_at at time zone 'America/New_York')::date between $1::date and $2::date and e.viewer_rep_slug=any($3::text[])) q`,
    [a.start, a.end, a.reps.map((r) => r.reportSlug)],
  );
  if (Number(result[0].opened) !== a.opened)
    throw Error("Distinct own-open reconciliation failed");
  const cash = await sql.query(
    `select coalesce(sum((r->>'amount')::numeric),0)::float8 as revenue from sales_performance_snapshots s cross join lateral jsonb_array_elements(s.rows) r where s.id=(select max(id) from sales_performance_snapshots) and lower(trim(r->>'paymentStatus'))='paid' and lower(trim(r->>'paymentType'))='new' and (r->>'amount')::numeric>0 and r->>'dateKey' between $1 and $2`,
    [a.start, a.end],
  );
  const perRepCash = await sql.query(
    `select r->>'repSlug' as slug,sum((r->>'amount')::numeric)::float8 as revenue from sales_performance_snapshots s cross join lateral jsonb_array_elements(s.rows) r where s.id=(select max(id) from sales_performance_snapshots) and lower(trim(r->>'paymentStatus'))='paid' and lower(trim(r->>'paymentType'))='new' and (r->>'amount')::numeric>0 and r->>'dateKey' between $1 and $2 group by r->>'repSlug'`,
    [a.start, a.end],
  );
  const byRep = new Map(perRepCash.map((r) => [r.slug, Number(r.revenue)]));
  for (const rep of a.reps.filter((r) => r.revenue !== null)) {
    if (Math.abs((byRep.get(rep.slug) || 0) - rep.revenue!) > 0.001)
      throw Error("Rep cash reconciliation failed: " + rep.slug);
  }
  console.log(
    JSON.stringify({
      days,
      start: a.start,
      end: a.end,
      computeMs: Math.round(performance.now() - begin),
      matched: a.matched,
      unmatched: a.excludedUnmatched,
      distinctOwnOpens: a.opened,
      allSheetPeriodCash: cash[0].revenue,
      rosterPeriodCash: a.reps.reduce((s, r) => s + (r.revenue || 0), 0),
      groups: a.groups,
      beforeAfter: a.beforeAfter,
      subsequent: a.subsequent,
      sensitivity: a.sensitivity,
      headline: a.headline,
    }),
  );
}
