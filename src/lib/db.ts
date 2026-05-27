import { neon } from "@neondatabase/serverless";
import type { NormalizedIngestPayload } from "@/lib/ingest";
import { normalizeStringList } from "@/lib/list-format";
import type {
  DashboardFilters,
  ManualFeedbackReport,
  PerformanceCall,
  RepSummary,
  UsageAnalytics,
  UsageDailyPoint,
  UsageEventBreakdown,
  UsageManualSummary,
  UsageOfficialSummary,
  UsageRecentEvent,
  UsageRepEngagement,
  UsageTotals,
  UsageUnviewedReport,
} from "@/lib/types";
import type { NormalizedManualCallback, ManualSubmitPayload } from "@/lib/manual-reports";
import type { UsageEventPayload } from "@/lib/usage-events";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;
let schemaReady = false;

export function hasDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

function getSql() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not configured");
  }

  if (!sqlClient) {
    sqlClient = neon(process.env.DATABASE_URL);
  }

  return sqlClient;
}

export async function ensureSchema() {
  if (schemaReady) return;

  const sql = getSql();
  await sql`
    create table if not exists performance_calls (
      id bigserial primary key,
      airtable_record_id text not null unique,
      scorecard_key text,
      rep_name text not null,
      rep_slug text not null,
      rep_email text,
      client_name text,
      call_date timestamptz,
      meeting_id text,
      meeting_title text,
      meeting_link text,
      transcript_link text,
      google_doc_id text,
      google_doc_link text,
      call_status text,
      one_line_verdict text,
      biggest_strength text,
      biggest_fix text,
      coaching_tip text,
      rudys_note text,
      what_went_well jsonb not null default '[]'::jsonb,
      what_to_improve jsonb not null default '[]'::jsonb,
      why_no_close jsonb,
      what_made_this_close_work jsonb,
      objections_surfaced jsonb not null default '[]'::jsonb,
      close_section_type text,
      close_section jsonb,
      source_payload jsonb not null default '{}'::jsonb,
      search_document text not null default '',
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists performance_calls_rep_slug_idx on performance_calls (rep_slug)`;
  await sql`create index if not exists performance_calls_call_date_idx on performance_calls (call_date desc nulls last)`;
  await sql`create index if not exists performance_calls_updated_at_idx on performance_calls (updated_at desc)`;

  await sql`
    create table if not exists manual_feedback_reports (
      id bigserial primary key,
      public_id text not null unique,
      status text not null default 'pending',
      input_type text not null,
      source_type text,
      rep_name text not null,
      rep_email text,
      client_name text,
      zoom_link text,
      original_zoom_link text,
      transcript_link text,
      transcript_drive_link text,
      google_doc_id text,
      google_doc_link text,
      report_doc_link text,
      call_status text,
      refusal_reason text,
      one_line_verdict text,
      biggest_strength text,
      biggest_fix text,
      coaching_tip text,
      rudys_note text,
      what_went_well jsonb not null default '[]'::jsonb,
      what_to_improve jsonb not null default '[]'::jsonb,
      why_no_close jsonb,
      what_made_this_close_work jsonb,
      objections_surfaced jsonb not null default '[]'::jsonb,
      close_section_type text,
      close_section jsonb,
      source_payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table manual_feedback_reports add column if not exists source_type text`;
  await sql`alter table manual_feedback_reports add column if not exists original_zoom_link text`;
  await sql`alter table manual_feedback_reports add column if not exists transcript_drive_link text`;
  await sql`alter table manual_feedback_reports add column if not exists report_doc_link text`;
  await sql`create index if not exists manual_feedback_reports_public_id_idx on manual_feedback_reports (public_id)`;
  await sql`create index if not exists manual_feedback_reports_status_idx on manual_feedback_reports (status)`;
  await sql`create index if not exists manual_feedback_reports_updated_at_idx on manual_feedback_reports (updated_at desc)`;

  await sql`
    create table if not exists dashboard_usage_events (
      id bigserial primary key,
      event_name text not null,
      source text,
      target_rep_slug text,
      target_rep_name text,
      report_id bigint,
      manual_public_id text,
      anonymous_session_id text,
      path text,
      referrer text,
      user_agent text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists dashboard_usage_events_created_at_idx on dashboard_usage_events (created_at desc)`;
  await sql`create index if not exists dashboard_usage_events_event_created_idx on dashboard_usage_events (event_name, created_at desc)`;
  await sql`create index if not exists dashboard_usage_events_rep_created_idx on dashboard_usage_events (target_rep_slug, created_at desc)`;
  await sql`create index if not exists dashboard_usage_events_report_idx on dashboard_usage_events (report_id)`;
  await sql`create index if not exists dashboard_usage_events_manual_public_id_idx on dashboard_usage_events (manual_public_id)`;

  schemaReady = true;
}

