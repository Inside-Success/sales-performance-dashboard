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
export async function calls() {
  await requireRepScoringAdmin();
  const sql = neon(process.env.DATABASE_URL!);
  return (await sql`SELECT shared_intervals, occurrence, transcript_doc_id, verified_recording_url, summary, review,
    rep_replies ->> (CASE WHEN review IS NULL THEN summary ELSE review END -> 'signal' ->> 'id') AS reply
    FROM call2_duration_pilot ORDER BY started_at DESC, occurrence`) as PilotCall[];
}
export function clock(seconds: number) {
  return Math.floor(seconds / 60) + ":" + String(seconds % 60).padStart(2, "0");
}

export function medianClock(seconds: number[]) {
  if (!seconds.length) return "—";
  const sorted = [...seconds].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return clock(
    Math.round(
      (sorted[middle] + sorted[Math.floor((sorted.length - 1) / 2)]) / 2,
    ),
  );
}

export function timeWithCast(row: PilotCall) {
  const cue = (row.review ?? row.summary).signal;
  if (!cue || !row.shared_intervals) return null;
  return row.shared_intervals.reduce(
    (total, [start, end]) => total + Math.max(0, end - Math.max(start, cue.at)),
    0,
  );
}
