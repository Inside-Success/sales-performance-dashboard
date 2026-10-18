import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import { type CheckpointInput, retryableProviderFailure, validProviderResult } from "./provider-checkpoint-policy";
import { coachingStage, normalizeCoaching, coachingContractErrors, CONTRACT_REVISION } from "./coaching-reliability-policy.mjs";

let schema: Promise<void> | null = null;
function database() {
  if (!process.env.DATABASE_URL) throw Error("Checkpoint database unavailable");
  return neon(process.env.DATABASE_URL);
}
async function ensureSchema() {
  if (!schema) schema = (async () => {
    const sql = database();
    await sql`create table if not exists coaching_provider_checkpoints (
      checkpoint_key text primary key, source_id text not null, stage text not null, provider text not null,
      request_hash text not null, status text not null check (status in ('running','completed','failed')),
      owner_token uuid not null, lease_until timestamptz not null, attempts integer not null default 1,
      result jsonb, last_error text, next_attempt_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )`;
    await sql`create index if not exists coaching_provider_checkpoints_updated_idx on coaching_provider_checkpoints(updated_at)`;
    await sql`create table if not exists coaching_provider_health (
      provider text primary key, failures integer not null default 0,
      open_until timestamptz not null default now(), probe_until timestamptz not null default now()
    )`;
  })().catch(error => { schema = null; throw error; });
  return schema;
}

