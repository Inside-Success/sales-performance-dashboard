// Explicitly invoked, bounded pilot. Never publishes calls or enables production.
import {readFileSync,writeFileSync,renameSync,existsSync,mkdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {buildAnalysisRequest,parseAnalysis} from '../../src/lib/script-adherence/model';
import {batchCost,indexBatchReceipts} from './batch-receipts';
const root='.private-adherence/provider-batch-pilot', project='pilot-2026-11-02';
mkdirSync(root,{recursive:true,mode:0o700});
const sql=neon(process.env.DATABASE_URL!);
const save=(name:string,data:unknown)=>{const p=`${root}/${name}.json`;writeFileSync(p+'.tmp',JSON.stringify(data,null,2),{mode:0o600});renameSync(p+'.tmp',p);};
const load=(name:string)=>existsSync(`${root}/${name}.json`)?JSON.parse(readFileSync(`${root}/${name}.json`,'utf8')):null;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const indices=[0,1,2,4,5,6,7,8,9,10,11,15];
const calls=JSON.parse(readFileSync('.private-adherence/holdout-calls.json','utf8'));
const source=(i:number)=>{const c=calls[i];if(!c.transcript.includes('Full Transcript'))throw Error('Missing transcript boundary');return c.transcript.split('Full Transcript').slice(1).join('Full Transcript').trim();};
async function api(path:string,body?:unknown){
 const key=process.env.ADHERENCE_OPENAI_API_KEY;if(!key)throw Error('Dedicated key missing');
 const res=await fetch(`https://api.openai.com/v1/${path}`,{method:body===undefined?'GET':'POST',headers:{Authorization:`Bearer ${key}`,...(body instanceof FormData?{}:{'Content-Type':'application/json'})},body:body===undefined?undefined:body instanceof FormData?body:JSON.stringify(body),signal:AbortSignal.timeout(90000)});
 const text=await res.text();if(!res.ok)throw Error(`Provider HTTP ${res.status}: ${text.slice(0,1200)}`);return path.endsWith('/content')?text:JSON.parse(text);
}
const command=process.argv[2], stage=process.argv[3]||'draft';
if(!['draft','review'].includes(stage))throw Error('Invalid stage');
const label=`batch-pilot-2026-11-03-${stage}`;
if(command==='prepare'){
 if(load(stage)){console.log('Already prepared; reuse saved manifest');process.exit(0);}
 const prior=stage==='review'?load('draft-results'):null;if(stage==='review'&&(!prior||prior.length!==indices.length||prior.some((x:any)=>!x.raw||x.transportError)))throw Error('Complete draft receipts required');
 const manifest=[];
 for(const index of indices){
  const c=calls[index],body:any=buildAnalysisRequest('gpt-6.1-terra',source(index),{title:c.source['Meeting Title'],rep:c.source['Rep Name']},prior?.find((x:any)=>x.index===index)?.raw);
  delete body.service_tier;
  const requestHash=hash(JSON.stringify(body)),sourceKey=hash(JSON.stringify([c.source['Automation Key']?.includes('ELrPk')?'ELrPkucySZ2nxcs4fpyAaA':'nTC8wAG7SsijjSRAP3IOng',c.source['Zoom Meeting UUID']]));
  const id=hash(label+sourceKey+requestHash),reserve=500000;
  await sql`with budget as (select * from script_adherence_budget where project=${project} for update), inserted as (insert into script_adherence_requests(id,project,source_key,request_hash,model,reserved_microusd,status,stage) select ${id},${project},${sourceKey},${requestHash},'gpt-6.1-terra',${reserve},'reserved',${label} from budget where committed_microusd+${reserve}<=ceiling_microusd on conflict do nothing returning id) update script_adherence_budget set committed_microusd=committed_microusd+${reserve} where project=${project} and exists(select 1 from inserted)`;
  const rows=await sql`select status,request_hash from script_adherence_requests where id=${id}`;if(rows.length!==1||rows[0].status!=='reserved'||rows[0].request_hash!==requestHash)throw Error('Reservation unavailable; reconcile');
  manifest.push({id,index,sourceKey,transcriptHash:hash(source(index)),body});
 }
 save(stage,{label,manifest,preparedAt:new Date().toISOString()});console.log({prepared:manifest.length,stage,reservedMaximumUSD:manifest.length*.5});
}else if(command==='submit'){
 const state=load(stage);if(!state)throw Error('Prepare first');if(state.batchId){console.log({batchId:state.batchId,status:'already submitted'});process.exit(0);}if(state.submissionStartedAt)throw Error('Submission outcome uncertain: reconcile by metadata, never blindly resubmit');
 const rows=await sql`select id,status from script_adherence_requests where stage=${label}`;if(rows.length!==indices.length||rows.some((r:any)=>r.status!=='reserved'))throw Error('Reservation state mismatch');
 if(!state.fileId){const form=new FormData();form.set('purpose','batch');form.set('file',new Blob([state.manifest.map((m:any)=>JSON.stringify({custom_id:m.id,method:'POST',url:'/v1/chat/completions',body:m.body})).join('\n')+'\n'],{type:'application/jsonl'}),label+'.jsonl');const file=await api('files',form);state.fileId=file.id;save(stage,state);}
 state.submissionStartedAt=new Date().toISOString();save(stage,state);
 const batch=await api('batches',{input_file_id:state.fileId,endpoint:'/v1/chat/completions',completion_window:'24h',metadata:{pilot:label,scope:'isolated-no-publication'}});state.batchId=batch.id;state.batch=batch;save(stage,state);
 await sql`update script_adherence_requests set status='submitted',updated_at=now() where stage=${label} and status='reserved'`;
 console.log({stage,batchId:batch.id,status:batch.status});
}else if(command==='status'||command==='collect'){
 const state=load(stage);if(!state?.batchId)throw Error('No batch ID');const b=await api(`batches/${state.batchId}`);state.batch=b;save(stage,state);console.log({stage,id:b.id,status:b.status,counts:b.request_counts,created_at:b.created_at,completed_at:b.completed_at,errors:b.errors});
 if(command==='status'||!['completed','expired','cancelled','failed'].includes(b.status))process.exit(0);
 const receipts=[];
 for(const file of [b.output_file_id,b.error_file_id].filter(Boolean)){const content=await api(`files/${file}/content`);save(file,{content});receipts.push(...content.trim().split('\n').filter(Boolean).map((l:string)=>JSON.parse(l)));}
 save(stage+'-receipts',receipts);
 const indexed=indexBatchReceipts(state.manifest.map((m:any)=>m.id),receipts);
 const results=[];
 for(const m of state.manifest){
  const receipt:any=indexed.get(m.id);
  if(!receipt){results.push({id:m.id,index:m.index,raw:null,result:null,error:'Missing receipt; reservation held',transportError:'Missing receipt',cost:null});continue;}
  const p=receipt.response?.body;let raw=null,result=null,error='',transportError='';
  try{if(receipt.response?.status_code!==200||!p?.usage){transportError='Missing successful provider usage';throw Error(transportError);}if(p.choices?.[0]?.finish_reason!=='stop')throw Error('Incomplete output');raw=JSON.parse(p.choices[0].message.content);result=parseAnalysis(raw,source(m.index));}catch(e){error=(e as Error).message;}
  const cost=p?.usage?batchCost(p.usage):null;
  if(cost!==null){if(cost>500000)throw Error('Reservation exceeded');await sql`with settled as (update script_adherence_requests set actual_microusd=${cost},status=${error?'held':'completed'},validation_error=${error||null},provider_id=${p.id},usage=${JSON.stringify({...p.usage,batch_id:b.id,pricing:'batch-50-percent'})}::jsonb,result=${JSON.stringify(result)}::jsonb,updated_at=now() where id=${m.id} and actual_microusd is null returning project,reserved_microusd) update script_adherence_budget b set committed_microusd=b.committed_microusd-s.reserved_microusd+${cost} from settled s where b.project=s.project`;}
  results.push({id:m.id,index:m.index,raw,result,error,transportError,cost,usage:p?.usage});
 }
 save(stage+'-results',results);console.log({stage,valid:results.filter(r=>!r.error).length,total:results.length,costUSD:results.reduce((n,r)=>n+(r.cost||0),0)/1e6,errors:results.filter(r=>r.error).map(r=>({index:r.index,error:r.error}))});
}else throw Error('prepare|submit|status|collect [draft|review]');
