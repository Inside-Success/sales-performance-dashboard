import "server-only";
import { neon } from "@neondatabase/serverless";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";

export type Cue = { id: number; at: number; playback: number; text: string };
export type Summary = {
  rep: string;
  cast: string;
  show: string;
  total: number;
  attendance: number | null;
  signal: Cue | null;
  outcome: string;
  recording: string;
  recordingStart: number;
  date: string;
};
export type PilotCall = {
  shared_intervals: [number, number][] | null;
  occurrence: string;
  transcript_doc_id: string | null;
  verified_recording_url: string | null;
  summary: Summary;
  reply: string | null;
  review: { signal: Cue | null; feedback?: string } | null;
};
export const PAGE_SIZE = 40;

export async function calls(rep = "", page = 1) {
  await requireRepScoringAdmin();
  const sql = neon(process.env.DATABASE_URL!);
  const [view] = await sql`WITH selected AS (
    SELECT occurrence, started_at, COALESCE(review, summary)->'signal'->>'at' AS at,
      shared_intervals FROM call2_duration_pilot
    WHERE ${rep} = '' OR summary->>'rep' = ${rep}
  ), durations AS (
    SELECT CASE WHEN at IS NOT NULL AND jsonb_array_length(shared_intervals) > 0 THEN
      (SELECT sum(greatest(0, (span->>1)::int - greatest((span->>0)::int, at::int)))
       FROM jsonb_array_elements(shared_intervals) span) END AS seconds FROM selected
  ), cards AS (
    SELECT p.shared_intervals, p.occurrence, p.transcript_doc_id, p.verified_recording_url,
      p.summary, p.review, p.started_at,
      p.rep_replies ->> (COALESCE(p.review,p.summary)->'signal'->>'id') AS reply
    FROM (SELECT occurrence FROM selected ORDER BY started_at DESC, occurrence
      LIMIT ${PAGE_SIZE} OFFSET ${(page - 1) * PAGE_SIZE}) windowed
    JOIN call2_duration_pilot p USING (occurrence)
  )
  SELECT count(*)::int AS total, count(seconds)::int AS measured,
    round((percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds))::numeric)::int AS median,
    ARRAY(SELECT DISTINCT summary->>'rep' FROM call2_duration_pilot ORDER BY 1) AS reps,
    COALESCE((SELECT jsonb_agg(cards ORDER BY started_at DESC, occurrence) FROM cards),'[]'::jsonb) AS rows
  FROM durations`;
  return view as { total: number; measured: number; median: number | null; reps: string[]; rows: PilotCall[] };
}
export function clock(seconds: number) {
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

export function timeWithCast(row: PilotCall) {
  const cue = (row.review ?? row.summary).signal;
  if (!cue || !row.shared_intervals?.length) return null;
  return row.shared_intervals.reduce(
    (total, [start, end]) => total + Math.max(0, end - Math.max(start, cue.at)),
    0,
  );
}