export async function upsertPerformanceCall(payload: NormalizedIngestPayload) {
  await ensureSchema();
  const sql = getSql();

  const rows = await sql.query(
    `
      insert into performance_calls (
        airtable_record_id,
        scorecard_key,
        rep_name,
        rep_slug,
        rep_email,
        client_name,
        call_date,
        meeting_id,
        meeting_title,
        meeting_link,
        transcript_link,
        google_doc_id,
        google_doc_link,
        call_status,
        one_line_verdict,
        biggest_strength,
        biggest_fix,
        coaching_tip,
        rudys_note,
        what_went_well,
        what_to_improve,
        why_no_close,
        what_made_this_close_work,
        objections_surfaced,
        close_section_type,
        close_section,
        source_payload,
        search_document
      )
      values (
        $1, $2, $3, $4, $5, $6, nullif($7, '')::timestamptz, $8, $9, $10,
        $11, $12, $13, $14, $15, $16, $17, $18, $19, $20::jsonb, $21::jsonb,
        $22::jsonb, $23::jsonb, $24::jsonb, $25, $26::jsonb, $27::jsonb, $28
      )
      on conflict (airtable_record_id) do update set
        scorecard_key = excluded.scorecard_key,
        rep_name = excluded.rep_name,
        rep_slug = excluded.rep_slug,
        rep_email = excluded.rep_email,
        client_name = excluded.client_name,
        call_date = excluded.call_date,
        meeting_id = excluded.meeting_id,
        meeting_title = excluded.meeting_title,
        meeting_link = excluded.meeting_link,
        transcript_link = excluded.transcript_link,
        google_doc_id = excluded.google_doc_id,
        google_doc_link = excluded.google_doc_link,
        call_status = excluded.call_status,
        one_line_verdict = excluded.one_line_verdict,
        biggest_strength = excluded.biggest_strength,
        biggest_fix = excluded.biggest_fix,
        coaching_tip = excluded.coaching_tip,
        rudys_note = excluded.rudys_note,
        what_went_well = excluded.what_went_well,
        what_to_improve = excluded.what_to_improve,
        why_no_close = excluded.why_no_close,
        what_made_this_close_work = excluded.what_made_this_close_work,
        objections_surfaced = excluded.objections_surfaced,
        close_section_type = excluded.close_section_type,
        close_section = excluded.close_section,
        source_payload = excluded.source_payload,
        search_document = excluded.search_document,
        updated_at = now()
      returning *
    `,
    [
      payload.airtable_record_id,
      payload.scorecard_key,
      payload.rep_name,
      payload.rep_slug,
      payload.rep_email,
      payload.client_name,
      payload.call_date,
      payload.meeting_id,
      payload.meeting_title,
      payload.meeting_link,
      payload.transcript_link,
      payload.google_doc_id,
      payload.google_doc_link,
      payload.call_status,
      payload.one_line_verdict,
      payload.biggest_strength,
      payload.biggest_fix,
      payload.coaching_tip,
      payload.rudys_note,
      JSON.stringify(payload.what_went_well),
      JSON.stringify(payload.what_to_improve),
      JSON.stringify(payload.why_no_close),
      JSON.stringify(payload.what_made_this_close_work),
      JSON.stringify(payload.objections_surfaced),
      payload.close_section_type,
      JSON.stringify(payload.close_section),
      JSON.stringify(payload.source_payload),
      payload.search_document,
    ],
  );

  return normalizeCall((rows as PerformanceCall[])[0]);
}

export async function recordUsageEvent(payload: UsageEventPayload) {
  await ensureSchema();
  const sql = getSql();

  await sql.query(
    `
      insert into dashboard_usage_events (
        event_name,
        source,
        target_rep_slug,
        target_rep_name,
        report_id,
        manual_public_id,
        anonymous_session_id,
        path,
        referrer,
        user_agent,
        metadata
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
    `,
    [
      payload.event_name,
      payload.source || null,
      payload.target_rep_slug || null,
      payload.target_rep_name || null,
      payload.report_id || null,
      payload.manual_public_id || null,
      payload.anonymous_session_id || null,
      payload.path || null,
      payload.referrer || null,
      payload.user_agent || null,
      JSON.stringify(payload.metadata || {}),
    ],
  );
}

