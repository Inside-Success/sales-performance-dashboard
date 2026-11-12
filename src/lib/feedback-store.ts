import "server-only";
import { neon } from "@neondatabase/serverless";
import { databaseUrl } from "./database-connection";

const sql = () => {
  const url = databaseUrl();
  if (!url) throw Error("Feedback storage unavailable");
  return neon(url);
};
let ready: Promise<void> | undefined;
export function ensureFeedbackStorage() {
  if (!ready) ready = (async () => {
    const db = sql();
    await db`create table if not exists feedback_transcriptions (
      id text primary key, viewer_email text not null, request_hash text not null,
      context jsonb not null, status text not null default 'pending', transcript text,
      provider_request_id text, usage jsonb, elapsed_ms integer,
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    )`;
    await db`create index if not exists feedback_transcriptions_viewer_time on feedback_transcriptions(viewer_email,created_at)`;
    await db`create unique index if not exists feedback_transcriptions_one_pending on feedback_transcriptions(viewer_email) where status='pending'`;
    await db`create table if not exists coaching_report_feedback (
      id text primary key, viewer_email text not null, payload_hash text not null,
      payload jsonb not null, sheet_status text not null default 'pending',
      created_at timestamptz not null default now(), updated_at timestamptz not null default now()
    )`;
  })().catch(error => { ready = undefined; throw error; });
  return ready;
}

export async function reserveVoiceRequest(id: string, email: string, hash: string, context: unknown) {
  await ensureFeedbackStorage();
  const db = sql();
  const results = await db.transaction([
    db`select pg_advisory_xact_lock(hashtextextended(${email},0))`,
    db`update feedback_transcriptions set status='uncertain',updated_at=now() where viewer_email=${email} and status='pending' and created_at<now()-interval '5 minutes'`,
    db`update feedback_transcriptions set transcript=null where viewer_email=${email} and transcript is not null and created_at<now()-interval '1 day'`,
    db`with inserted as (
      insert into feedback_transcriptions(id,viewer_email,request_hash,context)
      select ${id},${email},${hash},${JSON.stringify(context)}::jsonb
      where not exists(select 1 from feedback_transcriptions where viewer_email=${email} and status='pending')
      and (select count(*) from feedback_transcriptions where viewer_email=${email} and created_at>now()-interval '1 hour')<20
      on conflict(id) do nothing returning *,true as fresh
    ) select * from inserted union all
      select *,false as fresh from feedback_transcriptions where id=${id} and not exists(select 1 from inserted)`,
  ]);
  const row = results[3][0];
  if (!row) return { state: "limited" as const };
  if (row.viewer_email !== email || row.request_hash !== hash) return { state: "conflict" as const };
  if (row.fresh) return { state: "new" as const };
  if (row.status === "complete" && row.transcript) return { state: "complete" as const, text: String(row.transcript) };
  return { state: "held" as const };
}

export async function finishVoiceRequest(id: string, status: "complete" | "failed" | "uncertain", text: string | null, requestId: string | null, usage: unknown, elapsed: number) {
  await sql()`update feedback_transcriptions set status=${status},transcript=${text},provider_request_id=${requestId},usage=${JSON.stringify(usage ?? null)}::jsonb,elapsed_ms=${elapsed},updated_at=now() where id=${id} and status='pending'`;
}

export async function saveCoachingFeedback(id: string, email: string, hash: string, payload: unknown) {
  await ensureFeedbackStorage();
  const db = sql();
  // A single insert owns forwarding. A replay never blindly resends a Sheet append.
  const created = await db`insert into coaching_report_feedback(id,viewer_email,payload_hash,payload) values(${id},${email},${hash},${JSON.stringify(payload)}::jsonb) on conflict(id) do nothing returning id`;
  const rows = await db`select viewer_email,payload_hash,sheet_status from coaching_report_feedback where id=${id}`;
  if (rows[0]?.viewer_email !== email || rows[0]?.payload_hash !== hash) return { conflict: true, fresh: false };
  return { conflict: false, fresh: created.length > 0 };
}

export async function markCoachingFeedbackForward(id: string, state: "received" | "uncertain") {
  await sql()`update coaching_report_feedback set sheet_status=${state},updated_at=now() where id=${id} and sheet_status='pending'`;
}

export async function saveFaqDislikeOnce(id: string, email: string, conversationId: string, messageId: string, comment: string) {
  const db = sql();
  const inserted = await db`insert into ask_sales_faq_feedback(id,message_id,conversation_id,viewer_email,rating,comment)
    select ${id},m.id,m.conversation_id,m.viewer_email,'down',${comment}
    from ask_sales_faq_messages m where m.id=${messageId} and m.conversation_id=${conversationId} and m.viewer_email=${email} and m.role='assistant'
    on conflict(id) do nothing returning id`;
  const rows = await db`select id from ask_sales_faq_feedback where id=${id} and viewer_email=${email} and conversation_id=${conversationId} and message_id=${messageId} and rating='down' and comment=${comment}`;
  return { found: rows.length > 0, fresh: inserted.length > 0 };
}
