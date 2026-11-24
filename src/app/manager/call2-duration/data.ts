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
  review: { signal: Cue | null } | null;
  revision: string;
};
export async function calls() {
  await requireRepScoringAdmin();
  const sql = neon(process.env.DATABASE_URL!);
  return (await sql`SELECT occurrence, digest, summary, review, coalesce(reviewed_at::text, '') as revision
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
