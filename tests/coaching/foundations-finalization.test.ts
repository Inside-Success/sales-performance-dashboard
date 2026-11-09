import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const record=require('../../src/lib/foundations-record.cjs');
const {run}=require('../../scripts/coaching-foundations/pipeline.cjs');
const {reconcileScope,COMMERCIAL_REVIEW}=require('../../scripts/coaching-foundations/lesson-selection.cjs');
const prepared=record.prepare({sourceId:'fixture',policyRevision:'fixed',policyText:'No guarantees.',blocks:[{id:'T1',text:'I will send it tomorrow.'}]});
const report={version:'coaching-foundations-v3',status:'completed',exclusion_reason:'',offer_family:'main_istv',show:'Documentary',outcome:{payment:'not_confirmed',text:'Follow-up promised.',evidence_ids:['T1']},objections:[],lessons:[{id:'L1',purpose:'repeat',title:'Make next steps concrete',observation:'You promised the document.',teaching:'Give a clear follow-up.',example:'',evidence_ids:['T1'],counterevidence_ids:[]}],focus_id:'L1',next_steps:[{kind:'promised',text:'Send it tomorrow.',evidence_ids:['T1']}]};
const response=(req:any,parsed_json:any)=>({request_id:req.request_id,ok:true,provider_response_id:'fixture-'+req.request_id,parsed_json,stop_reason:'stop'});
function setup(mode='pass'){
 const requests:any[]=[],writes=new Map();let screens=0;
 const provider=async(req:any)=>{
  requests.push(req);
  if(req.stage==='writer')return response(req,report);
  if(req.stage==='reviewer')return response(req,{pass:true,findings:[],corrected_report:null});
  if(req.stage==='safety-repair')return response(req,{patches:[{path:'lessons.0.teaching',before:'Give a clear follow-up.',after:'State what you will send and when.'}]});
  const data=JSON.parse(req.prompt.slice(req.prompt.indexOf('\n')+1));
  const findings=mode==='repair'&&screens++===0?[{path:'lessons.0.teaching',before:'Give a clear follow-up.',reason:'Fixture safety finding'}]:mode==='metadata'?[{path:'offer_family',before:'main_istv',reason:'Wrong family'}]:[];
  return response(req,{candidate_digest:mode==='stale'?'wrong':data.candidate_digest,pass:findings.length===0,findings,l1_decisions:[]});
 };
 const store={scope:'isolated',putOnce:async(key:string,value:any)=>{if(writes.has(key)&&JSON.stringify(writes.get(key))!==JSON.stringify(value))throw Error('Conflicting write');writes.set(key,value);return {key,digest:value.payload.reviewed_coaching_v3.digest};}};
 return {requests,writes,args:{prepared,call:{blocks:prepared.blocks},prompts:{system:'fixture',prompt:()=>''},provider,store,channel:'official',models:{writer:'writer',reviewer:'reviewer',safety:'safety'}}};
}
describe('candidate full isolated path',()=>{
 it('replaces competing duties instead of appending instructions',()=>{
  const source='Before\nKeep compliance/legal evaluation and numeric scoring out of coaching. Old rule.\nAfter';
  const result=reconcileScope(source);expect(result).not.toContain('Old rule');expect(result).toContain('separate compliance stage owns exhaustive policy checking');
  expect(()=>reconcileScope(source+COMMERCIAL_REVIEW)).toThrow('conflicting');
 });
 it.each(['official','manual'])('renders one reviewed record into %s documents with an exact receipt',async channel=>{
  const {args,writes}=setup();const r=await run({...args,channel});expect(r.status).toBe('completed');expect(writes.size).toBe(1);
  expect(r.artifacts.text).toContain('Send it tomorrow.');expect(r.artifacts.html).not.toContain('T1');expect(r.artifacts.googleDocsRequests[0].insertText.text).toBe(r.artifacts.text);
 });
 it('re-screens changed wording before publishing',async()=>{
  const {args,requests}=setup('repair');const r=await run(args);expect(requests.map(x=>x.stage)).toEqual(['writer','reviewer','safety','safety-repair','safety']);expect(r.artifacts.text).toContain('State what you will send and when.');
 });
 it.each(['stale','metadata'])('holds %s safety decisions without delivery',async mode=>{
  const {args,writes}=setup(mode);await expect(run(args)).rejects.toThrow();expect(writes.size).toBe(0);
 });
 it('refuses a non-isolated sink before purchasing anything',async()=>{
  const {args,requests}=setup();await expect(run({...args,store:{...args.store,scope:'production'}})).rejects.toThrow('Isolated sink');expect(requests).toHaveLength(0);
 });
});