export async function getUsageAnalytics(): Promise<UsageAnalytics> {
  const fallback = getFallbackUsageAnalytics();

  if (!hasDatabase()) {
    return fallback;
  }

  try {
    await ensureSchema();
    const sql = getSql();

    const [
      totalsRows,
      officialSummaryRows,
      manualSummaryRows,
      dailyRows,
      eventBreakdownRows,
      repEngagementRows,
      unviewedReportRows,
      recentEventRows,
    ] = await Promise.all([
      sql.query(
        `
          select
            count(*) filter (where created_at >= now() - interval '1 day')::int as events_today,
            count(*) filter (where created_at >= now() - interval '7 days')::int as events_7d,
            count(*) filter (where created_at >= now() - interval '30 days')::int as events_30d,
            count(distinct anonymous_session_id) filter (
              where created_at >= now() - interval '7 days'
                and anonymous_session_id is not null
            )::int as sessions_7d,
            count(*) filter (
              where event_name in ('report_detail_viewed', 'manual_report_viewed')
                and created_at >= now() - interval '7 days'
            )::int as report_views_7d,
            count(*) filter (
              where event_name = 'rep_selected'
                and created_at >= now() - interval '7 days'
            )::int as rep_selections_7d,
            count(*) filter (
              where event_name = 'manual_report_submitted'
                and created_at >= now() - interval '7 days'
            )::int as manual_submissions_7d,
            count(*) filter (
              where event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                and created_at >= now() - interval '7 days'
            )::int as link_clicks_7d
          from dashboard_usage_events
        `,
        [],
      ),
      sql.query(
        `
          with official_events as (
            select *
            from dashboard_usage_events
            where event_name in ('dashboard_home_viewed', 'rep_selected', 'report_detail_viewed')
               or (event_name = 'report_card_clicked' and report_id is not null)
               or (
                 event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                 and report_id is not null
               )
          )
          select
            count(*) filter (
              where event_name = 'report_detail_viewed'
                and created_at >= now() - interval '1 day'
            )::int as report_views_today,
            count(*) filter (
              where event_name = 'report_detail_viewed'
                and created_at >= now() - interval '7 days'
            )::int as report_views_7d,
            count(*) filter (
              where event_name = 'report_detail_viewed'
                and created_at >= now() - interval '30 days'
            )::int as report_views_30d,
            count(distinct anonymous_session_id) filter (
              where created_at >= now() - interval '7 days'
                and anonymous_session_id is not null
            )::int as active_sessions_7d,
            count(distinct target_rep_slug) filter (
              where created_at >= now() - interval '7 days'
                and target_rep_slug is not null
            )::int as reps_with_activity_7d,
            count(*) filter (
              where event_name = 'rep_selected'
                and created_at >= now() - interval '7 days'
            )::int as rep_selections_7d,
            count(*) filter (
              where event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                and report_id is not null
                and created_at >= now() - interval '7 days'
            )::int as link_clicks_7d,
            max(created_at)::text as last_activity_at
          from official_events
        `,
        [],
      ),
      sql.query(
        `
          with manual_usage as (
            select *
            from dashboard_usage_events
            where event_name in (
                'manual_reports_page_viewed',
                'manual_submit_opened',
                'manual_report_submitted',
                'manual_report_viewed'
              )
               or (event_name = 'report_card_clicked' and manual_public_id is not null)
               or (
                 event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                 and manual_public_id is not null
               )
          )
          select
            (select count(*)::int from manual_feedback_reports) as total_reports,
            (select count(*)::int from manual_feedback_reports where status = 'completed') as completed_reports,
            (select count(*)::int from manual_feedback_reports where status in ('pending', 'processing')) as pending_reports,
            count(*) filter (
              where event_name in ('manual_reports_page_viewed', 'manual_submit_opened')
                and created_at >= now() - interval '7 days'
            )::int as page_opens_7d,
            count(*) filter (
              where event_name = 'manual_report_submitted'
                and created_at >= now() - interval '7 days'
            )::int as submissions_7d,
            count(*) filter (
              where event_name = 'manual_report_viewed'
                and created_at >= now() - interval '7 days'
            )::int as report_views_7d,
            count(*) filter (
              where event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                and manual_public_id is not null
                and created_at >= now() - interval '7 days'
            )::int as link_clicks_7d,
            count(distinct anonymous_session_id) filter (
              where created_at >= now() - interval '7 days'
                and anonymous_session_id is not null
            )::int as active_sessions_7d,
            max(created_at)::text as last_activity_at
          from manual_usage
        `,
        [],
      ),
      sql.query(
        `
          with days as (
            select generate_series(
              (current_date - interval '13 days')::date,
              current_date::date,
              interval '1 day'
            )::date as day
          )
          select
            days.day::text as day,
            count(events.id)::int as total_events,
            count(events.id) filter (
              where events.event_name in ('report_detail_viewed', 'manual_report_viewed')
            )::int as report_views,
            count(events.id) filter (where events.event_name = 'report_detail_viewed')::int as official_report_views,
            count(events.id) filter (where events.event_name = 'manual_report_viewed')::int as manual_report_views,
            count(events.id) filter (where events.event_name = 'rep_selected')::int as rep_selections,
            count(events.id) filter (where events.event_name = 'manual_report_submitted')::int as manual_submissions
          from days
          left join dashboard_usage_events events
            on events.created_at >= days.day
           and events.created_at < days.day + interval '1 day'
          group by days.day
          order by days.day asc
        `,
        [],
      ),
      sql.query(
        `
          select event_name, count(*)::int as count
          from dashboard_usage_events
          where created_at >= now() - interval '7 days'
          group by event_name
          order by count desc, event_name asc
        `,
        [],
      ),
      sql.query(
        `
          with report_views as (
            select
              report_id,
              count(*)::int as view_count,
              max(created_at) as last_viewed_at
            from dashboard_usage_events
            where event_name = 'report_detail_viewed'
              and report_id is not null
            group by report_id
          ),
          report_link_clicks as (
            select
              report_id,
              count(*) filter (where event_name = 'google_doc_clicked')::int as doc_clicks,
              count(*) filter (where event_name = 'zoom_clicked')::int as zoom_clicks,
              count(*) filter (where event_name = 'transcript_clicked')::int as transcript_clicks,
              max(created_at) as last_link_at
            from dashboard_usage_events
            where report_id is not null
              and event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
            group by report_id
          ),
          rep_selections as (
            select
              target_rep_slug as rep_slug,
              count(*)::int as rep_selections,
              max(created_at) as last_selected_at
            from dashboard_usage_events
            where event_name = 'rep_selected'
              and target_rep_slug is not null
            group by target_rep_slug
          )
          select
            calls.rep_name,
            calls.rep_slug,
            count(calls.id)::int as generated_reports,
            count(distinct calls.id) filter (where coalesce(report_views.view_count, 0) > 0)::int as viewed_reports,
            coalesce(sum(report_views.view_count), 0)::int as report_views,
            coalesce(max(rep_selections.rep_selections), 0)::int as rep_selections,
            coalesce(sum(report_link_clicks.doc_clicks), 0)::int as doc_clicks,
            coalesce(sum(report_link_clicks.zoom_clicks), 0)::int as zoom_clicks,
            coalesce(sum(report_link_clicks.transcript_clicks), 0)::int as transcript_clicks,
            nullif(
              greatest(
                coalesce(max(report_views.last_viewed_at), 'epoch'::timestamptz),
                coalesce(max(report_link_clicks.last_link_at), 'epoch'::timestamptz),
                coalesce(max(rep_selections.last_selected_at), 'epoch'::timestamptz)
              ),
              'epoch'::timestamptz
            )::text as last_activity_at
          from performance_calls calls
          left join report_views on report_views.report_id = calls.id
          left join report_link_clicks on report_link_clicks.report_id = calls.id
          left join rep_selections on rep_selections.rep_slug = calls.rep_slug
          group by calls.rep_name, calls.rep_slug
          order by report_views desc, viewed_reports desc, rep_selections desc, generated_reports desc, calls.rep_name asc
          limit 50
        `,
        [],
      ),
      sql.query(
        `
          select
            calls.id,
            calls.rep_name,
            calls.rep_slug,
            calls.client_name,
            calls.call_date::text,
            calls.created_at::text
          from performance_calls calls
          left join dashboard_usage_events events
            on events.report_id = calls.id
           and events.event_name = 'report_detail_viewed'
          where calls.created_at < now() - interval '48 hours'
          group by calls.id
          having count(events.id) = 0
          order by calls.created_at desc
          limit 25
        `,
        [],
      ),
      sql.query(
        `
          select
            id,
            event_name,
            source,
            target_rep_slug,
            target_rep_name,
            report_id,
            manual_public_id,
            path,
            created_at::text
          from dashboard_usage_events
          order by created_at desc
          limit 25
        `,
        [],
      ),
    ]);

    return {
      configured: true,
      generatedAt: new Date().toISOString(),
      totals: normalizeUsageTotals((totalsRows as UsageTotals[])[0]),
      official: normalizeUsageOfficialSummary((officialSummaryRows as UsageOfficialSummary[])[0]),
      manual: normalizeUsageManualSummary((manualSummaryRows as UsageManualSummary[])[0]),
      daily: (dailyRows as UsageDailyPoint[]).map(normalizeUsageDailyPoint),
      eventBreakdown: (eventBreakdownRows as UsageEventBreakdown[]).map(normalizeUsageEventBreakdown),
      repEngagement: (repEngagementRows as UsageRepEngagement[]).map(normalizeUsageRepEngagement),
      unviewedReports: (unviewedReportRows as UsageUnviewedReport[]).map(normalizeUsageUnviewedReport),
      recentEvents: (recentEventRows as UsageRecentEvent[]).map(normalizeUsageRecentEvent),
    };
  } catch (error) {
    console.error(error);
    return {
      ...fallback,
      configured: true,
      error: "Usage analytics query failed. Check DATABASE_URL and the dashboard_usage_events schema.",
    };
  }
}

