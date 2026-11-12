import {randomUUID} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {claimModel,receive} from './queue';
import {ProviderError,submissionDisposition,submissionMatches} from './submission-recovery';
export const terminalBatch=(s:string)=>['completed','failed','expired','cancelled'].includes(s);
export function receiptMap(expected:string[],receipts:Array<{custom_id:string;[key:string]:unknown}>){
 const allowed=new Set(expected),out=new Map<string,typeof receipts[number]>();
 if(allowed.size!==expected.length)throw Error('Duplicate manifest');
 for(const r of receipts){if(!allowed.has(r.custom_id)||out.has(r.custom_id))throw Error('Unexpected or duplicate provider receipt');out.set(r.custom_id,r);}return out;
}
const db=()=>neon(process.env.DATABASE_URL!);
// Only this dedicated key is permitted. Never fall back to the coaching/report-chat key.
async function provider(path:string,body?:unknown){
 const key=process.env.ADHERENCE_OPENAI_API_KEY;if(!key)throw Error('Dedicated adherence credential unavailable');
 const response=await fetch('https://api.openai.com/v1/'+path,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${key}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(40000),cache:'no-store'});
 if(!response.ok){let code:string|undefined;try{const body=await response.json();code=typeof body?.error?.code==='string'?body.error.code:undefined;}catch{}throw new ProviderError(response.status,response.headers.get('x-request-id'),code);}
 const reader=response.body?.getReader();if(!reader)throw Error('Empty provider response');const chunks:Uint8Array[]=[];let bytes=0;for(;;){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>50_000_000){await reader.cancel();throw Error('Provider file exceeds bounded collector');}chunks.push(part.value);}const text=Buffer.concat(chunks).toString('utf8');return path.endsWith('/content')?text:JSON.parse(text);
}
type Batch={id:string;state:string;file_id:string|null;provider_id:string|null;submission_at:string|null;error?:string|null};
const uncertainHold='Submission unconfirmed; retained for reconciliation without paid replay';
async function event(b:Batch,kind:string,detail:Record<string,unknown>={}){await db()`insert into script_adherence_submission_events(batch_id,kind,detail) values(${b.id},${kind},${JSON.stringify(detail)}::jsonb)`;}
async function holdSubmission(b:Batch,reason:string){const sql=db();await sql.transaction([
 sql`update script_adherence_provider_batches set state='held',provider_status=${reason===uncertainHold?'submission_unconfirmed':null},error=${reason},next_check_at=now()+interval '1 hour',updated_at=now() where id=${b.id} and provider_id is null and state in ('prepared','submitting','held')`,
 sql`update script_adherence_jobs j set state='held',error=${reason},updated_at=now() from script_adherence_batch_members m join script_adherence_requests r on r.id=m.request_id where m.batch_id=${b.id} and j.id=m.job_id and r.status='reserved' and r.actual_microusd is null and ((j.state='draft_pending' and j.draft_request_id=r.id) or (j.state='review_pending' and j.review_request_id=r.id))`,
 ]);}
async function attach(b:Batch,p:{id:string;status:string}){
 const sql=db();await sql.transaction([
  sql`update script_adherence_provider_batches set provider_id=${p.id},provider_status=${p.status},state='running',error=null,updated_at=now() where id=${b.id} and (provider_id is null or provider_id=${p.id})`,
  sql`update script_adherence_jobs j set state=case when j.draft_request_id=m.request_id then 'draft_pending' else 'review_pending' end,error=null,updated_at=now() from script_adherence_batch_members m where m.batch_id=${b.id} and j.id=m.job_id and j.state='held' and j.error=${uncertainHold} and (j.draft_request_id=m.request_id or j.review_request_id=m.request_id)`,
  sql`update script_adherence_requests set status='submitted',updated_at=now() where id in(select request_id from script_adherence_batch_members where batch_id=${b.id}) and status='reserved'`,
 ]);
}
async function reconcileSubmission(b:Batch,deadline:number){
 let after='',complete=false;const matches=new Map<string,{id:string;status:string}>();
 for(let page=0;page<10&&Date.now()<deadline-45000;page++){
  const list=await provider(`batches?limit=100${after?'&after='+encodeURIComponent(after):''}`);
  for(const p of list.data)if(submissionMatches(b,p))matches.set(p.id,p);
  if(!list.has_more){complete=true;break;}if(!list.last_id||list.last_id===after)throw Error('Provider reconciliation cursor did not advance');after=list.last_id;
 }
 if(matches.size>1){await holdSubmission(b,'Multiple provider jobs for one manifest; review required');throw Error('Multiple provider jobs for one manifest; review required');}
 // Do not attach the first match before checking the complete bounded inventory for duplicates.
 if(complete&&matches.size===1){await attach(b,[...matches.values()][0]);await event(b,'reconciled');return;}
 const sql=db();
 if(b.submission_at&&Date.now()-Date.parse(b.submission_at)>=3600000){
  await holdSubmission(b,uncertainHold);
  await sql`update script_adherence_provider_batches set next_check_at=now()+interval '1 hour',updated_at=now() where id=${b.id} and state='held' and provider_status='submission_unconfirmed'`;
 }else await sql`update script_adherence_provider_batches set error='Submission unconfirmed; reconciliation retained without paid replay',next_check_at=now()+interval '30 minutes',updated_at=now() where id=${b.id}`;
 // Incomplete reads and an absent batch never authorize an automatic paid retry.
}

