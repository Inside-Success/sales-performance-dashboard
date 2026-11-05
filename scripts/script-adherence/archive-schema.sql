ALTER TABLE script_adherence_jobs ADD COLUMN IF NOT EXISTS archive_checked_at timestamptz;
ALTER TABLE script_adherence_jobs ADD COLUMN IF NOT EXISTS source_provenance jsonb;
CREATE INDEX IF NOT EXISTS script_adherence_archive_pending ON script_adherence_jobs (archive_checked_at) WHERE state='awaiting_transcript';

ALTER TABLE script_adherence_control ADD COLUMN IF NOT EXISTS archive_enabled boolean NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS script_adherence_result_corrections (
 id text PRIMARY KEY, source_key text NOT NULL, request_id text NOT NULL,
 before_result jsonb NOT NULL, after_result jsonb NOT NULL, reason text NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
