import "server-only";
import { randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { currentScoreFields } from "./current-policy";

export const BACKFILL_RUN = "september-bounded-2026-09-10";
const db = () => neon(process.env.DATABASE_URL!);

export async function backfillProgress() {
  const sql = db();
  try {
    const rows = await sql`select r.state, r.budget, r.spent, r.in_flight,
      count(j.*)::int as total,
      count(*) filter(where j.state='completed')::int as completed,
      count(*) filter(where j.state='excluded')::int as excluded,
      count(*) filter(where j.state in ('failed','review_required'))::int as failed,
      count(*) filter(where j.state in ('claimed','computed') and j.updated_at < now()-interval '20 minutes')::int as stalled
      from mm_september_runs r join mm_september_jobs j using(run_id)
      where r.run_id=${BACKFILL_RUN} group by r.run_id`;
    return rows[0] || null;
  } catch { return null; }
}

export async function claimBackfill(executionId: string) {
  if (!/^\d+$/.test(executionId)) throw Error("Execution identity required");
  const sql = db();
  const token = randomUUID();
  // A job is never automatically reclaimed after an uncertain paid request.
  // Both budget and concurrency are updated atomically on the locked run row.
  const jobs = await sql`with candidate as (
      select id from mm_september_jobs where run_id=${BACKFILL_RUN} and state='pending'
      order by id for update skip locked limit 1
    ), permit as (
      update mm_september_runs set in_flight=in_flight+1, reserved=reserved+3, started=started+1
      where run_id=${BACKFILL_RUN} and state='running' and in_flight<5
      and started<dispatch_limit and spent+reserved+3<=budget
      and exists(select 1 from candidate) returning run_id
    ) update mm_september_jobs set state='claimed', token=${token}, execution_id=${executionId}, updated_at=now()
      where id in(select id from candidate) and exists(select 1 from permit)
      returning id, token, payload`;
  return jobs[0] ? { hasJob: true, job: jobs[0] } : { hasJob: false };
}

export async function failBackfillExecution(executionId: string) {
  const sql=db();
  await sql`update mm_september_runs set state='paused' where run_id=${BACKFILL_RUN} and state='running'`;
  const jobs=await sql`select id,token,state from mm_september_jobs where run_id=${BACKFILL_RUN} and execution_id=${executionId}`;
  const job=jobs[0];
  if(job?.state==='claimed') return completeBackfill({id:job.id,token:job.token,cost:3,result:{error:'Worker failed; conservative reserve retained pending usage reconciliation'}});
  // Computed results remain available for storage-only recovery, never a new AI run.
  return {ok:true,paused:true};
}

export async function completeBackfill(body: Record<string, unknown>) {
  const sql = db();
  const id = Number(body.id), token = String(body.token || "");
  const rows = await sql`select * from mm_september_jobs where id=${id} and run_id=${BACKFILL_RUN} and token=${token}`;
  const job = rows[0];
  if (!job) throw Error("Unknown job claim");
  if (["completed","excluded","failed","review_required"].includes(job.state)) return { ok: true, state: job.state };
  const result = (job.result || body.result || {}) as Record<string, unknown>;
  const cost = job.result ? Number(job.cost) : Number(body.cost);
  if (!Number.isFinite(cost) || cost<0 || cost>3) throw Error("Cost outside reserved allowance; reconcile execution");
  const fields = result.scoreFields as Record<string, unknown> | undefined;
  const payload = job.payload as Record<string, unknown>;
  if (fields && (fields["Source Record ID"] !== payload.source_record_id || fields["Scored Rep Email"] !== payload.rep_email || fields["Meeting Start At"] !== payload.call_date || fields["Assessment ID"] !== `magic-mike-call2-evidence-score-v2:${payload.source_record_id}`)) throw Error("Score identity mismatch");
  // Save the paid result before any Airtable operation. Retrying storage reuses it.
  await sql`update mm_september_jobs set state='computed', result=${JSON.stringify(result)}::jsonb, cost=${cost}, updated_at=now()
    where id=${id} and token=${token} and state='claimed'`;
  let state = "review_required";
  if (result.error) state="failed";
  else if (result.excluded === true) state="excluded";
  else if (fields && currentScoreFields(fields)) {
    const credential=process.env.REP_SCORING_AIRTABLE_TOKEN;
    if(!credential) throw Error("Score store unavailable");
    const url=`https://api.airtable.com/v0/${process.env.REP_SCORING_AIRTABLE_BASE_ID || "appEQQkTlJnc7tJgi"}/${encodeURIComponent(process.env.REP_SCORING_CALL_SCORES_TABLE || "call_scores")}`;
    const response=await fetch(url,{method:"PATCH",headers:{Authorization:`Bearer ${credential}`,"Content-Type":"application/json"},body:JSON.stringify({performUpsert:{fieldsToMergeOn:["Assessment ID"]},records:[{fields}]}),signal:AbortSignal.timeout(20000)});
    if(!response.ok) throw Error(`Score persistence failed (${response.status}); paid result saved`);
    const saved=await response.json();
    if(saved.records?.length!==1 || saved.records[0].fields?.["Assessment ID"]!==fields["Assessment ID"] || saved.records[0].fields?.["Composite Score"]!==fields["Composite Score"]) throw Error("Persistence verification failed");
    state="completed";
  }
  await sql`with finished as (
    update mm_september_jobs set state=${state}, updated_at=now() where id=${id} and token=${token} and state='computed' returning cost
  ) update mm_september_runs set spent=spent+coalesce((select cost from finished),0),
    reserved=reserved-case when exists(select 1 from finished) then 3 else 0 end,
    in_flight=in_flight-case when exists(select 1 from finished) then 1 else 0 end
    where run_id=${BACKFILL_RUN}`;
  await sql`update mm_september_runs set state=case
      when not exists(select 1 from mm_september_jobs where run_id=${BACKFILL_RUN} and state in ('pending','claimed','computed')) then 'completed'
      when in_flight=0 and (spent+3>budget or started>=dispatch_limit) then 'paused'
      else state end where run_id=${BACKFILL_RUN}`;
  return { ok:true, state };
}
