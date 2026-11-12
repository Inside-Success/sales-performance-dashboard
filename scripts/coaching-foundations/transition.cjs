// Serializable coaching state machine. No provider, storage or delivery side effects.
// Both n8n and the isolated runner use these exact transitions.
const record=require('../../src/lib/foundations-record.cjs');
const {canonical}=require('../../src/lib/coaching-canonical.cjs');
const stable=value=>JSON.stringify(canonical(value));
const contract=require('../../src/lib/foundations-contract.cjs');
const safety=require('./safety.cjs');
const reliability=require('./audit-reliability.cjs');
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
 return {...state,...(reliability.enabled(state)&&['safety','safety-contract-repair'].includes(stage)?{auditCandidateDigest:state.candidate.digest}:{}),status:'request',request:{request_id:id,case_id:state.prepared.sourceId,stage,model,...body}};
}
function start({prepared,call,system,models,channel,reasoning:options}){
 if(options?.version==='decision-plan-v1')return require('./decision-plan.cjs').start({prepared,call,system,models,channel,reasoning:options});
 if(!['official','manual'].includes(channel)||record.digest(call.blocks)!==prepared.sourceHash)throw Error('Source/channel mismatch');
 const configured=['interaction-reasoning-v1','interaction-identity-v1'].includes(options?.version)?{version:options.version,analyst:true,...(options.auditProtocol?{auditProtocol:options.auditProtocol}:{}),...(options.identityCatalog?{identityCatalog:options.identityCatalog}:{})}:reasoning.config(options);
 if(options?.auditProtocol&&!reliability.enabled({reasoning:options}))throw Error('Unknown audit protocol');
 const state={prepared,call,system,models,channel,reasoning:configured,repairCount:0,provider_results:[]};
 if(configured?.analyst){if(!models.analyst)throw Error('Missing analyst model');return request(state,'source-analyst',models.analyst,{system:protocol(state).analystSystem?protocol(state).analystSystem(state.reasoning):protocol(state).ANALYST_SYSTEM,prompt:'Read the full call. Return source observations only.\nUNTRUSTED FULL CALL:\n'+stable(call)});}
 return writer(state);
}
function writer(s){return request(s,'writer',s.models.writer,{system:s.system,prompt:prompt(s.call,'coach')+(s.analysis?'\nUNTRUSTED FALLIBLE SOURCE ANALYSIS — verify against the complete call, not a required report outline:\n'+stable(s.analysis):'')});}
function safetyBody(s){const body=safety.safetyRequest(s.candidate);if(['interaction-reasoning-v1','interaction-identity-v1'].includes(s.reasoning?.version))body.prompt+='\nUNTRUSTED SOURCE METADATA (subordinate to contradictory transcript evidence):\n'+stable(s.call.metadata||{});if(s.reasoning?.version==='interaction-identity-v1'&&!reliability.enabled(s))body.prompt+='\nAUDIT RESPONSE BINDING (copy exactly; do not calculate or rewrite):\n'+stable({candidate_digest:s.candidate.digest})+'\nComplete the required pass/findings/l1_decisions envelope from your independent full-source audit. The binding above must be copied unchanged.';return reliability.enabled(s)?reliability.auditBody(s,body):body;}
function protocol(s){if(s.reasoning?.version==='interaction-identity-v1')return require('./identity-reasoning.cjs');return s.reasoning?.version==='interaction-reasoning-v1'?require('./interaction-reasoning.cjs'):reasoning;}
function reviewPrompt(s){if(['interaction-reasoning-v1','interaction-identity-v1'].includes(s.reasoning?.version))return 'Review the coaching judgment and source coverage. '+CONTEXT_REVIEW+'\nUNTRUSTED FULL CALL:\n'+stable(s.call)+'\nUNTRUSTED CANDIDATE:\n'+stable(s.writer.response.parsed_json)+'\n'+protocol(s).editGuidance(s.analysis);return prompt(s.call,'review',s.writer.response.parsed_json)+(s.reasoning?'\n'+protocol(s).editGuidance(s.analysis):'');}
function advance(previous,response){
 if(previous.reasoning?.version==='decision-plan-v1')return require('./decision-plan.cjs').advance(previous,response);
 if(previous.status!=='request'||response.request_id!==previous.request.request_id)throw Error('Provider identity mismatch');
 const s=structuredClone(previous),stage=s.request.stage,id=s.request.request_id;
 s.provider_results.push({purpose:stage,result:Object.fromEntries(Object.entries(response).filter(([key])=>!['parsed_json','raw_text','text','output'].includes(key)))});
 if(stage==='source-analyst'||stage==='analyst-evidence-repair'){
  if(response.ok!==true||!response.provider_response_id||!['stop','end_turn'].includes(response.stop_reason)||!response.parsed_json)throw Error('Unusable analyst receipt');
  if(stage==='analyst-evidence-repair'){
   const withoutEvidence=a=>{const out=structuredClone(a);if(out.offer_identity)delete out.offer_identity.evidence;return out;};
   if(stable(withoutEvidence(response.parsed_json))!==stable(withoutEvidence(s.analystRepairOriginal)))throw Error('Analyst repair changed protected analysis');
  }
  try{s.analysis=protocol(s).validateAnalysis(response.parsed_json,s.prepared.blocks);}catch(error){
   if(stage!=='source-analyst'||error.code!=='ANALYST_IDENTITY_EVIDENCE'||s.analystEvidenceRepairUsed)throw error;
   s.analystEvidenceRepairUsed=true;s.analystRepairOriginal=structuredClone(response.parsed_json);
   return request(s,'analyst-evidence-repair',s.models.analyst,{system:s.request.system,prompt:'Correct only offer_identity.evidence in the supplied analysis. Return the complete analysis JSON with every other value unchanged, including observations, family, show and reason. Each evidence item must quote one contiguous original excerpt from its named source block. Do not insert ellipses to omit words, join separate passages, paraphrase, or invent evidence. Supply direct identifying evidence for the same current offer; do not choose a different family or weaken the claim to unknown to pass validation. If no supported correction exists, do not fabricate one. Validation faults: '+stable(error.issues)+'\nUNTRUSTED FULL CALL:\n'+stable(s.call)+'\nPREVIOUS UNTRUSTED ANALYSIS:\n'+stable(response.parsed_json)});
  }
  return writer(s.reasoning?.version==='interaction-identity-v1'?protocol(s).bind(s):s);
 }
 if(stage==='writer'||stage==='writer-contract-repair'){
  // Contract/transport errors remain held; no speculative rerun of a paid request.
  if(response.ok!==true||!response.provider_response_id||['length','max_tokens','refusal'].includes(response.stop_reason))throw Error('Unusable writer receipt');
  try{contract.validate(response.parsed_json,s.prepared.blocks);if(s.reasoning?.version==='interaction-identity-v1')protocol(s).assertReport(response.parsed_json,s.analysis);if(s.system.includes("TYLER REVIEW PRESENTATION — revision tyler-review-v2")&&response.parsed_json.presentation!=="tyler-review-v2")throw Error("Missing requested presentation revision");if(s.system.includes("TYLER REVIEW, NOVEMBER 9 CALL AND EDITED DRAFT")&&response.parsed_json.presentation!=="tyler-review-v1")throw Error("Missing requested presentation revision");}catch(error){
   if(stage!=='writer'||!response.parsed_json)throw error;
   return request(s,'writer-contract-repair',s.models.writer,{system:s.system,prompt:prompt(s.call,'coach')+'\nReturn a complete valid report correcting only the contract fault. Preserve supported judgment and evidence. All contract faults: '+stable(error.issues||[{path:'report',message:error.message}])+'\nCorrect every listed fault in one response. Recheck every objection and lesson, not just the first fault. Keep supported judgments, evidence and classification unchanged; do not remove a finding or change handling merely to satisfy the contract. Do not invent generic filler.\nPREVIOUS UNTRUSTED REPORT:\n'+stable(response.parsed_json)});
  }
  s.writer={id,response};return request(s,'reviewer',s.models.reviewer,{system:s.system,prompt:reviewPrompt(s)});
 }
 if(stage==='eligibility-review'){
  s.candidate=require('./reviewer-recovery.cjs').accept(s,response);
  return {...s,status:'excluded',request:null};
 }
 if(['reviewer','review-contract-repair','reviewer-output-repair'].includes(stage)){
  const recovery=require('./reviewer-recovery.cjs');
  const proposed=recovery.proposal(s.writer.response.parsed_json,response,s.prepared.blocks);
  if(proposed){
   s.eligibilityProposal={report:proposed,receipt:response};
   return request(s,'eligibility-review',s.models.reviewer,recovery.body(s,proposed));
  }
  if(stage==='reviewer'&&require('../../src/lib/foundations-terminal-receipt.cjs').repairableReviewerReceipt('foundations_reviewer_v3',response)){
   return request(s,'reviewer-output-repair',s.models.reviewer,{system:s.system,max_tokens:24000,prompt:reviewPrompt(s)+'\nThe previous terminal review exhausted its output allowance or returned invalid JSON. Independently review the same complete source and candidate; do not infer approval from that attempt. Return only the required compact justified-edits JSON envelope, with concise reasons and short exact evidence quotes. Preserve all material findings and required observation coverage. This is the single output-format recovery attempt.'});
  }
  try{let evaluated=response;if(s.reasoning)evaluated={...response,parsed_json:protocol(s).materializeReview(s.writer.response.parsed_json,response.parsed_json,s.analysis,s.prepared.blocks)};if(!s.reasoning&&s.system.includes(require('./judgment-review.cjs').MARKER))require('./judgment-review.cjs').validate(s.writer.response.parsed_json,response.parsed_json,s.prepared.blocks);s.candidate=record.accept({prepared:s.prepared,draftResponse:s.writer.response,draftRequestId:s.writer.id,reviewResponse:evaluated,reviewRequestId:id});}
  catch(error){
   if(stage!=='reviewer'||response.ok!==true||!response.provider_response_id||!response.parsed_json||['length','max_tokens','refusal'].includes(response.stop_reason)||/receipt|misaligned/i.test(error.message))throw error;
   return request(s,'review-contract-repair',s.models.reviewer,{system:s.system,prompt:reviewPrompt(s)+'\nThe previous complete review was held for a contract error. Return one complete valid review envelope; do not weaken the factual standard or invent evidence. All contract faults: '+stable(error.issues||[{path:'review',message:error.message}])+'\nCorrect every listed fault in the complete corrected report.\nPREVIOUS UNTRUSTED REVIEW:\n'+stable(response.parsed_json)});
  }
  if(s.candidate.report.status==='excluded')return {...s,status:'excluded',request:null};
  return request(s,'safety',s.models.safety,safetyBody(s));
 }
 if(stage==='safety'||stage==='safety-contract-repair'){
  let result;
  try{result=safety.assess(s.candidate,reliability.enabled(s)?reliability.boundResponse(s,response):response,id);}catch(error){
   if(reliability.enabled(s)&&error.message==='Unmapped, stale or non-prose safety finding'){
    reliability.validateFindings(s.candidate,response.parsed_json?.findings);
    if(s.adjudicationUsed)throw error;
    s.adjudicationUsed=true;s.adjudicationFindings=response.parsed_json.findings;
    return request(s,'safety-adjudication',s.models.reviewer,reliability.adjudicationRequest(s,s.adjudicationFindings));
   }
   // Only a confirmed terminal response may receive one new format review.
   // Unknown outcomes/refusals remain held. Only the isolated identity protocol
   // may discard a terminal mismatched digest and request a fresh full audit.
   // The mismatched receipt never establishes safety approval or edits the candidate.
   const terminal=response.ok===true&&response.provider_response_id&&['stop','end_turn','length','max_tokens'].includes(response.stop_reason);
   const parsed=response.parsed_json;
   const sameCandidate=reliability.enabled(s)?(!parsed||!Object.hasOwn(parsed,'candidate_digest')):(!parsed||parsed.candidate_digest===s.candidate.digest);
   const freshAudit=s.reasoning?.version==='interaction-identity-v1'&&['stop','end_turn'].includes(response.stop_reason)&&
    /^[a-f0-9]{64}$/.test(parsed?.candidate_digest||'')&&!sameCandidate&&
    typeof parsed.pass==='boolean'&&Array.isArray(parsed.findings)&&parsed.pass===(parsed.findings.length===0);
   const formatFault=['length','max_tokens'].includes(response.stop_reason)||!parsed||/^(Incomplete safety adjudication|Conflicting safety decision)$/.test(error.message);
   const attempted=s.safetyContractRepairs?.includes(s.candidate.digest);
   if(stage!=='safety'||!terminal||(!sameCandidate&&!freshAudit)||!formatFault||attempted)throw error;
   s.safetyContractRepairs=[...(s.safetyContractRepairs||[]),s.candidate.digest];
   const body=safetyBody(s);
   body.prompt+='\nA previous terminal review could not be accepted because its response was truncated or structurally invalid. Independently review the same complete candidate and source again. Return only the specified compact JSON envelope. l1_decisions must contain exactly the supplied lexical candidate IDs, not prose field paths; when lexical_candidates is empty, return l1_decisions: []. Keep reasoning concise, but preserve every genuine finding. Never infer approval from the previous attempt.';
   return request(s,'safety-contract-repair',s.models.safetyFormat||s.models.safety,body);
  }
  s.candidate=result.candidate;
  if(!result.findings.length)return {...s,status:'completed',request:null,payload:record.publish(s.candidate,{sourceId:s.prepared.sourceId,channel:s.channel})};
  if(s.repairCount>=1){
   if(!reliability.enabled(s)||s.adjudicationUsed)throw Error('Safety remains held after one repair');
   s.adjudicationUsed=true;s.adjudicationFindings=result.findings;
   return request(s,'safety-adjudication',s.models.reviewer,reliability.adjudicationRequest(s,result.findings));
  }
  s.findings=result.findings;s.repairCount++;
  return request(s,'safety-repair',s.models.reviewer,safety.repairRequest(s.candidate,result.findings));
 }
 if(stage==='safety-adjudication'){
  s.candidate=reliability.adjudicate(s,response);s.auditAdjudication=s.candidate.auditAdjudication;
  return request(s,'safety',s.models.safety,safetyBody(s));
 }
 if(stage==='safety-repair'){
  s.candidate=safety.apply(s.candidate,s.findings,response,id);
  return request(s,'safety',s.models.safety,safetyBody(s));
 }
 throw Error('Unsupported transition');
}
module.exports={start,advance,prompt};
