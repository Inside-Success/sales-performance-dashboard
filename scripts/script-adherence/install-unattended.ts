import {readFileSync} from 'node:fs';
import {neon} from '@neondatabase/serverless';
import {resultSchema} from '../../src/lib/script-adherence/contract';
import {metrics} from '../../src/lib/script-adherence/queue';
const sql=neon(process.env.DATABASE_URL!);
// Explicit additive migration; never executed by dashboard reads.
for(const statement of readFileSync('scripts/script-adherence/unattended-schema.sql','utf8').split(';').map(x=>x.trim()).filter(Boolean))await sql.query(statement);
const calls=await sql`select source_key,rep,started_at::text,result from script_adherence_calls`;
for(const c of calls){const r=resultSchema.parse(c.result),m=metrics(r,c.started_at);await sql`insert into script_adherence_metrics(source_key,rep,started_at,show,stage,script,complete,not_complete,unknown,not_applicable,actions) values(${c.source_key},${c.rep},${c.started_at},${r.show},${r.stage},${m.script},${m.complete},${m.notComplete},${m.unknown},${m.notApplicable},${JSON.stringify(m.actions)}::jsonb) on conflict(source_key) do nothing`;}
console.log({installed:true,indexedExistingCalls:calls.length,automaticProcessingEnabled:false});
