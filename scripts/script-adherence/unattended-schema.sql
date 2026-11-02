-- Additive, isolated processing ledger. Existing accepted results are preserved.
create table if not exists script_adherence_jobs (
 id text primary key, source_key text not null, account_id text not null, meeting_uuid text not null,
 files jsonb not null, rep text not null, title text not null, started_at timestamptz not null,
 source_url text not null, download_url text not null, transcript text, transcript_hash text,
 state text not null default 'awaiting_transcript' check (state in ('awaiting_transcript','ready','draft_pending','review_ready','review_pending','complete','held')),
 draft_request_id text references script_adherence_requests(id) deferrable initially deferred,review_request_id text references script_adherence_requests(id) deferrable initially deferred,
 draft jsonb, reviewed jsonb, error text, attempts integer not null default 0,
 next_attempt_at timestamptz not null default now(), lease_owner text, lease_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(account_id,meeting_uuid)
);
create index if not exists script_adherence_jobs_queue on script_adherence_jobs(state,next_attempt_at,created_at);
create table if not exists script_adherence_scan_pages (
 id text primary key, account_id text not null, run_id text not null, member_id text not null,
 from_at timestamptz not null,to_at timestamptz not null,next_page_token text not null default '',
 complete boolean not null default false,recording_count integer not null default 0,error text,
 updated_at timestamptz not null default now()
);
create table if not exists script_adherence_receipts (
 request_id text primary key references script_adherence_requests(id),job_id text not null references script_adherence_jobs(id),
 payload_hash text not null,payload jsonb not null,created_at timestamptz not null default now()
);
-- Stable minimal list data avoids transferring every evidence quote to browsers.
create table if not exists script_adherence_metrics (
 source_key text primary key references script_adherence_calls(source_key),
 rep text not null,started_at timestamptz not null,show text not null,stage text not null,
 script text,complete integer not null,not_complete integer not null,unknown integer not null,not_applicable integer not null,
 actions jsonb not null,updated_at timestamptz not null default now()
);
create index if not exists script_adherence_metrics_filters on script_adherence_metrics(started_at,rep,show,stage);

create table if not exists script_adherence_control (
 id boolean primary key default true check(id), enabled boolean not null default false,
 draft_model text not null default 'gpt-6-luna',review_model text not null default 'gpt-6.1-terra',
 start_at timestamptz not null default now(),canary_keys jsonb not null default '[]',updated_at timestamptz not null default now()
);
insert into script_adherence_control(id) values(true) on conflict do nothing;

alter table script_adherence_requests add column if not exists request_body jsonb;
create table if not exists script_adherence_coverage (
 account_id text primary key,through_at timestamptz not null,updated_at timestamptz not null default now()
);
create index if not exists script_adherence_metrics_local_date on script_adherence_metrics(((started_at at time zone 'America/New_York')::date));
