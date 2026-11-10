import {describe,it,expect} from 'vitest';
const contract=require('../../src/lib/foundations-contract.cjs');
const record=require('../../src/lib/foundations-record.cjs');
const transition=require('../../scripts/coaching-foundations/transition.cjs');
const boundary=require('../../scripts/coaching-foundations/production-boundary.cjs');
const terminal=require('../../src/lib/foundations-terminal-receipt.cjs');
const blocks=[{id:'T0001',text:'We are discussing casting, not a license purchase today.'}];
const prepared=record.prepare({sourceId:'source',policyRevision:'test',policyText:'Call two only',blocks});
const report={version:contract.VERSION,status:'excluded',exclusion_reason:'Casting only.',offer_family:'reality',show:'Island',outcome:{payment:'not_confirmed',text:'Casting only.',evidence_ids:['T0001']},objections:[],lessons:[],next_steps:[],focus_id:''};
const receipt=(request:any,value:any)=>({ok:true,request_id:request.request_id,provider_response_id:'provider-'+request.stage,stop_reason:'end_turn',parsed_json:value,usage:{input_tokens:100,output_tokens:30},costs:{total_cost_usd:0.1}});
function excluded(channel:string){
 let t=transition.start({prepared,call:{blocks},system:'Call two only',channel,models:{writer:'writer',reviewer:'reviewer',safety:'safety'}});
 t=transition.advance(t,receipt(t.request,report));t=transition.advance(t,receipt(t.request,{pass:true,findings:[],corrected_report:null}));
 return {status:t.status,source_id:'source',channel,candidate:t.candidate,payload:null,provider_results:t.provider_results};
}
const parent={caseItem:{metadata:{airtable_record_id:'source'}},input:{public_id:'source'},provider_results:[]};
describe('reviewed exclusion is a terminal outcome',()=>{
 it.each(['official','manual'])('routes %s without publishing, scoring or safety requests',channel=>{
  const result=excluded(channel),s=boundary.bindState(parent,result,channel,prepared);
  expect(s.coaching_raw.status).toBe('refused');expect(s.coaching_raw.refusal_reason).toBe('Casting only.');
  expect(s.reviewed_coaching_v3).toBeUndefined();expect(s.provider_results).toHaveLength(2);
  expect(s.coaching_safety_log.reviewed_exclusion_v3.source_hash).toBe(prepared.sourceHash);
 });
 it.each(['source','channel','policy','transcript','digest','review','unreviewed','payload'])('holds an exclusion with %s mismatch',fault=>{
  const r=excluded('official');
  if(fault==='source')r.source_id='wrong';
  if(fault==='channel')r.channel='manual';
  if(fault==='policy')r.candidate.prepared.policyHash='wrong';
  if(fault==='transcript')r.candidate.prepared.blocks[0].text='changed';
  if(fault==='digest')r.candidate.report.exclusion_reason='changed';
  if(fault==='review')r.candidate.reviewRequestId='wrong';
  if(fault==='unreviewed')r.provider_results.pop();
  if(fault==='payload')r.payload={} as any;
  expect(()=>boundary.bindState(parent,r,'official',prepared)).toThrow();
 });
});
describe('all validation faults reach one bounded repair',()=>{
 const bad=()=>({...report,status:'completed',exclusion_reason:'',objections:['O1','O2'].map(id=>({id,title:'Concern',category:'cost',concern:'A price concern.',response:'Acknowledged.',handling:'needs_work',resolution:'unresolved',assessment:'The concern stayed open.',teaching:'',example:'',evidence_ids:['T0001'],counterevidence_ids:[]}))});
 it('collects both missing teaching fields and preserves the original candidate',()=>{
  const input=bad(),snapshot=structuredClone(input);let error:any;try{contract.validate(input,blocks)}catch(e){error=e;}
  expect(error.issues.map((x:any)=>x.path)).toEqual(['objections.0','objections.1']);expect(input).toEqual(snapshot);
  const t=transition.start({prepared,call:{blocks},system:'fixture',channel:'official',models:{writer:'writer',reviewer:'reviewer',safety:'safety'}});
  const repair=transition.advance(t,receipt(t.request,input));expect(repair.request.prompt).toContain('objection O1');expect(repair.request.prompt).toContain('objection O2');
  expect(()=>transition.advance(repair,receipt(repair.request,input))).toThrow('Weak handling');
 });
 it('reports malformed nested shapes without a TypeError or accepting them',()=>{
  const r={...bad(),outcome:null,objections:[null],lessons:[null],next_steps:[null]};
  try{contract.validate(r,blocks);throw Error('unexpected acceptance')}catch(e:any){expect(e.issues).toHaveLength(4);expect(e).not.toBeInstanceOf(TypeError);}
 });
 it('rejects unknown evidence and invalid focus alongside missing fields',()=>{
  const r=bad();r.objections[1].evidence_ids=['unknown'];r.focus_id='missing';
  try{contract.validate(r,blocks);throw Error('unexpected acceptance')}catch(e:any){expect(e.issues.some((x:any)=>x.message==='evidence')).toBe(true);expect(e.issues.some((x:any)=>x.message==='focus')).toBe(true);}
 });
});
describe('failed paid receipt replay',()=>{
 const saved=receipt({request_id:'exact',stage:'writer'},report);
 it('reuses only complete first-stage receipts and reports zero new cost',()=>{
  expect(terminal.retainedContractReceipt('foundations_writer_v3',saved)).toBe(true);
  expect(terminal.retainedContractReceipt('foundations_reviewer_v3',saved)).toBe(true);
  const r=terminal.reusedReceipt(saved);expect(r.costs.total_cost_usd).toBe(0);expect(r.usage.input_tokens).toBe(0);expect(r.checkpoint_original_costs).toEqual(saved.costs);expect(r.provider_response_id).toBe(saved.provider_response_id);
 });
 it.each(['foundations_writer_contract_repair_v3','foundations_review_contract_repair_v3','compliance'])('does not reopen %s',stage=>expect(terminal.retainedContractReceipt(stage,saved)).toBe(false));
 it.each([{stop_reason:'refusal'},{stop_reason:'length'},{ok:false},{parsed_json:null},{provider_response_id:null},{usage:null},{parse_error:'bad'}])('holds unsafe retained receipt %j',patch=>expect(terminal.retainedContractReceipt('foundations_writer_v3',{...saved,...patch})).toBeFalsy());
});
