// Serializable coaching state machine. No provider, storage or delivery side effects.
// Both n8n and the isolated runner use these exact transitions.
const record=require('../../src/lib/foundations-record.cjs');
const {canonical}=require('../../src/lib/coaching-canonical.cjs');
const stable=value=>JSON.stringify(canonical(value));
const contract=require('../../src/lib/foundations-contract.cjs');
const safety=require('./safety.cjs');
const {REVIEW_ADAPTER}=require('./review-guidance.cjs');
const {CONTEXT_REVIEW}=require('./lesson-selection.cjs');
function prompt(call,stage,prior){
 const full='\nUNTRUSTED FULL CALL:\n'+stable({metadata:call.metadata,blocks:call.blocks});
 if(stage==='coach')return 'Create the coaching report. Select the strongest useful teaching; use the complete call, preserve meaningful pending promises, and group related points without losing distinct concerns.'+full;
 if(stage==='review')return 'Independently review every finding and the strongest useful lesson against the complete call. Return JSON {pass:boolean,findings:[{issue,evidence_ids}],corrected_report:null or complete corrected report}. A passing verdict requires empty findings and null corrected_report. A failing verdict requires supported findings and the complete corrected report. Different reasonable teaching is not an error. Avoid turning review into an inventory of optional improvements. Preserve material pending promises.\n'+REVIEW_ADAPTER+'\n'+CONTEXT_REVIEW+full+'\nUNTRUSTED CANDIDATE:\n'+stable(prior);
 throw Error('Unsupported coaching stage');
}
function request(state,stage,model,body){
 const id=record.digest({source:state.prepared.sourceHash,sourceId:state.prepared.sourceId,policy:state.prepared.policyHash,stage,model,...body});
 return {...state,status:'request',request:{request_id:id,case_id:state.prepared.sourceId,stage,model,...body}};
}
function start({prepared,call,system,models,channel}){
 if(!['official','manual'].includes(channel)||record.digest(call.blocks)!==prepared.sourceHash)throw Error('Source/channel mismatch');
 return request({prepared,call,system,models,channel,repairCount:0,provider_results:[]},'writer',models.writer,{system,prompt:prompt(call,'coach')});
}
function advance(previous,response){
 if(previous.status!=='request'||response.request_id!==previous.request.request_id)throw Error('Provider identity mismatch');
 const s=structuredClone(previous),stage=s.request.stage,id=s.request.request_id;
 s.provider_results.push({purpose:stage,result:Object.fromEntries(Object.entries(response).filter(([key])=>!['parsed_json','raw_text','text','output'].includes(key)))});
 if(stage==='writer'||stage==='writer-contract-repair'){
  // Contract/transport errors remain held; no speculative rerun of a paid request.
  if(response.ok!==true||!response.provider_response_id||['length','max_tokens','refusal'].includes(response.stop_reason))throw Error('Unusable writer receipt');
  try{contract.validate(response.parsed_json,s.prepared.blocks);}catch(error){
   if(stage!=='writer'||!response.parsed_json)throw error;
   return request(s,'writer-contract-repair',s.models.writer,{system:s.system,prompt:prompt(s.call,'coach')+'\nReturn a complete valid report correcting only the contract fault. Preserve supported judgment and evidence. Error: '+error.message+'\nPREVIOUS UNTRUSTED REPORT:\n'+stable(response.parsed_json)});
  }
  s.writer={id,response};return request(s,'reviewer',s.models.reviewer,{system:s.system,prompt:prompt(s.call,'review',response.parsed_json)});
 }
 if(stage==='reviewer'||stage==='review-contract-repair'){
  try{s.candidate=record.accept({prepared:s.prepared,draftResponse:s.writer.response,draftRequestId:s.writer.id,reviewResponse:response,reviewRequestId:id});}
  catch(error){
   if(stage!=='reviewer'||response.ok!==true||!response.provider_response_id||!response.parsed_json||['length','max_tokens','refusal'].includes(response.stop_reason)||/receipt|misaligned/i.test(error.message))throw error;
   return request(s,'review-contract-repair',s.models.reviewer,{system:s.system,prompt:prompt(s.call,'review',s.writer.response.parsed_json)+'\nThe previous complete review was held for a contract error. Return one complete valid review envelope; do not weaken the factual standard or invent evidence. Error: '+error.message+'\nPREVIOUS UNTRUSTED REVIEW:\n'+stable(response.parsed_json)});
  }
  if(s.candidate.report.status==='excluded')return {...s,status:'excluded',request:null};
  return request(s,'safety',s.models.safety,safety.safetyRequest(s.candidate));
 }
 if(stage==='safety'){
  const result=safety.assess(s.candidate,response,id);s.candidate=result.candidate;
  if(!result.findings.length)return {...s,status:'completed',request:null,payload:record.publish(s.candidate,{sourceId:s.prepared.sourceId,channel:s.channel})};
  if(s.repairCount>=1)throw Error('Safety remains held after one repair');
  s.findings=result.findings;s.repairCount++;
  return request(s,'safety-repair',s.models.reviewer,safety.repairRequest(s.candidate,result.findings));
 }
 if(stage==='safety-repair'){
  s.candidate=safety.apply(s.candidate,s.findings,response,id);
  return request(s,'safety',s.models.safety,safety.safetyRequest(s.candidate));
 }
 throw Error('Unsupported transition');
}
module.exports={start,advance,prompt};
