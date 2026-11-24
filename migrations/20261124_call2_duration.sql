CREATE TABLE IF NOT EXISTS call2_duration_pilot (
  occurrence text PRIMARY KEY,
  digest text NOT NULL,
  started_at timestamptz NOT NULL,
  summary jsonb NOT NULL,
  cast_cues jsonb NOT NULL,
  review jsonb,
  reviewed_at timestamptz
);
