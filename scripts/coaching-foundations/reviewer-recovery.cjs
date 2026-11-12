// Exception-only reviewer recovery. Never converts a failed review into approval.
const record=require('../../src/lib/foundations-record.cjs');
const contract=require('../../src/lib/foundations-contract.cjs');
const quote=require('./source-quote.cjs');
function proposal(draft,r,blocks){
 if(r?.ok!==true||!r.provider_response_id||!['stop','end_turn'].includes(r.stop_reason)||!r.parsed_json||draft.status!=='completed')return null;
 const a=r.parsed_json;
 let p;
 if(a.status==='excluded')p=structuredClone(a);
 else if(Array.isArray(a.edits)&&a.edits.some(e=>e.target==='status'&&e.value==='excluded')){
  const status=a.edits.filter(e=>e.target==='status');if(status.length!==1)throw Error('Ambiguous eligibility proposal');
  quote.resolve(status[0].source_quote,blocks);
  const reasons=a.edits.filter(e=>e.target==='exclusion_reason');if(reasons.length!==1)throw Error('Missing exclusion reason');
  quote.resolve(reasons[0].source_quote,blocks);
  p={...structuredClone(draft),status:'excluded',exclusion_reason:reasons[0].value,objections:[],lessons:[],next_steps:[],focus_id:''};
  if(p.presentation)p.summary='';
 }else return null;
 contract.validate(p,blocks);
 if(p.offer_family!==draft.offer_family||p.show!==draft.show||p.presentation!==draft.presentation)throw Error('Eligibility proposal changed protected identity');
 return p;
}
function body(s,p){return {system:s.system,prompt:'ELIGIBILITY ADJUDICATION — override report/review output format for this request only. Independently read the FULL call and decide whether the proposed exclusion is justified under the existing coaching scope and its reason and outcome accurately describe the source. Metadata/title and the previous reviewer are fallible. A price objection, no sale, missing payment, unknown offer family, imperfect handling or incomplete closing alone does NOT make a substantive sales call ineligible. Check the actual interaction and later exchanges. Do not force agreement. Return only JSON {proposal_digest,confirm:boolean,reason:string,evidence:[{id,text}]}. Copy proposal_digest exactly. Evidence must contain short exact contiguous excerpts from the source establishing the decision. A disagreement remains held for inspection; never fabricate support. Keep the explanation concise.\nproposal_digest: '+record.digest(p)+'\nUNTRUSTED FULL CALL:\n'+JSON.stringify(s.call)+'\nUNTRUSTED PROPOSED EXCLUSION:\n'+JSON.stringify(p)};}
function accept(s,r){
 const p=s.eligibilityProposal,a=r.parsed_json;
 if(r.ok!==true||!r.provider_response_id||!['stop','end_turn'].includes(r.stop_reason)||a?.proposal_digest!==record.digest(p.report)||a.confirm!==true||typeof a.reason!=='string'||!a.reason.trim()||!Array.isArray(a.evidence)||!a.evidence.length||a.evidence.length>12)throw Error('Eligibility adjudication unconfirmed');
 const evidence=a.evidence.map(q=>quote.resolve(q,s.prepared.blocks));
 const normalized={...r,parsed_json:{pass:true,findings:[],corrected_report:null}};
 const c=record.accept({prepared:s.prepared,draftResponse:{...p.receipt,parsed_json:p.report},draftRequestId:p.receipt.request_id,reviewResponse:normalized,reviewRequestId:s.request.request_id});
 c.eligibilityReview={version:'reviewer-eligibility-v1',originalWriterRequestId:s.writer.id,proposalRequestId:p.receipt.request_id,proposalDigest:record.digest(p.report),reason:a.reason,evidence};
 return c;
}
module.exports={proposal,body,accept};
