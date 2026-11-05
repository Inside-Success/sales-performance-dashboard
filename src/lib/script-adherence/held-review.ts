import {neon} from '@neondatabase/serverless';
import {buildAnalysisRequest} from './model';
import {digest} from './queue';
// Explicitly invoked recovery only. Never replay a request or alter accepted results.
export async function reserveHeldReview(jobId:string,expectedRequestId:string){
 const sql=neon(process.env.DATABASE_URL!);
 const rows=await sql`select j.*,p.payload from script_adherence_jobs j join script_adherence_requests r on r.id=j.review_request_id join script_adherence_receipts p on p.request_id=r.id and p.job_id=j.id where j.id=${jobId} and j.review_request_id=${expectedRequestId} and j.state='held' and r.actual_microusd is not null and r.status='held' and r.validation_error is not null and not exists(select 1 from script_adherence_calls c where c.source_key=j.source_key)`;
 if(!rows.length)return null;
 const j=rows[0];if(j.payload.choices?.[0]?.finish_reason!=='stop')throw Error('Incomplete original review cannot be replayed');
 const prior=JSON.parse(j.payload.choices[0].message.content);
 const body=buildAnalysisRequest('gpt-6.1-terra',j.transcript,{title:j.title,rep:j.rep},prior);
 const hash=digest(JSON.stringify(body)),id=digest(j.source_key+hash+'held-review-realtime'),reserve=500000;
 const reserved=await sql`with budget as (select * from script_adherence_budget where project='pilot-2026-11-02' for update),job as(update script_adherence_jobs set state='review_pending',review_request_id=${id},error=null,updated_at=now() where id=${jobId} and state='held' and review_request_id=${expectedRequestId} and not exists(select 1 from script_adherence_calls c where c.source_key=${j.source_key}) and exists(select 1 from budget where ceiling_microusd is null or committed_microusd+${reserve}<=ceiling_microusd) returning id),request as(insert into script_adherence_requests(id,project,source_key,request_hash,model,reserved_microusd,status,stage,request_body,transport) select ${id},'pilot-2026-11-02',${j.source_key},${hash},'gpt-6.1-terra',${reserve},'reserved','unattended-review',${JSON.stringify(body)}::jsonb,'realtime' from job returning id),debit as(update script_adherence_budget set committed_microusd=committed_microusd+${reserve} where project='pilot-2026-11-02' and exists(select 1 from request)) select id from request`;
 return reserved.length?{id,jobId,originalRequestId:expectedRequestId,body}:null;
}