async function submit(b:Batch,deadline:number){
 if(b.state==='submitting'||b.state==='held'){await reconcileSubmission(b,deadline);return;}
 const sql=db(),requests=await sql`select r.id,r.request_body from script_adherence_batch_members m join script_adherence_requests r on r.id=m.request_id where m.batch_id=${b.id} order by r.id`;
 if(!requests.length)throw Error('Empty provider batch');
 let file=b.file_id;
 if(!file){const lines=requests.map(r=>JSON.stringify({custom_id:r.id,method:'POST',url:'/v1/chat/completions',body:r.request_body})).join('\n')+'\n';if(Buffer.byteLength(lines)>30_000_000)throw Error('Batch input exceeds bound');const form=new FormData();form.set('purpose','batch');form.set('file',new Blob([lines],{type:'application/jsonl'}),b.id+'.jsonl');const uploaded=await provider('files',form);file=uploaded.id;await sql`update script_adherence_provider_batches set file_id=${file},updated_at=now() where id=${b.id}`;}
 // Persist intent BEFORE the paid operation. A timeout resumes via list/reconcile only.
 const claimed=await sql`update script_adherence_provider_batches set state='submitting',submission_at=now(),updated_at=now() where id=${b.id} and state='prepared' returning id`;
 if(!claimed.length)return;
 await event(b,'submission_intent',{fileId:file});
 let p;
 try{p=await provider('batches',{input_file_id:file,endpoint:'/v1/chat/completions',completion_window:'24h',metadata:{adherence_batch:b.id,system:'magic-mike-script-adherence'}});}
 catch(e){
  const disposition=submissionDisposition(e);
  await event(b,disposition,{status:e instanceof ProviderError?e.status:null,requestId:e instanceof ProviderError?e.requestId:null,code:e instanceof ProviderError?e.code:null});
  if(disposition==='retryable_rejection'){
   const [r]=await sql`select count(*)::int as count from script_adherence_submission_events where batch_id=${b.id} and kind='retryable_rejection'`;
   if(Number(r?.count)>=3)await holdSubmission(b,'Provider repeatedly rejected submission; review required');
   else await sql`update script_adherence_provider_batches set state='prepared',error='Provider rejected submission with HTTP 429; bounded retry scheduled',next_check_at=now()+interval '30 minutes',updated_at=now() where id=${b.id} and state='submitting' and provider_id is null`;
  }else if(disposition==='rejected')await holdSubmission(b,e instanceof Error?e.message:'Provider rejected submission');
  else await sql`update script_adherence_provider_batches set error='Submission outcome uncertain; reconciling before any retry',next_check_at=now()+interval '10 minutes',updated_at=now() where id=${b.id}`;
  return;
 }
 // A successful provider receipt followed by a DB failure must only reconcile, never re-POST.
 await event(b,'accepted',{providerId:p.id,status:p.status});
 await attach(b,p);
}
async function hold(requestId:string,jobId:string,reason:string){const sql=db();await sql`update script_adherence_jobs set state='held',error=${reason},updated_at=now() where id=${jobId} and (draft_request_id=${requestId} or review_request_id=${requestId}) and state in ('draft_pending','review_pending')`;}
async function collect(b:Batch,deadline:number){
 const sql=db(),p=await provider('batches/'+b.provider_id);
 await sql`update script_adherence_provider_batches set provider_status=${p.status},provider_snapshot=${JSON.stringify(p)}::jsonb,next_check_at=now()+interval '10 minutes',updated_at=now(),error=null where id=${b.id}`;
 if(!terminalBatch(p.status))return;
 await sql`update script_adherence_provider_batches set state='collecting' where id=${b.id}`;
 const members=await sql`select m.request_id,m.job_id,r.actual_microusd from script_adherence_batch_members m join script_adherence_requests r on r.id=m.request_id where batch_id=${b.id}`;
 const receipts=[];
 for(const file of [p.output_file_id,p.error_file_id].filter(Boolean)){if(Date.now()>deadline-45000)return;const content=await provider(`files/${file}/content`);receipts.push(...content.trim().split('\n').filter(Boolean).map((s:string)=>JSON.parse(s)));}
 const indexed=receiptMap(members.map(m=>String(m.request_id)),receipts);
 let unsettled=false;
 for(const m of members){
  if(m.actual_microusd!==null)continue;
  if(Date.now()>deadline)return; // Durable per-request settlement makes the next poll resumable.
  const r=indexed.get(String(m.request_id)) as {response?:{status_code:number;body:Record<string,unknown>};error?:{code:string}}|undefined;
  if(r?.response?.status_code===200&&r.response.body.usage){await receive(m.request_id,m.job_id,r.response.body);continue;}
  // Only explicit never-executed expiration or whole-file validation failure is free.
  const free=r?.error?.code==='batch_expired'||(p.status==='failed'&&!p.output_file_id&&p.errors?.data?.length);
  const reason=free?'Batch did not execute this request; retained for retry review':'Provider receipt incomplete or failed; reconcile before paid retry';
  if(free){await sql`with settled as(update script_adherence_requests set status='failed',actual_microusd=0,validation_error=${reason},updated_at=now() where id=${m.request_id} and actual_microusd is null returning project,reserved_microusd) update script_adherence_budget b set committed_microusd=b.committed_microusd-s.reserved_microusd from settled s where b.project=s.project`;}
  else unsettled=true;
  await hold(m.request_id,m.job_id,reason);
 }
 await sql`update script_adherence_provider_batches set state=${unsettled||p.status!=='completed'?'held':'complete'},error=${unsettled?'Unsettled provider receipts need review':p.status!=='completed'?'Terminal provider failure retained for review':null},updated_at=now() where id=${b.id}`;
}
export async function runProviderBatch(){
 const sql=db(),owner=randomUUID(),deadline=Date.now()+140000;
 const lock=await sql`update script_adherence_runner set lease_owner=${owner},lease_until=now()+interval '4 minutes',last_started_at=now() where id=true and (lease_until is null or lease_until<now()) returning id`;
 if(!lock.length)return {busy:true};
 try{
  const configs=await sql`select * from script_adherence_control where id=true`,config=configs[0];
  if(!config||config.transport!=='batch')return {paused:true};
  // Existing paid batches are always collected, even when intake is paused.
  const due=await sql`select * from script_adherence_provider_batches where (state in ('prepared','submitting','running','collecting') or (state='held' and provider_id is null and provider_status='submission_unconfirmed')) and next_check_at<=now() order by case when state='collecting' then 0 when state='held' then 2 else 1 end,next_check_at,created_at limit 4`;
  const failures:string[]=[];
  for(const b of due){if(Date.now()>deadline-(b.state==='prepared'?85000:45000))break;try{if(b.provider_id)await collect(b as Batch,deadline);else await submit(b as Batch,deadline);}catch(e){const message=e instanceof Error?e.message:'Batch operation failed';failures.push(message);await sql`update script_adherence_provider_batches set error=${message.slice(0,500)},next_check_at=now()+interval '10 minutes',updated_at=now() where id=${b.id}`;}}
  if(failures.length)throw Error(failures.join('; ').slice(0,500));
  // Bound provider concurrency; queued calls stay durable. Reviews retain claim priority.
  const [inflight]=await sql`select count(*)::int as count from script_adherence_provider_batches where state in ('prepared','submitting','running','collecting')`;
  if((config.enabled||config.canary_keys.length)&&Number(inflight?.count||0)<4&&Date.now()<deadline-45000){
   const work=[];let preparationFailure:unknown;
   try{for(let i=0;i<100&&Date.now()<deadline-45000;i++){const item=await claimModel(work.map(w=>w.id),'openai','batch');if(!item)break;work.push(item);}}catch(e){preparationFailure=e;}
   // Persist already reserved work even if a subsequent claim fails. Never lose a partial manifest.

   if(work.length){
    const id=randomUUID();await sql.transaction([
     sql`insert into script_adherence_provider_batches(id) values(${id})`,
     sql`insert into script_adherence_batch_members(request_id,batch_id,job_id) select r.id,${id},r.job from jsonb_to_recordset(${JSON.stringify(work.map(w=>({id:w.id,job:w.jobId})))}::jsonb) as r(id text,job text)`,
    ]);if(!preparationFailure&&Date.now()<deadline-85000)await submit({id,state:'prepared',file_id:null,provider_id:null,submission_at:null},deadline);
   }
   if(preparationFailure)throw preparationFailure;
  }
  await sql`update script_adherence_runner set last_success_at=now(),error=null where id=true and lease_owner=${owner}`;
  return {checked:due.length};
 }catch(e){const message=e instanceof Error?e.message:'Batch step failed';await sql`update script_adherence_runner set error=${message.slice(0,500)} where id=true and lease_owner=${owner}`;throw e;}
 finally{await sql`update script_adherence_runner set lease_owner=null,lease_until=null where id=true and lease_owner=${owner}`;}
}

export async function recordSchedulerFailure(workflowId?:string){
 const sql=db();if(workflowId==='hb3M0O7fYx04oVEs')await sql`update script_adherence_runner set source_error='Source scan reported an error; inspect the scoped n8n execution' where id=true`;else await sql`update script_adherence_runner set error=coalesce(error,'Provider check reported an error; inspect the scoped n8n execution') where id=true`;
}

export async function recordSourceSuccess(){const sql=db();await sql`update script_adherence_runner set source_error=null where id=true`;}
