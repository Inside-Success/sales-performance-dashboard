import {timingSafeEqual} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {z} from 'zod';
import {ACCOUNTS,claimModel,claimSource,discover,receive,reconcileReceipts,recordingSchema,saveSource,digest} from '@/lib/script-adherence/queue';
export const runtime='nodejs';
export const maxDuration=60;
const owner=z.string().regex(/^[a-zA-Z0-9:_-]{1,120}$/),id=z.string().regex(/^[a-f0-9]{64}$/);
const input=z.discriminatedUnion('operation',[
 z.object({operation:z.literal('window')}),
 z.object({operation:z.literal('pending_checked'),accountId:z.enum(ACCOUNTS),uuid:z.string().min(1),error:z.string().max(1000)}),
 z.object({operation:z.literal('closers'),accountId:z.enum(ACCOUNTS),members:z.array(z.object({id:z.string().min(1),name:z.string().min(1)})).min(1).max(10000)}),
 z.object({operation:z.literal('discover'),accountId:z.enum(ACCOUNTS),runId:owner,memberId:z.string().max(200),from:z.string().datetime(),to:z.string().datetime(),page:z.string().max(1000),next:z.string().max(1000),recordings:z.array(recordingSchema).max(300)}),
 z.object({operation:z.literal('finish_scan'),accountId:z.enum(ACCOUNTS),runId:owner,from:z.string().datetime(),to:z.string().datetime(),members:z.array(z.string().min(1)).min(1).max(10000)}),
 z.object({operation:z.literal('next'),owner}),
 z.object({operation:z.literal('source'),id,owner,files:z.array(z.object({id:z.string(),vtt:z.string().max(250000)})).max(100),error:z.string().max(1000).optional()}),
 z.object({operation:z.literal('receipt'),id,jobId:id,payload:z.record(z.string(),z.unknown())}),
 z.object({operation:z.literal('status')}),
]);
export async function POST(request:Request){
 const expected=process.env.INGEST_SECRET||'',supplied=request.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim()||'';
 if(!expected||Buffer.byteLength(expected)!==Buffer.byteLength(supplied)||!timingSafeEqual(Buffer.from(expected),Buffer.from(supplied)))return Response.json({error:'Unauthorized'},{status:401});
 try{
  const raw=await request.text();if(Buffer.byteLength(raw)>3_000_000)return Response.json({error:'Payload too large'},{status:413});
  const p=input.parse(JSON.parse(raw)),sql=neon(process.env.DATABASE_URL!);let result:unknown;
  if(p.operation==='window'){
   const c=(await sql`select * from script_adherence_control where id=true`)[0];
   const pending=await sql`select account_id,meeting_uuid,rep from script_adherence_jobs where state='awaiting_transcript' and next_attempt_at<=now() and (jsonb_array_length(files)=0 or exists(select 1 from jsonb_array_elements(files) f where (f->>'ready')::boolean=false)) order by updated_at limit 300`;
   const coverage=await sql`select account_id,through_at::text from script_adherence_coverage`;
   const accounts=[{id:ACCOUNTS[0],group:'pwN_fmhxQauPn38YRIEEZw'},{id:ACCOUNTS[1],group:'15x1Nf8kRheJS79QVqwM_A'}].map(a=>{
    const prior=coverage.find(x=>x.account_id===a.id),start=new Date(c.start_at).getTime(),from=Math.max(start,prior?new Date(prior.through_at).getTime()-2*86400000:start);
    return {...a,from:new Date(from).toISOString(),to:new Date(Math.min(Date.now(),from+27*86400000)).toISOString()};
   });
   result={enabled:c.enabled,pending,accounts};
  }else if(p.operation==='pending_checked'){
   await sql`update script_adherence_jobs set error=${p.error},next_attempt_at=now()+interval '12 hours',updated_at=now() where account_id=${p.accountId} and meeting_uuid=${p.uuid} and state='awaiting_transcript'`;
   result={retained:true};
  }else if(p.operation==='closers'){
   await sql`insert into script_adherence_closers(account_id,member_id,name) select ${p.accountId},m.id,m.name from jsonb_to_recordset(${JSON.stringify(p.members)}::jsonb) as m(id text,name text) on conflict(account_id,member_id) do update set name=excluded.name,updated_at=now()`;
   result={saved:p.members.length};
  }else if(p.operation==='discover'){
   if(p.recordings.some(r=>r.accountId!==p.accountId))throw Error('Account mismatch');
   result=await discover(p.recordings);
   await sql`insert into script_adherence_scan_pages(id,account_id,run_id,member_id,from_at,to_at,next_page_token,complete,recording_count) values(${digest(JSON.stringify([p.runId,p.accountId,p.memberId,p.page]))},${p.accountId},${p.runId},${p.memberId},${p.from},${p.to},${p.next},${!p.next},${p.recordings.length}) on conflict(id) do nothing`;
  }else if(p.operation==='finish_scan'){
   const pages=await sql`select distinct member_id from script_adherence_scan_pages where account_id=${p.accountId} and run_id=${p.runId} and from_at=${p.from} and to_at=${p.to} and complete=true`;
   if(new Set(p.members).size!==p.members.length||p.members.some(m=>!pages.some(x=>x.member_id===m)))throw Error('Incomplete closer coverage');
   await sql`insert into script_adherence_coverage(account_id,through_at) values(${p.accountId},${p.to}) on conflict(account_id) do update set through_at=greatest(script_adherence_coverage.through_at,excluded.through_at),updated_at=now()`;
   result={complete:true,members:p.members.length};
  }else if(p.operation==='next'){
   await reconcileReceipts();const first=await claimModel();
   if(first){const work=[first],provider=String(first.body.model).startsWith('gpt-')?'openai':'anthropic';for(let i=1;i<6;i++){const item=await claimModel(work.map(w=>w.id),provider);if(!item)break;work.push(item);}result={kind:provider,work};}
   else{const work=[];for(let i=0;i<6;i++){const source=await claimSource(p.owner);if(!source)break;work.push(source);}result=work.length?{kind:'source',work}:{kind:'done'};}
  }else if(p.operation==='source'){
   try{result=await saveSource(p.id,p.owner,p.files,p.error);}catch(e){await saveSource(p.id,p.owner,[],e instanceof Error?e.message:'Invalid source');result={saved:false,retained:true};}
  }else if(p.operation==='receipt')result=await receive(p.id,p.jobId,p.payload);
  else{
   const states=await sql`select state,count(*)::int as count,min(created_at)::text as oldest from script_adherence_jobs group by state`;
   const budget=await sql`select ceiling_microusd,committed_microusd from script_adherence_budget where project='pilot-2026-11-02'`;
   result={states,budget:budget[0]};
  }
  return Response.json(result,{headers:{'Cache-Control':'no-store'}});
 }catch{return Response.json({error:'Batch step held; saved work remains available for reconciliation'},{status:503});}
}
