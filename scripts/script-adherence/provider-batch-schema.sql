-- Additive. Applying this migration does not enable processing.
alter table script_adherence_control add column if not exists transport text not null default 'realtime' check(transport in ('realtime','batch'));
alter table script_adherence_requests add column if not exists transport text not null default 'realtime' check(transport in ('realtime','batch'));
create table if not exists script_adherence_provider_batches (
 id text primary key, state text not null default 'prepared' check(state in ('prepared','submitting','running','collecting','complete','held')),
 file_id text,provider_id text unique,provider_status text,provider_snapshot jsonb,
 submission_at timestamptz,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 next_check_at timestamptz not null default now(),error text
);
create table if not exists script_adherence_batch_members (
 request_id text primary key references script_adherence_requests(id),
 batch_id text not null references script_adherence_provider_batches(id),job_id text not null references script_adherence_jobs(id)
);
create index if not exists script_adherence_batch_members_batch on script_adherence_batch_members(batch_id);
create table if not exists script_adherence_runner (
 id boolean primary key default true check(id),lease_owner text,lease_until timestamptz,last_started_at timestamptz,last_success_at timestamptz,error text
);
insert into script_adherence_runner(id) values(true) on conflict do nothing;

alter table script_adherence_runner add column if not exists source_error text;