export async function getDashboardData(filters: DashboardFilters = {}) {
  if (!hasDatabase()) {
    return getFallbackDashboardData();
  }

  try {
    await ensureSchema();
    const where: string[] = [];
    const params: unknown[] = [];

    if (filters.q) {
      params.push(`%${filters.q}%`);
      where.push(
        `(
          search_document ilike $${params.length}
          or rep_name ilike $${params.length}
          or client_name ilike $${params.length}
          or meeting_title ilike $${params.length}
          or to_char(call_date at time zone 'America/New_York', 'Dy Mon DD YYYY HH12:MI AM') ilike $${params.length}
          or to_char(call_date at time zone 'America/New_York', 'FMDay FMMonth FMDD YYYY FMHH12:MI AM') ilike $${params.length}
          or to_char(call_date at time zone 'America/New_York', 'YYYY-MM-DD') ilike $${params.length}
        )`,
      );
    }

    if (filters.rep) {
      params.push(filters.rep);
      where.push(`rep_slug = $${params.length}`);
    }

    if (filters.client) {
      params.push(`%${filters.client}%`);
      where.push(`client_name ilike $${params.length}`);
    }

    if (filters.date) {
      params.push(filters.date);
      where.push(`(call_date at time zone 'America/New_York')::date = $${params.length}::date`);
    }

    if (filters.from) {
      params.push(filters.from);
      where.push(`call_date >= $${params.length}::timestamptz`);
    }

    if (filters.to) {
      params.push(filters.to);
      where.push(`call_date < ($${params.length}::date + interval '1 day')`);
    }

    const whereSql = where.length ? `where ${where.join(" and ")}` : "";
    const sql = getSql();

    const [calls, reps, latestByRep, lastUpdatedRows] = await Promise.all([
      sql.query(
        `
          select *
          from performance_calls
          ${whereSql}
          order by call_date desc nulls last, updated_at desc
          limit 100
        `,
        params,
      ),
      sql.query(
        `
          select rep_name, rep_slug, count(*)::int as call_count, max(call_date)::text as latest_call_date
          from performance_calls
          group by rep_name, rep_slug
          order by rep_name asc
        `,
        [],
      ),
      sql.query(
        `
          select *
          from (
            select distinct on (rep_slug) *
            from performance_calls
            order by rep_slug, call_date desc nulls last, updated_at desc
          ) latest
          order by call_date desc nulls last, updated_at desc
          limit 40
        `,
        [],
      ),
      sql.query("select max(updated_at)::text as last_updated_at from performance_calls", []),
    ]);
    const lastUpdatedAt = (lastUpdatedRows as { last_updated_at: string | null }[])[0]?.last_updated_at ?? null;

    return {
      calls: (calls as PerformanceCall[]).map(normalizeCall),
      reps: reps as RepSummary[],
      latestByRep: (latestByRep as PerformanceCall[]).map(normalizeCall),
      lastUpdatedAt,
      configured: true,
      error: undefined,
    };
  } catch (error) {
    console.error(error);
    return {
      ...getFallbackDashboardData(),
      configured: true,
      error: "Database query failed. Check DATABASE_URL and the schema.",
    };
  }
}

