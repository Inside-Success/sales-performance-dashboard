export const USAGE_EVENT_NAMES = [
  "dashboard_home_viewed",
  "manual_reports_page_viewed",
  "manual_submit_opened",
  "rep_selected",
  "report_card_clicked",
  "report_detail_viewed",
  "google_doc_clicked",
  "zoom_clicked",
  "transcript_clicked",
  "manual_report_submitted",
  "manual_report_viewed",
] as const;

export type UsageEventName = (typeof USAGE_EVENT_NAMES)[number];

export type UsageEventData = {
  source?: string | null;
  target_rep_slug?: string | null;
  target_rep_name?: string | null;
  report_id?: number | null;
  manual_public_id?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type UsageEventPayload = UsageEventData & {
  event_name: UsageEventName;
  anonymous_session_id?: string | null;
  path?: string | null;
  referrer?: string | null;
  user_agent?: string | null;
};
