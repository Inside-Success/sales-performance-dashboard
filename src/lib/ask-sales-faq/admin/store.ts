import "server-only";
import { neon } from "@neondatabase/serverless";
import { buildAskSalesFaqRepReviewKey } from "../admin-rep-review";
import type { Filters } from "./filters";
const db = () => {
  if (!process.env.DATABASE_URL) throw new Error("Database unavailable");
  return neon(process.env.DATABASE_URL);
};
export const adminEmails = () =>
  (process.env.ASK_SALES_FAQ_ADMIN_EMAILS || "")
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
const failure = `(m.error_class is not null or m.outcome in ('safe_fallback','rate_limited','duplicate_in_progress','feature_disabled','auth_blocked','validation_error'))`;
const unanswered = `(m.outcome in ('low_confidence_route','abstain_unapproved') or m.answer_payload #>> '{runtimeMetadata,revamp,status}' in ('knowledge_gap','conflict','partial'))`;
const base = `with scoped as (
 select m.*, c.viewer_name, c.title, ${failure} as failed, coalesce(${unanswered},false) as unanswered,
 f.rating, f.comment, greatest(m.created_at,coalesce(f.created_at,m.created_at)) as event_at from ask_sales_faq_messages m join ask_sales_faq_conversations c on c.id=m.conversation_id
 left join lateral (select rating,comment,created_at from ask_sales_faq_feedback where message_id=m.id order by created_at desc,id desc limit 1) f on true
 where c.status <> 'deleted' and m.created_at >= ($1::date::timestamp at time zone 'America/New_York')
 and m.created_at < (($2::date+1)::timestamp at time zone 'America/New_York')
 and ($3::boolean or not(lower(m.viewer_email)=any($4::text[])))
 and ($5='' or lower(m.viewer_email)=$5)
), threads as (
 select conversation_id as id, max(viewer_email) as email, max(viewer_name) as name, max(title) as title,
 max(created_at)::text as last_at, count(*)::int as messages, count(*) filter(where role='user')::int as questions,
 bool_or(failed) as failed,bool_or(unanswered) as unanswered,bool_or(rating='down') as down,
 bool_or($6='' or strpos(lower(content_redacted),lower($6))>0 or strpos(lower(coalesce(viewer_name,'')||' '||viewer_email),lower($6))>0) as matches
 from scoped group by conversation_id
)`;
function args(f: Filters) {
  return [f.start, f.end, f.includeAdmins, adminEmails(), f.rep, f.q];
}
export async function getConversationOverview(f: Filters) {
  const sql = db();
  const reps = await sql.query(
    `select lower(viewer_email) as email,max(viewer_name) as name from ask_sales_faq_conversations where status<>'deleted' group by lower(viewer_email) order by name nulls last,email`,
  );
  const scopedFilters = {
    ...f,
    rep: f.rep
      ? String(
          reps.find(
            (r) => buildAskSalesFaqRepReviewKey(String(r.email)) === f.rep,
          )?.email || "unmatched.invalid",
        )
      : "",
  };
  const [metrics, rows] = await Promise.all([
    sql.query(
      base +
        ` select count(*) filter(where role='user')::int as questions,count(distinct viewer_email) filter(where role='user')::int as people,count(*) filter(where rating='up')::int as up,count(*) filter(where rating='down')::int as down,count(*) filter(where role='assistant' and failed)::int as failures from scoped`,
      args(scopedFilters),
    ),
    sql.query(
      base +
        ` select t.*, (coalesce(r.reviewed,false) and r.reviewed_through >= (select max(greatest(m.created_at,coalesce((select max(f.created_at) from ask_sales_faq_feedback f where f.message_id=m.id),m.created_at))) from ask_sales_faq_messages m where m.conversation_id=t.id)) as reviewed, count(*) over()::int as total from threads t left join ask_sales_faq_admin_reviews r on r.conversation_id=t.id where matches
 and ($7='all' or ($7='attention' and (failed or unanswered or down)) or ($7='down' and down) or ($7='failed' and failed) or ($7='unanswered' and unanswered)) and ($9='all' or ($9='reviewed')=(coalesce(r.reviewed,false) and r.reviewed_through >= (select max(greatest(m.created_at,coalesce((select max(f.created_at) from ask_sales_faq_feedback f where f.message_id=m.id),m.created_at))) from ask_sales_faq_messages m where m.conversation_id=t.id))) order by last_at desc,t.id desc limit 30 offset $8`,
      [...args(scopedFilters), f.filter, (f.page - 1) * 30, f.review],
    ),
  ]);
  return {
    metrics: metrics[0] as Record<string, number>,
    rows: rows as Thread[],
    reps: reps
      .map((r) => ({
        key: buildAskSalesFaqRepReviewKey(String(r.email)) || "",
        email: String(r.email),
        name: r.name ? String(r.name) : null,
      }))
      .filter((r) => r.key),
  };
}
export type Thread = {
  id: string;
  email: string;
  name: string | null;
  title: string | null;
  last_at: string;
  messages: number;
  questions: number;
  failed: boolean;
  unanswered: boolean;
  down: boolean;
  total: number;
  reviewed: boolean;
};
export async function getConversation(id: string) {
  const sql = db();
  const c = await sql.query(
    `select id,viewer_name as name,viewer_email as email,title from ask_sales_faq_conversations where id=$1 and status<>'deleted'`,
    [id],
  );
  if (!c.length) return null;
  const messages = await sql.query(
    `select m.id,m.role,m.content_redacted as text,m.created_at::text as date,m.provider,m.model,m.latency_ms,m.error_class,to_char(greatest(m.created_at,coalesce(f.created_at,m.created_at)) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.US"Z"') as event_at,m.source_label,m.answer_payload->'source' as source,${failure} as failed,coalesce(${unanswered},false) as unanswered,f.rating,f.comment from ask_sales_faq_messages m left join lateral(select rating,comment,created_at from ask_sales_faq_feedback where message_id=m.id order by created_at desc,id desc limit 1) f on true where m.conversation_id=$1 order by m.created_at,m.id`,
    [id],
  );
  return {
    conversation: c[0] as {
      id: string;
      name: string | null;
      email: string;
      title: string | null;
    },
    messages: messages as Message[],
  };
}
export type Message = {
  id: string;
  role: string;
  text: string;
  date: string;
  event_at: string;
  provider: string | null;
  model: string | null;
  latency_ms: number | null;
  error_class: string | null;
  source_label: string | null;
  source: unknown;
  failed: boolean;
  unanswered: boolean;
  rating: string | null;
  comment: string | null;
};
export async function getUsage(f: Filters) {
  const sql = db();
  const [users, daily] = await Promise.all([
    sql.query(
      base +
        `, identities as (
 select lower(viewer_email) as email,max(viewer_name) as name from dashboard_usage_events where viewer_email is not null and viewer_is_mapped and created_at>=now()-interval '30 days' group by lower(viewer_email)
 union all select lower(rep_email),max(rep_name) from performance_calls where rep_email is not null and trim(rep_email)<>'' and coalesce(call_date,created_at)>=now()-interval '30 days' group by lower(rep_email)
 union all select lower(viewer_email),max(viewer_name) from ask_sales_faq_conversations where status<>'deleted' group by lower(viewer_email)
 ), roster as (select email,max(name) as name from identities where ($3 or not(email=any($4::text[]))) group by email), activity as (
 select lower(viewer_email) as email,count(*)::int as questions,count(distinct (created_at at time zone 'America/New_York')::date)::int as days from scoped where role='user' group by lower(viewer_email)
 ), lifetime as (select lower(m.viewer_email) as email,max(m.created_at)::text as last_at,count(*)::int as total from ask_sales_faq_messages m join ask_sales_faq_conversations c on c.id=m.conversation_id where m.role='user' and c.status<>'deleted' group by lower(m.viewer_email))
 select r.*,coalesce(a.questions,0)::int as questions,coalesce(a.days,0)::int as days,l.last_at,coalesce(l.total,0)::int as total from roster r left join activity a using(email) left join lifetime l using(email) order by questions desc,email`,
      args(f),
    ),
    sql.query(
      base +
        ` select d.day::date::text as day,count(s.id)::int as questions,count(distinct lower(s.viewer_email))::int as people from generate_series($1::date,$2::date,interval '1 day') d(day) left join scoped s on s.role='user' and (s.created_at at time zone 'America/New_York')::date=d.day::date group by d.day order by d.day`,
      args(f),
    ),
  ]);
  return {
    users: (users as UsageUser[]).map((u) => ({
      ...u,
      repKey: buildAskSalesFaqRepReviewKey(u.email) || "",
    })),
    daily: daily as { day: string; questions: number; people: number }[],
  };
}
export type UsageUser = {
  repKey: string;
  email: string;
  name: string | null;
  questions: number;
  days: number;
  last_at: string | null;
  total: number;
};
export async function getReview(id: string) {
  const rows = await db().query(
    `select reviewed,note,actor,version,updated_at::text,reviewed_through::text from ask_sales_faq_admin_reviews where conversation_id=$1`,
    [id],
  );
  return (
    (rows[0] as
      | {
          reviewed: boolean;
          note: string;
          actor: string;
          version: number;
          updated_at: string;
          reviewed_through: string;
        }
      | undefined) || null
  );
}
export async function saveReview(
  id: string,
  actor: string,
  input: { reviewed: boolean; note: string; version: number; through: string },
) {
  const rows = await db().query(
    `insert into ask_sales_faq_admin_reviews(conversation_id,reviewed,note,actor,reviewed_through)
 select id,$2,$3,$4,$5::timestamptz from ask_sales_faq_conversations where id=$1 and status<>'deleted' and ($6=0 or exists(select 1 from ask_sales_faq_admin_reviews where conversation_id=$1))
 on conflict(conversation_id) do update set reviewed=excluded.reviewed,note=excluded.note,actor=excluded.actor,reviewed_through=excluded.reviewed_through,version=ask_sales_faq_admin_reviews.version+1,updated_at=now() where ask_sales_faq_admin_reviews.version=$6
 returning version`,
    [id, input.reviewed, input.note, actor, input.through, input.version],
  );
  return rows.length > 0;
}
