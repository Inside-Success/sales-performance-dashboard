import {describe,it,expect} from 'vitest';
const t=require('../../scripts/coaching-foundations/transition.cjs');
const record=require('../../src/lib/foundations-record.cjs');
const terminal=require('../../src/lib/foundations-terminal-receipt.cjs');
const boundary=require('../../scripts/coaching-foundations/production-boundary.cjs');
const blocks=[{id:'T0001',text:'This is our casting interview. We discuss the agreement on the next call.'}];
const prepared=record.prepare({sourceId:'fixture',policyRevision:'test',policyText:'Only substantive sales calls.',blocks});
const draft={version:'coaching-foundations-v3',status:'completed',exclusion_reason:'',offer_family:'reality',show:'Example',outcome:{payment:'not_confirmed',text:'A further meeting was discussed.',evidence_ids:['T0001']},objections:[],lessons:[],next_steps:[],focus_id:''};
const excluded={...draft,status:'excluded',exclusion_reason:'Casting interview only.'};
const receipt=(s:any,json:any,patch:any={})=>({ok:true,request_id:s.request.request_id,provider_response_id:'provider-'+s.request.stage,stop_reason:'stop',usage:{input_tokens:100,output_tokens:100},parsed_json:json,...patch});
function reviewer(){let s=t.start({prepared,call:{blocks},system:'Fixture policy',channel:'official',models:{writer:'writer',reviewer:'reviewer',safety:'safety'}});return t.advance(s,receipt(s,draft));}
describe('bounded reviewer output recovery',()=>{
 it.each(['length','max_tokens','stop'])('repairs known %s output once without accepting it',stop=>{
  const s=reviewer(),r=receipt(s,null,{stop_reason:stop,parse_error:'Invalid JSON object'});
  expect(terminal.repairableReviewerReceipt('foundations_reviewer_v3',r)).toBe(true);
  const next=t.advance(s,r);expect(next.request.stage).toBe('reviewer-output-repair');expect(next.request.max_tokens).toBe(24000);expect(next.candidate).toBeUndefined();
  expect(t.advance(structuredClone(s),r).request.request_id).toBe(next.request.request_id);
  expect(()=>t.advance(next,receipt(next,null,{stop_reason:stop}))).toThrow();
 });
 it.each([{ok:false},{provider_response_id:''},{stop_reason:'refusal'},{usage:null}])('does not retry unknown/unsafe receipt %j',patch=>{
  const s=reviewer(),r=receipt(s,null,{stop_reason:'length',...patch});expect(terminal.repairableReviewerReceipt('foundations_reviewer_v3',r)).toBe(false);expect(()=>t.advance(s,r)).toThrow();
 });
 it('requires exact request identity and does not add a stage to successful reviews',()=>{
  const s=reviewer();expect(()=>t.advance(s,receipt(s,null,{request_id:'other'}))).toThrow('identity');
  expect(t.advance(s,receipt(s,{pass:true,findings:[],corrected_report:null})).request.stage).toBe('safety');
 });
});
describe('reviewer eligibility disagreement',()=>{
 it('requires a separate source-bound confirmation and routes exclusion without report delivery',()=>{
  const s=reviewer(),p=t.advance(s,receipt(s,excluded));expect(p.request.stage).toBe('eligibility-review');expect(p.candidate).toBeUndefined();
  const decision={proposal_digest:record.digest(excluded),confirm:true,reason:'The full interaction remains casting.',evidence:[{id:'T0001',text:blocks[0].text}]};
  const done=t.advance(p,receipt(p,decision));expect(done.status).toBe('excluded');expect(done.payload).toBeUndefined();
  const result={...done,source_id:'fixture',payload:null};
  expect(boundary.excludedProjection(result,prepared).status).toBe('refused');
  const missing=structuredClone(result);missing.provider_results.pop();expect(()=>boundary.excludedProjection(missing,prepared)).toThrow();
 });
 it.each([{confirm:false},{proposal_digest:'stale'},{evidence:[{id:'T0001',text:'invented words'}]},{evidence:[]}])('holds an unconfirmed exclusion %j',patch=>{
  const p=t.advance(reviewer(),receipt(reviewer(),excluded));expect(()=>t.advance(p,receipt(p,{proposal_digest:record.digest(excluded),confirm:true,reason:'Casting.',evidence:[{id:'T0001',text:blocks[0].text}],...patch}))).toThrow();
 });
 it('recognizes status edits as proposals only, without allowing arbitrary protected edits',()=>{
  const s=reviewer(),q={id:'T0001',text:blocks[0].text};const p=t.advance(s,receipt(s,{edits:[{target:'status',value:'excluded',source_quote:q},{target:'exclusion_reason',value:'Casting only.',source_quote:q}]}));expect(p.request.stage).toBe('eligibility-review');
  expect(()=>t.advance(s,receipt(s,{...excluded,show:'Invented'}))).toThrow('protected identity');
 });
});
it('handles the actual OpenAI decoder contract without mistaking transport failures for malformed output',()=>{
 const s=reviewer(),r=receipt(s,null,{ok:false,provider:'openai',parse_error:'Invalid JSON object',stop_reason:'length'});
 expect(t.advance(s,r).request.stage).toBe('reviewer-output-repair');
 for(const patch of [{parse_error:'Provider response unavailable'},{parse_error:'Missing or invalid usage receipt'},{provider:'anthropic'},{stop_reason:'error'},{stop_reason:'refusal'}])expect(()=>t.advance(s,{...r,...patch})).toThrow();
});
it('updates both official exclusion consumers and the manual consumer without changing wiring',()=>{
 const {runtime}=require('../../scripts/coaching-foundations/parent-workflows.cjs');
 const {patchParent}=require('../../scripts/coaching-foundations/reviewer-recovery-workflows.cjs');
 const stale=runtime().replaceAll('reviewer-eligibility-v1','stale-eligibility-v0');
 for(const [channel,names] of [['official',['MM Reliable Coaching','MM Build Safety Screen Request']],['manual',['MM Manual Build Factual Audit']]] as const){
  const before={nodes:names.map(name=>({name,parameters:{jsCode:stale+'\n// bindState consumer'}})),connections:{preserved:true}};
  const next=patchParent(before,channel);expect(next.connections).toEqual(before.connections);
  for(const n of next.nodes){expect(n.parameters.jsCode).toContain('reviewer-eligibility-v1');expect(n.parameters.jsCode).not.toContain('stale-eligibility-v0');}
  expect(()=>patchParent({...before,nodes:before.nodes.slice(1)},channel)).toThrow('Parent binding drift');
 }
});
