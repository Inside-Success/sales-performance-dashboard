import { createHash } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { normalizeAuthEmail } from "@/lib/auth-utils";
import { databaseUrl } from "@/lib/database-connection";

type RecordingIdentity = { owner: string; title: string; startedAt: string };

/** Share metadata selects a candidate. Only the signed-in rep can use their archived transcript. */
export async function resolveManualArchivedTranscript(recording: RecordingIdentity, sessionEmail?: string | null) {
  const email = normalizeAuthEmail(sessionEmail);
  const url = databaseUrl();
  if (!email || !url || recording.owner.length > 200 || recording.title.length > 1000) return null;

  const sql = neon(url, { fetchOptions: { signal: AbortSignal.timeout(4000) } });
  const rows = await sql`
    with owner as (
      select min(rep_name) as rep_name
      from performance_calls
      where lower(rep_email) = ${email} and rep_slug <> '' and rep_name <> ''
      having count(distinct rep_slug) = 1 and count(distinct lower(trim(rep_name))) = 1
    )
    select j.transcript, j.transcript_hash
    from script_adherence_jobs j join owner o on lower(trim(o.rep_name)) = lower(trim(j.rep))
    where j.started_at = ${recording.startedAt}::timestamptz
      and lower(trim(j.title)) = lower(trim(${recording.title}))
      and lower(trim(j.rep)) = lower(trim(${recording.owner}))
      and j.meeting_uuid <> ''
    limit 2
  `;
  if (rows.length !== 1) return null;
  const { transcript, transcript_hash: hash } = rows[0];
  if (typeof transcript !== "string" || transcript.trim().length < 80 ||
      Buffer.byteLength(transcript) > 600000 ||
      createHash("sha256").update(transcript).digest("hex") !== hash) return null;
  return formatManualArchivedTranscript(transcript);
}

/** Keep the original cue and speaker text. Preserve segment labels when the recording has multiple parts. */
export function formatManualArchivedTranscript(transcript: string) {
  const prefix = /^\[segment (\d+) (\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\]/gm;
  const segments = new Set(Array.from(transcript.matchAll(prefix), match => match[1]));
  return transcript.replace(prefix, (_, segment: string, timestamp: string) =>
    segments.size > 1 ? `[${timestamp}] [segment ${segment}]` : `[${timestamp}]`);
}
