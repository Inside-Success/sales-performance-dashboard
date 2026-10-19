/**
 * Explicit, offline publication of ONE isolated review set.
 * No source-call, usage, Sheet, Slack or workflow writes.
 * Run with vite-node and a private JSON input. DATABASE_URL must be server-only.
 */
import fs from "node:fs";
import { neon } from "@neondatabase/serverless";
import { z } from "zod";
import { reportSchema, validateEvidence, REVIEW_RUN_ID } from "../src/lib/coaching-review/schema";
const input=z.object({
  reviewed:z.literal(true),
  prompt_hash:z.string().regex(/^[a-f0-9]{64}$/),
  source_versions:z.record(z.string(),z.string()),
  cost_usd:z.number().nonnegative().max(40),
  reserved_cost_usd:z.number().nonnegative().max(40),
  provider_calls:z.number().int().positive(),
  reports:z.array(z.object({
    meta:z.object({number:z.number().int().min(1).max(10),call_id:z.number().int().positive(),rep:z.string().min(1),prospect:z.string().min(1),date:z.string().datetime()}),
    report:reportSchema,
    evidence:z.array(z.object({id:z.string().regex(/^T\d{4}$/),text:z.string().min(1)})),
    writer:z.string().min(1),reviewer:z.string().min(1),audit:z.object({pass:z.literal(true),notes:z.string()}),
  })).length(10),
});
async function main(){
 const filename=process.argv[2];if(!filename)throw Error("Private input file required");
 const payload=input.parse(JSON.parse(fs.readFileSync(filename,"utf8")));
 if(new Set(payload.reports.map(r=>r.meta.number)).size!==10||new Set(payload.reports.map(r=>r.meta.call_id)).size!==10)throw Error("Ten distinct numbered calls required");
 const closes=payload.reports.filter(r=>r.report.outcome.payment==="confirmed").length;
 if(closes<1||closes>2)throw Error("This approved set requires one or two on-call confirmed payments");
 for(const r of payload.reports) {
   validateEvidence(r.report,r.evidence);
   if(new Set(r.evidence.map(b=>b.id)).size!==r.evidence.length)throw Error("Duplicate evidence");
 }
 if(!process.argv.includes("--publish")){console.log("Valid: ten reviewed reports. Dry run; no database access.");return;}
 if(!process.env.DATABASE_URL)throw Error("DATABASE_URL required");
 const sql=neon(process.env.DATABASE_URL);
 // One transaction. Duplicate run/result IDs abort instead of overwriting an existing experiment.
 const queries=[
  sql`insert into prompt_benchmark_runs (run_id,title,status,finished_at,total_cost_usd,total_provider_calls,source_payload)
      values (${REVIEW_RUN_ID},'Objection-first coaching review','completed',now(),${payload.cost_usd},${payload.provider_calls},${JSON.stringify({prompt_hash:payload.prompt_hash,source_versions:payload.source_versions,reserved_cost_usd:payload.reserved_cost_usd})}::jsonb)`,
  ...payload.reports.map(r=>sql`insert into prompt_benchmark_outputs
    (result_id,run_id,case_id,case_label,case_type,call_status,model,provider,call_mode,coaching_mode,output,ai_eval)
    values (${REVIEW_RUN_ID+"-"+r.meta.number},${REVIEW_RUN_ID},${String(r.meta.call_id)},${"Report "+r.meta.number},'isolated_review','scored',${r.writer},'anthropic','isolated','objection-review-v1',
    ${JSON.stringify({meta:r.meta,report:r.report,evidence:r.evidence})}::jsonb,
    ${JSON.stringify({published:true,reviewer:r.reviewer,audit:r.audit})}::jsonb)`)
 ];
 await sql.transaction(queries);
 const rows=await sql`select count(*)::int as count from prompt_benchmark_outputs where run_id=${REVIEW_RUN_ID} and ai_eval->>'published'='true'`;
 if(rows[0].count!==10)throw Error("Publication verification failed");
 console.log("Published and verified ten isolated reports.");
}
main().catch(e=>{console.error(e instanceof Error?e.message:"Publication failed");process.exitCode=1;});

