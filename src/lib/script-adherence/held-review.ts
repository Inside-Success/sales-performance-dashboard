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
 let body;
 try{body=buildAnalysisRequest('gpt-6.1-terra',j.transcript,{title:j.title,rep:j.rep},prior);}catch(e){
  if(!(e instanceof Error)||!e.message.includes('bounded context'))throw e;
  // Omit only the untrusted prior answer, never any source text. Review remains independent.
  body=buildAnalysisRequest('gpt-6.1-terra',j.transcript,{title:j.title,rep:j.rep},{});
 }
 const hash=digest(JSON.stringify(body)),id=digest(j.source_key+hash+'held-review-realtime'),reserve=500000;
 const reserved=await sql`with budget as (select * from script_adherence_budget where project='pilot-2026-11-02' for update),job as(update script_adherence_jobs set state='review_pending',review_request_id=${id},error=null,updated_at=now() where id=${jobId} and state='held' and review_request_id=${expectedRequestId} and not exists(select 1 from script_adherence_calls c where c.source_key=${j.source_key}) and exists(select 1 from budget where ceiling_microusd is null or committed_microusd+${reserve}<=ceiling_microusd) returning id),request as(insert into script_adherence_requests(id,project,source_key,request_hash,model,reserved_microusd,status,stage,request_body,transport) select ${id},'pilot-2026-11-02',${j.source_key},${hash},'gpt-6.1-terra',${reserve},'reserved','unattended-review',${JSON.stringify(body)}::jsonb,'realtime' from job returning id),debit as(update script_adherence_budget set committed_microusd=committed_microusd+${reserve} where project='pilot-2026-11-02' and exists(select 1 from request)) select id from request`;
 return reserved.length?{id,jobId,originalRequestId:expectedRequestId,body}:null;
}

// Revalidate a settled receipt after a deterministic contract fix; never charge again.
export async function revalidateHeldReview(jobId:string,expectedRequestId:string){
 const sql=neon(process.env.DATABASE_URL!);
 const rows=await sql`select j.*,r.actual_microusd,r.validation_error,p.payload from script_adherence_jobs j join script_adherence_requests r on r.id=j.review_request_id join script_adherence_receipts p on p.request_id=r.id and p.job_id=j.id where j.id=${jobId} and j.review_request_id=${expectedRequestId} and j.state='held' and r.actual_microusd is not null and r.status='held' and not exists(select 1 from script_adherence_calls c where c.source_key=j.source_key)`;
 if(!rows.length)return {published:false};const j=rows[0];
 if(j.payload.choices?.[0]?.finish_reason!=='stop')throw Error('Incomplete original review');
 const {parseAnalysis,PIPELINE_VERSION}=await import('./model');
 const {metrics}=await import('./queue');const {RUBRIC_VERSION}=await import('./rubric');
 const parsed={...parseAnalysis(JSON.parse(j.payload.choices[0].message.content),j.transcript),revalidatedFrom:{error:j.validation_error,parserVersion:PIPELINE_VERSION}};
 const result=parsed.analysis,m=metrics(result,j.started_at);
 const published=await sql`with job as(update script_adherence_jobs set state='complete',reviewed=${JSON.stringify(parsed)}::jsonb,error=null,updated_at=now() where id=${jobId} and state='held' and review_request_id=${expectedRequestId} returning id),request as(update script_adherence_requests set status='completed',result=${JSON.stringify(parsed)}::jsonb,validation_error=null,updated_at=now() where id=${expectedRequestId} and exists(select 1 from job)),published as(insert into script_adherence_calls(source_key,account_id,meeting_uuid,transcript_hash,rep,title,started_at,source_url,rubric_version,result,request_id,review_status) select ${j.source_key},${j.account_id},${j.meeting_uuid},${j.transcript_hash},${j.rep},${j.title},${j.started_at},${j.source_url},${RUBRIC_VERSION},${JSON.stringify(result)}::jsonb,${expectedRequestId},'accepted' from job on conflict(source_key) do nothing returning source_key) insert into script_adherence_metrics(source_key,rep,started_at,show,stage,script,complete,not_complete,unknown,not_applicable,actions) select source_key,${j.rep},${j.started_at},${result.show},${result.stage},${m.script},${m.complete},${m.notComplete},${m.unknown},${m.notApplicable},${JSON.stringify(m.actions)}::jsonb from published returning source_key`;
 return {published:published.length===1,costMicrousd:0,uncertainComponents:parsed.normalization.uncertainComponents};
}