// One atomic row owns each exact request. Prompts/transcripts are never copied here.
export async function providerCheckpoint(input: CheckpointInput) {
  await ensureSchema();
  const sql = database();
  if (input.action === "source_status") {
    const checkpoints = await sql`select stage,status,attempts,lease_until::text,next_attempt_at::text,updated_at::text,last_error
      from coaching_provider_checkpoints where source_id=${input.source_id} and status<>'completed'
      order by updated_at desc limit 10`;
    return {source_id:input.source_id,checkpoints};
  }
  const key = createHash("sha256").update(JSON.stringify([input.source_id, input.stage, input.provider, input.request_hash])).digest("hex");
  if (input.action === "claim") {
    const existing = await sql`select result from coaching_provider_checkpoints where checkpoint_key=${key} and status='completed'`;
    if (existing[0]) {
      const result = {...existing[0].result};
      if (coachingStage(input.stage)) {
        result.call_purpose=input.stage;
        result.parsed_json=normalizeCoaching(result.parsed_json);
        result.model_text=JSON.stringify(result.parsed_json);
        result.contract_revision=CONTRACT_REVISION;
      }
      if (validProviderResult(result)) return { status: "cached", result };
      // Retain the rejected output for diagnosis. Only this exact invalid request can be retried.
      await sql`update coaching_provider_checkpoints set status='failed',last_error='Invalid coaching contract in cached result',
        next_attempt_at=now(),updated_at=now() where checkpoint_key=${key} and status='completed'`;
    }
    await sql`delete from coaching_provider_checkpoints where checkpoint_key in
      (select checkpoint_key from coaching_provider_checkpoints where status<>'running' and updated_at<now()-interval '14 days' limit 100)`;
    await sql`insert into coaching_provider_health(provider) values (${input.provider}) on conflict do nothing`;
    const health = await sql`select failures,open_until,probe_until from coaching_provider_health where provider=${input.provider}`;
    if (Number(health[0]?.failures) >= 3) {
      const probe = await sql`update coaching_provider_health set probe_until=now()+interval '10 minutes'
        where provider=${input.provider} and failures>=3 and open_until<=now() and probe_until<=now() returning provider`;
      if (!probe.length) return { status: "deferred", retry_at: health[0].open_until, reason: "provider_cooldown" };
    }
    const token = randomUUID();
    const claimed = await sql`insert into coaching_provider_checkpoints
      (checkpoint_key,source_id,stage,provider,request_hash,status,owner_token,lease_until)
      values (${key},${input.source_id},${input.stage},${input.provider},${input.request_hash},'running',${token},now()+interval '10 minutes')
      on conflict (checkpoint_key) do update set status='running',owner_token=excluded.owner_token,
        lease_until=excluded.lease_until,attempts=coaching_provider_checkpoints.attempts+1,updated_at=now()
      where (coaching_provider_checkpoints.status='running' and coaching_provider_checkpoints.lease_until<now())
        or (coaching_provider_checkpoints.status='failed' and coaching_provider_checkpoints.next_attempt_at<=now())
      returning owner_token`;
    if (claimed.length) return { status: "acquired", token };
    const rows = await sql`select status,result,lease_until,next_attempt_at from coaching_provider_checkpoints where checkpoint_key=${key}`;
    const row = rows[0];
    if (row?.status === "completed") return { status: "cached", result: row.result };
    return { status: "deferred", retry_at: row?.status === "running" ? row.lease_until : row?.next_attempt_at };
  }
  if (input.action === "complete") {
    const normalized:Record<string,unknown> = {...input.result,call_purpose:input.stage};
    if (coachingStage(input.stage)) {
      normalized.parsed_json=normalizeCoaching(normalized.parsed_json);
      normalized.model_text=JSON.stringify(normalized.parsed_json);
      normalized.contract_revision=CONTRACT_REVISION;
    }
    if (coachingStage(input.stage) && !validProviderResult(normalized) && validProviderResult({...normalized,call_purpose:undefined})) {
      // Parsed coaching must reach the existing bounded targeted repair. It must
      // not become a completed/reusable provider checkpoint before that repair.
      const reason='Invalid coaching contract: '+coachingContractErrors(normalized.parsed_json).join('; ');
      const rejected={...normalized};delete rejected.raw_response;
      const rows=await sql`update coaching_provider_checkpoints set status='failed',result=${JSON.stringify(rejected)}::jsonb,
        last_error=${reason},next_attempt_at=now(),updated_at=now()
        where checkpoint_key=${key} and owner_token=${input.token} and status='running' returning checkpoint_key`;
      if(!rows.length) {
        const prior=await sql`select status,owner_token,last_error from coaching_provider_checkpoints where checkpoint_key=${key}`;
        if(prior[0]?.status!=='failed'||prior[0]?.owner_token!==input.token||prior[0]?.last_error!==reason)throw Error('Checkpoint ownership changed; rejection refused');
      }
      return {status:'rejected_contract',repair_required:true};
    }
    if (!validProviderResult(normalized)) throw Error("Invalid structured provider result; checkpoint refused");
    // raw_response duplicates the text and may contain reasoning; retain normalized fields only.
    const result = { ...normalized };
    delete result.raw_response;
    const rows = await sql`update coaching_provider_checkpoints set status='completed',result=${JSON.stringify(result)}::jsonb,
      last_error=null,updated_at=now() where checkpoint_key=${key} and owner_token=${input.token} and status='running'
      returning checkpoint_key`;
    if (!rows.length) {
      const prior = await sql`select status,owner_token from coaching_provider_checkpoints where checkpoint_key=${key}`;
      if (prior[0]?.status !== "completed" || prior[0]?.owner_token !== input.token) throw Error("Checkpoint ownership changed; completion refused");
    }
    await sql`update coaching_provider_health set failures=0,open_until=now(),probe_until=now() where provider=${input.provider}`;
    return { status: "completed" };
  }
  const transient = retryableProviderFailure(input.error);
  const failed = await sql`update coaching_provider_checkpoints set status='failed',last_error=${input.error},
    next_attempt_at=now()+case when ${transient} then interval '5 minutes' else interval '24 hours' end,updated_at=now()
    where checkpoint_key=${key} and owner_token=${input.token} and status='running' returning checkpoint_key`;
  if (failed.length && transient) await sql`update coaching_provider_health set failures=failures+1,
    open_until=case when failures+1>=3 then now()+interval '5 minutes' else open_until end,
    probe_until=now() where provider=${input.provider}`;
  return { status: "failed", retryable: transient };
}
