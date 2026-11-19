import {it,expect} from 'vitest';
const reasoning=require('../../scripts/coaching-foundations/source-reasoning.cjs');
const contract=require('../../src/lib/foundations-contract.cjs');
const knowledge=require('../../scripts/coaching-foundations/coaching-knowledge-view.cjs');
const rules=require('../../scripts/coaching-foundations/coaching-knowledge-rules.json');
const t=require('../../scripts/coaching-foundations/transition.cjs');
const blocks=[{id:'T0001',text:'Buyer: We need delivery before June.'}];
it('preserves sound adjacent prose while correcting a supported teaching field',()=>{
 const draft={presentation:'syed-review-v1',summary:'Keep summary',objections:[{id:'O1',exchange:'Keep specific exchange',teaching:'Old teaching'}],lessons:[]};
 const audit={pass:false,findings:[{issue:'Missed deadline',evidence_ids:['T0001']}],edits:[{target:'objections:O1:teaching',before:'Old teaching',value:'Confirm whether delivery before June is possible before asking for payment.',reason:'The response must address the deadline.',source_quote:{id:'T0001',text:blocks[0].text}}],observation_dispositions:[]};
 expect(contract.providerErrors('foundations_reviewer_v3',audit)).toEqual([]);
 const out=reasoning.materializeReview(draft,audit,{observations:[]},blocks).corrected_report;
 expect(out.objections[0].exchange).toBe(draft.objections[0].exchange);expect(out.summary).toBe(draft.summary);
 expect(()=>reasoning.materializeReview(draft,{...audit,edits:[{...audit.edits[0],before:'stale'}]},{observations:[]},blocks)).toThrow('Stale');
 expect(()=>reasoning.materializeReview(draft,{...audit,edits:[{...audit.edits[0],target:'objections:O1',value:draft.objections[0]}]},{observations:[]},blocks)).toThrow('Whole-item');
});
it('accepts formatting-only source variations but holds new evaluator instructions',()=>{
 const rule=rules.find((r:any)=>r.before.startsWith('* The compliance evaluation'));
 expect(knowledge.project(rule.before).text).toBe(knowledge.project(rule.before.slice(2)).text);
 expect(()=>knowledge.project('Flag only when an invented new rule applies.')).toThrow('Unreviewed');
});
it('shortens prose without allowing removal of an objection or a changed judgment',()=>{
 const report={objections:[{id:'O1',teaching:'Long teaching',handling:'sound'},{id:'O2',teaching:'Keep this',handling:'needs_work'}]};
 const final=t.patchLength(report,['objections.0.teaching'],[{path:'objections.0.teaching',before:'Long teaching',value:'Short teaching'}]);
 expect(final.objections).toHaveLength(2);expect(final.objections[1]).toEqual(report.objections[1]);
 expect(()=>t.patchLength(report,['objections.0.teaching'],[{path:'objections.0.handling',before:'sound',value:'needs_work'}])).toThrow('Forbidden');
});
it('routes official review contract faults to one source-bound repair without accepting the draft',()=>{
 const objection={id:'O1',exchange:'Buyer needs delivery before June.',teaching:'Confirm the expected delivery date.'};
 const state=t.request({
  channel:'official',system:'# Coaching report instructions',call:{blocks,metadata:{}},
  prepared:{sourceHash:'source',sourceId:'exact-call',policyHash:'policy',blocks},
  models:{reviewer:'reviewer'},reasoning:{version:'interaction-identity-v1'},
  analysis:{observations:[],offer_identity:{family:'main_istv'}},provider_results:[],
  writer:{response:{parsed_json:{status:'completed',presentation:'syed-review-v1',offer_family:'main_istv',objections:[objection],lessons:[]}}}
 },'reviewer','reviewer',{system:'review',prompt:'original'});
 const base={target:'objections:O1:teaching',before:objection.teaching,value:'Ask for the specific deadline.',reason:'Confirm the buyer deadline.',source_quote:blocks[0]};
 for(const [edit,message] of [
  [{...base,target:'objections:O1',value:{...objection,teaching:base.value}},'Whole-item replacement forbidden'],
  [{...base,value:base.before},'No-op field patch'],
  [{...base,source_quote:{id:'T0001',text:'June'}},'Reasoning quote is an incomplete short fragment'],
 ] as const){
  const audit={pass:false,findings:[{issue:'Deadline handling',evidence_ids:['T0001']}],edits:[edit],observation_dispositions:[],coverage_additions:[]};
  const receipt={request_id:state.request.request_id,ok:true,provider_response_id:'paid',stop_reason:'stop',parsed_json:audit};
  const next=t.advance(state,receipt);
  expect(next.request.stage).toBe('review-contract-repair');
  expect(next.request.request_id).not.toBe(state.request.request_id);
  expect(next.request.prompt).toContain(message);
  expect(next.writer).toEqual(state.writer);
  expect(next.candidate).toBeUndefined();
  expect(next.provider_results).toHaveLength(1);
  expect(()=>t.advance(next,{...receipt,request_id:next.request.request_id})).toThrow(message);
  expect(()=>t.advance(state,{...receipt,provider_response_id:null})).toThrow();
  expect(()=>t.advance(state,{...receipt,request_id:'wrong'})).toThrow('Provider identity mismatch');
  expect(()=>t.advance({...state,channel:'manual'},receipt)).toThrow(message);
 }
});
