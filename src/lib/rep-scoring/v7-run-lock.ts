import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";

export const V7_CHECKPOINT_RUN_KEY = "v7.1-checkpoint-250-2026-08-13";
export const V7_CHECKPOINT_BOUNDARY = "2026-08-03T04:00:00.000Z";
export const V7_CHECKPOINT_TARGET = 250;

export type V7RunState = "active" | "dispatched" | "completed" | "failed";
export type V7RunStatus = {
  runKey: string; scorerVersion: string; boundaryStart: string; targetCalls: number; state: V7RunState;
  selectedCalls: number; workerBatches: number; finalizedCalls: number; scoredCalls: number; fairExclusions: number;
  attempt: number; leaseExpiresAt: string; createdAt: string; updatedAt: string; dispatchedAt: string;
  completedAt: string; failureReason: string;
};
type RunRow = {
  run_key: string; scorer_version: string; boundary_start: string | Date; target_calls: number; state: V7RunState;
  selected_calls: number; worker_batches: number; finalized_calls: number; scored_calls: number; fair_exclusions: number;
  attempt: number; lease_expires_at: string | Date; created_at: string | Date; updated_at: string | Date;
  dispatched_at: string | Date | null; completed_at: string | Date | null; failure_reason: string | null;
};

let schemaPromise: Promise<void> | null = null;

function sql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  return neon(process.env.DATABASE_URL);
}

async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      const query = sql();
      await query`
        create table if not exists rep_scoring_v7_runs (
          run_key text primary key,
          scorer_version text not null,
          boundary_start timestamptz not null,
          target_calls integer not null check (target_calls > 0),
          state text not null check (state in ('active', 'dispatched', 'completed', 'failed')),
          token_hash text not null,
          selected_calls integer not null default 0 check (selected_calls >= 0),
          worker_batches integer not null default 0 check (worker_batches >= 0),
          finalized_calls integer not null default 0 check (finalized_calls >= 0),
          scored_calls integer not null default 0 check (scored_calls >= 0),
          fair_exclusions integer not null default 0 check (fair_exclusions >= 0),
          attempt integer not null default 1 check (attempt > 0),
          lease_expires_at timestamptz not null,
          dispatched_at timestamptz,
          completed_at timestamptz,
          failure_reason text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now(),
          check (selected_calls <= target_calls),
          check (finalized_calls <= target_calls),
          check (scored_calls + fair_exclusions <= finalized_calls)
        )
      `;
      await query`create index if not exists rep_scoring_v7_runs_state_idx on rep_scoring_v7_runs (state, updated_at desc)`;
    })().catch((error) => { schemaPromise = null; throw error; });
  }
  return schemaPromise;
}

export async function acquireV7Run(input: { runKey: string; scorerVersion: string; boundaryStart: string; targetCalls: number }) {
  assertRunDefinition(input);
  await ensureSchema();
  const query = sql();
  const token = randomUUID();
  const tokenHash = hashToken(token);
  const rows = await query`
    insert into rep_scoring_v7_runs (run_key, scorer_version, boundary_start, target_calls, state, token_hash, lease_expires_at)
    values (${input.runKey}, ${input.scorerVersion}, ${input.boundaryStart}, ${input.targetCalls}, 'active', ${tokenHash}, now() + interval '30 minutes')
    on conflict (run_key) do update set
      scorer_version = excluded.scorer_version, boundary_start = excluded.boundary_start, target_calls = excluded.target_calls,
      state = 'active', token_hash = excluded.token_hash, selected_calls = 0, worker_batches = 0, finalized_calls = 0,
      scored_calls = 0, fair_exclusions = 0, attempt = rep_scoring_v7_runs.attempt + 1,
      lease_expires_at = now() + interval '30 minutes', dispatched_at = null, completed_at = null,
      failure_reason = null, updated_at = now()
    where rep_scoring_v7_runs.state = 'failed'
       or (rep_scoring_v7_runs.state = 'active' and rep_scoring_v7_runs.selected_calls = 0 and rep_scoring_v7_runs.lease_expires_at < now())
    returning *
  ` as RunRow[];
  if (rows[0]) return { acquired: true, token, run: normalize(rows[0]) };
  return { acquired: false, token: "", run: await getV7Run(input.runKey) };
}

