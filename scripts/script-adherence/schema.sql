-- Isolated tables only. No coaching, source-call or report mutation.
create table if not exists script_adherence_budget (
  project text primary key, ceiling_microusd bigint not null check(ceiling_microusd<=40000000 and ceiling_microusd>=0),
  committed_microusd bigint not null default 0 check(committed_microusd>=0)
);
insert into script_adherence_budget(project,ceiling_microusd) values ('pilot-2026-11-02',40000000) on conflict do nothing;
create table if not exists script_adherence_requests (
  id text primary key, project text not null references script_adherence_budget(project), source_key text not null,
  request_hash text not null, model text not null, reserved_microusd bigint not null check(reserved_microusd>=0),
  actual_microusd bigint check(actual_microusd>=0), status text not null check(status in ('reserved','submitted','completed','held','failed')),
  provider_id text, usage jsonb, result jsonb, created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create table if not exists script_adherence_calls (
  source_key text primary key, account_id text not null, meeting_uuid text not null, transcript_hash text not null,
  rep text not null, title text not null, started_at timestamptz not null, source_url text not null,
  rubric_version text not null, result jsonb not null, request_id text not null references script_adherence_requests(id),
  review_status text not null check(review_status in ('pilot','accepted')), updated_at timestamptz not null default now()
);
create index if not exists script_adherence_calls_date on script_adherence_calls(started_at desc);
create table if not exists script_adherence_scans (
  id text primary key, account_id text not null, from_at timestamptz not null,to_at timestamptz not null,
  summary jsonb not null, created_at timestamptz not null default now()
);
alter table script_adherence_requests add column if not exists stage text not null default 'combined';
alter table script_adherence_requests add column if not exists validation_error text;
