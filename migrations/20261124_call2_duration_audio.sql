CREATE TABLE IF NOT EXISTS call2_duration_audio_parts (
  occurrence text NOT NULL REFERENCES call2_duration_pilot (occurrence),
  part integer NOT NULL CHECK (part >= 0),
  file_hash text NOT NULL,
  total_bytes integer NOT NULL CHECK (total_bytes > 0),
  audio bytea NOT NULL CHECK (octet_length(audio) BETWEEN 1 AND 524288),
  PRIMARY KEY (occurrence, part)
);
