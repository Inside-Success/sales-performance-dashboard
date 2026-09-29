import "server-only";
import { neon } from "@neondatabase/serverless";
import type { InsightCall } from "@/lib/coaching-insights";

export async function getCoachingInsightCalls(days: number, type: "official" | "manual") {
  if (!process.env.DATABASE_URL) throw new Error("Coaching data is unavailable.");
  const sql = neon(process.env.DATABASE_URL);
  // Read existing storage only: no schema changes, source writes or model calls.
  const since = new Date(Date.now() - days * 86400000).toISOString();
  const rows = type === "official" ? await sql`
    select id::text, rep_name, rep_slug, client_name, call_date::text, one_line_verdict,
      what_to_improve, objections_surfaced,
      jsonb_build_object('reviewed_coaching_v1', source_payload->'reviewed_coaching_v1') as source_payload,
      source_payload->>'source_airtable_record_id' as source_id, 'official' as report_type
    from performance_calls where coalesce(call_date, created_at) >= ${since}::timestamptz
    and call_status = 'scored' order by coalesce(call_date,created_at) desc
  ` : await sql`
    select public_id as id, rep_name, rep_slug, client_name, created_at::text as call_date,
      one_line_verdict, what_to_improve, objections_surfaced,
      jsonb_build_object('reviewed_coaching_v1', source_payload->'reviewed_coaching_v1') as source_payload,
      public_id as source_id, 'manual' as report_type
    from manual_feedback_reports where created_at >= ${since}::timestamptz and status = 'completed'
    order by created_at desc
  `;
  return rows as InsightCall[];
}
