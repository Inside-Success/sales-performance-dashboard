export type JsonObject = Record<string, unknown>;

export type CloseSectionType = "why_no_close" | "what_made_this_close_work" | null;

export type PerformanceCall = {
  id: number;
  airtable_record_id: string;
  scorecard_key: string | null;
  rep_name: string;
  rep_slug: string;
  rep_email: string | null;
  client_name: string | null;
  call_date: string | null;
  meeting_id: string | null;
  meeting_title: string | null;
  meeting_link: string | null;
  transcript_link: string | null;
  google_doc_id: string | null;
  google_doc_link: string | null;
  call_status: string | null;
  one_line_verdict: string | null;
  biggest_strength: string | null;
  biggest_fix: string | null;
  coaching_tip: string | null;
  rudys_note: string | null;
  what_went_well: string[];
  what_to_improve: string[];
  why_no_close: JsonObject | string | null;
  what_made_this_close_work: JsonObject | string | null;
  objections_surfaced: string[];
  close_section_type: CloseSectionType;
  close_section: JsonObject | string | null;
  source_payload: JsonObject;
  created_at: string;
  updated_at: string;
};

export type DashboardFilters = {
  q?: string;
  rep?: string;
  client?: string;
  date?: string;
  from?: string;
  to?: string;
};

export type RepSummary = {
  rep_name: string;
  rep_slug: string;
  call_count: number;
  latest_call_date: string | null;
};

export type ManualReportStatus =
  | "pending"
  | "processing"
  | "completed"
  | "refused"
  | "needs_transcript_paste"
  | "failed";

export type ManualReportInputType = "transcript" | "zoom_link";
export type ManualReportSourceType = "pasted_transcript" | "zoom_link";

export type ManualFeedbackReport = {
  id: number;
  public_id: string;
  status: ManualReportStatus;
  input_type: ManualReportInputType;
  source_type: ManualReportSourceType | null;
  rep_name: string;
  rep_email: string | null;
  client_name: string | null;
  zoom_link: string | null;
  original_zoom_link: string | null;
  transcript_link: string | null;
  transcript_drive_link: string | null;
  google_doc_id: string | null;
  google_doc_link: string | null;
  report_doc_link: string | null;
  call_status: string | null;
  refusal_reason: string | null;
  one_line_verdict: string | null;
  biggest_strength: string | null;
  biggest_fix: string | null;
  coaching_tip: string | null;
  rudys_note: string | null;
  what_went_well: string[];
  what_to_improve: string[];
  why_no_close: JsonObject | string | null;
  what_made_this_close_work: JsonObject | string | null;
  objections_surfaced: string[];
  close_section_type: CloseSectionType;
  close_section: JsonObject | string | null;
  source_payload: JsonObject;
  created_at: string;
  updated_at: string;
};

export type UsageTotals = {
  events_today: number;
  events_7d: number;
  events_30d: number;
  sessions_7d: number;
  report_views_7d: number;
  rep_selections_7d: number;
  manual_submissions_7d: number;
  link_clicks_7d: number;
};

export type UsageOfficialSummary = {
  total_reps: number;
  total_reports: number;
  report_views_today: number;
  report_views_7d: number;
  report_views_30d: number;
  active_sessions_7d: number;
  reps_with_activity_7d: number;
  rep_selections_7d: number;
  link_clicks_7d: number;
  last_activity_at: string | null;
};

export type UsageManualSummary = {
  total_reports: number;
  completed_reports: number;
  pending_reports: number;
  page_opens_7d: number;
  submissions_7d: number;
  report_views_7d: number;
  link_clicks_7d: number;
  active_sessions_7d: number;
  last_activity_at: string | null;
};

export type UsageDailyPoint = {
  day: string;
  total_events: number;
  report_views: number;
  official_report_views: number;
  manual_report_views: number;
  rep_selections: number;
  manual_submissions: number;
};

export type UsageEventBreakdown = {
  event_name: string;
  count: number;
};

export type UsageRepEngagement = {
  rep_name: string;
  rep_slug: string;
  generated_reports: number;
  viewed_reports: number;
  report_views: number;
  rep_selections: number;
  doc_clicks: number;
  zoom_clicks: number;
  transcript_clicks: number;
  last_activity_at: string | null;
};

export type UsageUnviewedReport = {
  id: number;
  rep_name: string;
  rep_slug: string;
  client_name: string | null;
  call_date: string | null;
  created_at: string;
};

export type UsageRecentEvent = {
  id: number;
  event_name: string;
  source: string | null;
  target_rep_slug: string | null;
  target_rep_name: string | null;
  report_id: number | null;
  manual_public_id: string | null;
  path: string | null;
  created_at: string;
};

export type UsageAnalytics = {
  configured: boolean;
  error?: string;
  generatedAt: string;
  totals: UsageTotals;
  official: UsageOfficialSummary;
  manual: UsageManualSummary;
  daily: UsageDailyPoint[];
  eventBreakdown: UsageEventBreakdown[];
  repEngagement: UsageRepEngagement[];
  unviewedReports: UsageUnviewedReport[];
  recentEvents: UsageRecentEvent[];
};

export type SalesCorrelationUsageRow = {
  rep_slug: string;
  rep_name: string;
  generated_reports: number;
  first_report_generated_at: string | null;
  latest_report_generated_at: string | null;
  usage_events_window: number;
  usage_events_all: number;
  report_views_window: number;
  report_views_all: number;
  report_clicks_window: number;
  viewed_reports: number;
  viewed_reports_window: number;
  rep_selections_window: number;
  link_clicks_window: number;
  first_activity_at: string | null;
  last_activity_at: string | null;
};

export type SalesCorrelationUsageEvent = {
  rep_slug: string;
  rep_name: string;
  event_name: string;
  report_id: number | null;
  created_at: string;
};

export type SalesCorrelationUsageData = {
  configured: boolean;
  rows: SalesCorrelationUsageRow[];
  events: SalesCorrelationUsageEvent[];
  error?: string;
};
