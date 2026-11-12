-- Additive diagnostics only: no score, metric, request or budget rewrites.
create table if not exists script_adherence_submission_events (
 id bigint generated always as identity primary key,
 batch_id text not null references script_adherence_provider_batches(id),
 kind text not null,detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create index if not exists script_adherence_submission_events_batch on script_adherence_submission_events(batch_id,created_at);
