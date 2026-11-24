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
  occurrence: string;
  digest: string;
  summary: Summary;
  reply: string | null;
  review: { signal: Cue | null; feedback?: string } | null;
  revision: string;
};
export async function calls() {
  await requireRepScoringAdmin();
  const sql = neon(process.env.DATABASE_URL!);
  return (await sql`SELECT occurrence, digest, summary, review,
    rep_replies ->> (CASE WHEN review IS NULL THEN summary ELSE review END -> 'signal' ->> 'id') AS reply, coalesce(reviewed_at::text, '') as revision
    FROM call2_duration_pilot ORDER BY started_at DESC, occurrence`) as PilotCall[];
}
export async function choices(id: string) {
  await requireRepScoringAdmin();
  const sql = neon(process.env.DATABASE_URL!);
  const rows =
    await sql`SELECT cast_cues FROM call2_duration_pilot WHERE occurrence = ${id}`;
  return (rows[0]?.cast_cues || []) as Cue[];
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
