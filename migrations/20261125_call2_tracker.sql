CREATE TABLE IF NOT EXISTS call2_tracker_start (
  singleton boolean PRIMARY KEY DEFAULT true CHECK (singleton),
  started_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO call2_tracker_start DEFAULT VALUES ON CONFLICT DO NOTHING;

CREATE TABLE IF NOT EXISTS call2_tracker_intake (
  source text PRIMARY KEY,
  status text NOT NULL,
  backfill boolean NOT NULL DEFAULT false,
  retry_at timestamptz,
  attempts integer NOT NULL DEFAULT 1
);
CREATE TABLE IF NOT EXISTS call2_tracker_requests (
  occurrence text PRIMARY KEY,
  digest text NOT NULL,
  receipt jsonb
);
CREATE OR REPLACE VIEW call2_tracker_reports AS
SELECT id, created_at, source_payload->>'source_airtable_record_id' AS source,
  transcript_link, source_payload #>> '{reviewed_coaching_v3,report,outcome,text}' AS outcome
FROM performance_calls
WHERE source_payload->>'source_airtable_record_id' IS NOT NULL;
