// Private, resumable comparison. Does not publish results or alter accepted calls.
import {readFileSync,writeFileSync,existsSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {neon} from '@neondatabase/serverless';
import {MODELS,buildAnalysisRequest,parseAnalysis,type AdherenceModel} from '../../src/lib/script-adherence/model';
import {usageCost} from '../../src/lib/script-adherence/cost';
const dir='.private-adherence/',sql=neon(process.env.DATABASE_URL!),project='pilot-2026-11-02';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const cohort=process.env.ADHERENCE_COHORT||'expanded-calls.json';if(!['expanded-calls.json','holdout-calls.json'].includes(cohort))throw Error('Unknown cohort');
const calls: Array<{source:Record<string,string>;transcript:string}>=JSON.parse(readFileSync(dir+cohort,'utf8'));
const sourceKey=(c:typeof calls[number])=>hash(JSON.stringify([c.source['Automation Key']?.includes('ELrPk')?'ELrPkucySZ2nxcs4fpyAaA':'nTC8wAG7SsijjSRAP3IOng',c.source['Zoom Meeting UUID']]));
const transcript=(c:typeof calls[number])=>{if(!c.transcript.includes('Full Transcript'))throw Error('Missing source boundary');return c.transcript.split('Full Transcript').slice(1).join('Full Transcript').trim();};
const save=(name:string,v:unknown)=>writeFileSync(dir+name,JSON.stringify(v,null,2),{mode:0o600});
const [command,label,modelArg,draftLabel,indices]=process.argv.slice(2);
if(command==='freeze'){
 if(existsSync(dir+'benchmark-reference.json'))throw Error('Reference already frozen');
 const manifest=JSON.parse(readFileSync(dir+'expanded-reviewed-manifest.json','utf8'));const reference=[];
 for(const m of manifest){const rows=await sql`select result,status from script_adherence_requests where id=${m.requestId}`;if(rows[0]?.status!=='completed')throw Error('Reference not completed');reference.push({index:m.index,source:sourceKey(calls[m.index]),transcriptHash:hash(transcript(calls[m.index])),result:rows[0].result});}
 save('benchmark-reference.json',reference);console.log({frozen:reference.length});
}else if(command==='prepare'){
 if(!/^[a-z0-9-]+$/.test(label)||!MODELS.includes(modelArg as AdherenceModel))throw Error('Invalid run');
 const model=modelArg as AdherenceModel,drafts=draftLabel&&draftLabel!=='none'?JSON.parse(readFileSync(dir+draftLabel+'-parsed.json','utf8')):null;
 const requests=[],manifest=[];
 for(const [index,c] of calls.entries()){
  if(indices&&!indices.split(',').map(Number).includes(index))continue;
  const draft=drafts?.find((r:{index:number})=>r.index===index);if(drafts&&!draft)throw Error('Missing draft');
  const body=buildAnalysisRequest(model,transcript(c),{title:c.source['Meeting Title'],rep:c.source['Rep Name']},draft?draft.raw:undefined);
  const source=sourceKey(c),requestHash=hash(JSON.stringify(body)),id=hash(source+requestHash),reserve=model==='gpt-6.1-terra'?500000:200000;
  const rows=await sql`with budget as (select * from script_adherence_budget where project=${project} for update),inserted as (insert into script_adherence_requests(id,project,source_key,request_hash,model,reserved_microusd,status,stage) select ${id},${project},${source},${requestHash},${model},${reserve},'reserved',${drafts?'benchmark-review':'benchmark-draft'} from budget where committed_microusd+${reserve}<=ceiling_microusd on conflict do nothing returning id), debited as (update script_adherence_budget set committed_microusd=committed_microusd+${reserve} where project=${project} and exists(select 1 from inserted) returning project) select id from inserted`;
  manifest.push({index,id,model,cohort,source,transcriptHash:hash(transcript(c)),draftId:draft?.id||null});
  if(rows.length)requests.push({id,body});
  else {const prior=await sql`select status from script_adherence_requests where id=${id}`;if(!prior.length)throw Error('Budget exhausted');if(prior[0].status==='reserved')requests.push({id,body});else if(!['completed','held'].includes(prior[0].status))throw Error('Unresolved request; reconcile');}
 }
 save(label+'-manifest.json',manifest);save('structured-requests.json',{requests});console.log({label,requests:requests.length});
}else if(command==='collect'){
 const manifest=JSON.parse(readFileSync(dir+label+'-manifest.json','utf8')),receipts=readdirSync(dir).filter(n=>n.endsWith('-receipts.json')&&/^(fair|matrix|fixed|compare)-/.test(n)).flatMap(n=>JSON.parse(readFileSync(dir+n,'utf8'))),parsed=[];
 for(const m of manifest){
  const item=receipts.find((r:{id:string})=>r.id===m.id);if(!item)throw Error('Missing receipt');
  const p=item.response,open=m.model.startsWith('gpt'),usage=p.usage;let raw:unknown=null,result:unknown=null,error='';
  try{if(!usage)throw Error('No usage receipt');if(open?p.choices?.[0]?.finish_reason!=='stop':p.stop_reason!=='end_turn')throw Error('Incomplete output');raw=JSON.parse(open?p.choices[0].message.content:p.content.filter((x:{type:string})=>x.type==='text').map((x:{text:string})=>x.text).join(''));result=parseAnalysis(raw,transcript(calls[m.index]));}catch(e){error=e instanceof Error?e.message:'Invalid output';}
  const rejection=String(p.details?.httpCode)==='400'&&String(p.details?.description||'').startsWith('The compiled grammar is too large');
  const cost=usage?usageCost(m.model,usage):rejection?0:null;
  if(cost!==null){
   const row=await sql`select reserved_microusd from script_adherence_requests where id=${m.id}`;if(cost>Number(row[0].reserved_microusd))throw Error('Reservation exceeded');
   await sql`with settled as (update script_adherence_requests set actual_microusd=${cost},status=${error?'held':'completed'},validation_error=${error||null},provider_id=${p.id||null},usage=${JSON.stringify(usage||{preGenerationRejection:true,httpCode:400})}::jsonb,result=${JSON.stringify(result)}::jsonb,updated_at=now() where id=${m.id} and actual_microusd is null returning project,reserved_microusd) update script_adherence_budget b set committed_microusd=b.committed_microusd-s.reserved_microusd+${cost} from settled s where b.project=s.project`;
  }else await sql`update script_adherence_requests set status='held',validation_error='No usage receipt; no automatic replay' where id=${m.id} and actual_microusd is null`;
  parsed.push({...m,raw,result,error,cost});
 }
 save(label+'-parsed.json',parsed);console.log({label,total:parsed.length,valid:parsed.filter(x=>!x.error).length,cost:parsed.reduce((n,x)=>n+(x.cost||0),0)/1e6,errors:parsed.filter(x=>x.error).map(x=>({index:x.index,error:x.error}))});
}else throw Error('freeze | prepare LABEL MODEL [DRAFT|none] [INDICES] | collect LABEL');
