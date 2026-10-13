import "server-only";
import { neon } from "@neondatabase/serverless";
import { getSalesRows } from "./sales-correlation";
import {
  analyzeSalesImpact,
  type ImpactReport,
  type ImpactOpen,
} from "./sales-impact-analysis";

export async function getSalesImpactAnalytics(days = 30, now = new Date()) {
  if (!process.env.DATABASE_URL)
    throw Error("Sales Impact data is unavailable.");
  const sql = neon(process.env.DATABASE_URL);
  const [reports, opens, sales] = await Promise.all([
    sql.query(
      "select id,rep_slug,rep_name,created_at::text,call_date::text from performance_calls where created_at <= $1::timestamptz",
      [now.toISOString()],
    ),
    sql.query(
      `select e.report_id,e.viewer_rep_slug as rep_slug,e.created_at::text from dashboard_usage_events e
      join performance_calls c on c.id=e.report_id
      where e.event_name='report_detail_viewed' and e.source='official_report' and e.viewer_is_mapped
      and e.viewer_rep_slug=c.rep_slug and e.created_at>=c.created_at and e.created_at<=$1::timestamptz`,
      [now.toISOString()],
    ),
    getSalesRows(),
  ]);
  if (!sales.configured || sales.error)
    throw Error(
      "Sales data could not be loaded; missing sales are not shown as zero.",
    );
  return {
    analysis: analyzeSalesImpact(
      reports as ImpactReport[],
      opens as ImpactOpen[],
      sales.rows,
      days,
      now,
    ),
    source: sales.dataSource,
    syncedAt: sales.snapshotCreatedAt,
    warning: sales.snapshotWarning || null,
  };
}