describe('Tyler layered presentation',()=>{
 it('gives a distinct lesson one home and preserves old receipts',()=>{
  const contract=require('../../src/lib/foundations-contract.cjs');
  expect(contract.render(report,prepared.blocks)).toContain('What to carry into your next call');
  const layered={...report,lessons:[{...report.lessons[0],layer:'strategy'}]};
  const text=contract.render(layered,prepared.blocks);
  expect(text).toContain('Choosing your approach');
  expect(text).not.toContain('What to carry into your next call');
  expect(text.split('Give a clear follow-up.')).toHaveLength(2);
  expect(()=>contract.validate({...layered,lessons:[{...layered.lessons[0],layer:'made-up'}]},prepared.blocks)).toThrow('lesson layer');
 });
});
it('keeps a document insight together and emits one bullet per insight',()=>{
 const {docRequests}=require('../../scripts/coaching-foundations/document-format.cjs');
 const d=docRequests([{key:'strategy',title:'Choosing your approach',items:['A direct ask\nExplain why.\nTry this.']}],[{text:'Coaching',style:'TITLE'}]);
 expect(d.requests.filter((x:any)=>x.createParagraphBullets)).toHaveLength(1);
 const p=d.requests.filter((x:any)=>x.updateParagraphStyle).map((x:any)=>x.updateParagraphStyle.paragraphStyle);
 expect(p.at(-2).keepWithNext).toBe(true);expect(p.at(-1).keepWithNext).toBe(false);
 expect(d.text).toContain('Explain why.\nTry this.');
});

describe('durable candidate transitions and parent boundary',()=>{
 const transition=require('../../scripts/coaching-foundations/transition.cjs');
 const boundary=require('../../scripts/coaching-foundations/production-boundary.cjs');
 it('repairs one transport-valid malformed draft with a distinct request and then reviews it',async()=>{
  const {args}=setup();let t=transition.start({...args,system:args.prompts.system});const first=t.request.request_id;
  t=transition.advance(t,response(t.request,{...report,version:'bad'}));expect(t.request.stage).toBe('writer-contract-repair');expect(t.request.request_id).not.toBe(first);
  const repaired=t.request.request_id;t=transition.advance(t,response(t.request,report));expect(t.request.stage).toBe('reviewer');expect(t.writer.id).toBe(repaired);
  expect(t.provider_results).toHaveLength(2);expect(t.provider_results[0].result).not.toHaveProperty('parsed_json');
 });
 it('holds a second malformed draft and mismatched or truncated paid receipts',()=>{
  const {args}=setup();const initial=transition.start({...args,system:'fixture'});
  expect(()=>transition.advance(initial,{...response(initial.request,report),request_id:'other'})).toThrow('identity');
  expect(()=>transition.advance(initial,{...response(initial.request,report),stop_reason:'length'})).toThrow('Unusable');
  const repair=transition.advance(initial,response(initial.request,{...report,version:'bad'}));
  expect(()=>transition.advance(repair,response(repair.request,{...report,version:'bad'}))).toThrow();
 });
 it.each(['official','manual'])('retains source, safety and cached zero-cost receipt for %s',async channel=>{
  const {args}=setup();const r=await run({...args,channel});
  const result={...r,source_id:'fixture',channel,provider_results:[{purpose:'writer',result:{cached:true,costs:{total_cost_usd:0},provider_response_id:'saved'}}]};
  const bound=boundary.bindState({case_id:'fixture',input:{public_id:'fixture'},caseItem:{metadata:{airtable_record_id:'fixture'}},provider_results:[]},result,channel);
  expect(bound.coaching_raw.reviewed_coaching_v3.digest).toBe(r.payload.reviewed_coaching_v3.digest);
  expect(bound.provider_results).toEqual(result.provider_results);expect(bound.coaching_raw.winnability).toBe('');
  expect(()=>boundary.bindState(bound,{...result,source_id:'wrong'},channel)).toThrow('mismatch');
  expect(()=>boundary.bindState(bound,{...result,status:'excluded'},channel)).toThrow('mismatch');
 });
 it('keeps the serialized review guidance identical to Tyler adapter guidance',()=>{
  expect(require('../../scripts/coaching-foundations/review-guidance.cjs').REVIEW_ADAPTER).toBe(require('../../scripts/coaching-lab/tyler-adapter.cjs').REVIEW_ADAPTER);
 });
 it('requires an isolated provider and produces code that runs without structuredClone in n8n',()=>{
  const {build}=require('../../scripts/coaching-foundations/n8n-workflow.cjs');
  expect(()=>build({providerWorkflowId:'X9L4JtDbpkSCflxZ',models:{}})).toThrow('isolated');
  const graph=build({providerWorkflowId:'isolated',models:{writer:{model:'test'},reviewer:{model:'test'},safety:{model:'test'}}});
  const start=graph.nodes.find((n:any)=>n.name==='Start');
  const out=new Function('$json',start.parameters.jsCode)({body:{prepared,call:{blocks:prepared.blocks},system:'test',models:{writer:'writer',reviewer:'reviewer',safety:'safety'},channel:'official'}});
  expect(out[0].json.transition.status).toBe('request');expect(graph.nodes).toHaveLength(6);
 });
});
