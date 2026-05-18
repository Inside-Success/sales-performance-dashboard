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
);

create index if not exists performance_calls_rep_slug_idx
  on performance_calls (rep_slug);

create index if not exists performance_calls_call_date_idx
  on performance_calls (call_date desc nulls last);

create index if not exists performance_calls_updated_at_idx
  on performance_calls (updated_at desc);

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
);

alter table manual_feedback_reports
  add column if not exists source_type text,
  add column if not exists original_zoom_link text,
  add column if not exists transcript_drive_link text,
  add column if not exists report_doc_link text;

create index if not exists manual_feedback_reports_public_id_idx
  on manual_feedback_reports (public_id);

create index if not exists manual_feedback_reports_status_idx
  on manual_feedback_reports (status);

create index if not exists manual_feedback_reports_updated_at_idx
  on manual_feedback_reports (updated_at desc);
