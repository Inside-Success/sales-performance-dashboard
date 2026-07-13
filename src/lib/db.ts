import { neon } from "@neondatabase/serverless";
import { getAuthEmailDomain, normalizeAuthEmail } from "@/lib/auth-utils";
import type { NormalizedIngestPayload } from "@/lib/ingest";
import { normalizeStringList } from "@/lib/list-format";
import type {
  DashboardFilters,
  ManualFeedbackReport,
  PerformanceCall,
  RepSummary,
  UsageAnalytics,
  UsageChatRep,
  UsageChatSummary,
  UsageDailyPoint,
  UsageEventBreakdown,
  UsageLegacySummary,
  UsageManualSummary,
  UsageOfficialSummary,
  UsageRecentEvent,
  UsageRepEngagement,
  UsageTotals,
  UsageUnmappedUser,
  UsageUnviewedReport,
  SalesCorrelationUsageData,
  SalesCorrelationUsageEvent,
  SalesCorrelationUsageRow,
  SalesSnapshotRecord,
  SalesSnapshotRow,
  PromptBenchmarkCost,
  PromptBenchmarkData,
  PromptBenchmarkDecisionRow,
  PromptBenchmarkOutput,
  PromptBenchmarkRun,
  PromptBenchmarkRunReviewData,
} from "@/lib/types";
import type { NormalizedManualCallback, ManualSubmitPayload } from "@/lib/manual-reports";
import type { PromptBenchmarkIngestPayload } from "@/lib/prompt-benchmark";
import type { UsageEventPayload } from "@/lib/usage-events";
import type {
  AskSalesFaqConversationSummary,
  AskSalesFaqConversationPage,
  AskSalesFaqAdminOverview,
  AskSalesFaqAdminLogItem,
  AskSalesFaqFeedbackContext,
  AskSalesFaqDiagnosticPayload,
  AskSalesFaqFeedbackPayload,
  AskSalesFaqLogPayload,
  AskSalesFaqRepHistoryPage,
  AskSalesFaqResponse,
  AskSalesFaqStructuredAnswer,
  AskSalesFaqUsageOverview,
} from "@/lib/ask-sales-faq/types";
import {
  buildAskSalesFaqRepReviewKey,
  encodeAskSalesFaqRepHistoryCursor,
  type AskSalesFaqRepHistoryCursor,
} from "@/lib/ask-sales-faq/admin-rep-review";
import {
  classifyAskSalesFaqReview,
  percentOf,
  shouldCreateAskSalesFaqMiss,
} from "@/lib/ask-sales-faq/admin-analytics";
import {
  encodeAskSalesFaqConversationCursor,
  type AskSalesFaqConversationCursor,
} from "@/lib/ask-sales-faq/conversation-history";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;
let schemaReady = false;
let schemaReadyPromise: Promise<void> | null = null;

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
  if (schemaReadyPromise) return schemaReadyPromise;

  schemaReadyPromise = buildSchema()
    .then(() => {
      schemaReady = true;
    })
    .catch((error) => {
      schemaReady = false;
      throw error;
    })
    .finally(() => {
      schemaReadyPromise = null;
    });

  return schemaReadyPromise;
}