export async function markV7RunDispatched(runKey: string, token: string, selectedCalls: number, workerBatches: number) {
  if (!Number.isInteger(selectedCalls) || selectedCalls <= 0) throw new Error("selectedCalls must be a positive integer");
  if (!Number.isInteger(workerBatches) || workerBatches <= 0) throw new Error("workerBatches must be a positive integer");
  await ensureSchema();
  const query = sql();
  const rows = await query`
    update rep_scoring_v7_runs set state = 'dispatched', selected_calls = ${selectedCalls}, worker_batches = ${workerBatches},
      dispatched_at = now(), lease_expires_at = now() + interval '6 hours', updated_at = now()
    where run_key = ${runKey} and token_hash = ${hashToken(token)} and state = 'active'
      and selected_calls = 0 and target_calls = ${selectedCalls}
    returning *
  ` as RunRow[];
  if (!rows[0]) throw new Error("Run dispatch was refused because the lock is missing, stale, duplicated, or the selected count is not exact");
  return normalize(rows[0]);
}

export async function completeV7Run(runKey: string, token: string, input: { finalizedCalls: number; scoredCalls: number; fairExclusions: number }) {
  const { finalizedCalls, scoredCalls, fairExclusions } = input;
  if (![finalizedCalls, scoredCalls, fairExclusions].every(Number.isInteger)) throw new Error("Run totals must be integers");
  if (finalizedCalls < 0 || scoredCalls < 0 || fairExclusions < 0 || scoredCalls + fairExclusions > finalizedCalls) throw new Error("Run totals are inconsistent");
  await ensureSchema();
  const query = sql();
  const rows = await query`
    update rep_scoring_v7_runs set
      state = case when ${finalizedCalls} = target_calls then 'completed' else state end,
      finalized_calls = ${finalizedCalls}, scored_calls = ${scoredCalls}, fair_exclusions = ${fairExclusions},
      completed_at = case when ${finalizedCalls} = target_calls then now() else completed_at end,
      lease_expires_at = case when ${finalizedCalls} = target_calls then now() else now() + interval '30 minutes' end,
      updated_at = now()
    where run_key = ${runKey} and token_hash = ${hashToken(token)} and state in ('active', 'dispatched')
      and ${finalizedCalls} <= target_calls
    returning *
  ` as RunRow[];
  if (!rows[0]) throw new Error("Run progress update was refused");
  return normalize(rows[0]);
}

export async function failV7Run(runKey: string, token: string, reason: string) {
  await ensureSchema();
  const query = sql();
  const rows = await query`
    update rep_scoring_v7_runs set state = 'failed', failure_reason = ${reason.slice(0, 1000)}, lease_expires_at = now(), updated_at = now()
    where run_key = ${runKey} and token_hash = ${hashToken(token)} and state = 'active' and selected_calls = 0
    returning *
  ` as RunRow[];
  if (!rows[0]) throw new Error("Only an undispatched active run can be marked failed");
  return normalize(rows[0]);
}

export async function getV7Run(runKey: string): Promise<V7RunStatus | null> {
  await ensureSchema();
  const query = sql();
  const rows = await query`select * from rep_scoring_v7_runs where run_key = ${runKey} limit 1` as RunRow[];
  return rows[0] ? normalize(rows[0]) : null;
}

function assertRunDefinition(input: { runKey: string; scorerVersion: string; boundaryStart: string; targetCalls: number }) {
  if (!/^[a-z0-9][a-z0-9._:-]{7,119}$/i.test(input.runKey)) throw new Error("Invalid runKey");
  if (!input.scorerVersion.trim()) throw new Error("scorerVersion is required");
  if (!Number.isFinite(Date.parse(input.boundaryStart))) throw new Error("boundaryStart must be an ISO timestamp");
  if (!Number.isInteger(input.targetCalls) || input.targetCalls <= 0 || input.targetCalls > 1000) throw new Error("targetCalls must be an integer from 1 to 1000");
}
function hashToken(token: string) { if (!token) throw new Error("Run token is required"); return createHash("sha256").update(token).digest("hex"); }
function normalize(row: RunRow): V7RunStatus { return {
  runKey: row.run_key, scorerVersion: row.scorer_version, boundaryStart: iso(row.boundary_start), targetCalls: Number(row.target_calls), state: row.state,
  selectedCalls: Number(row.selected_calls), workerBatches: Number(row.worker_batches), finalizedCalls: Number(row.finalized_calls),
  scoredCalls: Number(row.scored_calls), fairExclusions: Number(row.fair_exclusions), attempt: Number(row.attempt),
  leaseExpiresAt: iso(row.lease_expires_at), createdAt: iso(row.created_at), updatedAt: iso(row.updated_at),
  dispatchedAt: iso(row.dispatched_at), completedAt: iso(row.completed_at), failureReason: row.failure_reason || "",
}; }
function iso(value: string | Date | null) { if (!value) return ""; const date = value instanceof Date ? value : new Date(value); return Number.isNaN(date.getTime()) ? "" : date.toISOString(); }
