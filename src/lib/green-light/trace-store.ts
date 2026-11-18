import "server-only";
import { after } from "next/server";
import { neon } from "@neondatabase/serverless";
import { databaseUrl } from "@/lib/database-connection";
import { splitLetter } from "@/lib/green-light/letter-sections";

// Permanent record of every green light letter made on the rep page: what the rep gave (Zoom link,
// transcript, the whole focus points box), the letter exactly as the AI wrote it, every AI change
// with the text before and after, and the final text sent to the Google Doc.
//
// It lives in its own table in the dashboard database and nothing else reads or writes it. Rows are
// only ever added. Writing is best effort and happens after the rep already has their answer, so a
// database problem can never slow down or block a letter.

export type GreenLightTraceEvent = {
  event: "zoom" | "generate" | "start_failed" | "draft" | "failed" | "refine" | "refine_failed" | "save" | "save_failed";
  rep_email: string;
  rep_name?: string;
  job_id?: string;
  prospect_name?: string;
  show_type?: string;
  input_type?: string;
  zoom_link?: string;
  focus_points?: string;
  transcript?: string;
  instructions?: string;
  letter_before?: string;
  letter_text?: string;
  document_url?: string;
  doc_title?: string;
  error?: string;
  detail?: Record<string, unknown>;
};

// Each call gets its own time limit, so a slow database can only ever cost a trace row.
const SETUP_TIMEOUT_MS = 10000;
const QUERY_TIMEOUT_MS = 8000;

function database(timeoutMs = QUERY_TIMEOUT_MS) {
  const url = databaseUrl();
  if (!url) return null;
  return neon(url, { fetchOptions: { signal: AbortSignal.timeout(timeoutMs) } });
}

let ready: Promise<void> | undefined;
function ensureTraceStorage() {
  if (!ready) {
    ready = (async () => {
      const sql = database(SETUP_TIMEOUT_MS);
      if (!sql) throw new Error("Trace storage unavailable");
      await sql`create table if not exists green_light_letter_trace (
        id bigint generated always as identity primary key,
        created_at timestamptz not null default now(),
        event text not null,
        job_id text not null default '',
        rep_email text not null,
        rep_name text not null default '',
        prospect_name text not null default '',
        show_type text not null default '',
        input_type text not null default '',
        zoom_link text,
        focus_points text,
        transcript text,
        instructions text,
        letter_before text,
        letter_text text,
        sections jsonb,
        document_url text,
        doc_title text,
        error text,
        detail jsonb
      )`;
      await sql`create index if not exists green_light_letter_trace_job on green_light_letter_trace(job_id, id)`;
      await sql`create index if not exists green_light_letter_trace_time on green_light_letter_trace(created_at desc)`;
      await sql`create index if not exists green_light_letter_trace_rep on green_light_letter_trace(rep_email, created_at desc)`;
      // The page can ask for a finished letter more than once; its first answer is the one kept.
      await sql`create unique index if not exists green_light_letter_trace_one_result on green_light_letter_trace(job_id, event) where event in ('draft','failed')`;
    })().catch((error) => {
      ready = undefined;
      throw error;
    });
  }
  return ready;
}

/** The sections written for this prospect, by name, so a draft and the final letter are easy to compare. */
export function writtenSections(letter: string | undefined) {
  if (!letter) return null;
  const split = splitLetter(letter);
  if (split.mode !== "sections") return null;
  const sections: Record<string, string> = {};
  for (const segment of split.segments) if (segment.kind === "edit") sections[segment.key] = segment.text;
  return sections;
}

// Postgres refuses a NUL character and a broken half of an emoji; neither may cost a whole row.
const UNSTORABLE = /\u0000|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;
const storable = (value: string) => value.replace(UNSTORABLE, "");
const text = (value: string | undefined) => (typeof value === "string" && value ? storable(value) || null : null);
const json = (value: unknown) => (value ? JSON.stringify(value, (_key, item) => (typeof item === "string" ? storable(item) : item)) : null);

