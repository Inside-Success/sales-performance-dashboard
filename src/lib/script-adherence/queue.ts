import {observedRep} from './attribution';
import {createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {z} from 'zod';
import {buildAnalysisRequest,parseAnalysis,MODELS,type AdherenceModel,PIPELINE_VERSION} from './model';
import {usageCost} from './cost';
import {actionStatus,scriptFor,summarize,type Analysis} from './contract';
import {RUBRIC_VERSION} from './rubric';
const db=()=>neon(process.env.DATABASE_URL!);
export const digest=(v:string)=>createHash('sha256').update(v).digest('hex');
export const ACCOUNTS=['nTC8wAG7SsijjSRAP3IOng','ELrPkucySZ2nxcs4fpyAaA'] as const;
export const sourceIdentity=(account:string,uuid:string)=>digest(JSON.stringify([account,uuid]));
export function transcriptFromVtt(input:string){
 if(!/^\uFEFF?WEBVTT/.test(input.trim()))throw Error('Expected complete WebVTT');
 const cues=input.replace(/^\uFEFF/,'').split(/\r?\n\s*\r?\n/).flatMap(block=>{
  const lines=block.split(/\r?\n/),i=lines.findIndex(l=>/^\d{2}:\d{2}(?::\d{2})?[.,]\d{3}\s+-->/.test(l));
  if(i<0)return [];const timestamp=lines[i].split(' -->')[0].replace(',','.');
  const text=lines.slice(i+1).join(' ').replace(/<[^>]*>/g,'').trim();return text?[`[${timestamp}] ${text}`]:[];
 });if(!cues.length)throw Error('Transcript contains no speech');return cues.join('\n');
}
export const recordingSchema=z.object({accountId:z.enum(ACCOUNTS),uuid:z.string().min(1).max(200),rep:z.string().min(1).max(200),title:z.string().max(1000),startedAt:z.string().datetime(),sourceUrl:z.union([z.string().url(),z.literal('')]),files:z.array(z.object({id:z.string().min(1),url:z.string().url(),start:z.string(),ready:z.boolean()}).strict()).max(100)}).strict();
export function safeZoomUrl(value:string){const u=new URL(value);if(u.protocol!=='https:'||!/(^|\.)zoom\.us$/.test(u.hostname)||u.username||u.password)throw Error('Untrusted Zoom download');return value;}
export async function discover(recordings:z.infer<typeof recordingSchema>[]){
 const sql=db();const rows=recordings.map(raw=>{const r=recordingSchema.parse(raw);for(const f of r.files)safeZoomUrl(f.url);return {id:sourceIdentity(r.accountId,r.uuid),account_id:r.accountId,meeting_uuid:r.uuid,files:r.files,rep:r.rep,title:r.title,started_at:r.startedAt,source_url:r.sourceUrl,download_url:r.files[0]?.url||''};});
 if(new Set(rows.map(r=>r.id)).size!==rows.length)throw Error('Duplicate meeting in coverage page');
 if(!rows.length)return {saved:0};
 // One bounded page write avoids a network round trip per recording.
 await sql`insert into script_adherence_jobs(id,source_key,account_id,meeting_uuid,files,rep,title,started_at,source_url,download_url)
 select r.id,r.id,r.account_id,r.meeting_uuid,r.files,r.rep,r.title,r.started_at,r.source_url,r.download_url
 from jsonb_to_recordset(${JSON.stringify(rows)}::jsonb) as r(id text,account_id text,meeting_uuid text,files jsonb,rep text,title text,started_at timestamptz,source_url text,download_url text)
 on conflict(id) do update set files=excluded.files,download_url=excluded.download_url,rep=excluded.rep,updated_at=now() where script_adherence_jobs.state='awaiting_transcript'`;
 return {saved:rows.length};
}
export async function claimSource(owner:string){
 const sql=db();const rows=await sql`with candidate as (select j.id from script_adherence_jobs j,script_adherence_control c where (c.enabled or c.canary_keys ? j.id) and j.state='awaiting_transcript' and j.started_at<now()-interval '2 hours' and j.next_attempt_at<=now() and (j.lease_until is null or j.lease_until<now()) and jsonb_array_length(j.files)>0 and not exists(select 1 from jsonb_array_elements(j.files) f where (f->>'ready')::boolean=false) order by j.created_at for update of j skip locked limit 1) update script_adherence_jobs j set lease_owner=${owner},lease_until=now()+interval '5 minutes',attempts=attempts+1 from candidate c where j.id=c.id returning j.id,j.account_id,j.files`;
 return rows[0]||null;
}
export async function saveSource(id:string,owner:string,files:Array<{id:string;vtt:string}>,error?:string){
 const sql=db();if(error){await sql`update script_adherence_jobs set error=${error.slice(0,1000)},next_attempt_at=now()+interval '12 hours',lease_owner=null,lease_until=null,updated_at=now() where id=${id} and lease_owner=${owner} and state='awaiting_transcript'`;return {saved:false};}
 const rows=await sql`select files,rep from script_adherence_jobs where id=${id} and lease_owner=${owner} and state='awaiting_transcript'`;
 if(!rows.length)throw Error('Source lease no longer owned');
 const expected=rows[0].files as Array<{id:string;start:string}>;
 if(files.length!==expected.length||new Set(files.map(f=>f.id)).size!==expected.length||expected.some(f=>!files.some(x=>x.id===f.id)))throw Error('Incomplete recording segments');
 // Relative timecodes restart per recording segment; retain segment label and source chronology.
 const text=[...expected].sort((a,b)=>a.start.localeCompare(b.start)).map((f,i)=>transcriptFromVtt(files.find(x=>x.id===f.id)!.vtt).replace(/^\[/gm,`[segment ${i+1} `)).join('\n');
 if(Buffer.byteLength(text)>180000){
  await sql`update script_adherence_jobs set state='held',error='Full transcript exceeds supported size; retained for review without truncation',lease_owner=null,lease_until=null,updated_at=now() where id=${id} and lease_owner=${owner} and state='awaiting_transcript'`;
  return {saved:false,held:true};
 }
 const roster=await sql`select distinct name from script_adherence_closers`;
 const attribution=observedRep(text,rows[0].rep,roster.map(r=>String(r.name)));
 const updated=await sql`update script_adherence_jobs set rep=${attribution.rep},attribution=${JSON.stringify(attribution)}::jsonb,transcript=${text},transcript_hash=${digest(text)},state='ready',lease_owner=null,lease_until=null,error=null,updated_at=now() where id=${id} and lease_owner=${owner} and state='awaiting_transcript' returning id`;
 return {saved:updated.length===1};
}
export function metrics(result:Analysis,startedAt:string){const s=summarize([result],[startedAt]);return {...s,script:scriptFor(result),actions:result.actions.map(a=>({id:a.id,status:actionStatus(result,a.id,startedAt)}))};}
export async function claimModel(exclude:string[]=[],provider?:'openai'|'anthropic'){
 const sql=db();const configs=await sql`select * from script_adherence_control where id=true`;if(!configs.length)return null;const c=configs[0];
 const reserved=await sql`select r.id,r.request_body,j.id as job_id,r.stage from script_adherence_requests r join script_adherence_jobs j on r.id=j.draft_request_id or r.id=j.review_request_id where r.status='reserved' and not (r.id=any(${exclude}::text[])) and (${provider||''}='' or (r.model like 'gpt-%')=${provider==='openai'}) and r.request_body is not null and (${c.enabled} or ${JSON.stringify(c.canary_keys)}::jsonb ? j.id) order by r.created_at limit 1`;
 if(reserved.length)return {id:reserved[0].id,jobId:reserved[0].job_id,body:reserved[0].request_body,stage:reserved[0].stage==='unattended-review'?'review':'draft',pipeline:PIPELINE_VERSION};
 const rows=await sql`select * from script_adherence_jobs where state in ('ready','review_ready') and (${provider||''}='' or ((case when state='review_ready' then ${c.review_model} else ${c.draft_model} end) like 'gpt-%')=${provider==='openai'}) and (${c.enabled} or ${JSON.stringify(c.canary_keys)}::jsonb ? id) order by case when state='review_ready' then 0 else 1 end,created_at limit 1`;
 if(!rows.length)return null;const j=rows[0],review=j.state==='review_ready',model=(review?c.review_model:c.draft_model) as AdherenceModel;if(!MODELS.includes(model))throw Error('Unpriced model');
 const body=buildAnalysisRequest(model,j.transcript,{title:j.title,rep:j.rep},review?j.draft:undefined),requestHash=digest(JSON.stringify(body)),id=digest(j.source_key+requestHash),reserve=model==='gpt-6.1-terra'?500000:200000;
 const result=await sql`with budget as (select * from script_adherence_budget where project='pilot-2026-11-02' for update),job as (update script_adherence_jobs set state=${review?'review_pending':'draft_pending'},draft_request_id=case when ${review} then draft_request_id else ${id} end,review_request_id=case when ${review} then ${id} else review_request_id end,updated_at=now() where id=${j.id} and state=${j.state} and exists(select 1 from budget where committed_microusd+${reserve}<=ceiling_microusd) returning id), inserted as (insert into script_adherence_requests(id,project,source_key,request_hash,model,reserved_microusd,status,stage,request_body) select ${id},'pilot-2026-11-02',${j.source_key},${requestHash},${model},${reserve},'reserved',${review?'unattended-review':'unattended-draft'},${JSON.stringify(body)}::jsonb from job returning id),debited as(update script_adherence_budget set committed_microusd=committed_microusd+${reserve} where project='pilot-2026-11-02' and exists(select 1 from inserted) returning project) select id from inserted`;
 // Request FK is deferrable to allow one atomic job/request reservation transaction.
 return result.length?{id,jobId:j.id,body,stage:review?'review':'draft',pipeline:PIPELINE_VERSION}:null;
}
export async function receive(id:string,jobId:string,payload:Record<string,unknown>){
 const sql=db(),rows=await sql`select r.*,j.transcript,j.transcript_hash,j.account_id,j.meeting_uuid,j.rep,j.title,j.started_at::text,j.source_url,j.state as job_state,j.draft_request_id,j.review_request_id from script_adherence_requests r join script_adherence_jobs j on j.id=${jobId} where r.id=${id} and r.source_key=j.source_key and (j.draft_request_id=r.id or j.review_request_id=r.id)`;
 if(!rows.length)throw Error('Unmatched receipt');const r=rows[0],review=r.stage==='unattended-review';
 if(!['submitted','completed','held'].includes(r.status))throw Error('Request not dispatched');
 const payloadHash=digest(JSON.stringify(payload));
 await sql`insert into script_adherence_receipts(request_id,job_id,payload_hash,payload) values(${id},${jobId},${payloadHash},${JSON.stringify(payload)}::jsonb) on conflict do nothing`;
 const receipts=await sql`select payload_hash from script_adherence_receipts where request_id=${id}`;if(receipts[0].payload_hash!==payloadHash)throw Error('Conflicting provider receipt');
 if(r.actual_microusd!==null)return {duplicate:true,published:r.job_state==='complete'};
 const usage=payload.usage as Record<string,unknown>|undefined;
 if(!usage){await sql`update script_adherence_jobs set state='held',error='Provider result uncertain; reconcile saved receipt without replay',updated_at=now() where id=${jobId} and state in ('draft_pending','review_pending')`;return {held:true};}
 const cost=usageCost(r.model,usage);if(cost>Number(r.reserved_microusd))throw Error('Provider cost exceeded reservation');
 let raw:unknown=null,validated:ReturnType<typeof parseAnalysis>|null=null,error='';
 try{
  const open=r.model.startsWith('gpt'),choices=payload.choices as Array<{finish_reason:string;message:{content:string}}>;
  if(open?choices?.[0]?.finish_reason!=='stop':payload.stop_reason!=='end_turn')throw Error('Incomplete provider output');
  raw=JSON.parse(open?choices[0].message.content:(payload.content as Array<{type:string;text:string}>).filter(x=>x.type==='text').map(x=>x.text).join(''));
  validated=parseAnalysis(raw,r.transcript);
 }catch(e){error=e instanceof Error?e.message:'Invalid model output';}
 const complete=review&&!!validated,next=complete?'complete':!review&&raw?'review_ready':'held';
 const analysis=validated?.analysis,summary=analysis?metrics(analysis,r.started_at):null;
 // Receipt, budget settlement, queue advancement and publication share one transaction.
 // A draft may be structurally invalid: the independent full-source review can correct it.
 const updates=await sql`with settled as (update script_adherence_requests set actual_microusd=${cost},status=${error?'held':'completed'},validation_error=${error.slice(0,1000)||null},provider_id=${String(payload.id||'')},usage=${JSON.stringify(usage)}::jsonb,result=${JSON.stringify(validated)}::jsonb,updated_at=now() where id=${id} and actual_microusd is null returning project,reserved_microusd),budget as (update script_adherence_budget b set committed_microusd=b.committed_microusd-s.reserved_microusd+${cost} from settled s where b.project=s.project),job as (update script_adherence_jobs set state=${next},draft=case when ${review} then draft else ${JSON.stringify(raw)}::jsonb end,reviewed=case when ${review} then ${JSON.stringify(validated)}::jsonb else reviewed end,error=${error.slice(0,1000)||null},updated_at=now() where id=${jobId} and exists(select 1 from settled) returning id),published as (insert into script_adherence_calls(source_key,account_id,meeting_uuid,transcript_hash,rep,title,started_at,source_url,rubric_version,result,request_id,review_status) select ${r.source_key},${r.account_id},${r.meeting_uuid},${r.transcript_hash},${r.rep},${r.title},${r.started_at},${r.source_url},${RUBRIC_VERSION},${JSON.stringify(analysis)}::jsonb,${id},'accepted' from job where ${complete} on conflict(source_key) do nothing returning source_key) insert into script_adherence_metrics(source_key,rep,started_at,show,stage,script,complete,not_complete,unknown,not_applicable,actions) select source_key,${r.rep},${r.started_at},${analysis?.show||''},${analysis?.stage||'unknown'},${summary?.script||null},${summary?.complete||0},${summary?.notComplete||0},${summary?.unknown||0},${summary?.notApplicable||0},${JSON.stringify(summary?.actions||[])}::jsonb from published returning source_key`;
 return {published:updates.length===1,state:next,costMicrousd:cost};
}
export async function reconcileReceipts(){
 const sql=db(),rows=await sql`select p.request_id,p.job_id,p.payload from script_adherence_receipts p join script_adherence_requests r on r.id=p.request_id where r.actual_microusd is null and p.payload ? 'usage' order by p.created_at limit 20`;
 for(const r of rows)await receive(r.request_id,r.job_id,r.payload);
 // A lost provider response must become visible, not silently retry and double-charge.
 await sql`update script_adherence_jobs j set state='held',error='Provider receipt overdue; reconcile before any paid retry',updated_at=now() from script_adherence_requests r where r.id=case when j.state='review_pending' then j.review_request_id else j.draft_request_id end and j.state in ('draft_pending','review_pending') and r.status='submitted' and r.updated_at<now()-interval '45 minutes' and not exists(select 1 from script_adherence_receipts p where p.request_id=r.id)`;
 return {reconciled:rows.length};
}
