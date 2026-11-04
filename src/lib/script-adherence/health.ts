import 'server-only';
import {neon} from '@neondatabase/serverless';
import {healthState,type HealthState} from './health-state';
export type OperatorHealth={state:HealthState;lastCheck:string|null;active:number;held:number;spent:number;reserved:number;ceiling:number|null};
export async function readOperatorHealth(email:string|null|undefined):Promise<OperatorHealth|null>{
 // The diagnostic data never crosses the server boundary for other managers.
 if(email?.trim().toLowerCase()!=='syed.haider@insidesuccess.com')return null;
 try{
 const sql=neon(process.env.DATABASE_URL!);
 const [rows]=await sql`select c.enabled,jsonb_array_length(c.canary_keys)::int as canary,r.last_success_at::text as last_check,(r.error is not null or r.source_error is not null) as runner_error,b.committed_microusd,b.ceiling_microusd,
 (select coalesce(sum(actual_microusd),0) from script_adherence_requests where project=b.project) as spent_microusd,
 (select count(*)::int from script_adherence_provider_batches where state in ('prepared','submitting','running','collecting')) as active,
 (select min(created_at)::text from script_adherence_provider_batches where state in ('prepared','submitting','running','collecting')) as oldest,
 (select count(*)::int from script_adherence_provider_batches where state='held' or error is not null) as errors,
 (select count(*)::int from script_adherence_jobs where state='held') as held,
 (select count(*)::int from script_adherence_jobs j where state in ('ready','review_ready') and (c.enabled or c.canary_keys ? j.id)) as pending_requests,
 (select count(*)::int from script_adherence_jobs j where state='awaiting_transcript' and (c.enabled or c.canary_keys ? j.id)) as waiting_sources,
 exists(select 1 from script_adherence_jobs j where (c.enabled or c.canary_keys ? j.id) and ((state in ('ready','review_ready') and updated_at<now()-interval '2 hours' and not exists(select 1 from script_adherence_provider_batches where state in ('prepared','submitting','running','collecting'))) or (state='awaiting_transcript' and created_at<now()-interval '48 hours'))) as stalled,
 (select case when count(distinct account_id)=2 then min(through_at)::text end from script_adherence_coverage) as coverage
 from script_adherence_control c cross join script_adherence_runner r cross join script_adherence_budget b where c.id=true and r.id=true and b.project='pilot-2026-11-02'`;
 if(!rows)throw Error('Missing state');
 const state=healthState({enabled:rows.enabled,canary:rows.canary,active:rows.active,held:rows.held,errors:rows.errors,oldest:rows.oldest,lastCheck:rows.last_check,coverage:rows.coverage,committed:Number(rows.committed_microusd),ceiling:rows.ceiling_microusd===null?null:Number(rows.ceiling_microusd),runnerError:rows.runner_error,stalled:rows.stalled,waitingSources:rows.waiting_sources,pendingRequests:rows.pending_requests});
 return {state,lastCheck:rows.last_check,active:rows.active,held:rows.held,spent:Number(rows.spent_microusd)/1e6,reserved:(Number(rows.committed_microusd)-Number(rows.spent_microusd))/1e6,ceiling:rows.ceiling_microusd===null?null:Number(rows.ceiling_microusd)/1e6};
 }catch{return {state:{tone:'attention',label:'Status unavailable',message:'Backend status could not be verified. This does not establish a processing failure.'},lastCheck:null,active:0,held:0,spent:0,reserved:0,ceiling:null};}
}
