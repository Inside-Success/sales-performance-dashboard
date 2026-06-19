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
  verified_users_7d: number;
  verified_events_7d: number;
  legacy_events_30d: number;
  report_views_7d: number;
  report_engagements_7d: number;
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
  report_engagements_today: number;
  report_engagements_7d: number;
  report_engagements_30d: number;
  engagement_seconds_7d: number;
  active_sessions_7d: number;
  verified_users_7d: number;
  unmapped_users_30d: number;
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
  report_engagements: number;
  own_report_opens: number;
  other_report_opens: number;
  own_report_engagements: number;
  other_report_engagements: number;
  engagement_seconds: number;
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

export type UsageUnmappedUser = {
  viewer_email: string;
  viewer_name: string | null;
  viewer_domain: string | null;
  events_30d: number;
  report_opens_30d: number;
  report_engagements_30d: number;
  last_activity_at: string | null;
};

export type UsageLegacySummary = {
  events_30d: number;
  report_views_30d: number;
  sessions_30d: number;
  last_activity_at: string | null;
};

export type UsageChatSummary = {
  opens_7d: number;
  questions_7d: number;
  answers_7d: number;
  errors_7d: number;
  reps_using_chat_7d: number;
  official_reports_with_questions_7d: number;
  manual_reports_with_questions_7d: number;
  last_activity_at: string | null;
};

export type UsageChatRep = {
  rep_slug: string;
  rep_name: string;
  opens_7d: number;
  questions_7d: number;
  answers_7d: number;
  errors_7d: number;
  official_reports_asked_7d: number;
  manual_reports_asked_7d: number;
  last_activity_at: string | null;
};

export type UsageRecentEvent = {
  id: number;
  event_name: string;
  source: string | null;
  target_rep_slug: string | null;
  target_rep_name: string | null;
  viewer_email: string | null;
  viewer_name: string | null;
  viewer_rep_slug: string | null;
  viewer_rep_name: string | null;
  viewer_is_mapped: boolean;
  engagement_seconds: number;
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
  unmappedUsers: UsageUnmappedUser[];
  legacy: UsageLegacySummary;
  chat: UsageChatSummary;
  chatReps: UsageChatRep[];
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

export type SalesSnapshotRow = {
  date: string;
  dateKey: string;
  paymentStatus: string;
  paymentType: string;
  amount: number;
  repName: string;
  repSlug: string;
  showName: string;
  contractSigned: boolean;
};

export type SalesSnapshotRecord = {
  id: number;
  source_url: string;
  source_sheet: string | null;
  headers: string[];
  rows: SalesSnapshotRow[];
  row_count: number;
  paid_row_count: number;
  new_paid_row_count: number;
  latest_sales_date: string | null;
  validation_notes: string[];
  created_at: string;
};

export type PromptBenchmarkRun = {
  id: number;
  run_id: string;
  title: string | null;
  status: string;
  sheet_url: string | null;
  dashboard_url: string | null;
  started_at: string | null;
  finished_at: string | null;
  total_cost_usd: number;
  total_provider_calls: number;
  source_payload: JsonObject;
  created_at: string;
  updated_at: string;
};

export type PromptBenchmarkOutput = {
  id: number;
  result_id: string;
  run_id: string;
  case_id: string;
  case_label: string | null;
  case_type: string;
  expected_call_status: string | null;
  call_status: string | null;
  model: string;
  provider: string;
  call_mode: string;
  coaching_mode: string;
  output: JsonObject;
  ai_eval: JsonObject;
  classification_agreed: boolean | null;
  overall_quality: number | null;
  total_cost_usd: number;
  total_input_tokens: number;
  total_output_tokens: number;
  total_latency_ms: number;
  created_at: string;
  updated_at: string;
};

export type PromptBenchmarkCost = {
  id: number;
  cost_id: string;
  run_id: string;
  result_id: string | null;
  case_id: string | null;
  model: string;
  provider: string;
  call_purpose: string;
  input_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  output_tokens: number;
  input_cost_usd: number;
  cache_write_cost_usd: number;
  cache_read_cost_usd: number;
  output_cost_usd: number;
  total_cost_usd: number;
  started_at: string | null;
  finished_at: string | null;
  latency_ms: number;
  provider_response_id: string | null;
  error: string | null;
  created_at: string;
};

export type PromptBenchmarkDecisionRow = {
  model: string;
  call_mode: string;
  coaching_mode: string;
  output_count: number;
  scored_cases: number;
  gate_cases: number;
  avg_overall_quality: number | null;
  classification_agreement_rate: number | null;
  pass_rate_core_criteria: number | null;
  total_cost_usd: number;
  avg_latency_ms: number;
  total_input_tokens: number;
  total_output_tokens: number;
};

export type PromptBenchmarkData = {
  configured: boolean;
  generatedAt: string;
  runs: PromptBenchmarkRun[];
  outputs: PromptBenchmarkOutput[];
  costs: PromptBenchmarkCost[];
  decisionRows: PromptBenchmarkDecisionRow[];
  totals: {
    runs: number;
    outputs: number;
    provider_calls: number;
    total_cost_usd: number;
    avg_overall_quality: number | null;
  };
  error?: string;
};

export type PromptBenchmarkRunReviewData = {
  configured: boolean;
  generatedAt: string;
  run: PromptBenchmarkRun | null;
  outputs: PromptBenchmarkOutput[];
  costs: PromptBenchmarkCost[];
  error?: string;
};
