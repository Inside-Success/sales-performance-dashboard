// Serializable coaching state machine. No provider, storage or delivery side effects.
// Both n8n and the isolated runner use these exact transitions.
const record=require('../../src/lib/foundations-record.cjs');
const {canonical}=require('../../src/lib/coaching-canonical.cjs');
const stable=value=>JSON.stringify(canonical(value));
const contract=require('../../src/lib/foundations-contract.cjs');
const safety=require('./safety.cjs');
const reasoning=require('./source-reasoning.cjs');
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
function start({prepared,call,system,models,channel,reasoning:options}){
 if(options?.version==='decision-plan-v1')return require('./decision-plan.cjs').start({prepared,call,system,models,channel,reasoning:options});
 if(!['official','manual'].includes(channel)||record.digest(call.blocks)!==prepared.sourceHash)throw Error('Source/channel mismatch');
 const configured=reasoning.config(options);
 const state={prepared,call,system,models,channel,reasoning:configured,repairCount:0,provider_results:[]};
 if(configured?.analyst){if(!models.analyst)throw Error('Missing analyst model');return request(state,'source-analyst',models.analyst,{system:reasoning.ANALYST_SYSTEM,prompt:'Read the full call. Return source observations only.\nUNTRUSTED FULL CALL:\n'+stable(call)});}
 return writer(state);
}
function writer(s){return request(s,'writer',s.models.writer,{system:s.system,prompt:prompt(s.call,'coach')+(s.analysis?'\nUNTRUSTED FALLIBLE SOURCE ANALYSIS — verify against the complete call, not a required report outline:\n'+stable(s.analysis):'')});}
function reviewPrompt(s){return prompt(s.call,'review',s.writer.response.parsed_json)+(s.reasoning?'\n'+reasoning.editGuidance(s.analysis):'');}
function advance(previous,response){
 if(previous.reasoning?.version==='decision-plan-v1')return require('./decision-plan.cjs').advance(previous,response);
 if(previous.status!=='request'||response.request_id!==previous.request.request_id)throw Error('Provider identity mismatch');
 const s=structuredClone(previous),stage=s.request.stage,id=s.request.request_id;
 s.provider_results.push({purpose:stage,result:Object.fromEntries(Object.entries(response).filter(([key])=>!['parsed_json','raw_text','text','output'].includes(key)))});
 if(stage==='source-analyst'){
  if(response.ok!==true||!response.provider_response_id||['length','max_tokens','refusal'].includes(response.stop_reason))throw Error('Unusable analyst receipt');
  s.analysis=reasoning.validateAnalysis(response.parsed_json,s.prepared.blocks);return writer(s);
 }
 if(stage==='writer'||stage==='writer-contract-repair'){
  // Contract/transport errors remain held; no speculative rerun of a paid request.
  if(response.ok!==true||!response.provider_response_id||['length','max_tokens','refusal'].includes(response.stop_reason))throw Error('Unusable writer receipt');
  try{contract.validate(response.parsed_json,s.prepared.blocks);if(s.system.includes("TYLER REVIEW PRESENTATION — revision tyler-review-v2")&&response.parsed_json.presentation!=="tyler-review-v2")throw Error("Missing requested presentation revision");if(s.system.includes("TYLER REVIEW, NOVEMBER 9 CALL AND EDITED DRAFT")&&response.parsed_json.presentation!=="tyler-review-v1")throw Error("Missing requested presentation revision");}catch(error){
   if(stage!=='writer'||!response.parsed_json)throw error;
   return request(s,'writer-contract-repair',s.models.writer,{system:s.system,prompt:prompt(s.call,'coach')+'\nReturn a complete valid report correcting only the contract fault. Preserve supported judgment and evidence. All contract faults: '+stable(error.issues||[{path:'report',message:error.message}])+'\nCorrect every listed fault in one response. Recheck every objection and lesson, not just the first fault. Keep supported judgments, evidence and classification unchanged; do not remove a finding or change handling merely to satisfy the contract. Do not invent generic filler.\nPREVIOUS UNTRUSTED REPORT:\n'+stable(response.parsed_json)});
  }
  s.writer={id,response};return request(s,'reviewer',s.models.reviewer,{system:s.system,prompt:reviewPrompt(s)});
 }
 if(stage==='reviewer'||stage==='review-contract-repair'){
  try{let evaluated=response;if(s.reasoning)evaluated={...response,parsed_json:reasoning.materializeReview(s.writer.response.parsed_json,response.parsed_json,s.analysis,s.prepared.blocks)};if(!s.reasoning&&s.system.includes(require('./judgment-review.cjs').MARKER))require('./judgment-review.cjs').validate(s.writer.response.parsed_json,response.parsed_json,s.prepared.blocks);s.candidate=record.accept({prepared:s.prepared,draftResponse:s.writer.response,draftRequestId:s.writer.id,reviewResponse:evaluated,reviewRequestId:id});}
  catch(error){
   if(stage!=='reviewer'||response.ok!==true||!response.provider_response_id||!response.parsed_json||['length','max_tokens','refusal'].includes(response.stop_reason)||/receipt|misaligned/i.test(error.message))throw error;
   return request(s,'review-contract-repair',s.models.reviewer,{system:s.system,prompt:reviewPrompt(s)+'\nThe previous complete review was held for a contract error. Return one complete valid review envelope; do not weaken the factual standard or invent evidence. All contract faults: '+stable(error.issues||[{path:'review',message:error.message}])+'\nCorrect every listed fault in the complete corrected report.\nPREVIOUS UNTRUSTED REVIEW:\n'+stable(response.parsed_json)});
  }
  if(s.candidate.report.status==='excluded')return {...s,status:'excluded',request:null};
  return request(s,'safety',s.models.safety,safety.safetyRequest(s.candidate));
 }
 if(stage==='safety'||stage==='safety-contract-repair'){
  let result;
  try{result=safety.assess(s.candidate,response,id);}catch(error){
   // Only a confirmed terminal response may receive one new format review.
   // Unknown transport outcomes, refusals, stale digests and unmapped findings stay held.
   const terminal=response.ok===true&&response.provider_response_id&&['stop','end_turn','length','max_tokens'].includes(response.stop_reason);
   const parsed=response.parsed_json;
   const sameCandidate=!parsed||parsed.candidate_digest===s.candidate.digest;
   const formatFault=['length','max_tokens'].includes(response.stop_reason)||!parsed||/^(Incomplete safety adjudication|Conflicting safety decision)$/.test(error.message);
   const attempted=s.safetyContractRepairs?.includes(s.candidate.digest);
   if(stage!=='safety'||!terminal||!sameCandidate||!formatFault||attempted)throw error;
   s.safetyContractRepairs=[...(s.safetyContractRepairs||[]),s.candidate.digest];
   const body=safety.safetyRequest(s.candidate);
   body.prompt+='\nA previous terminal review could not be accepted because its response was truncated or structurally invalid. Independently review the same complete candidate and source again. Return only the specified compact JSON envelope. l1_decisions must contain exactly the supplied lexical candidate IDs, not prose field paths; when lexical_candidates is empty, return l1_decisions: []. Keep reasoning concise, but preserve every genuine finding. Never infer approval from the previous attempt.';
   return request(s,'safety-contract-repair',s.models.safety,body);
  }
  s.candidate=result.candidate;
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
