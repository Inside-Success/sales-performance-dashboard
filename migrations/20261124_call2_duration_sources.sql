ALTER TABLE call2_duration_pilot
  ADD COLUMN IF NOT EXISTS transcript_doc_id text,
  ADD COLUMN IF NOT EXISTS verified_recording_url text;
