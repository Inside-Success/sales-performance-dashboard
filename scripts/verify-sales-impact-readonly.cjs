/** Read-only production reconciliation. Run through vercel env run; never prints credentials or rep names. */
const fs = require("node:fs");
const assert = require("node:assert/strict");
const ts = require("typescript");
require.extensions[".ts"] = (module, filename) =>
  module._compile(
    ts.transpileModule(fs.readFileSync(filename, "utf8"), {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
    }).outputText,
    filename,
  );
const { neon } = require("@neondatabase/serverless");
const {
  analyzeSalesImpact,
  miamiDay,
  impactRepKey,
} = require("../src/lib/sales-impact-analysis.ts");
async function main() {
  if (!process.env.DATABASE_URL)
    throw Error(
      "DATABASE_URL is required; use the linked production environment.",
    );
  const sql = neon(process.env.DATABASE_URL);
  const now = new Date();
  const [reports, events, snapshots] = await Promise.all([
    sql.query(
      "select id,rep_slug,rep_name,created_at::text,call_date::text from performance_calls where created_at <= $1::timestamptz",
      [now.toISOString()],
    ),
    sql.query(
      `select e.report_id,e.viewer_rep_slug as rep_slug,e.created_at::text from dashboard_usage_events e join performance_calls c on c.id=e.report_id where e.event_name='report_detail_viewed' and e.source='official_report' and e.viewer_is_mapped and e.viewer_rep_slug=c.rep_slug and e.created_at>=c.created_at and e.created_at<=$1::timestamptz`,
      [now.toISOString()],
    ),
    sql.query(
      "select created_at,rows from sales_performance_snapshots order by id desc limit 1",
    ),
  ]);
  assert(snapshots.length, "A validated sales snapshot must exist");
  const sales = snapshots[0].rows;
  const results = [];
  for (const days of [7, 14, 30, 90]) {
    const a = analyzeSalesImpact(reports, events, sales, days, now);
    const expected = new Map(
      ["none", "low", "medium", "high"].map((key) => [key, []]),
    );
    for (const rep of a.reps) {
      const owned = reports.filter(
        (r) => impactRepKey(r.rep_name || r.rep_slug) === rep.slug,
      );
      const available = new Set(
        owned
          .filter(
            (r) =>
              miamiDay(r.created_at) >= a.start &&
              miamiDay(r.created_at) <= a.end,
          )
          .map((r) => Number(r.id)),
      );
      const ownIds = new Set(owned.map((r) => Number(r.id)));
      const opened = new Set(
        events
          .filter(
            (e) =>
              ownIds.has(Number(e.report_id)) &&
              miamiDay(e.created_at) >= a.start &&
              miamiDay(e.created_at) <= a.end,
          )
          .map((e) => Number(e.report_id)),
      );
      const covered = [...available].filter((id) => opened.has(id)).length;
      assert.equal(
        rep.opened,
        opened.size,
        `opens: window ${days}, rep index ${a.reps.indexOf(rep)}`,
      );
      assert.equal(
        rep.received,
        available.size,
        `received: window ${days}, rep index ${a.reps.indexOf(rep)}`,
      );
      assert.equal(
        rep.receivedOpened,
        covered,
        `covered: window ${days}, rep index ${a.reps.indexOf(rep)}`,
      );
      assert.equal(
        rep.receivedOpenRate,
        available.size ? covered / available.size : null,
      );
      assert(covered <= available.size);
      const bucket =
        opened.size >= 21
          ? "high"
          : opened.size >= 6
            ? "medium"
            : opened.size >= 1
              ? "low"
              : "none";
      assert.equal(rep.group, bucket);
      const matching = sales.filter(
        (s) => impactRepKey(s.repName || s.repSlug) === rep.slug,
      );
      const cash = matching
        .filter(
          (s) =>
            s.dateKey >= a.start &&
            s.dateKey <= a.end &&
            s.paymentStatus.trim().toLowerCase() === "paid" &&
            s.paymentType.trim().toLowerCase() === "new" &&
            Number.isFinite(s.amount) &&
            s.amount > 0,
        )
        .reduce((sum, s) => sum + s.amount, 0);
      assert.equal(
        rep.revenue,
        matching.length ? cash : null,
        `revenue: window ${days}, rep index ${a.reps.indexOf(rep)}`,
      );
      if (rep.revenue !== null) expected.get(bucket).push(cash);
    }
    for (const group of a.groups) {
      const values = expected.get(group.key);
      assert.equal(group.count, values.length);
      assert.equal(
        group.average,
        values.length
          ? values.reduce((sum, v) => sum + v, 0) / values.length
          : null,
      );
    }
    results.push({
      days,
      start: a.start,
      end: a.end,
      matched: a.matched,
      unmatched: a.excludedUnmatched,
      groups: a.groups,
      beforeAfter: a.beforeAfter,
      subsequent: a.subsequent,
      coverageChecks: a.reps.length,
    });
  }
  console.log(
    JSON.stringify(
      {
        verifiedAt: now.toISOString(),
        snapshotAt: snapshots[0].created_at,
        reportRows: reports.length,
        ownOpenEvents: events.length,
        salesRows: sales.length,
        results,
      },
      null,
      2,
    ),
  );
}
main().catch((e) => {
  console.error(e.message);
  process.exitCode = 1;
});