async function buildSchema() {
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
      engagement_seconds integer not null default 0,
      viewer_email text,
      viewer_name text,
      viewer_domain text,
      viewer_rep_slug text,
      viewer_rep_name text,
      viewer_is_mapped boolean not null default false,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table dashboard_usage_events add column if not exists engagement_seconds integer not null default 0`;
  await sql`alter table dashboard_usage_events add column if not exists viewer_email text`;
  await sql`alter table dashboard_usage_events add column if not exists viewer_name text`;
  await sql`alter table dashboard_usage_events add column if not exists viewer_domain text`;
  await sql`alter table dashboard_usage_events add column if not exists viewer_rep_slug text`;
  await sql`alter table dashboard_usage_events add column if not exists viewer_rep_name text`;
  await sql`alter table dashboard_usage_events add column if not exists viewer_is_mapped boolean not null default false`;
  await sql`create index if not exists dashboard_usage_events_created_at_idx on dashboard_usage_events (created_at desc)`;
  await sql`create index if not exists dashboard_usage_events_event_created_idx on dashboard_usage_events (event_name, created_at desc)`;
  await sql`create index if not exists dashboard_usage_events_rep_created_idx on dashboard_usage_events (target_rep_slug, created_at desc)`;
  await sql`create index if not exists dashboard_usage_events_report_idx on dashboard_usage_events (report_id)`;
  await sql`create index if not exists dashboard_usage_events_manual_public_id_idx on dashboard_usage_events (manual_public_id)`;
  await sql`create index if not exists dashboard_usage_events_viewer_email_created_idx on dashboard_usage_events (viewer_email, created_at desc)`;
  await sql`create index if not exists dashboard_usage_events_viewer_rep_created_idx on dashboard_usage_events (viewer_rep_slug, created_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_conversations (
      id text primary key,
      viewer_email text not null,
      viewer_name text,
      title text,
      status text not null default 'active' check (status in ('active', 'archived', 'deleted')),
      deleted_at timestamptz,
      deleted_by text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table ask_sales_faq_conversations add column if not exists deleted_at timestamptz`;
  await sql`alter table ask_sales_faq_conversations add column if not exists deleted_by text`;
  await sql`create index if not exists ask_sales_faq_conversations_viewer_updated_idx on ask_sales_faq_conversations (viewer_email, updated_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_messages (
      id text primary key,
      conversation_id text not null references ask_sales_faq_conversations(id) on delete cascade,
      viewer_email text not null,
      role text not null check (role in ('user', 'assistant', 'system_safe')),
      content_redacted text not null,
      content_hash text,
      redaction_summary jsonb not null default '[]'::jsonb,
      outcome text,
      matched_article_id text,
      source_label text,
      source_last_reviewed text,
      answer_payload jsonb,
      needs_route boolean not null default false,
      route_reason text,
      provider text,
      model text,
      latency_ms integer,
      error_class text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`alter table ask_sales_faq_messages add column if not exists answer_payload jsonb`;
  await sql`create index if not exists ask_sales_faq_messages_conversation_created_idx on ask_sales_faq_messages (conversation_id, created_at asc)`;
  await sql`create index if not exists ask_sales_faq_messages_viewer_created_idx on ask_sales_faq_messages (viewer_email, created_at desc)`;
  await sql`create index if not exists ask_sales_faq_messages_outcome_created_idx on ask_sales_faq_messages (outcome, created_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_feedback (
      id text primary key,
      message_id text not null references ask_sales_faq_messages(id) on delete cascade,
      conversation_id text not null references ask_sales_faq_conversations(id) on delete cascade,
      viewer_email text not null,
      rating text not null check (rating in ('up', 'down')),
      comment text,
      created_at timestamptz not null default now(),
      constraint ask_sales_faq_feedback_down_comment_required
        check (rating <> 'down' or length(trim(coalesce(comment, ''))) > 0)
    )
  `;
  await sql`create index if not exists ask_sales_faq_feedback_message_idx on ask_sales_faq_feedback (message_id)`;
  await sql`create index if not exists ask_sales_faq_feedback_rating_created_idx on ask_sales_faq_feedback (rating, created_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_misses (
      id text primary key,
      message_id text references ask_sales_faq_messages(id) on delete set null,
      conversation_id text references ask_sales_faq_conversations(id) on delete cascade,
      viewer_email text not null,
      question_redacted text not null,
      decision text not null,
      route_reason text,
      status text not null default 'new' check (status in ('new', 'reviewed', 'converted_to_article', 'ignored')),
      reviewed_by text,
      reviewed_at timestamptz,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists ask_sales_faq_misses_status_created_idx on ask_sales_faq_misses (status, created_at desc)`;
  await sql`create index if not exists ask_sales_faq_misses_viewer_created_idx on ask_sales_faq_misses (viewer_email, created_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_diagnostics (
      id text primary key,
      conversation_id text,
      viewer_email text not null,
      viewer_name text,
      event_type text not null,
      detail text,
      metadata jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists ask_sales_faq_diagnostics_created_idx on ask_sales_faq_diagnostics (created_at desc)`;
  await sql`create index if not exists ask_sales_faq_diagnostics_event_created_idx on ask_sales_faq_diagnostics (event_type, created_at desc)`;
  await sql`create index if not exists ask_sales_faq_diagnostics_viewer_created_idx on ask_sales_faq_diagnostics (viewer_email, created_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_request_guards (
      id text primary key,
      viewer_email text not null,
      conversation_id text not null,
      client_request_id text not null,
      status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'failed', 'rate_limited')),
      assistant_message_id text,
      response_payload jsonb,
      error_class text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists ask_sales_faq_request_guards_viewer_created_idx on ask_sales_faq_request_guards (viewer_email, created_at desc)`;
  await sql`create index if not exists ask_sales_faq_request_guards_created_idx on ask_sales_faq_request_guards (created_at desc)`;
  await sql`create index if not exists ask_sales_faq_request_guards_status_updated_idx on ask_sales_faq_request_guards (status, updated_at desc)`;

  await sql`
    create table if not exists sales_performance_snapshots (
      id bigserial primary key,
      source_url text not null,
      source_sheet text,
      headers jsonb not null default '[]'::jsonb,
      rows jsonb not null default '[]'::jsonb,
      row_count integer not null default 0,
      paid_row_count integer not null default 0,
      new_paid_row_count integer not null default 0,
      latest_sales_date timestamptz,
      validation_notes jsonb not null default '[]'::jsonb,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists sales_performance_snapshots_created_at_idx on sales_performance_snapshots (created_at desc)`;

  await sql`
    create table if not exists prompt_benchmark_runs (
      id bigserial primary key,
      run_id text not null unique,
      title text,
      status text not null default 'completed',
      sheet_url text,
      dashboard_url text,
      started_at timestamptz,
      finished_at timestamptz,
      total_cost_usd numeric(12,6) not null default 0,
      total_provider_calls integer not null default 0,
      source_payload jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists prompt_benchmark_runs_updated_at_idx on prompt_benchmark_runs (updated_at desc)`;

  await sql`
    create table if not exists prompt_benchmark_outputs (
      id bigserial primary key,
      result_id text not null unique,
      run_id text not null,
      case_id text not null,
      case_label text,
      case_type text not null default 'scored',
      expected_call_status text,
      call_status text,
      model text not null,
      provider text not null,
      call_mode text not null,
      coaching_mode text not null,
      output jsonb not null default '{}'::jsonb,
      ai_eval jsonb not null default '{}'::jsonb,
      classification_agreed boolean,
      overall_quality numeric(6,2),
      total_cost_usd numeric(12,6) not null default 0,
      total_input_tokens integer not null default 0,
      total_output_tokens integer not null default 0,
      total_latency_ms integer not null default 0,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists prompt_benchmark_outputs_run_id_idx on prompt_benchmark_outputs (run_id)`;
  await sql`create index if not exists prompt_benchmark_outputs_config_idx on prompt_benchmark_outputs (model, call_mode, coaching_mode)`;
  await sql`create index if not exists prompt_benchmark_outputs_updated_at_idx on prompt_benchmark_outputs (updated_at desc)`;

  await sql`
    create table if not exists prompt_benchmark_costs (
      id bigserial primary key,
      cost_id text not null unique,
      run_id text not null,
      result_id text,
      case_id text,
      model text not null,
      provider text not null,
      call_purpose text not null,
      input_tokens integer not null default 0,
      cache_creation_input_tokens integer not null default 0,
      cache_read_input_tokens integer not null default 0,
      output_tokens integer not null default 0,
      input_cost_usd numeric(12,6) not null default 0,
      cache_write_cost_usd numeric(12,6) not null default 0,
      cache_read_cost_usd numeric(12,6) not null default 0,
      output_cost_usd numeric(12,6) not null default 0,
      total_cost_usd numeric(12,6) not null default 0,
      started_at timestamptz,
      finished_at timestamptz,
      latency_ms integer not null default 0,
      provider_response_id text,
      error text,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists prompt_benchmark_costs_run_id_idx on prompt_benchmark_costs (run_id)`;
  await sql`create index if not exists prompt_benchmark_costs_result_id_idx on prompt_benchmark_costs (result_id)`;
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
  const viewer = await resolveUsageViewer(sql, payload.viewer_email, payload.viewer_name);

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
        metadata,
        engagement_seconds,
        viewer_email,
        viewer_name,
        viewer_domain,
        viewer_rep_slug,
        viewer_rep_name,
        viewer_is_mapped
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb, $12, $13, $14, $15, $16, $17, $18)
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
      getEngagementSeconds(payload.engagement_seconds),
      viewer.viewer_email,
      viewer.viewer_name,
      viewer.viewer_domain,
      viewer.viewer_rep_slug,
      viewer.viewer_rep_name,
      viewer.viewer_is_mapped,
    ],
  );
}

type ResolvedUsageViewer = {
  viewer_email: string | null;
  viewer_name: string | null;
  viewer_domain: string | null;
  viewer_rep_slug: string | null;
  viewer_rep_name: string | null;
  viewer_is_mapped: boolean;
};

async function resolveUsageViewer(
  sql: SqlClient,
  rawEmail: string | null | undefined,
  rawName: string | null | undefined,
): Promise<ResolvedUsageViewer> {
  const viewerEmail = normalizeAuthEmail(rawEmail);
  const viewerName = normalizeViewerName(rawName);
  const viewerDomain = getAuthEmailDomain(viewerEmail);
  const fallback: ResolvedUsageViewer = {
    viewer_email: viewerEmail,
    viewer_name: viewerName,
    viewer_domain: viewerDomain,
    viewer_rep_slug: null,
    viewer_rep_name: null,
    viewer_is_mapped: false,
  };

  if (!viewerEmail && !viewerName) return fallback;

  if (viewerEmail) {
    const rows = (await sql.query(
      `
        select
          rep_slug,
          max(rep_name) as rep_name,
          max(updated_at) as latest_report_at
        from performance_calls
        where lower(rep_email) = lower($1)
        group by rep_slug
        order by latest_report_at desc nulls last
      `,
      [viewerEmail],
    )) as Array<{ rep_slug: string; rep_name: string }>;

    if (rows.length === 1) {
      return {
        ...fallback,
        viewer_rep_slug: rows[0].rep_slug,
        viewer_rep_name: rows[0].rep_name,
        viewer_is_mapped: true,
      };
    }
  }

  if (viewerName) {
    const rows = (await sql.query(
      `
        select
          rep_slug,
          max(rep_name) as rep_name,
          max(updated_at) as latest_report_at
        from performance_calls
        where lower(regexp_replace(trim(rep_name), '\\s+', ' ', 'g')) = lower($1)
        group by rep_slug
        order by latest_report_at desc nulls last
      `,
      [viewerName],
    )) as Array<{ rep_slug: string; rep_name: string }>;

    if (rows.length === 1) {
      return {
        ...fallback,
        viewer_rep_slug: rows[0].rep_slug,
        viewer_rep_name: rows[0].rep_name,
        viewer_is_mapped: true,
      };
    }
  }

  return fallback;
}

function normalizeViewerName(value: string | null | undefined) {
  const normalized = value?.trim().replace(/\s+/g, " ");
  return normalized || null;
}

function getEngagementSeconds(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.round(Number(value)));
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
      unmappedUserRows,
      legacySummaryRows,
      chatSummaryRows,
      chatRepRows,
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
            count(distinct viewer_email) filter (
              where created_at >= now() - interval '7 days'
                and viewer_email is not null
            )::int as verified_users_7d,
            count(*) filter (
              where created_at >= now() - interval '7 days'
                and viewer_email is not null
            )::int as verified_events_7d,
            count(*) filter (
              where created_at >= now() - interval '30 days'
                and viewer_email is null
            )::int as legacy_events_30d,
            count(*) filter (
              where event_name in ('report_detail_viewed', 'manual_report_viewed')
                and created_at >= now() - interval '7 days'
            )::int as report_views_7d,
            count(*) filter (
              where event_name = 'report_engaged'
                and viewer_is_mapped
                and created_at >= now() - interval '7 days'
            )::int as report_engagements_7d,
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
            where source in ('official_dashboard', 'official_report')
               or event_name in ('dashboard_home_viewed', 'rep_selected', 'report_detail_viewed', 'report_engaged', 'report_active_time')
               or (event_name = 'report_card_clicked' and report_id is not null)
               or (
                 event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                 and report_id is not null
               )
          )
          select
            (select count(distinct rep_slug)::int from performance_calls) as total_reps,
            (select count(*)::int from performance_calls) as total_reports,
            count(*) filter (
              where event_name = 'report_detail_viewed'
                and viewer_is_mapped
                and created_at >= now() - interval '1 day'
            )::int as report_views_today,
            count(*) filter (
              where event_name = 'report_detail_viewed'
                and viewer_is_mapped
                and created_at >= now() - interval '7 days'
            )::int as report_views_7d,
            count(*) filter (
              where event_name = 'report_detail_viewed'
                and viewer_is_mapped
                and created_at >= now() - interval '30 days'
            )::int as report_views_30d,
            count(*) filter (
              where event_name = 'report_engaged'
                and viewer_is_mapped
                and created_at >= now() - interval '1 day'
            )::int as report_engagements_today,
            count(*) filter (
              where event_name = 'report_engaged'
                and viewer_is_mapped
                and created_at >= now() - interval '7 days'
            )::int as report_engagements_7d,
            count(*) filter (
              where event_name = 'report_engaged'
                and viewer_is_mapped
                and created_at >= now() - interval '30 days'
            )::int as report_engagements_30d,
            coalesce(sum(engagement_seconds) filter (
              where event_name = 'report_active_time'
                and viewer_is_mapped
                and created_at >= now() - interval '7 days'
            ), 0)::int as engagement_seconds_7d,
            count(distinct anonymous_session_id) filter (
              where created_at >= now() - interval '7 days'
                and anonymous_session_id is not null
            )::int as active_sessions_7d,
            count(distinct viewer_email) filter (
              where created_at >= now() - interval '7 days'
                and viewer_email is not null
            )::int as verified_users_7d,
            count(distinct viewer_email) filter (
              where created_at >= now() - interval '30 days'
                and viewer_email is not null
                and not viewer_is_mapped
            )::int as unmapped_users_30d,
            count(distinct viewer_rep_slug) filter (
              where created_at >= now() - interval '7 days'
                and viewer_is_mapped
                and viewer_rep_slug is not null
            )::int as reps_with_activity_7d,
            count(*) filter (
              where event_name = 'rep_selected'
                and viewer_is_mapped
                and created_at >= now() - interval '7 days'
            )::int as rep_selections_7d,
            count(*) filter (
              where event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                and report_id is not null
                and viewer_is_mapped
                and created_at >= now() - interval '7 days'
            )::int as link_clicks_7d,
            max(created_at) filter (where viewer_email is not null)::text as last_activity_at
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
                'manual_report_viewed',
                'report_engaged',
                'report_active_time'
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
            (
              select count(*)::int
              from manual_feedback_reports
              where status in ('pending', 'processing')
                and updated_at >= now() - interval '5 minutes'
            ) as pending_reports,
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
            count(events.id) filter (
              where events.event_name = 'report_engaged'
                and events.source = 'official_report'
                and events.viewer_is_mapped
            )::int as official_report_views,
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
          with reps as (
            select
              rep_slug,
              max(rep_name) as rep_name,
              count(*)::int as generated_reports
            from performance_calls
            group by rep_slug
          ),
          official_events as (
            select
              events.*,
              calls.rep_slug as report_rep_slug
            from dashboard_usage_events events
            left join performance_calls calls on calls.id = events.report_id
            where events.viewer_is_mapped
              and events.viewer_rep_slug is not null
              and (
                events.source in ('official_dashboard', 'official_report')
                or events.event_name in ('dashboard_home_viewed', 'rep_selected', 'report_detail_viewed', 'report_engaged', 'report_active_time')
                or (
                  events.event_name in ('report_card_clicked', 'google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                  and events.report_id is not null
                )
              )
          )
          select
            reps.rep_name,
            reps.rep_slug,
            reps.generated_reports,
            count(distinct official_events.report_id) filter (
              where official_events.event_name = 'report_engaged'
                and official_events.report_id is not null
            )::int as viewed_reports,
            count(*) filter (where official_events.event_name = 'report_detail_viewed')::int as report_views,
            count(*) filter (where official_events.event_name = 'report_engaged')::int as report_engagements,
            count(*) filter (
              where official_events.event_name = 'report_detail_viewed'
                and official_events.report_rep_slug = reps.rep_slug
            )::int as own_report_opens,
            count(*) filter (
              where official_events.event_name = 'report_detail_viewed'
                and official_events.report_rep_slug is not null
                and official_events.report_rep_slug <> reps.rep_slug
            )::int as other_report_opens,
            count(*) filter (
              where official_events.event_name = 'report_engaged'
                and official_events.report_rep_slug = reps.rep_slug
            )::int as own_report_engagements,
            count(*) filter (
              where official_events.event_name = 'report_engaged'
                and official_events.report_rep_slug is not null
                and official_events.report_rep_slug <> reps.rep_slug
            )::int as other_report_engagements,
            coalesce(sum(official_events.engagement_seconds) filter (
              where official_events.event_name = 'report_active_time'
            ), 0)::int as engagement_seconds,
            count(*) filter (where official_events.event_name = 'rep_selected')::int as rep_selections,
            count(*) filter (where official_events.event_name = 'google_doc_clicked')::int as doc_clicks,
            count(*) filter (where official_events.event_name = 'zoom_clicked')::int as zoom_clicks,
            count(*) filter (where official_events.event_name = 'transcript_clicked')::int as transcript_clicks,
            max(official_events.created_at)::text as last_activity_at
          from reps
          left join official_events on official_events.viewer_rep_slug = reps.rep_slug
          group by reps.rep_name, reps.rep_slug, reps.generated_reports
          order by report_engagements desc, report_views desc, generated_reports desc, reps.rep_name asc
          limit 75
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
           and events.event_name = 'report_engaged'
           and events.viewer_is_mapped
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
            viewer_email,
            max(viewer_name) as viewer_name,
            max(viewer_domain) as viewer_domain,
            count(*)::int as events_30d,
            count(*) filter (where event_name in ('report_detail_viewed', 'manual_report_viewed'))::int as report_opens_30d,
            count(*) filter (where event_name = 'report_engaged')::int as report_engagements_30d,
            max(created_at)::text as last_activity_at
          from dashboard_usage_events
          where viewer_email is not null
            and not viewer_is_mapped
            and created_at >= now() - interval '30 days'
          group by viewer_email
          order by last_activity_at desc
          limit 25
        `,
        [],
      ),
      sql.query(
        `
          select
            count(*) filter (where created_at >= now() - interval '30 days')::int as events_30d,
            count(*) filter (
              where event_name in ('report_detail_viewed', 'manual_report_viewed')
                and created_at >= now() - interval '30 days'
            )::int as report_views_30d,
            count(distinct anonymous_session_id) filter (
              where anonymous_session_id is not null
                and created_at >= now() - interval '30 days'
            )::int as sessions_30d,
            max(created_at)::text as last_activity_at
          from dashboard_usage_events
          where viewer_email is null
        `,
        [],
      ),
      sql.query(
        `
          select
            count(*) filter (
              where event_name = 'chat_opened'
                and created_at >= now() - interval '7 days'
            )::int as opens_7d,
            count(*) filter (
              where event_name = 'chat_question_sent'
                and created_at >= now() - interval '7 days'
            )::int as questions_7d,
            count(*) filter (
              where event_name = 'chat_answer_received'
                and created_at >= now() - interval '7 days'
            )::int as answers_7d,
            count(*) filter (
              where event_name = 'chat_error'
                and created_at >= now() - interval '7 days'
            )::int as errors_7d,
            count(distinct viewer_rep_slug) filter (
              where viewer_is_mapped
                and viewer_rep_slug is not null
                and event_name in ('chat_opened', 'chat_question_sent', 'chat_answer_received')
                and created_at >= now() - interval '7 days'
            )::int as reps_using_chat_7d,
            count(distinct report_id) filter (
              where report_id is not null
                and event_name = 'chat_question_sent'
                and created_at >= now() - interval '7 days'
            )::int as official_reports_with_questions_7d,
            count(distinct manual_public_id) filter (
              where manual_public_id is not null
                and event_name = 'chat_question_sent'
                and created_at >= now() - interval '7 days'
            )::int as manual_reports_with_questions_7d,
            max(created_at)::text as last_activity_at
          from dashboard_usage_events
          where event_name in ('chat_opened', 'chat_question_sent', 'chat_answer_received', 'chat_error')
        `,
        [],
      ),
      sql.query(
        `
          select
            viewer_rep_slug as rep_slug,
            coalesce(max(viewer_rep_name), 'Mapped rep') as rep_name,
            count(*) filter (where event_name = 'chat_opened')::int as opens_7d,
            count(*) filter (where event_name = 'chat_question_sent')::int as questions_7d,
            count(*) filter (where event_name = 'chat_answer_received')::int as answers_7d,
            count(*) filter (where event_name = 'chat_error')::int as errors_7d,
            count(distinct report_id) filter (
              where report_id is not null
                and event_name = 'chat_question_sent'
            )::int as official_reports_asked_7d,
            count(distinct manual_public_id) filter (
              where manual_public_id is not null
                and event_name = 'chat_question_sent'
            )::int as manual_reports_asked_7d,
            max(created_at)::text as last_activity_at
          from dashboard_usage_events
          where event_name in ('chat_opened', 'chat_question_sent', 'chat_answer_received', 'chat_error')
            and created_at >= now() - interval '7 days'
            and viewer_is_mapped
            and viewer_rep_slug is not null
          group by viewer_rep_slug
          order by questions_7d desc, opens_7d desc, last_activity_at desc
          limit 15
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
            viewer_email,
            viewer_name,
            viewer_rep_slug,
            viewer_rep_name,
            viewer_is_mapped,
            engagement_seconds,
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
      unmappedUsers: (unmappedUserRows as UsageUnmappedUser[]).map(normalizeUsageUnmappedUser),
      legacy: normalizeUsageLegacySummary((legacySummaryRows as UsageLegacySummary[])[0]),
      chat: normalizeUsageChatSummary((chatSummaryRows as UsageChatSummary[])[0]),
      chatReps: (chatRepRows as UsageChatRep[]).map(normalizeUsageChatRep),
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

export async function getSalesCorrelationUsageData(
  historyDays = 120,
  windowDays = 30,
): Promise<SalesCorrelationUsageData> {
  if (!hasDatabase()) {
    return {
      configured: false,
      rows: [],
      events: [],
    };
  }

  try {
    await ensureSchema();
    const sql = getSql();

    const [rows, events] = await Promise.all([
      sql.query(
        `
          with reports as (
            select
              rep_slug,
              max(rep_name) as rep_name,
              count(*)::int as generated_reports,
              min(created_at)::text as first_report_generated_at,
              max(created_at)::text as latest_report_generated_at
            from performance_calls
            group by rep_slug
          ),
          normalized_events as (
            select
              events.id,
              events.event_name,
              events.created_at,
              events.report_id,
              events.viewer_rep_slug as rep_slug,
              events.viewer_rep_name as rep_name
            from dashboard_usage_events events
            where events.viewer_is_mapped
              and events.viewer_rep_slug is not null
              and events.source = 'official_report'
              and (
                events.event_name = 'report_engaged'
                or (
                  events.event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                  and events.report_id is not null
                )
              )
          ),
          event_agg as (
            select
              rep_slug,
              max(rep_name) as rep_name,
              count(*) filter (
                where created_at >= now() - ($1::int * interval '1 day')
              )::int as usage_events_window,
              count(*)::int as usage_events_all,
              count(*) filter (
                where event_name = 'report_engaged'
                  and created_at >= now() - ($1::int * interval '1 day')
              )::int as report_views_window,
              count(*) filter (
                where event_name = 'report_engaged'
              )::int as report_views_all,
              0::int as report_clicks_window,
              count(distinct report_id) filter (
                where event_name = 'report_engaged'
                  and report_id is not null
              )::int as viewed_reports,
              count(distinct report_id) filter (
                  where event_name = 'report_engaged'
                  and report_id is not null
                  and created_at >= now() - ($1::int * interval '1 day')
              )::int as viewed_reports_window,
              0::int as rep_selections_window,
              count(*) filter (
                where event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                  and created_at >= now() - ($1::int * interval '1 day')
              )::int as link_clicks_window,
              min(created_at)::text as first_activity_at,
              max(created_at)::text as last_activity_at
            from normalized_events
            where rep_slug is not null
            group by rep_slug
          )
          select
            coalesce(reports.rep_slug, event_agg.rep_slug) as rep_slug,
            coalesce(reports.rep_name, event_agg.rep_name, reports.rep_slug, event_agg.rep_slug) as rep_name,
            coalesce(reports.generated_reports, 0)::int as generated_reports,
            reports.first_report_generated_at,
            reports.latest_report_generated_at,
            coalesce(event_agg.usage_events_window, 0)::int as usage_events_window,
            coalesce(event_agg.usage_events_all, 0)::int as usage_events_all,
            coalesce(event_agg.report_views_window, 0)::int as report_views_window,
            coalesce(event_agg.report_views_all, 0)::int as report_views_all,
            coalesce(event_agg.report_clicks_window, 0)::int as report_clicks_window,
            coalesce(event_agg.viewed_reports, 0)::int as viewed_reports,
            coalesce(event_agg.viewed_reports_window, 0)::int as viewed_reports_window,
            coalesce(event_agg.rep_selections_window, 0)::int as rep_selections_window,
            coalesce(event_agg.link_clicks_window, 0)::int as link_clicks_window,
            event_agg.first_activity_at,
            event_agg.last_activity_at
          from reports
          full outer join event_agg on event_agg.rep_slug = reports.rep_slug
          order by report_views_window desc, usage_events_window desc, generated_reports desc, rep_name asc
        `,
        [windowDays],
      ),
      sql.query(
        `
          with normalized_events as (
            select
              events.event_name,
              events.created_at,
              events.report_id,
              events.viewer_rep_slug as rep_slug,
              events.viewer_rep_name as rep_name
            from dashboard_usage_events events
            where events.created_at >= now() - ($1::int * interval '1 day')
              and events.viewer_is_mapped
              and events.viewer_rep_slug is not null
              and events.source = 'official_report'
              and (
                events.event_name = 'report_engaged'
                or (
                  events.event_name in ('google_doc_clicked', 'zoom_clicked', 'transcript_clicked')
                  and events.report_id is not null
                )
              )
          )
          select
            rep_slug,
            coalesce(rep_name, rep_slug) as rep_name,
            event_name,
            report_id,
            created_at::text
          from normalized_events
          where rep_slug is not null
          order by created_at asc
        `,
        [historyDays],
      ),
    ]);

    return {
      configured: true,
      rows: (rows as SalesCorrelationUsageRow[]).map(normalizeSalesCorrelationUsageRow),
      events: (events as SalesCorrelationUsageEvent[]).map(normalizeSalesCorrelationUsageEvent),
    };
  } catch (error) {
    console.error(error);
    return {
      configured: true,
      rows: [],
      events: [],
      error: "Sales correlation usage query failed. Check DATABASE_URL and usage tracking data.",
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

export async function getLatestSalesPerformanceSnapshot(): Promise<SalesSnapshotRecord | null> {
  if (!hasDatabase()) return null;

  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql.query(
      `
        select
          id,
          source_url,
          source_sheet,
          headers,
          rows,
          row_count::int,
          paid_row_count::int,
          new_paid_row_count::int,
          latest_sales_date::text,
          validation_notes,
          created_at::text
        from sales_performance_snapshots
        order by created_at desc
        limit 1
      `,
      [],
    );

    const snapshot = (rows as SalesSnapshotRecord[])[0];
    return snapshot ? normalizeSalesSnapshot(snapshot) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function saveSalesPerformanceSnapshot(input: {
  source_url: string;
  source_sheet: string;
  headers: string[];
  rows: SalesSnapshotRow[];
  row_count: number;
  paid_row_count: number;
  new_paid_row_count: number;
  latest_sales_date: string | null;
  validation_notes: string[];
}): Promise<SalesSnapshotRecord | null> {
  if (!hasDatabase()) return null;

  try {
    await ensureSchema();
    const sql = getSql();
    const rows = await sql.query(
      `
        insert into sales_performance_snapshots (
          source_url,
          source_sheet,
          headers,
          rows,
          row_count,
          paid_row_count,
          new_paid_row_count,
          latest_sales_date,
          validation_notes
        )
        values ($1, $2, $3::jsonb, $4::jsonb, $5, $6, $7, nullif($8, '')::timestamptz, $9::jsonb)
        returning
          id,
          source_url,
          source_sheet,
          headers,
          rows,
          row_count::int,
          paid_row_count::int,
          new_paid_row_count::int,
          latest_sales_date::text,
          validation_notes,
          created_at::text
      `,
      [
        input.source_url,
        input.source_sheet,
        JSON.stringify(input.headers),
        JSON.stringify(input.rows),
        input.row_count,
        input.paid_row_count,
        input.new_paid_row_count,
        input.latest_sales_date || "",
        JSON.stringify(input.validation_notes),
      ],
    );

    const snapshot = (rows as SalesSnapshotRecord[])[0];
    return snapshot ? normalizeSalesSnapshot(snapshot) : null;
  } catch (error) {
    console.error(error);
    return null;
  }
}

export async function ingestPromptBenchmark(payload: PromptBenchmarkIngestPayload) {
  await ensureSchema();
  const sql = getSql();

  await sql.query(
    `
      insert into prompt_benchmark_runs (
        run_id,
        title,
        status,
        sheet_url,
        dashboard_url,
        started_at,
        finished_at,
        total_cost_usd,
        total_provider_calls,
        source_payload
      )
      values ($1, $2, $3, $4, $5, nullif($6, '')::timestamptz, nullif($7, '')::timestamptz, $8, $9, $10::jsonb)
      on conflict (run_id) do update set
        title = excluded.title,
        status = excluded.status,
        sheet_url = excluded.sheet_url,
        dashboard_url = excluded.dashboard_url,
        started_at = excluded.started_at,
        finished_at = excluded.finished_at,
        total_cost_usd = excluded.total_cost_usd,
        total_provider_calls = excluded.total_provider_calls,
        source_payload = excluded.source_payload,
        updated_at = now()
    `,
    [
      payload.run.run_id,
      payload.run.title,
      payload.run.status,
      payload.run.sheet_url,
      payload.run.dashboard_url,
      payload.run.started_at,
      payload.run.finished_at,
      payload.run.total_cost_usd,
      payload.run.total_provider_calls,
      JSON.stringify(payload.run.source_payload),
    ],
  );

  for (const output of payload.outputs) {
    await sql.query(
      `
        insert into prompt_benchmark_outputs (
          result_id,
          run_id,
          case_id,
          case_label,
          case_type,
          expected_call_status,
          call_status,
          model,
          provider,
          call_mode,
          coaching_mode,
          output,
          ai_eval,
          classification_agreed,
          overall_quality,
          total_cost_usd,
          total_input_tokens,
          total_output_tokens,
          total_latency_ms
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, $13::jsonb, $14, $15, $16, $17, $18, $19)
        on conflict (result_id) do update set
          run_id = excluded.run_id,
          case_id = excluded.case_id,
          case_label = excluded.case_label,
          case_type = excluded.case_type,
          expected_call_status = excluded.expected_call_status,
          call_status = excluded.call_status,
          model = excluded.model,
          provider = excluded.provider,
          call_mode = excluded.call_mode,
          coaching_mode = excluded.coaching_mode,
          output = excluded.output,
          ai_eval = excluded.ai_eval,
          classification_agreed = excluded.classification_agreed,
          overall_quality = excluded.overall_quality,
          total_cost_usd = excluded.total_cost_usd,
          total_input_tokens = excluded.total_input_tokens,
          total_output_tokens = excluded.total_output_tokens,
          total_latency_ms = excluded.total_latency_ms,
          updated_at = now()
      `,
      [
        output.result_id,
        output.run_id,
        output.case_id,
        output.case_label,
        output.case_type,
        output.expected_call_status,
        output.call_status,
        output.model,
        output.provider,
        output.call_mode,
        output.coaching_mode,
        JSON.stringify(output.output),
        JSON.stringify(output.ai_eval),
        output.classification_agreed,
        output.overall_quality,
        output.total_cost_usd,
        output.total_input_tokens,
        output.total_output_tokens,
        output.total_latency_ms,
      ],
    );
  }

  for (const cost of payload.costs) {
    await sql.query(
      `
        insert into prompt_benchmark_costs (
          cost_id,
          run_id,
          result_id,
          case_id,
          model,
          provider,
          call_purpose,
          input_tokens,
          cache_creation_input_tokens,
          cache_read_input_tokens,
          output_tokens,
          input_cost_usd,
          cache_write_cost_usd,
          cache_read_cost_usd,
          output_cost_usd,
          total_cost_usd,
          started_at,
          finished_at,
          latency_ms,
          provider_response_id,
          error
        )
        values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, nullif($17, '')::timestamptz, nullif($18, '')::timestamptz, $19, $20, $21)
        on conflict (cost_id) do update set
          run_id = excluded.run_id,
          result_id = excluded.result_id,
          case_id = excluded.case_id,
          model = excluded.model,
          provider = excluded.provider,
          call_purpose = excluded.call_purpose,
          input_tokens = excluded.input_tokens,
          cache_creation_input_tokens = excluded.cache_creation_input_tokens,
          cache_read_input_tokens = excluded.cache_read_input_tokens,
          output_tokens = excluded.output_tokens,
          input_cost_usd = excluded.input_cost_usd,
          cache_write_cost_usd = excluded.cache_write_cost_usd,
          cache_read_cost_usd = excluded.cache_read_cost_usd,
          output_cost_usd = excluded.output_cost_usd,
          total_cost_usd = excluded.total_cost_usd,
          started_at = excluded.started_at,
          finished_at = excluded.finished_at,
          latency_ms = excluded.latency_ms,
          provider_response_id = excluded.provider_response_id,
          error = excluded.error
      `,
      [
        cost.cost_id,
        cost.run_id,
        cost.result_id,
        cost.case_id,
        cost.model,
        cost.provider,
        cost.call_purpose,
        cost.input_tokens,
        cost.cache_creation_input_tokens,
        cost.cache_read_input_tokens,
        cost.output_tokens,
        cost.input_cost_usd,
        cost.cache_write_cost_usd,
        cost.cache_read_cost_usd,
        cost.output_cost_usd,
        cost.total_cost_usd,
        cost.started_at,
        cost.finished_at,
        cost.latency_ms,
        cost.provider_response_id,
        cost.error,
      ],
    );
  }

  return {
    run_id: payload.run.run_id,
    outputs: payload.outputs.length,
    costs: payload.costs.length,
  };
}

export async function getPromptBenchmarkData(): Promise<PromptBenchmarkData> {
  const fallback = getFallbackPromptBenchmarkData();

  if (!hasDatabase()) return fallback;

  try {
    await ensureSchema();
    const sql = getSql();

    const [runs, outputs, costs, decisionRows, totalsRows] = await Promise.all([
      sql.query(
        `
          select
            id,
            run_id,
            title,
            status,
            sheet_url,
            dashboard_url,
            started_at::text,
            finished_at::text,
            total_cost_usd::float8,
            total_provider_calls::int,
            source_payload,
            created_at::text,
            updated_at::text
          from prompt_benchmark_runs
          order by updated_at desc
          limit 20
        `,
        [],
      ),
      sql.query(
        `
          select
            id,
            result_id,
            run_id,
            case_id,
            case_label,
            case_type,
            expected_call_status,
            call_status,
            model,
            provider,
            call_mode,
            coaching_mode,
            output,
            ai_eval,
            classification_agreed,
            overall_quality::float8,
            total_cost_usd::float8,
            total_input_tokens::int,
            total_output_tokens::int,
            total_latency_ms::int,
            created_at::text,
            updated_at::text
          from prompt_benchmark_outputs
          order by updated_at desc
          limit 250
        `,
        [],
      ),
      sql.query(
        `
          select
            id,
            cost_id,
            run_id,
            result_id,
            case_id,
            model,
            provider,
            call_purpose,
            input_tokens::int,
            cache_creation_input_tokens::int,
            cache_read_input_tokens::int,
            output_tokens::int,
            input_cost_usd::float8,
            cache_write_cost_usd::float8,
            cache_read_cost_usd::float8,
            output_cost_usd::float8,
            total_cost_usd::float8,
            started_at::text,
            finished_at::text,
            latency_ms::int,
            provider_response_id,
            error,
            created_at::text
          from prompt_benchmark_costs
          order by created_at desc
          limit 250
        `,
        [],
      ),
      sql.query(
        `
          select
            model,
            call_mode,
            coaching_mode,
            count(*)::int as output_count,
            count(*) filter (where case_type = 'scored')::int as scored_cases,
            count(*) filter (where case_type <> 'scored')::int as gate_cases,
            avg(overall_quality)::float8 as avg_overall_quality,
            avg(case when classification_agreed is null then null when classification_agreed then 1 else 0 end)::float8 as classification_agreement_rate,
            avg(
              case
                when ai_eval = '{}'::jsonb then null
                else (
                  (
                    case when ai_eval #>> '{classification_correct,rating}' = 'pass' then 1 else 0 end +
                    case when ai_eval #>> '{fair_to_rep,rating}' = 'pass' then 1 else 0 end +
                    case when ai_eval #>> '{accurate_facts,rating}' = 'pass' then 1 else 0 end +
                    case when ai_eval #>> '{separation_maintained,rating}' = 'pass' then 1 else 0 end
                  )::float8 / 4
                )
              end
            )::float8 as pass_rate_core_criteria,
            sum(total_cost_usd)::float8 as total_cost_usd,
            avg(total_latency_ms)::float8 as avg_latency_ms,
            sum(total_input_tokens)::int as total_input_tokens,
            sum(total_output_tokens)::int as total_output_tokens
          from prompt_benchmark_outputs
          group by model, call_mode, coaching_mode
          order by avg_overall_quality desc nulls last, total_cost_usd asc
        `,
        [],
      ),
      sql.query(
        `
          select
            (select count(*)::int from prompt_benchmark_runs) as runs,
            (select count(*)::int from prompt_benchmark_outputs) as outputs,
            (select count(*)::int from prompt_benchmark_costs) as provider_calls,
            (select coalesce(sum(total_cost_usd), 0)::float8 from prompt_benchmark_costs) as total_cost_usd,
            (select avg(overall_quality)::float8 from prompt_benchmark_outputs) as avg_overall_quality
        `,
        [],
      ),
    ]);

    return {
      configured: true,
      generatedAt: new Date().toISOString(),
      runs: (runs as PromptBenchmarkRun[]).map(normalizePromptBenchmarkRun),
      outputs: (outputs as PromptBenchmarkOutput[]).map(normalizePromptBenchmarkOutput),
      costs: (costs as PromptBenchmarkCost[]).map(normalizePromptBenchmarkCost),
      decisionRows: (decisionRows as PromptBenchmarkDecisionRow[]).map(
        normalizePromptBenchmarkDecisionRow,
      ),
      totals: normalizePromptBenchmarkTotals(
        (totalsRows as Partial<PromptBenchmarkData["totals"]>[])[0],
      ),
    };
  } catch (error) {
    console.error(error);
    return {
      ...fallback,
      configured: true,
      error: "Prompt benchmark query failed. Check DATABASE_URL and the benchmark schema.",
    };
  }
}

export async function getPromptBenchmarkRunReview(
  runId: string,
): Promise<PromptBenchmarkRunReviewData> {
  const fallback = getFallbackPromptBenchmarkRunReviewData();

  if (!hasDatabase()) return fallback;

  try {
    await ensureSchema();
    const sql = getSql();

    const [runs, outputs, costs] = await Promise.all([
      sql.query(
        `
          select
            id,
            run_id,
            title,
            status,
            sheet_url,
            dashboard_url,
            started_at::text,
            finished_at::text,
            total_cost_usd::float8,
            total_provider_calls::int,
            source_payload,
            created_at::text,
            updated_at::text
          from prompt_benchmark_runs
          where run_id = $1
          limit 1
        `,
        [runId],
      ),
      sql.query(
        `
          select
            id,
            result_id,
            run_id,
            case_id,
            case_label,
            case_type,
            expected_call_status,
            call_status,
            model,
            provider,
            call_mode,
            coaching_mode,
            output,
            ai_eval,
            classification_agreed,
            overall_quality::float8,
            total_cost_usd::float8,
            total_input_tokens::int,
            total_output_tokens::int,
            total_latency_ms::int,
            created_at::text,
            updated_at::text
          from prompt_benchmark_outputs
          where run_id = $1
          order by case_label asc nulls last, case_id asc, call_mode asc, coaching_mode asc, model asc
        `,
        [runId],
      ),
      sql.query(
        `
          select
            id,
            cost_id,
            run_id,
            result_id,
            case_id,
            model,
            provider,
            call_purpose,
            input_tokens::int,
            cache_creation_input_tokens::int,
            cache_read_input_tokens::int,
            output_tokens::int,
            input_cost_usd::float8,
            cache_write_cost_usd::float8,
            cache_read_cost_usd::float8,
            output_cost_usd::float8,
            total_cost_usd::float8,
            started_at::text,
            finished_at::text,
            latency_ms::int,
            provider_response_id,
            error,
            created_at::text
          from prompt_benchmark_costs
          where run_id = $1
          order by case_id asc nulls last, result_id asc nulls last, created_at asc
        `,
        [runId],
      ),
    ]);

    return {
      configured: true,
      generatedAt: new Date().toISOString(),
      run: (runs as PromptBenchmarkRun[])[0]
        ? normalizePromptBenchmarkRun((runs as PromptBenchmarkRun[])[0])
        : null,
      outputs: (outputs as PromptBenchmarkOutput[]).map(normalizePromptBenchmarkOutput),
      costs: (costs as PromptBenchmarkCost[]).map(normalizePromptBenchmarkCost),
    };
  } catch (error) {
    console.error(error);
    return {
      ...fallback,
      configured: true,
      error: "Prompt benchmark review query failed. Check DATABASE_URL and the benchmark schema.",
    };
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

export async function ensureAskSalesFaqStorage() {
  if (!hasDatabase()) return false;
  await ensureSchema();
  return true;
}

export type AskSalesFaqRequestGuardState =
  | {
      state: "reserved";
    }
  | {
      state: "existing";
      status: "in_progress" | "completed" | "failed" | "rate_limited";
      response: AskSalesFaqResponse | null;
      assistantMessageId: string | null;
    };

export type AskSalesFaqRateLimitStatus =
  | {
      limited: false;
      userCount: number;
      userLimit: number;
      userWindowMinutes: number;
      globalCount: number;
      globalLimit: number;
      globalWindowSeconds: number;
    }
  | {
      limited: true;
      scope: "user" | "global";
      retryAfterSeconds: number;
      userCount: number;
      userLimit: number;
      userWindowMinutes: number;
      globalCount: number;
      globalLimit: number;
      globalWindowSeconds: number;
    };

export async function reserveAskSalesFaqRequest(payload: {
  id: string;
  viewerEmail: string;
  conversationId: string;
  clientRequestId: string;
}): Promise<AskSalesFaqRequestGuardState> {
  await ensureSchema();
  const sql = getSql();
  const inserted = (await sql.query(
    `
      insert into ask_sales_faq_request_guards (
        id,
        viewer_email,
        conversation_id,
        client_request_id,
        status,
        created_at,
        updated_at
      )
      values ($1, $2, $3, $4, 'in_progress', now(), now())
      on conflict (id) do nothing
      returning id
    `,
    [payload.id, payload.viewerEmail, payload.conversationId, payload.clientRequestId],
  )) as Array<{ id: string }>;

  if (inserted.length) return { state: "reserved" };

  const rows = (await sql.query(
    `
      select
        status,
        assistant_message_id,
        response_payload
      from ask_sales_faq_request_guards
      where id = $1
      limit 1
    `,
    [payload.id],
  )) as Array<{
    status: "in_progress" | "completed" | "failed" | "rate_limited";
    assistant_message_id: string | null;
    response_payload: unknown;
  }>;

  const existing = rows[0];
  if (!existing) return { state: "reserved" };

  return {
    state: "existing",
    status: existing.status,
    assistantMessageId: existing.assistant_message_id,
    response: normalizeAskSalesFaqResponsePayload(existing.response_payload),
  };
}

export async function checkAskSalesFaqRateLimit(viewerEmail: string): Promise<AskSalesFaqRateLimitStatus> {
  await ensureSchema();
  const sql = getSql();
  const userWindowMinutes = clampPositiveInt(process.env.FAQ_RATE_LIMIT_USER_WINDOW_MINUTES, 30, 5, 240);
  const userLimit = clampPositiveInt(process.env.FAQ_RATE_LIMIT_USER_MAX, 100, 10, 200);
  const globalWindowSeconds = clampPositiveInt(process.env.FAQ_RATE_LIMIT_GLOBAL_WINDOW_SECONDS, 60, 10, 600);
  const globalLimit = clampPositiveInt(process.env.FAQ_RATE_LIMIT_GLOBAL_MAX, 300, 50, 2000);
  const rows = (await sql.query(
    `
      select
        (
          select count(*)::int
          from ask_sales_faq_request_guards
          where viewer_email = $1
            and created_at >= now() - ($2::int * interval '1 minute')
            and status in ('in_progress', 'completed')
        ) as user_count,
        (
          select count(*)::int
          from ask_sales_faq_request_guards
          where created_at >= now() - ($3::int * interval '1 second')
            and status in ('in_progress', 'completed')
        ) as global_count
    `,
    [viewerEmail, userWindowMinutes, globalWindowSeconds],
  )) as Array<{ user_count: number; global_count: number }>;
  const userCount = Number(rows[0]?.user_count || 0);
  const globalCount = Number(rows[0]?.global_count || 0);

  if (userCount > userLimit) {
    return {
      limited: true,
      scope: "user",
      retryAfterSeconds: Math.max(60, Math.ceil((userWindowMinutes * 60) / 4)),
      userCount,
      userLimit,
      userWindowMinutes,
      globalCount,
      globalLimit,
      globalWindowSeconds,
    };
  }

  if (globalCount > globalLimit) {
    return {
      limited: true,
      scope: "global",
      retryAfterSeconds: Math.max(30, globalWindowSeconds),
      userCount,
      userLimit,
      userWindowMinutes,
      globalCount,
      globalLimit,
      globalWindowSeconds,
    };
  }

  return {
    limited: false,
    userCount,
    userLimit,
    userWindowMinutes,
    globalCount,
    globalLimit,
    globalWindowSeconds,
  };
}

export async function completeAskSalesFaqRequest(payload: {
  id: string;
  assistantMessageId: string;
  response: AskSalesFaqResponse;
}) {
  await ensureSchema();
  await getSql().query(
    `
      update ask_sales_faq_request_guards
      set status = 'completed',
          assistant_message_id = $2,
          response_payload = $3::jsonb,
          error_class = null,
          updated_at = now()
      where id = $1
    `,
    [payload.id, payload.assistantMessageId, JSON.stringify(payload.response)],
  );
}

export async function failAskSalesFaqRequest(payload: {
  id: string;
  status?: "failed" | "rate_limited";
  assistantMessageId?: string | null;
  response?: AskSalesFaqResponse | null;
  errorClass?: string | null;
}) {
  await ensureSchema();
  await getSql().query(
    `
      update ask_sales_faq_request_guards
      set status = $2,
          assistant_message_id = coalesce($3, assistant_message_id),
          response_payload = coalesce($4::jsonb, response_payload),
          error_class = $5,
          updated_at = now()
      where id = $1
    `,
    [
      payload.id,
      payload.status || "failed",
      payload.assistantMessageId || null,
      payload.response ? JSON.stringify(payload.response) : null,
      payload.errorClass || null,
    ],
  );
}

export async function saveAskSalesFaqExchange(payload: AskSalesFaqLogPayload) {
  await ensureSchema();
  const sql = getSql();
  const shouldCreateMiss = shouldCreateAskSalesFaqMiss({
    outcome: payload.outcome,
    needsRoute: payload.needsRoute,
    errorClass: payload.errorClass,
  });
  const answerPayload = payload.structuredAnswer
    ? {
        ...payload.structuredAnswer,
        ...(payload.runtimeMetadata ? { runtimeMetadata: payload.runtimeMetadata } : {}),
      }
    : null;

  await sql.query(
    `
      insert into ask_sales_faq_conversations (
        id,
        viewer_email,
        viewer_name,
        title,
        status,
        updated_at
      )
      values ($1, $2, $3, $4, 'active', now())
      on conflict (id) do update set
        viewer_email = excluded.viewer_email,
        viewer_name = excluded.viewer_name,
        title = coalesce(ask_sales_faq_conversations.title, excluded.title),
        updated_at = now()
    `,
    [payload.conversationId, payload.viewerEmail, payload.viewerName, payload.title],
  );

  await sql.query(
    `
      insert into ask_sales_faq_messages (
        id,
        conversation_id,
        viewer_email,
        role,
        content_redacted,
        redaction_summary,
        created_at
      )
      values ($1, $2, $3, 'user', $4, $5::jsonb, now())
      on conflict (id) do nothing
    `,
    [
      payload.userMessageId,
      payload.conversationId,
      payload.viewerEmail,
      payload.questionRedacted,
      JSON.stringify(payload.redactions),
    ],
  );

  await sql.query(
    `
      insert into ask_sales_faq_messages (
        id,
        conversation_id,
        viewer_email,
        role,
        content_redacted,
        redaction_summary,
        outcome,
        matched_article_id,
        source_label,
        source_last_reviewed,
        answer_payload,
        needs_route,
        route_reason,
        provider,
        model,
        latency_ms,
        error_class,
        created_at
      )
      values ($1, $2, $3, 'assistant', $4, $5::jsonb, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, now())
      on conflict (id) do nothing
    `,
    [
      payload.assistantMessageId,
      payload.conversationId,
      payload.viewerEmail,
      payload.answerRedacted,
      JSON.stringify(payload.redactions),
      payload.outcome,
      payload.matchedArticleId,
      payload.sourceLabel,
      payload.sourceLastReviewed,
      answerPayload ? JSON.stringify(answerPayload) : null,
      payload.needsRoute,
      payload.routeReason,
      payload.provider,
      payload.model,
      payload.latencyMs,
      payload.errorClass,
    ],
  );

  if (shouldCreateMiss) {
    await sql.query(
      `
        insert into ask_sales_faq_misses (
          id,
          message_id,
          conversation_id,
          viewer_email,
          question_redacted,
          decision,
          route_reason,
          status
        )
        values ($1, $2, $3, $4, $5, $6, $7, 'new')
        on conflict (id) do nothing
      `,
      [
        `miss_${payload.assistantMessageId}`,
        payload.assistantMessageId,
        payload.conversationId,
        payload.viewerEmail,
        payload.questionRedacted,
        payload.outcome,
        payload.routeReason,
      ],
    );
  }
}

export async function saveAskSalesFaqDiagnostic(payload: AskSalesFaqDiagnosticPayload) {
  if (!hasDatabase()) return;

  await ensureSchema();
  const sql = getSql();
  await sql.query(
    `
      insert into ask_sales_faq_diagnostics (
        id,
        conversation_id,
        viewer_email,
        viewer_name,
        event_type,
        detail,
        metadata,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7::jsonb, now())
      on conflict (id) do nothing
    `,
    [
      payload.id,
      payload.conversationId,
      payload.viewerEmail,
      payload.viewerName,
      payload.eventType,
      payload.detail,
      JSON.stringify(payload.metadata),
    ],
  );
}

export async function getAskSalesFaqConversations(
  viewerEmail: string,
  options: {
    limit?: number;
    cursor?: AskSalesFaqConversationCursor | null;
    query?: string;
  } = {},
): Promise<AskSalesFaqConversationPage> {
  if (!hasDatabase()) return { conversations: [], nextCursor: null };

  await ensureSchema();
  const sql = getSql();
  const limit = Math.max(1, Math.min(options.limit || 20, 50));
  const query = String(options.query || "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, 120);
  const params: unknown[] = [viewerEmail];
  const where = ["c.viewer_email = $1", "c.status = 'active'"];

  if (query) {
    params.push(query);
    const queryParam = `$${params.length}`;
    where.push(`(
      position(${queryParam} in lower(coalesce(c.title, ''))) > 0
      or exists (
        select 1
        from ask_sales_faq_messages search_message
        where search_message.conversation_id = c.id
          and position(${queryParam} in lower(search_message.content_redacted)) > 0
      )
    )`);
  }

  if (options.cursor) {
    params.push(options.cursor.updatedAt, options.cursor.id);
    const updatedAtParam = `$${params.length - 1}`;
    const idParam = `$${params.length}`;
    where.push(`(c.updated_at < ${updatedAtParam}::timestamptz or (c.updated_at = ${updatedAtParam}::timestamptz and c.id < ${idParam}))`);
  }

  params.push(limit + 1);
  const limitParam = `$${params.length}`;
  const conversations = (await sql.query(
    `
      select
        c.id,
        c.title,
        c.updated_at::text as updated_at
      from ask_sales_faq_conversations c
      where ${where.join("\n        and ")}
      order by c.updated_at desc, c.id desc
      limit ${limitParam}
    `,
    params,
  )) as Array<{ id: string; title: string | null; updated_at: string }>;

  const hasMore = conversations.length > limit;
  const pageConversations = hasMore ? conversations.slice(0, limit) : conversations;

  const result: AskSalesFaqConversationSummary[] = [];
  for (const conversation of pageConversations) {
    const messages = (await sql.query(
      `
        select
          m.id,
          m.role,
          m.content_redacted,
          m.outcome,
          m.source_label,
          m.source_last_reviewed,
          m.answer_payload,
          m.needs_route,
          m.route_reason,
          m.provider,
          m.model,
          m.created_at::text as created_at,
          feedback.rating as feedback_rating,
          feedback.comment as feedback_comment,
          feedback.created_at::text as feedback_created_at
        from ask_sales_faq_messages m
        left join lateral (
          select f.rating, f.comment, f.created_at
          from ask_sales_faq_feedback f
          where f.message_id = m.id
            and f.viewer_email = $2
          order by f.created_at desc
          limit 1
        ) feedback on true
        where m.conversation_id = $1
        order by m.created_at asc
      `,
      [conversation.id, viewerEmail],
    )) as Array<{
      id: string;
      role: "user" | "assistant" | "system_safe";
      content_redacted: string;
      outcome: string | null;
      source_label: string | null;
      source_last_reviewed: string | null;
      answer_payload: unknown;
      needs_route: boolean;
      route_reason: string | null;
      provider: string | null;
      model: string | null;
      created_at: string;
      feedback_rating: "up" | "down" | null;
      feedback_comment: string | null;
      feedback_created_at: string | null;
    }>;

    result.push({
      id: conversation.id,
      title: conversation.title,
      updatedAt: conversation.updated_at,
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        content: message.content_redacted,
        outcome: message.outcome,
        sourceLabel: message.source_label,
        sourceLastReviewed: message.source_last_reviewed,
        structuredAnswer: normalizeAskSalesFaqAnswerPayload(message.answer_payload),
        needsRoute: Boolean(message.needs_route),
        routeReason: message.route_reason,
        provider: message.provider,
        model: message.model,
        feedback:
          message.feedback_rating && message.feedback_created_at
            ? {
                rating: message.feedback_rating,
                comment: message.feedback_comment,
                createdAt: message.feedback_created_at,
              }
            : null,
        createdAt: message.created_at,
      })),
    });
  }

  const lastConversation = pageConversations.at(-1);
  return {
    conversations: result,
    nextCursor:
      hasMore && lastConversation
        ? encodeAskSalesFaqConversationCursor({ updatedAt: lastConversation.updated_at, id: lastConversation.id })
        : null,
  };
}

function normalizeAskSalesFaqAnswerPayload(value: unknown): AskSalesFaqStructuredAnswer | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<AskSalesFaqStructuredAnswer>;
  if (typeof payload.summary !== "string" || !Array.isArray(payload.sections)) return null;
  if (!["High", "Medium", "Low"].includes(String(payload.confidenceLabel))) return null;
  if (!["approved", "evidence", "mixed", "fallback", "conversation"].includes(String(payload.sourceMode))) return null;
  const confidenceScore = normalizeAskSalesFaqConfidenceScore(payload.confidenceScore);

  const sections = payload.sections
    .filter((section) => section && typeof section === "object" && typeof section.title === "string")
    .map((section) => {
      const candidate = section as AskSalesFaqStructuredAnswer["sections"][number];
      return {
        title: candidate.title,
        body: typeof candidate.body === "string" ? candidate.body : undefined,
        items: Array.isArray(candidate.items)
          ? candidate.items.filter((item): item is string => typeof item === "string")
          : undefined,
        tone: candidate.tone,
      };
    });

  return {
    summary: payload.summary,
    sections,
    confidenceLabel:
      confidenceScore === null
        ? (payload.confidenceLabel as AskSalesFaqStructuredAnswer["confidenceLabel"])
        : askSalesFaqConfidenceLabelFromScore(confidenceScore),
    confidenceScore: confidenceScore ?? 0,
    sourceMode: payload.sourceMode as AskSalesFaqStructuredAnswer["sourceMode"],
  };
}

function normalizeAskSalesFaqResponsePayload(value: unknown): AskSalesFaqResponse | null {
  if (!value || typeof value !== "object") return null;
  const payload = value as Partial<AskSalesFaqResponse>;
  const conversationId = typeof payload.conversationId === "string" ? payload.conversationId : "";
  const messageId = typeof payload.messageId === "string" ? payload.messageId : "";
  const answer = typeof payload.answer === "string" ? payload.answer : "";
  const outcome = typeof payload.outcome === "string" ? payload.outcome : "";

  if (!conversationId || !messageId || !answer || !outcome) return null;

  return {
    ok: Boolean(payload.ok),
    conversationId,
    messageId,
    answer,
    structuredAnswer: normalizeAskSalesFaqAnswerPayload(payload.structuredAnswer),
    outcome: payload.outcome as AskSalesFaqResponse["outcome"],
    source:
      payload.source && typeof payload.source === "object"
        ? {
            label: typeof payload.source.label === "string" ? payload.source.label : "Ask Sales FAQ",
            lastReviewed: typeof payload.source.lastReviewed === "string" ? payload.source.lastReviewed : "",
            approved: Boolean(payload.source.approved),
            sourceMode: payload.source.sourceMode,
            confidenceLabel: payload.source.confidenceLabel,
            confidenceScore:
              typeof payload.source.confidenceScore === "number" ? payload.source.confidenceScore : undefined,
            expandableDetails:
              typeof payload.source.expandableDetails === "string" ? payload.source.expandableDetails : undefined,
          }
        : null,
    model: typeof payload.model === "string" ? payload.model : null,
    provider:
      payload.provider === "deepseek" || payload.provider === "anthropic" || payload.provider === "mock"
        ? payload.provider
        : null,
    needsRoute: Boolean(payload.needsRoute),
    routeReason: typeof payload.routeReason === "string" ? payload.routeReason : null,
    redactions: Array.isArray(payload.redactions)
      ? payload.redactions.filter((item): item is string => typeof item === "string")
      : [],
    latencyMs: typeof payload.latencyMs === "number" ? payload.latencyMs : 0,
  };
}

function normalizeAskSalesFaqConfidenceScore(value: unknown) {
  const numericValue = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(numericValue)) return null;
  const scaledValue = numericValue >= 0 && numericValue <= 1 ? numericValue * 100 : numericValue;
  return Math.max(0, Math.min(100, Math.round(scaledValue)));
}

function askSalesFaqConfidenceLabelFromScore(score: number): AskSalesFaqStructuredAnswer["confidenceLabel"] {
  if (score >= 80) return "High";
  if (score >= 50) return "Medium";
  return "Low";
}

function clampPositiveInt(value: string | undefined, fallback: number, min: number, max: number) {
  const parsed = Number.parseInt(value || "", 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(min, Math.min(max, parsed));
}

export async function renameAskSalesFaqConversation(payload: {
  conversationId: string;
  viewerEmail: string;
  title: string;
}) {
  if (!hasDatabase()) return false;

  await ensureSchema();
  const rows = (await getSql().query(
    `
      update ask_sales_faq_conversations
      set title = $3,
          updated_at = now()
      where id = $1
        and viewer_email = $2
        and status = 'active'
      returning id
    `,
    [payload.conversationId, payload.viewerEmail, payload.title],
  )) as Array<{ id: string }>;

  return rows.length > 0;
}

export async function deleteAskSalesFaqConversationForViewer(payload: {
  conversationId: string;
  viewerEmail: string;
}) {
  if (!hasDatabase()) return false;

  await ensureSchema();
  const rows = (await getSql().query(
    `
      update ask_sales_faq_conversations
      set status = 'deleted',
          deleted_at = now(),
          deleted_by = $2,
          updated_at = now()
      where id = $1
        and viewer_email = $2
        and status = 'active'
      returning id
    `,
    [payload.conversationId, payload.viewerEmail],
  )) as Array<{ id: string }>;

  return rows.length > 0;
}

export async function saveAskSalesFaqFeedback(payload: AskSalesFaqFeedbackPayload) {
  await ensureSchema();
  await getSql().query(
    `
      insert into ask_sales_faq_feedback (
        id,
        message_id,
        conversation_id,
        viewer_email,
        rating,
        comment
      )
      values ($1, $2, $3, $4, $5, $6)
      on conflict (id) do update set
        rating = excluded.rating,
        comment = excluded.comment
    `,
    [
      payload.id,
      payload.messageId,
      payload.conversationId,
      payload.viewerEmail,
      payload.rating,
      payload.comment,
    ],
  );
}

export async function getAskSalesFaqFeedbackContext(payload: {
  messageId: string;
  conversationId: string;
  viewerEmail: string;
  rating: "up" | "down";
  comment: string | null;
}): Promise<AskSalesFaqFeedbackContext | null> {
  if (!hasDatabase()) return null;

  await ensureSchema();
  const sql = getSql();
  const rows = (await sql.query(
    `
      with assistant_message as (
        select
          id,
          conversation_id,
          viewer_email,
          content_redacted,
          outcome,
          source_label,
          source_last_reviewed,
          needs_route,
          route_reason,
          provider,
          model,
          created_at
        from ask_sales_faq_messages
        where id = $1
          and conversation_id = $2
          and viewer_email = $3
          and role = 'assistant'
        limit 1
      ),
      previous_user_message as (
        select m.content_redacted
        from ask_sales_faq_messages m
        join assistant_message a on a.conversation_id = m.conversation_id
        where m.role = 'user'
          and m.created_at <= a.created_at
        order by m.created_at desc
        limit 1
      )
      select
        a.id as message_id,
        a.conversation_id,
        c.title as conversation_title,
        a.viewer_email,
        (select content_redacted from previous_user_message) as question,
        a.content_redacted as answer,
        a.outcome,
        a.source_label,
        a.source_last_reviewed,
        a.needs_route,
        a.route_reason,
        a.provider,
        a.model,
        a.created_at::text as created_at
      from assistant_message a
      join ask_sales_faq_conversations c on c.id = a.conversation_id
      limit 1
    `,
    [payload.messageId, payload.conversationId, payload.viewerEmail],
  )) as Array<{
    message_id: string;
    conversation_id: string;
    conversation_title: string | null;
    viewer_email: string;
    question: string | null;
    answer: string | null;
    outcome: string | null;
    source_label: string | null;
    source_last_reviewed: string | null;
    needs_route: boolean | null;
    route_reason: string | null;
    provider: string | null;
    model: string | null;
    created_at: string | null;
  }>;

  const row = rows[0];
  if (!row) return null;

  return {
    messageId: row.message_id,
    conversationId: row.conversation_id,
    conversationTitle: row.conversation_title,
    viewerEmail: row.viewer_email,
    rating: payload.rating,
    comment: payload.comment,
    question: row.question,
    answer: row.answer,
    outcome: row.outcome,
    sourceLabel: row.source_label,
    sourceLastReviewed: row.source_last_reviewed,
    needsRoute: Boolean(row.needs_route),
    routeReason: row.route_reason,
    provider: row.provider,
    model: row.model,
    createdAt: row.created_at,
  };
}

export async function getAskSalesFaqAdminOverview(
  limit = 20,
  windowDays = 7,
): Promise<AskSalesFaqAdminOverview> {
  const empty: AskSalesFaqAdminOverview = {
    generatedAt: new Date().toISOString(),
    windowDays,
    summary: {
      questions: 0,
      groundedAnswers: 0,
      conversationReplies: 0,
      routes: 0,
      failures: 0,
      reviewItems: 0,
      feedbackCount: 0,
      thumbsDown: 0,
      medianLatencyMs: 0,
      p95LatencyMs: 0,
      deepseekAnswers: 0,
      anthropicAnswers: 0,
    },
    daily: [],
    outcomes: [],
    recentMisses: [],
    recentFeedback: [],
    recentAnswers: [],
  };

  if (!hasDatabase()) return empty;

  await ensureSchema();
  const sql = getSql();
  const normalizedLimit = Math.max(5, Math.min(limit, 50));
  const normalizedDays = [7, 30, 90].includes(windowDays) ? windowDays : 7;

  const [metricRows, dailyRows, outcomeRows, recentReviewRows, recentFeedback, recentAnswers] = await Promise.all([
    sql.query(
      `
        with assistant as (
          select *
          from ask_sales_faq_messages
          where role = 'assistant'
            and created_at >= now() - ($1::int * interval '1 day')
        ), feedback as (
          select *
          from ask_sales_faq_feedback
          where created_at >= now() - ($1::int * interval '1 day')
        )
        select
          count(*)::int as questions,
          count(*) filter (where outcome in ('answer_from_approved_article', 'answer_from_evidence'))::int as grounded_answers,
          count(*) filter (where outcome = 'conversation_reply')::int as conversation_replies,
          count(*) filter (
            where needs_route
               or outcome in ('route_from_approved_article', 'route_from_evidence', 'low_confidence_route', 'abstain_unapproved', 'admin_only')
          )::int as routes,
          count(*) filter (
            where error_class is not null
               or outcome in ('safe_fallback', 'rate_limited', 'duplicate_in_progress', 'feature_disabled', 'auth_blocked', 'validation_error')
          )::int as failures,
          count(*) filter (
            where error_class is not null
               or needs_route
               or outcome in ('route_from_approved_article', 'route_from_evidence', 'low_confidence_route', 'abstain_unapproved', 'admin_only', 'safe_fallback', 'rate_limited', 'duplicate_in_progress', 'feature_disabled', 'auth_blocked', 'validation_error')
               or exists (select 1 from feedback f where f.message_id = assistant.id and f.rating = 'down')
          )::int as review_items,
          (select count(*)::int from feedback) as feedback_count,
          (select count(*)::int from feedback where rating = 'down') as thumbs_down,
          coalesce(percentile_cont(0.5) within group (order by latency_ms) filter (where latency_ms is not null), 0)::float as median_latency_ms,
          coalesce(percentile_cont(0.95) within group (order by latency_ms) filter (where latency_ms is not null), 0)::float as p95_latency_ms,
          count(*) filter (where provider = 'deepseek')::int as deepseek_answers,
          count(*) filter (where provider = 'anthropic')::int as anthropic_answers
        from assistant
      `,
      [normalizedDays],
    ),
    sql.query(
      `
        with days as (
          select generate_series(
            current_date - (($1::int - 1) * interval '1 day'),
            current_date,
            interval '1 day'
          )::date as day
        )
        select
          days.day::text as day,
          count(messages.id)::int as questions,
          count(messages.id) filter (where messages.outcome in ('answer_from_approved_article', 'answer_from_evidence'))::int as grounded_answers,
          count(messages.id) filter (
            where messages.needs_route
               or messages.outcome in ('route_from_approved_article', 'route_from_evidence', 'low_confidence_route', 'abstain_unapproved', 'admin_only')
          )::int as routes,
          count(messages.id) filter (
            where messages.error_class is not null
               or messages.outcome in ('safe_fallback', 'rate_limited', 'duplicate_in_progress', 'feature_disabled', 'auth_blocked', 'validation_error')
          )::int as failures
        from days
        left join ask_sales_faq_messages messages
          on messages.role = 'assistant'
         and messages.created_at >= days.day
         and messages.created_at < days.day + interval '1 day'
        group by days.day
        order by days.day asc
      `,
      [normalizedDays],
    ),
    sql.query(
      `
        select coalesce(outcome, 'unknown') as outcome, count(*)::int as count
        from ask_sales_faq_messages
        where role = 'assistant'
          and created_at >= now() - ($1::int * interval '1 day')
        group by coalesce(outcome, 'unknown')
        order by count desc, outcome asc
      `,
      [normalizedDays],
    ),
    sql.query(
      `
        select
          a.id,
          a.conversation_id,
          a.viewer_email,
          a.content_redacted as answer,
          a.outcome,
          a.source_label,
          a.needs_route,
          a.route_reason,
          a.provider,
          a.model,
          a.latency_ms,
          a.error_class,
          a.answer_payload->>'sourceMode' as source_mode,
          a.answer_payload #>> '{runtimeMetadata,pipelineVersion}' as pipeline_version,
          a.answer_payload #>> '{runtimeMetadata,knowledgeVersion}' as knowledge_version,
          a.answer_payload #>> '{runtimeMetadata,v3,validation,verdict}' as validation_verdict,
          jsonb_array_length(coalesce(a.answer_payload #> '{runtimeMetadata,v3,selection,selectedPolicyIds}', '[]'::jsonb)) as selected_policy_count,
          a.created_at::text as created_at,
          f.rating,
          f.comment,
          (
            select u.content_redacted
            from ask_sales_faq_messages u
            where u.conversation_id = a.conversation_id
              and u.role = 'user'
              and u.created_at <= a.created_at
            order by u.created_at desc
            limit 1
          ) as question
        from ask_sales_faq_messages a
        left join lateral (
          select rating, comment
          from ask_sales_faq_feedback
          where message_id = a.id
          order by created_at desc
          limit 1
        ) f on true
        where a.role = 'assistant'
          and (
            a.error_class is not null
            or a.needs_route
            or a.outcome in ('route_from_approved_article', 'route_from_evidence', 'low_confidence_route', 'abstain_unapproved', 'admin_only', 'safe_fallback', 'rate_limited', 'duplicate_in_progress', 'feature_disabled', 'auth_blocked', 'validation_error')
            or f.rating = 'down'
          )
        order by a.created_at desc
        limit $1
      `,
      [normalizedLimit],
    ),
    sql.query(
      `
        with feedback as (
          select *
          from ask_sales_faq_feedback
          order by created_at desc
          limit $1
        )
        select
          f.id,
          f.message_id,
          f.conversation_id,
          f.viewer_email,
          f.rating,
          f.comment,
          f.created_at::text as created_at,
          a.content_redacted as answer,
          a.outcome,
          a.source_label,
          a.needs_route,
          a.route_reason,
          a.provider,
          a.model,
          a.latency_ms,
          a.error_class,
          (
            select u.content_redacted
            from ask_sales_faq_messages u
            where u.conversation_id = f.conversation_id
              and u.role = 'user'
              and u.created_at <= a.created_at
            order by u.created_at desc
            limit 1
          ) as question
        from feedback f
        left join ask_sales_faq_messages a on a.id = f.message_id
        order by f.created_at desc
      `,
      [normalizedLimit],
    ),
    sql.query(
      `
        with assistant as (
          select *
          from ask_sales_faq_messages
          where role = 'assistant'
          order by created_at desc
          limit $1
        )
        select
          a.id,
          a.conversation_id,
          a.viewer_email,
          a.content_redacted as answer,
          a.outcome,
          a.source_label,
          a.needs_route,
          a.route_reason,
          a.provider,
          a.model,
          a.latency_ms,
          a.error_class,
          a.answer_payload->>'confidenceLabel' as confidence_label,
          case
            when (a.answer_payload->>'confidenceScore') ~ '^[0-9]+(\\.[0-9]+)?$'
            then (a.answer_payload->>'confidenceScore')::float
            else null
          end as confidence_score,
          a.answer_payload->>'sourceMode' as source_mode,
          a.answer_payload #>> '{runtimeMetadata,pipelineVersion}' as pipeline_version,
          a.answer_payload #>> '{runtimeMetadata,knowledgeVersion}' as knowledge_version,
          a.answer_payload #>> '{runtimeMetadata,v3,validation,verdict}' as validation_verdict,
          jsonb_array_length(coalesce(a.answer_payload #> '{runtimeMetadata,v3,selection,selectedPolicyIds}', '[]'::jsonb)) as selected_policy_count,
          a.created_at::text as created_at,
          (
            select u.content_redacted
            from ask_sales_faq_messages u
            where u.conversation_id = a.conversation_id
              and u.role = 'user'
              and u.created_at <= a.created_at
            order by u.created_at desc
            limit 1
          ) as question
        from assistant a
        order by a.created_at desc
      `,
      [normalizedLimit],
    ),
  ]);

  type AdminRow = {
    id: string;
    conversation_id: string;
    viewer_email: string;
    created_at: string;
    question: string | null;
    answer: string | null;
    outcome: string | null;
    source_label: string | null;
    needs_route: boolean | null;
    route_reason: string | null;
    provider: string | null;
    model: string | null;
    latency_ms: number | null;
    error_class: string | null;
    source_mode: string | null;
    rating: "up" | "down";
    comment: string | null;
    confidence_label: string | null;
    confidence_score: number | null;
    pipeline_version: string | null;
    knowledge_version: string | null;
    validation_verdict: string | null;
    selected_policy_count: number | null;
  };

  const metricRow = (metricRows as Array<Record<string, number>>)[0] || {};

  const mapAdminRow = (item: AdminRow): AskSalesFaqAdminLogItem => {
    const confidenceScore = normalizeAskSalesFaqConfidenceScore(item.confidence_score);
    const classification = classifyAskSalesFaqReview({
      rating: item.rating,
      outcome: item.outcome,
      needsRoute: Boolean(item.needs_route),
      errorClass: item.error_class,
    });

    return {
      id: item.id,
      createdAt: item.created_at,
      viewerEmail: item.viewer_email,
      question: item.question,
      answer: item.answer,
      outcome: item.outcome,
      sourceLabel: item.source_label,
      sourceMode: item.source_mode,
      needsRoute: Boolean(item.needs_route),
      routeReason: item.route_reason,
      provider: item.provider,
      model: item.model,
      rating: item.rating,
      comment: item.comment,
      confidenceLabel: confidenceScore === null ? item.confidence_label : askSalesFaqConfidenceLabelFromScore(confidenceScore),
      confidenceScore,
      reviewCategory: classification.category,
      reviewAction: classification.action,
      latencyMs: Number(item.latency_ms || 0),
      errorClass: item.error_class,
      pipelineVersion: item.pipeline_version,
      knowledgeVersion: item.knowledge_version,
      validationVerdict: item.validation_verdict,
      selectedPolicyCount: Number(item.selected_policy_count || 0),
    };
  };

  return {
    generatedAt: new Date().toISOString(),
    windowDays: normalizedDays,
    summary: {
      questions: Number(metricRow.questions || 0),
      groundedAnswers: Number(metricRow.grounded_answers || 0),
      conversationReplies: Number(metricRow.conversation_replies || 0),
      routes: Number(metricRow.routes || 0),
      failures: Number(metricRow.failures || 0),
      reviewItems: Number(metricRow.review_items || 0),
      feedbackCount: Number(metricRow.feedback_count || 0),
      thumbsDown: Number(metricRow.thumbs_down || 0),
      medianLatencyMs: Math.round(Number(metricRow.median_latency_ms || 0)),
      p95LatencyMs: Math.round(Number(metricRow.p95_latency_ms || 0)),
      deepseekAnswers: Number(metricRow.deepseek_answers || 0),
      anthropicAnswers: Number(metricRow.anthropic_answers || 0),
    },
    daily: (dailyRows as Array<Record<string, string | number>>).map((row) => ({
      day: String(row.day),
      questions: Number(row.questions || 0),
      groundedAnswers: Number(row.grounded_answers || 0),
      routes: Number(row.routes || 0),
      failures: Number(row.failures || 0),
    })),
    outcomes: (outcomeRows as Array<{ outcome: string; count: number }>).map((row) => ({
      outcome: row.outcome,
      count: Number(row.count || 0),
    })),
    recentMisses: (recentReviewRows as AdminRow[]).map(mapAdminRow),
    recentFeedback: (recentFeedback as AdminRow[]).map(mapAdminRow),
    recentAnswers: (recentAnswers as AdminRow[]).map(mapAdminRow),
  };
}

export async function getAskSalesFaqUsageOverview(windowDays = 30): Promise<AskSalesFaqUsageOverview> {
  const normalizedDays = [7, 30, 90].includes(windowDays) ? windowDays : 30;
  const empty: AskSalesFaqUsageOverview = {
    generatedAt: new Date().toISOString(),
    windowDays: normalizedDays,
    summary: {
      knownUsers: 0,
      activatedUsers: 0,
      adoptionRate: 0,
      active7d: 0,
      active30d: 0,
      returningUsers: 0,
      neverUsed: 0,
      questionsInWindow: 0,
      averageQuestionsPerActiveUser: 0,
    },
    daily: [],
    users: [],
  };

  if (!hasDatabase()) return empty;

  await ensureSchema();
  const sql = getSql();
  const excludedEmails = (process.env.ASK_SALES_FAQ_ADMIN_EMAILS || "")
    .split(",")
    .map((email) => normalizeAuthEmail(email))
    .filter((email): email is string => Boolean(email));

  const [userRows, dailyRows] = await Promise.all([
    sql.query(
      `
        with identity_sources as (
          select lower(viewer_email) as email, max(viewer_name) as name, 'dashboard' as source
          from dashboard_usage_events
          where viewer_email is not null
          group by lower(viewer_email)
          union all
          select lower(rep_email) as email, max(rep_name) as name, 'rep_roster' as source
          from performance_calls
          where rep_email is not null and trim(rep_email) <> ''
          group by lower(rep_email)
          union all
          select lower(viewer_email) as email, max(viewer_name) as name, 'ask_sales' as source
          from ask_sales_faq_conversations
          group by lower(viewer_email)
        ), known_users as (
          select
            email,
            max(name) filter (where name is not null and trim(name) <> '') as name,
            bool_or(source = 'dashboard') as known_from_dashboard,
            bool_or(source = 'rep_roster') as known_from_rep_roster
          from identity_sources
          where not (email = any($2::text[]))
          group by email
        ), activity as (
          select
            lower(viewer_email) as email,
            min(created_at) filter (where role = 'user')::text as first_asked_at,
            max(created_at) filter (where role = 'user')::text as last_asked_at,
            count(distinct created_at::date) filter (where role = 'user')::int as active_days,
            count(distinct conversation_id) filter (where role = 'user')::int as conversations,
            count(*) filter (where role = 'user')::int as questions_all_time,
            count(*) filter (
              where role = 'user'
                and created_at >= now() - ($1::int * interval '1 day')
            )::int as questions_in_window,
            count(*) filter (
              where role = 'assistant'
                and created_at >= now() - ($1::int * interval '1 day')
                and outcome in ('answer_from_approved_article', 'answer_from_evidence')
            )::int as grounded_answers_in_window,
            count(*) filter (
              where role = 'assistant'
                and created_at >= now() - ($1::int * interval '1 day')
                and (
                  needs_route
                  or outcome in ('route_from_approved_article', 'route_from_evidence', 'low_confidence_route', 'abstain_unapproved', 'admin_only')
                )
            )::int as routes_in_window,
            count(*) filter (
              where role = 'assistant'
                and created_at >= now() - ($1::int * interval '1 day')
                and (
                  error_class is not null
                  or outcome in ('safe_fallback', 'rate_limited', 'duplicate_in_progress', 'feature_disabled', 'auth_blocked', 'validation_error')
                )
            )::int as failures_in_window,
            coalesce(avg(latency_ms) filter (
              where role = 'assistant'
                and created_at >= now() - ($1::int * interval '1 day')
                and latency_ms is not null
            ), 0)::float as average_latency_ms
          from ask_sales_faq_messages
          where not (lower(viewer_email) = any($2::text[]))
          group by lower(viewer_email)
        )
        select
          known.email as viewer_email,
          known.name as viewer_name,
          known.known_from_dashboard,
          known.known_from_rep_roster,
          activity.first_asked_at,
          activity.last_asked_at,
          coalesce(activity.active_days, 0)::int as active_days,
          coalesce(activity.conversations, 0)::int as conversations,
          coalesce(activity.questions_all_time, 0)::int as questions_all_time,
          coalesce(activity.questions_in_window, 0)::int as questions_in_window,
          coalesce(activity.grounded_answers_in_window, 0)::int as grounded_answers_in_window,
          coalesce(activity.routes_in_window, 0)::int as routes_in_window,
          coalesce(activity.failures_in_window, 0)::int as failures_in_window,
          coalesce(activity.average_latency_ms, 0)::float as average_latency_ms
        from known_users known
        left join activity on activity.email = known.email
        order by activity.last_asked_at desc nulls last, known.name asc nulls last, known.email asc
      `,
      [normalizedDays, excludedEmails],
    ),
    sql.query(
      `
        with days as (
          select generate_series(
            current_date - (($1::int - 1) * interval '1 day'),
            current_date,
            interval '1 day'
          )::date as day
        )
        select
          days.day::text as day,
          count(messages.id)::int as questions,
          count(distinct lower(messages.viewer_email))::int as active_users
        from days
        left join ask_sales_faq_messages messages
          on messages.role = 'user'
         and messages.created_at >= days.day
         and messages.created_at < days.day + interval '1 day'
         and not (lower(messages.viewer_email) = any($2::text[]))
        group by days.day
        order by days.day asc
      `,
      [normalizedDays, excludedEmails],
    ),
  ]);

  const now = Date.now();
  const users = (userRows as Array<Record<string, string | number | boolean | null>>).map((row) => {
    const lastAskedAt = row.last_asked_at ? String(row.last_asked_at) : null;
    const lastAskedMs = lastAskedAt ? new Date(lastAskedAt).getTime() : 0;
    const questionsAllTime = Number(row.questions_all_time || 0);
    const activeDays = Number(row.active_days || 0);
    const daysSinceUse = lastAskedMs ? (now - lastAskedMs) / 86_400_000 : Number.POSITIVE_INFINITY;
    const status = !questionsAllTime
      ? "never_used"
      : daysSinceUse > 30
        ? "dormant"
        : activeDays === 1
          ? "new"
          : daysSinceUse <= 7
            ? "active"
            : "returning";

    return {
      viewerEmail: String(row.viewer_email),
      viewerName: row.viewer_name ? String(row.viewer_name) : null,
      repReviewKey: buildAskSalesFaqRepReviewKey(String(row.viewer_email)),
      knownFromDashboard: Boolean(row.known_from_dashboard),
      knownFromRepRoster: Boolean(row.known_from_rep_roster),
      firstAskedAt: row.first_asked_at ? String(row.first_asked_at) : null,
      lastAskedAt,
      activeDays,
      conversations: Number(row.conversations || 0),
      questionsAllTime,
      questionsInWindow: Number(row.questions_in_window || 0),
      groundedAnswersInWindow: Number(row.grounded_answers_in_window || 0),
      routesInWindow: Number(row.routes_in_window || 0),
      failuresInWindow: Number(row.failures_in_window || 0),
      averageLatencyMs: Math.round(Number(row.average_latency_ms || 0)),
      status,
    } as AskSalesFaqUsageOverview["users"][number];
  });

  const activatedUsers = users.filter((user) => user.questionsAllTime > 0).length;
  const active7d = users.filter((user) => user.lastAskedAt && now - new Date(user.lastAskedAt).getTime() <= 7 * 86_400_000).length;
  const active30d = users.filter((user) => user.lastAskedAt && now - new Date(user.lastAskedAt).getTime() <= 30 * 86_400_000).length;
  const returningUsers = users.filter((user) => user.activeDays >= 2).length;
  const questionsInWindow = users.reduce((total, user) => total + user.questionsInWindow, 0);
  const activeInWindow = users.filter((user) => user.questionsInWindow > 0).length;

  return {
    generatedAt: new Date().toISOString(),
    windowDays: normalizedDays,
    summary: {
      knownUsers: users.length,
      activatedUsers,
      adoptionRate: percentOf(activatedUsers, users.length),
      active7d,
      active30d,
      returningUsers,
      neverUsed: users.length - activatedUsers,
      questionsInWindow,
      averageQuestionsPerActiveUser: activeInWindow ? Math.round((questionsInWindow / activeInWindow) * 10) / 10 : 0,
    },
    daily: (dailyRows as Array<Record<string, string | number>>).map((row) => ({
      day: String(row.day),
      questions: Number(row.questions || 0),
      activeUsers: Number(row.active_users || 0),
    })),
    users,
  };
}

export async function getAskSalesFaqRepHistory(
  viewerEmail: string,
  options: {
    viewerName?: string | null;
    windowDays?: 7 | 30 | 90 | null;
    cursor?: AskSalesFaqRepHistoryCursor | null;
    limit?: number;
  } = {},
): Promise<AskSalesFaqRepHistoryPage | null> {
  const normalizedEmail = normalizeAuthEmail(viewerEmail);
  if (!normalizedEmail) return null;

  const windowDays = options.windowDays === 7 || options.windowDays === 30 || options.windowDays === 90
    ? options.windowDays
    : null;
  const normalizedLimit = Math.max(10, Math.min(options.limit || 25, 50));
  const empty: AskSalesFaqRepHistoryPage = {
    generatedAt: new Date().toISOString(),
    windowDays,
    rep: {
      viewerEmail: normalizedEmail,
      viewerName: options.viewerName || null,
    },
    summary: {
      questions: 0,
      groundedAnswers: 0,
      routes: 0,
      failures: 0,
      feedbackCount: 0,
      thumbsDown: 0,
    },
    items: [],
    nextCursor: null,
  };

  if (!hasDatabase()) return empty;

  await ensureSchema();
  const sql = getSql();
  const cursorCreatedAt = options.cursor?.createdAt || null;
  const cursorId = options.cursor?.id || null;

  const [summaryRows, historyRows] = await Promise.all([
    sql.query(
      `
        with assistant as (
          select *
          from ask_sales_faq_messages
          where role = 'assistant'
            and lower(viewer_email) = $1
            and ($2::int is null or created_at >= now() - ($2::int * interval '1 day'))
        )
        select
          count(*)::int as questions,
          count(*) filter (where outcome in ('answer_from_approved_article', 'answer_from_evidence'))::int as grounded_answers,
          count(*) filter (
            where needs_route
               or outcome in ('route_from_approved_article', 'route_from_evidence', 'low_confidence_route', 'abstain_unapproved', 'admin_only')
          )::int as routes,
          count(*) filter (
            where error_class is not null
               or outcome in ('safe_fallback', 'rate_limited', 'duplicate_in_progress', 'feature_disabled', 'auth_blocked', 'validation_error')
          )::int as failures,
          (select count(*)::int from ask_sales_faq_feedback f where f.message_id in (select id from assistant)) as feedback_count,
          (select count(*)::int from ask_sales_faq_feedback f where f.message_id in (select id from assistant) and f.rating = 'down') as thumbs_down
        from assistant
      `,
      [normalizedEmail, windowDays],
    ),
    sql.query(
      `
        select
          a.id,
          a.conversation_id,
          c.title as conversation_title,
          c.status as conversation_status,
          a.created_at::text as created_at,
          a.content_redacted as answer,
          a.outcome,
          a.source_label,
          a.source_last_reviewed,
          a.needs_route,
          a.route_reason,
          a.provider,
          a.model,
          a.latency_ms,
          a.error_class,
          a.answer_payload->>'confidenceLabel' as confidence_label,
          case
            when (a.answer_payload->>'confidenceScore') ~ '^[0-9]+(\\.[0-9]+)?$'
            then (a.answer_payload->>'confidenceScore')::float
            else null
          end as confidence_score,
          a.answer_payload->>'sourceMode' as source_mode,
          a.answer_payload #>> '{runtimeMetadata,pipelineVersion}' as pipeline_version,
          a.answer_payload #>> '{runtimeMetadata,knowledgeVersion}' as knowledge_version,
          a.answer_payload #>> '{runtimeMetadata,v3,validation,verdict}' as validation_verdict,
          jsonb_array_length(coalesce(a.answer_payload #> '{runtimeMetadata,v3,selection,selectedPolicyIds}', '[]'::jsonb)) as selected_policy_count,
          a.answer_payload #> '{runtimeMetadata,v3,stageTimings}' as stage_timings,
          question.content_redacted as question,
          feedback.rating,
          feedback.comment,
          feedback.created_at::text as feedback_created_at
        from ask_sales_faq_messages a
        join ask_sales_faq_conversations c on c.id = a.conversation_id
        left join lateral (
          select u.content_redacted
          from ask_sales_faq_messages u
          where u.conversation_id = a.conversation_id
            and lower(u.viewer_email) = $1
            and u.role = 'user'
            and u.created_at <= a.created_at
          order by u.created_at desc, u.id desc
          limit 1
        ) question on true
        left join lateral (
          select f.rating, f.comment, f.created_at
          from ask_sales_faq_feedback f
          where f.message_id = a.id
          order by f.created_at desc
          limit 1
        ) feedback on true
        where a.role = 'assistant'
          and lower(a.viewer_email) = $1
          and ($2::int is null or a.created_at >= now() - ($2::int * interval '1 day'))
          and (
            $3::timestamptz is null
            or (a.created_at, a.id) < ($3::timestamptz, $4::text)
          )
        order by a.created_at desc, a.id desc
        limit $5
      `,
      [normalizedEmail, windowDays, cursorCreatedAt, cursorId, normalizedLimit + 1],
    ),
  ]);

  type HistoryRow = {
    id: string;
    conversation_id: string;
    conversation_title: string | null;
    conversation_status: "active" | "archived" | "deleted";
    created_at: string;
    question: string | null;
    answer: string;
    outcome: string | null;
    source_label: string | null;
    source_last_reviewed: string | null;
    source_mode: string | null;
    confidence_label: string | null;
    confidence_score: number | null;
    needs_route: boolean | null;
    route_reason: string | null;
    provider: string | null;
    model: string | null;
    latency_ms: number | null;
    error_class: string | null;
    pipeline_version: string | null;
    knowledge_version: string | null;
    validation_verdict: string | null;
    selected_policy_count: number | null;
    stage_timings: unknown;
    rating: "up" | "down" | null;
    comment: string | null;
    feedback_created_at: string | null;
  };

  const rows = historyRows as HistoryRow[];
  const visibleRows = rows.slice(0, normalizedLimit);
  const metricRow = (summaryRows as Array<Record<string, number>>)[0] || {};
  const lastVisible = visibleRows.at(-1);

  return {
    generatedAt: new Date().toISOString(),
    windowDays,
    rep: empty.rep,
    summary: {
      questions: Number(metricRow.questions || 0),
      groundedAnswers: Number(metricRow.grounded_answers || 0),
      routes: Number(metricRow.routes || 0),
      failures: Number(metricRow.failures || 0),
      feedbackCount: Number(metricRow.feedback_count || 0),
      thumbsDown: Number(metricRow.thumbs_down || 0),
    },
    items: visibleRows.map((row) => {
      const confidenceScore = normalizeAskSalesFaqConfidenceScore(row.confidence_score);
      const stageTimings = normalizeAskSalesFaqStageTimings(row.stage_timings);

      return {
        id: row.id,
        conversationId: row.conversation_id,
        conversationTitle: row.conversation_title,
        conversationStatus: row.conversation_status,
        createdAt: row.created_at,
        question: row.question,
        answer: row.answer,
        outcome: row.outcome,
        sourceLabel: row.source_label,
        sourceLastReviewed: row.source_last_reviewed,
        sourceMode: row.source_mode,
        confidenceLabel: confidenceScore === null ? row.confidence_label : askSalesFaqConfidenceLabelFromScore(confidenceScore),
        confidenceScore,
        needsRoute: Boolean(row.needs_route),
        routeReason: row.route_reason,
        provider: row.provider,
        model: row.model,
        latencyMs: Number(row.latency_ms || 0),
        errorClass: row.error_class,
        pipelineVersion: row.pipeline_version,
        knowledgeVersion: row.knowledge_version,
        validationVerdict: row.validation_verdict,
        selectedPolicyCount: Number(row.selected_policy_count || 0),
        stageTimings,
        feedback: row.rating && row.feedback_created_at
          ? { rating: row.rating, comment: row.comment, createdAt: row.feedback_created_at }
          : null,
      };
    }),
    nextCursor: rows.length > normalizedLimit && lastVisible
      ? encodeAskSalesFaqRepHistoryCursor({ createdAt: lastVisible.created_at, id: lastVisible.id })
      : null,
  };
}

function normalizeAskSalesFaqStageTimings(value: unknown): Record<string, number> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const entries = Object.entries(value)
    .map(([key, timing]) => [key, Number(timing)] as const)
    .filter(([key, timing]) => Boolean(key) && Number.isFinite(timing) && timing >= 0);

  return entries.length ? Object.fromEntries(entries) : null;
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

function normalizePromptBenchmarkRun(run: PromptBenchmarkRun): PromptBenchmarkRun {
  return {
    ...run,
    id: Number(run.id),
    total_cost_usd: Number(run.total_cost_usd || 0),
    total_provider_calls: Number(run.total_provider_calls || 0),
    source_payload: (run.source_payload || {}) as PromptBenchmarkRun["source_payload"],
  };
}

function normalizeSalesSnapshot(snapshot: SalesSnapshotRecord): SalesSnapshotRecord {
  return {
    ...snapshot,
    id: Number(snapshot.id),
    headers: Array.isArray(snapshot.headers) ? snapshot.headers.map(String) : [],
    rows: Array.isArray(snapshot.rows) ? snapshot.rows.map(normalizeSalesSnapshotRow) : [],
    row_count: Number(snapshot.row_count || 0),
    paid_row_count: Number(snapshot.paid_row_count || 0),
    new_paid_row_count: Number(snapshot.new_paid_row_count || 0),
    validation_notes: Array.isArray(snapshot.validation_notes)
      ? snapshot.validation_notes.map(String)
      : [],
  };
}

function normalizeSalesSnapshotRow(row: SalesSnapshotRow): SalesSnapshotRow {
  return {
    date: String(row.date || ""),
    dateKey: String(row.dateKey || ""),
    paymentStatus: String(row.paymentStatus || ""),
    paymentType: String(row.paymentType || ""),
    amount: Number(row.amount || 0),
    repName: String(row.repName || ""),
    repSlug: String(row.repSlug || ""),
    showName: String(row.showName || ""),
    contractSigned: Boolean(row.contractSigned),
  };
}

function normalizePromptBenchmarkOutput(output: PromptBenchmarkOutput): PromptBenchmarkOutput {
  return {
    ...output,
    id: Number(output.id),
    output: (output.output || {}) as PromptBenchmarkOutput["output"],
    ai_eval: (output.ai_eval || {}) as PromptBenchmarkOutput["ai_eval"],
    classification_agreed:
      output.classification_agreed === null || output.classification_agreed === undefined
        ? null
        : Boolean(output.classification_agreed),
    overall_quality:
      output.overall_quality === null || output.overall_quality === undefined
        ? null
        : Number(output.overall_quality),
    total_cost_usd: Number(output.total_cost_usd || 0),
    total_input_tokens: Number(output.total_input_tokens || 0),
    total_output_tokens: Number(output.total_output_tokens || 0),
    total_latency_ms: Number(output.total_latency_ms || 0),
  };
}

function normalizePromptBenchmarkCost(cost: PromptBenchmarkCost): PromptBenchmarkCost {
  return {
    ...cost,
    id: Number(cost.id),
    input_tokens: Number(cost.input_tokens || 0),
    cache_creation_input_tokens: Number(cost.cache_creation_input_tokens || 0),
    cache_read_input_tokens: Number(cost.cache_read_input_tokens || 0),
    output_tokens: Number(cost.output_tokens || 0),
    input_cost_usd: Number(cost.input_cost_usd || 0),
    cache_write_cost_usd: Number(cost.cache_write_cost_usd || 0),
    cache_read_cost_usd: Number(cost.cache_read_cost_usd || 0),
    output_cost_usd: Number(cost.output_cost_usd || 0),
    total_cost_usd: Number(cost.total_cost_usd || 0),
    latency_ms: Number(cost.latency_ms || 0),
  };
}

function normalizePromptBenchmarkDecisionRow(
  row: PromptBenchmarkDecisionRow,
): PromptBenchmarkDecisionRow {
  return {
    model: row.model,
    call_mode: row.call_mode,
    coaching_mode: row.coaching_mode,
    output_count: Number(row.output_count || 0),
    scored_cases: Number(row.scored_cases || 0),
    gate_cases: Number(row.gate_cases || 0),
    avg_overall_quality:
      row.avg_overall_quality === null || row.avg_overall_quality === undefined
        ? null
        : Number(row.avg_overall_quality),
    classification_agreement_rate:
      row.classification_agreement_rate === null ||
      row.classification_agreement_rate === undefined
        ? null
        : Number(row.classification_agreement_rate),
    pass_rate_core_criteria:
      row.pass_rate_core_criteria === null || row.pass_rate_core_criteria === undefined
        ? null
        : Number(row.pass_rate_core_criteria),
    total_cost_usd: Number(row.total_cost_usd || 0),
    avg_latency_ms: Number(row.avg_latency_ms || 0),
    total_input_tokens: Number(row.total_input_tokens || 0),
    total_output_tokens: Number(row.total_output_tokens || 0),
  };
}

function normalizePromptBenchmarkTotals(row: unknown): PromptBenchmarkData["totals"] {
  const totals = (row || {}) as Partial<PromptBenchmarkData["totals"]>;
  const avgQuality = totals.avg_overall_quality;

  return {
    runs: Number(totals.runs || 0),
    outputs: Number(totals.outputs || 0),
    provider_calls: Number(totals.provider_calls || 0),
    total_cost_usd: Number(totals.total_cost_usd || 0),
    avg_overall_quality:
      avgQuality === null || avgQuality === undefined ? null : Number(avgQuality),
  };
}

function normalizeUsageTotals(row: UsageTotals | undefined): UsageTotals {
  return {
    events_today: Number(row?.events_today || 0),
    events_7d: Number(row?.events_7d || 0),
    events_30d: Number(row?.events_30d || 0),
    sessions_7d: Number(row?.sessions_7d || 0),
    verified_users_7d: Number(row?.verified_users_7d || 0),
    verified_events_7d: Number(row?.verified_events_7d || 0),
    legacy_events_30d: Number(row?.legacy_events_30d || 0),
    report_views_7d: Number(row?.report_views_7d || 0),
    report_engagements_7d: Number(row?.report_engagements_7d || 0),
    rep_selections_7d: Number(row?.rep_selections_7d || 0),
    manual_submissions_7d: Number(row?.manual_submissions_7d || 0),
    link_clicks_7d: Number(row?.link_clicks_7d || 0),
  };
}

function normalizeUsageOfficialSummary(row: UsageOfficialSummary | undefined): UsageOfficialSummary {
  return {
    total_reps: Number(row?.total_reps || 0),
    total_reports: Number(row?.total_reports || 0),
    report_views_today: Number(row?.report_views_today || 0),
    report_views_7d: Number(row?.report_views_7d || 0),
    report_views_30d: Number(row?.report_views_30d || 0),
    report_engagements_today: Number(row?.report_engagements_today || 0),
    report_engagements_7d: Number(row?.report_engagements_7d || 0),
    report_engagements_30d: Number(row?.report_engagements_30d || 0),
    engagement_seconds_7d: Number(row?.engagement_seconds_7d || 0),
    active_sessions_7d: Number(row?.active_sessions_7d || 0),
    verified_users_7d: Number(row?.verified_users_7d || 0),
    unmapped_users_30d: Number(row?.unmapped_users_30d || 0),
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
    report_engagements: Number(row.report_engagements || 0),
    own_report_opens: Number(row.own_report_opens || 0),
    other_report_opens: Number(row.other_report_opens || 0),
    own_report_engagements: Number(row.own_report_engagements || 0),
    other_report_engagements: Number(row.other_report_engagements || 0),
    engagement_seconds: Number(row.engagement_seconds || 0),
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

function normalizeUsageUnmappedUser(row: UsageUnmappedUser): UsageUnmappedUser {
  return {
    viewer_email: row.viewer_email,
    viewer_name: row.viewer_name,
    viewer_domain: row.viewer_domain,
    events_30d: Number(row.events_30d || 0),
    report_opens_30d: Number(row.report_opens_30d || 0),
    report_engagements_30d: Number(row.report_engagements_30d || 0),
    last_activity_at: row.last_activity_at,
  };
}

function normalizeUsageLegacySummary(row: UsageLegacySummary | undefined): UsageLegacySummary {
  return {
    events_30d: Number(row?.events_30d || 0),
    report_views_30d: Number(row?.report_views_30d || 0),
    sessions_30d: Number(row?.sessions_30d || 0),
    last_activity_at: row?.last_activity_at || null,
  };
}

function normalizeUsageChatSummary(row: UsageChatSummary | undefined): UsageChatSummary {
  return {
    opens_7d: Number(row?.opens_7d || 0),
    questions_7d: Number(row?.questions_7d || 0),
    answers_7d: Number(row?.answers_7d || 0),
    errors_7d: Number(row?.errors_7d || 0),
    reps_using_chat_7d: Number(row?.reps_using_chat_7d || 0),
    official_reports_with_questions_7d: Number(row?.official_reports_with_questions_7d || 0),
    manual_reports_with_questions_7d: Number(row?.manual_reports_with_questions_7d || 0),
    last_activity_at: row?.last_activity_at || null,
  };
}

function normalizeUsageChatRep(row: UsageChatRep): UsageChatRep {
  return {
    rep_slug: row.rep_slug,
    rep_name: row.rep_name,
    opens_7d: Number(row.opens_7d || 0),
    questions_7d: Number(row.questions_7d || 0),
    answers_7d: Number(row.answers_7d || 0),
    errors_7d: Number(row.errors_7d || 0),
    official_reports_asked_7d: Number(row.official_reports_asked_7d || 0),
    manual_reports_asked_7d: Number(row.manual_reports_asked_7d || 0),
    last_activity_at: row.last_activity_at || null,
  };
}

function normalizeUsageRecentEvent(row: UsageRecentEvent): UsageRecentEvent {
  return {
    id: Number(row.id),
    event_name: row.event_name,
    source: row.source,
    target_rep_slug: row.target_rep_slug,
    target_rep_name: row.target_rep_name,
    viewer_email: row.viewer_email,
    viewer_name: row.viewer_name,
    viewer_rep_slug: row.viewer_rep_slug,
    viewer_rep_name: row.viewer_rep_name,
    viewer_is_mapped: Boolean(row.viewer_is_mapped),
    engagement_seconds: Number(row.engagement_seconds || 0),
    report_id: row.report_id ? Number(row.report_id) : null,
    manual_public_id: row.manual_public_id,
    path: row.path,
    created_at: row.created_at,
  };
}

function normalizeSalesCorrelationUsageRow(row: SalesCorrelationUsageRow): SalesCorrelationUsageRow {
  return {
    rep_slug: row.rep_slug,
    rep_name: row.rep_name,
    generated_reports: Number(row.generated_reports || 0),
    first_report_generated_at: row.first_report_generated_at || null,
    latest_report_generated_at: row.latest_report_generated_at || null,
    usage_events_window: Number(row.usage_events_window || 0),
    usage_events_all: Number(row.usage_events_all || 0),
    report_views_window: Number(row.report_views_window || 0),
    report_views_all: Number(row.report_views_all || 0),
    report_clicks_window: Number(row.report_clicks_window || 0),
    viewed_reports: Number(row.viewed_reports || 0),
    viewed_reports_window: Number(row.viewed_reports_window || 0),
    rep_selections_window: Number(row.rep_selections_window || 0),
    link_clicks_window: Number(row.link_clicks_window || 0),
    first_activity_at: row.first_activity_at || null,
    last_activity_at: row.last_activity_at || null,
  };
}

function normalizeSalesCorrelationUsageEvent(
  row: SalesCorrelationUsageEvent,
): SalesCorrelationUsageEvent {
  return {
    rep_slug: row.rep_slug,
    rep_name: row.rep_name,
    event_name: row.event_name,
    report_id: row.report_id ? Number(row.report_id) : null,
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
    unmappedUsers: [],
    legacy: normalizeUsageLegacySummary(undefined),
    chat: normalizeUsageChatSummary(undefined),
    chatReps: [],
    recentEvents: [],
  };
}

function getFallbackPromptBenchmarkData(): PromptBenchmarkData {
  return {
    configured: false,
    generatedAt: new Date().toISOString(),
    runs: [],
    outputs: [],
    costs: [],
    decisionRows: [],
    totals: {
      runs: 0,
      outputs: 0,
      provider_calls: 0,
      total_cost_usd: 0,
      avg_overall_quality: null,
    },
  };
}

function getFallbackPromptBenchmarkRunReviewData(): PromptBenchmarkRunReviewData {
  return {
    configured: false,
    generatedAt: new Date().toISOString(),
    run: null,
    outputs: [],
    costs: [],
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
    source_payload: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  },
];