/** Adds one row. Never throws: a failure is noted in the server log and the letter carries on. */
export async function recordGreenLightTrace(entry: GreenLightTraceEvent) {
  try {
    const sql = database();
    if (!sql) return;
    await ensureTraceStorage();
    const sections = writtenSections(entry.letter_text);
    await sql`insert into green_light_letter_trace
      (event, job_id, rep_email, rep_name, prospect_name, show_type, input_type, zoom_link, focus_points, transcript,
       instructions, letter_before, letter_text, sections, document_url, doc_title, error, detail)
      values (${entry.event}, ${storable(entry.job_id || "")}, ${storable(entry.rep_email)}, ${storable(entry.rep_name || "")}, ${storable(entry.prospect_name || "")},
        ${storable(entry.show_type || "")}, ${storable(entry.input_type || "")}, ${text(entry.zoom_link)}, ${text(entry.focus_points)}, ${text(entry.transcript)},
        ${text(entry.instructions)}, ${text(entry.letter_before)}, ${text(entry.letter_text)},
        ${json(sections)}::jsonb, ${text(entry.document_url)}, ${text(entry.doc_title)},
        ${text(entry.error)}, ${json(entry.detail)}::jsonb)
      on conflict do nothing`;
  } catch (error) {
    console.error("Green light trace not saved", entry.event, error instanceof Error ? error.name : "UnknownError");
  }
}

/**
 * What the routes call: adds the row after the response has gone out. Nothing here can reach the
 * rep's answer, not even a failure to schedule the write.
 */
export function traceGreenLight(entry: GreenLightTraceEvent) {
  try {
    after(() => recordGreenLightTrace(entry));
  } catch (error) {
    console.error("Green light trace not scheduled", entry.event, error instanceof Error ? error.name : "UnknownError");
  }
}

export type GreenLightTraceRow = {
  id: string;
  created_at: string;
  event: string;
  job_id: string;
  rep_email: string;
  rep_name: string;
  prospect_name: string;
  show_type: string;
  input_type: string;
  zoom_link: string | null;
  focus_points: string | null;
  transcript: string | null;
  instructions: string | null;
  letter_before: string | null;
  letter_text: string | null;
  sections: Record<string, string> | null;
  document_url: string | null;
  doc_title: string | null;
  error: string | null;
  detail: Record<string, unknown> | null;
};

export type GreenLightTraceSummary = Pick<
  GreenLightTraceRow,
  "id" | "created_at" | "event" | "job_id" | "rep_email" | "rep_name" | "prospect_name" | "show_type" | "input_type" | "zoom_link" | "document_url" | "doc_title" | "error"
> & { focus_chars: number; transcript_chars: number; letter_chars: number };

function readDatabase() {
  const sql = database();
  if (!sql) throw new Error("Trace storage unavailable");
  return sql;
}

/** Every row of one letter, oldest first, with the full text. */
export async function readGreenLightTrace(jobId: string) {
  const sql = readDatabase();
  await ensureTraceStorage();
  return (await sql`select id::text, created_at::text, event, job_id, rep_email, rep_name, prospect_name, show_type, input_type,
      zoom_link, focus_points, transcript, instructions, letter_before, letter_text, sections, document_url, doc_title, error, detail
    from green_light_letter_trace where job_id = ${jobId} order by id`) as GreenLightTraceRow[];
}

/** One row by its number, with the full text (for rows that belong to no letter, such as a Zoom request). */
export async function readGreenLightTraceRow(id: string) {
  const sql = readDatabase();
  await ensureTraceStorage();
  return (await sql`select id::text, created_at::text, event, job_id, rep_email, rep_name, prospect_name, show_type, input_type,
      zoom_link, focus_points, transcript, instructions, letter_before, letter_text, sections, document_url, doc_title, error, detail
    from green_light_letter_trace where id = ${id}::bigint`) as GreenLightTraceRow[];
}

/** Newest rows first, without the long text. Optional filters match part of a name, email or link. */
export async function listGreenLightTrace(filter: { prospect?: string; rep?: string; doc?: string; limit?: number }) {
  const sql = readDatabase();
  await ensureTraceStorage();
  const like = (value: string | undefined) => (value ? `%${value.replace(/[\\%_]/g, (match) => `\\${match}`)}%` : null);
  const prospect = like(filter.prospect);
  const rep = like(filter.rep);
  const doc = like(filter.doc);
  const limit = Math.min(Math.max(Math.trunc(filter.limit || 50), 1), 300);
  return (await sql`select id::text, created_at::text, event, job_id, rep_email, rep_name, prospect_name, show_type, input_type,
      zoom_link, document_url, doc_title, error,
      coalesce(length(focus_points), 0)::int as focus_chars, coalesce(length(transcript), 0)::int as transcript_chars,
      coalesce(length(letter_text), 0)::int as letter_chars
    from green_light_letter_trace
    where (${prospect}::text is null or prospect_name ilike ${prospect})
      and (${rep}::text is null or rep_email ilike ${rep} or rep_name ilike ${rep})
      and (${doc}::text is null or document_url ilike ${doc} or doc_title ilike ${doc})
    order by id desc limit ${limit}`) as GreenLightTraceSummary[];
}
