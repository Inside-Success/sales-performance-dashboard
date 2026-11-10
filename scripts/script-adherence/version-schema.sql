-- Additive only. Activation is a separate explicit compare-and-set after deployment.
alter table script_adherence_control add column if not exists active_rubric_version text;
alter table script_adherence_control add column if not exists rubric_effective_at timestamptz;
create table if not exists script_adherence_source_checks (
 document_id text primary key, observed_hash text, expected_hash text not null,
 error text, checked_at timestamptz not null
);
