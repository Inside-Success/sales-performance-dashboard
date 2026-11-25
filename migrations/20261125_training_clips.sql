CREATE TABLE IF NOT EXISTS training_clip_reports (
    report_date date PRIMARY KEY,
    picks jsonb NOT NULL CHECK (jsonb_typeof(picks) = 'array'),
    sheet_url text NOT NULL
);
CREATE TABLE IF NOT EXISTS training_clip_media (
    id uuid PRIMARY KEY,
    size_bytes integer NOT NULL CHECK (size_bytes > 0)
);
CREATE TABLE IF NOT EXISTS training_clip_chunks (
    media_id uuid NOT NULL REFERENCES training_clip_media(id),
    part integer NOT NULL CHECK (part >= 0),
    content bytea NOT NULL,
    PRIMARY KEY (media_id, part)
);