export async function getPerformanceCall(id: string) {
  if (!hasDatabase()) {
    return demoCalls.find((call) => String(call.id) === id) ?? null;
  }

  try {
    await ensureSchema();
    const rows = (await getSql().query("select * from performance_calls where id = $1 limit 1", [id])) as PerformanceCall[];
    return rows[0] ? normalizeCall(rows[0]) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function createManualFeedbackReport(publicId: string, payload: ManualSubmitPayload) {
  await ensureSchema();
  const sourceType = payload.input_type === "zoom_link" ? "zoom_link" : "pasted_transcript";
  const rows = await getSql().query(
    `
      insert into manual_feedback_reports (
        public_id,
        status,
        input_type,
        source_type,
        rep_name,
        rep_email,
        client_name,
        zoom_link,
        original_zoom_link,
        source_payload
      )
      values ($1, 'pending', $2, $3, $4, $5, $6, $7, $7, $8::jsonb)
      returning *
    `,
    [
      publicId,
      payload.input_type,
      sourceType,
      payload.rep_name || "Unknown rep",
      payload.rep_email,
      payload.client_name,
      payload.zoom_link,
      JSON.stringify({
        input_type: payload.input_type,
        source_type: sourceType,
        rep_name: payload.rep_name,
        rep_email: payload.rep_email,
        client_name: payload.client_name,
        zoom_link: payload.zoom_link,
        submitted_at: new Date().toISOString(),
      }),
    ],
  );

  return normalizeManualReport((rows as ManualFeedbackReport[])[0]);
}

export async function updateManualFeedbackStatus(
  publicId: string,
  status: ManualFeedbackReport["status"],
  refusalReason?: string,
) {
  await ensureSchema();
  const rows = await getSql().query(
    `
      update manual_feedback_reports
      set status = $2,
          refusal_reason = coalesce($3, refusal_reason),
          updated_at = now()
      where public_id = $1
      returning *
    `,
    [publicId, status, refusalReason || null],
  );

  return (rows as ManualFeedbackReport[])[0]
    ? normalizeManualReport((rows as ManualFeedbackReport[])[0])
    : null;
}

export async function applyManualFeedbackCallback(payload: NormalizedManualCallback) {
  await ensureSchema();

  const rows = await getSql().query(
    `
      update manual_feedback_reports
      set status = $2,
          rep_name = coalesce($3, rep_name),
          rep_email = coalesce($4, rep_email),
          client_name = coalesce($5, client_name),
          zoom_link = coalesce($6, zoom_link),
          original_zoom_link = coalesce($25, original_zoom_link),
          transcript_link = coalesce($7, transcript_link),
          transcript_drive_link = coalesce($26, transcript_drive_link),
          google_doc_id = coalesce($8, google_doc_id),
          google_doc_link = coalesce($9, google_doc_link),
          report_doc_link = coalesce($27, report_doc_link),
          call_status = coalesce($10, call_status),
          refusal_reason = coalesce($11, refusal_reason),
          one_line_verdict = coalesce($12, one_line_verdict),
          biggest_strength = coalesce($13, biggest_strength),
          biggest_fix = coalesce($14, biggest_fix),
          coaching_tip = coalesce($15, coaching_tip),
          rudys_note = coalesce($16, rudys_note),
          what_went_well = $17::jsonb,
          what_to_improve = $18::jsonb,
          why_no_close = $19::jsonb,
          what_made_this_close_work = $20::jsonb,
          objections_surfaced = $21::jsonb,
          close_section_type = $22,
          close_section = $23::jsonb,
          source_payload = $24::jsonb,
          source_type = coalesce($28, source_type),
          updated_at = now()
      where public_id = $1
      returning *
    `,
    [
      payload.public_id,
      payload.status,
      payload.rep_name,
      payload.rep_email,
      payload.client_name,
      payload.zoom_link,
      payload.transcript_link,
      payload.google_doc_id,
      payload.google_doc_link,
      payload.call_status,
      payload.refusal_reason,
      payload.one_line_verdict,
      payload.biggest_strength,
      payload.biggest_fix,
      payload.coaching_tip,
      payload.rudys_note,
      JSON.stringify(payload.what_went_well),
      JSON.stringify(payload.what_to_improve),
      JSON.stringify(payload.why_no_close),
      JSON.stringify(payload.what_made_this_close_work),
      JSON.stringify(payload.objections_surfaced),
      payload.close_section_type,
      JSON.stringify(payload.close_section),
      JSON.stringify(payload.source_payload),
      payload.original_zoom_link,
      payload.transcript_drive_link,
      payload.report_doc_link,
      payload.source_type,
    ],
  );

  return (rows as ManualFeedbackReport[])[0]
    ? normalizeManualReport((rows as ManualFeedbackReport[])[0])
    : null;
}

export async function getManualFeedbackReports(limit = 100) {
  if (!hasDatabase()) return [];

  try {
    await ensureSchema();
    const rows = (await getSql().query(
      `
        select *
        from manual_feedback_reports
        where status = 'completed'
        order by updated_at desc
        limit $1
      `,
      [limit],
    )) as ManualFeedbackReport[];

    return rows.map(normalizeManualReport);
  } catch (error) {
    console.error(error);
    return [];
  }
}

export async function getManualFeedbackReport(publicId: string) {
  if (!hasDatabase()) return null;

  try {
    await ensureSchema();
    const rows = (await getSql().query(
      "select * from manual_feedback_reports where public_id = $1 limit 1",
      [publicId],
    )) as ManualFeedbackReport[];

    return rows[0] ? normalizeManualReport(rows[0]) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

function normalizeCall(call: PerformanceCall): PerformanceCall {
  return {
    ...call,
    what_went_well: normalizeStringList(call.what_went_well),
    what_to_improve: normalizeStringList(call.what_to_improve),
    objections_surfaced: normalizeStringList(call.objections_surfaced),
  };
}

function normalizeManualReport(report: ManualFeedbackReport): ManualFeedbackReport {
  return {
    ...report,
    what_went_well: normalizeStringList(report.what_went_well),
    what_to_improve: normalizeStringList(report.what_to_improve),
    objections_surfaced: normalizeStringList(report.objections_surfaced),
  };
}

function normalizeUsageTotals(row: UsageTotals | undefined): UsageTotals {
  return {
    events_today: Number(row?.events_today || 0),
    events_7d: Number(row?.events_7d || 0),
    events_30d: Number(row?.events_30d || 0),
    sessions_7d: Number(row?.sessions_7d || 0),
    report_views_7d: Number(row?.report_views_7d || 0),
    rep_selections_7d: Number(row?.rep_selections_7d || 0),
    manual_submissions_7d: Number(row?.manual_submissions_7d || 0),
    link_clicks_7d: Number(row?.link_clicks_7d || 0),
  };
}

function normalizeUsageOfficialSummary(row: UsageOfficialSummary | undefined): UsageOfficialSummary {
  return {
    report_views_today: Number(row?.report_views_today || 0),
    report_views_7d: Number(row?.report_views_7d || 0),
    report_views_30d: Number(row?.report_views_30d || 0),
    active_sessions_7d: Number(row?.active_sessions_7d || 0),
    reps_with_activity_7d: Number(row?.reps_with_activity_7d || 0),
    rep_selections_7d: Number(row?.rep_selections_7d || 0),
    link_clicks_7d: Number(row?.link_clicks_7d || 0),
    last_activity_at: row?.last_activity_at || null,
  };
}

function normalizeUsageManualSummary(row: UsageManualSummary | undefined): UsageManualSummary {
  return {
    total_reports: Number(row?.total_reports || 0),
    completed_reports: Number(row?.completed_reports || 0),
    pending_reports: Number(row?.pending_reports || 0),
    page_opens_7d: Number(row?.page_opens_7d || 0),
    submissions_7d: Number(row?.submissions_7d || 0),
    report_views_7d: Number(row?.report_views_7d || 0),
    link_clicks_7d: Number(row?.link_clicks_7d || 0),
    active_sessions_7d: Number(row?.active_sessions_7d || 0),
    last_activity_at: row?.last_activity_at || null,
  };
}

function normalizeUsageDailyPoint(row: UsageDailyPoint): UsageDailyPoint {
  return {
    day: row.day,
    total_events: Number(row.total_events || 0),
    report_views: Number(row.report_views || 0),
    official_report_views: Number(row.official_report_views || 0),
    manual_report_views: Number(row.manual_report_views || 0),
    rep_selections: Number(row.rep_selections || 0),
    manual_submissions: Number(row.manual_submissions || 0),
  };
}

function normalizeUsageEventBreakdown(row: UsageEventBreakdown): UsageEventBreakdown {
  return {
    event_name: row.event_name,
    count: Number(row.count || 0),
  };
}

function normalizeUsageRepEngagement(row: UsageRepEngagement): UsageRepEngagement {
  return {
    rep_name: row.rep_name,
    rep_slug: row.rep_slug,
    generated_reports: Number(row.generated_reports || 0),
    viewed_reports: Number(row.viewed_reports || 0),
    report_views: Number(row.report_views || 0),
    rep_selections: Number(row.rep_selections || 0),
    doc_clicks: Number(row.doc_clicks || 0),
    zoom_clicks: Number(row.zoom_clicks || 0),
    transcript_clicks: Number(row.transcript_clicks || 0),
    last_activity_at: row.last_activity_at,
  };
}

function normalizeUsageUnviewedReport(row: UsageUnviewedReport): UsageUnviewedReport {
  return {
    id: Number(row.id),
    rep_name: row.rep_name,
    rep_slug: row.rep_slug,
    client_name: row.client_name,
    call_date: row.call_date,
    created_at: row.created_at,
  };
}

function normalizeUsageRecentEvent(row: UsageRecentEvent): UsageRecentEvent {
  return {
    id: Number(row.id),
    event_name: row.event_name,
    source: row.source,
    target_rep_slug: row.target_rep_slug,
    target_rep_name: row.target_rep_name,
    report_id: row.report_id ? Number(row.report_id) : null,
    manual_public_id: row.manual_public_id,
    path: row.path,
    created_at: row.created_at,
  };
}

function getFallbackDashboardData() {
  const useDemo = process.env.USE_DEMO_DATA === "true";
  const calls = useDemo ? demoCalls : [];
  return {
    calls,
    reps: buildRepSummaries(calls),
    latestByRep: calls,
    lastUpdatedAt: getLatestUpdatedAt(calls),
    configured: false,
    error: undefined,
  };
}

function getFallbackUsageAnalytics(): UsageAnalytics {
  return {
    configured: false,
    generatedAt: new Date().toISOString(),
    totals: normalizeUsageTotals(undefined),
    official: normalizeUsageOfficialSummary(undefined),
    manual: normalizeUsageManualSummary(undefined),
    daily: [],
    eventBreakdown: [],
    repEngagement: [],
    unviewedReports: [],
    recentEvents: [],
  };
}

function getLatestUpdatedAt(calls: PerformanceCall[]) {
  return calls.reduce<string | null>((latest, call) => {
    if (!call.updated_at) return latest;
    if (!latest) return call.updated_at;
    return new Date(call.updated_at) > new Date(latest) ? call.updated_at : latest;
  }, null);
}

function buildRepSummaries(calls: PerformanceCall[]): RepSummary[] {
  const reps = new Map<string, RepSummary>();
  for (const call of calls) {
    const existing = reps.get(call.rep_slug);
    if (!existing) {
      reps.set(call.rep_slug, {
        rep_name: call.rep_name,
        rep_slug: call.rep_slug,
        call_count: 1,
        latest_call_date: call.call_date,
      });
      continue;
    }
    existing.call_count += 1;
    if (call.call_date && (!existing.latest_call_date || call.call_date > existing.latest_call_date)) {
      existing.latest_call_date = call.call_date;
    }
  }
  return Array.from(reps.values()).sort((a, b) => a.rep_name.localeCompare(b.rep_name));
}

const demoCalls: PerformanceCall[] = [
  {
    id: 1,
    airtable_record_id: "demo",
    scorecard_key: "demo",
    rep_name: "Demo Rep",
    rep_slug: "demo-rep",
    rep_email: "rep@example.com",
    client_name: "Demo Client",
    call_date: new Date().toISOString(),
    meeting_id: "demo-meeting",
    meeting_title: "Demo Client - Sales Call",
    meeting_link: null,
    transcript_link: null,
    google_doc_id: null,
    google_doc_link: null,
    call_status: "scored",
    one_line_verdict: "The rep kept the call focused but needs a sharper close.",
    biggest_strength: "Clear rapport and steady control through discovery.",
    biggest_fix: "Ask one sharper timing question before presenting the next step.",
    coaching_tip: "Use one concise recap before the close, then stop talking.",
    rudys_note: "Good foundation. The next step is tightening the final five minutes.",
    what_went_well: ["Established trust early", "Kept the prospect engaged"],
    what_to_improve: ["Make the close more direct", "Handle hesitation with a clearer next step"],
    why_no_close: {
      root_cause: "The ask came too late.",
      what_to_say_next_time: "Based on what you told me, are you ready to get started today?",
    },
    what_made_this_close_work: null,
    objections_surfaced: ["Timing", "Budget"],
    close_section_type: "why_no_close",
    close_section: {
      root_cause: "The ask came too late.",
      what_to_say_next_time: "Based on what you told me, are you ready to get started today?",
    },
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
