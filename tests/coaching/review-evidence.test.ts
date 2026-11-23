import {expect,it} from 'vitest';
const evidence=require('../../scripts/coaching-foundations/review-evidence.cjs');
const {digest}=require('../../src/lib/coaching-canonical.cjs');
const blocks=[
 {id:'T0001',timestamp:'00:12',text:'Buyer: I need my partner to sign. We cannot pay today.'},
 {id:'T0002',timestamp:'00:17',text:'Rep: I will send the updated contract.'},
];
const source={channel:'official',call:{blocks},prepared:{blocks,sourceHash:digest(blocks)}};
const referenced={edits:[{target:'outcome',value:'No payment today',reason:'Buyer declined immediate payment.',evidence_ref:{start:'T0001:1',end:'T0001:2'}}],observation_dispositions:[],coverage_additions:[]};
it('materializes an exact contiguous excerpt from the immutable call',()=>{
 const out=evidence.decode(source,referenced);
 expect(out.issues).toEqual([]);
 expect(out.result.edits[0].source_quote).toEqual({id:'T0001',text:blocks[0].text});
 expect(out.result.edits[0].evidence_ref).toBeUndefined();
 expect(referenced.edits[0].evidence_ref).toEqual({start:'T0001:1',end:'T0001:2'});
});
it('rejects bogus, mixed, cross-block and reversed span selections',()=>{
 for(const ref of [{start:'T0004:1'},{start:'T0001:1',end:'T0002:1'},{start:'T0001:2',end:'T0001:1'},{start:'T0001:1',text:'invented'}]){
  const entry={...referenced.edits[0],evidence_ref:ref};
  expect(evidence.decode(source,{...referenced,edits:[entry]}).issues[0].path).toBe('edits.0');
 }
 expect(()=>evidence.decode({...source,call:{blocks:[blocks[1]]}},referenced)).toThrow('source mismatch');
 expect(()=>evidence.decode({...source,channel:'manual'},referenced)).toThrow('source mismatch');
});
it('repairs only failing evidence slots, preserving judgment and refusing unsupported evidence',()=>{
 const legacy={...referenced,edits:[{...referenced.edits[0],evidence_ref:undefined,source_quote:{id:'T0001',text:'Invented payment commitment'}}]};
 const failed=evidence.decode(source,legacy,{legacy:true});
 expect(evidence.repairBody(source,legacy,failed.issues).prompt).toMatch(/\bJSON\b/);
 const good={path:'edits.0',evidence_ref:{start:'T0001:2'}};
 const fixed=evidence.patchEvidence(source,legacy,failed.issues,[{...good,value:'Changed outcome'}],{legacy:true});
 expect(fixed.edits[0].value).toBe('No payment today');
 expect(fixed.edits[0].source_quote).toEqual({id:'T0001',text:'We cannot pay today.'});
 for(const invalid of [[{...good,evidence_ref:null}],[{...good,path:'edits.1'}],[good,good]]){
  expect(()=>evidence.patchEvidence(source,legacy,failed.issues,invalid,{legacy:true})).toThrow();
 }
});

it('routes new official writer output through referenced review and requires safety',()=>{
 const t=require('../../scripts/coaching-foundations/transition.cjs');
 const {prepare}=require('../../src/lib/foundations-record.cjs');
 const system='# Coaching report instructions';
 const prepared=prepare({sourceId:'fixture',policyRevision:'fixture',policyText:system,blocks});
 const report={
  version:'coaching-foundations-v3',presentation:'syed-review-v1',status:'completed',
  exclusion_reason:'',offer_family:'main_istv',show:'Documentary',summary:'Clarify the approval timeline.',
  outcome:{payment:'not_confirmed',text:'No payment today.',evidence_ids:['T0001']},
  objections:[],lessons:[],next_steps:[],focus_id:'',coverage:[]
 };
 const state={
  prepared,channel:'official',system,call:{blocks,metadata:{}},
  reasoning:{version:'interaction-identity-v1',auditProtocol:'request-bound-audit-v1'},
  reviewEvidenceVersion:evidence.VERSION,models:{reviewer:'review',safety:'safety'},
  analysis:{offer_identity:{family:'main_istv'},observations:[]},provider_results:[]
 };
 const response=(request:{request_id:string},parsed_json:unknown)=>({
  request_id:request.request_id,ok:true,provider_response_id:'fixture',stop_reason:'stop',parsed_json
 });
 const next=t.request(state,'writer','writer',{system,prompt:'Write coaching.'});
 const review=t.advance(next,response(next.request,report));
 expect(review.request.stage).toBe('reviewer-reference');
 expect(review.request.prompt).toContain('T0001:2');
 const manual={...next,channel:'manual',reviewEvidenceVersion:undefined};
 expect(t.advance(manual,response(manual.request,report)).request.stage).toBe('reviewer');
 const audit={
  pass:false,findings:[{issue:'Clarify the approval dependency',evidence_ids:['T0001']}],
  edits:[{target:'summary',before:report.summary,value:'Confirm who must sign and when.',reason:'The buyer raised a second signer.',evidence_ref:{start:'T0001:1'}}],
  observation_dispositions:[],coverage_additions:[]
 };
 const safety=t.advance(review,response(review.request,audit));
 expect(safety.request.stage).toBe('safety');
 expect(safety.candidate.report.summary).toBe(audit.edits[0].value);
 expect(safety.candidate.safety).toBeNull();
 expect(safety.payload).toBeUndefined();
 expect(safety.provider_results.at(-1).purpose).toBe('reviewer-reference');
});
