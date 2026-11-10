// Candidate compatibility projection. Reviewed v3 remains authoritative; no invented scores or claims.
const record=require('../../src/lib/foundations-record.cjs');
function project(payload,sourceId,channel){
 const loaded=record.read(payload,sourceId,channel);if(!loaded)throw Error('Missing foundations report');
 const r=loaded.report,improve=r.lessons.filter(x=>x.purpose!=='repeat'),repeat=r.lessons.filter(x=>x.purpose==='repeat');
 const lesson=x=>[x.title,x.observation,x.teaching,x.example].filter(Boolean).join('\n');
 const focus=[...r.objections,...r.lessons].find(x=>x.id===r.focus_id);
 return {...payload,status:'completed',call_status:'scored',refusal_reason:null,one_line_verdict:r.outcome.text,
 biggest_strength:repeat[0]?lesson(repeat[0]):'',what_id_polish:improve[0]?lesson(improve[0]):'',coaching_tip:focus?.teaching||'',
 rudys_note:'',what_went_well:repeat.map(lesson),what_to_improve:improve.map(lesson),
 why_no_close:r.outcome.payment==='confirmed'?'':r.outcome.text,what_made_this_close_work:r.outcome.payment==='confirmed'?r.outcome.text:'',
 objections_surfaced:r.objections.map(x=>[x.concern,x.response,x.assessment,x.teaching].filter(Boolean).join('\n')),winnability:''};
}
// Exclusions are reviewed terminal outcomes, never scored reports or processing errors.
function excludedProjection(result, expected) {
 const c=result.candidate,p=c?.prepared;
 if(!expected||expected.sourceId!==result.source_id||!p||p.sourceId!==result.source_id||p.sourceHash!==expected.sourceHash||p.policyHash!==expected.policyHash||p.policyRevision!==expected.policyRevision||record.digest(p.blocks)!==p.sourceHash||record.digest(p.policyText)!==p.policyHash||c.digest!==record.digest(c.report)||c.report?.status!=='excluded'||result.payload!=null)throw Error('Unverified coaching exclusion binding');
 require('../../src/lib/foundations-contract.cjs').validate(c.report,p.blocks);
 const receipts=result.provider_results||[];
 for(const [id,stages] of [[c.writerRequestId,['writer','writer-contract-repair']],[c.reviewRequestId,['reviewer','review-contract-repair']]]) {
  if(!id||!receipts.some(x=>stages.includes(x.purpose)&&x.result?.request_id===id&&x.result.ok===true&&x.result.provider_response_id&&!['length','max_tokens','refusal'].includes(x.result.stop_reason)))throw Error('Unverified coaching exclusion review');
 }
 return {status:'refused',call_status:'refused',refusal_reason:c.report.exclusion_reason,coaching_version:record.GENERATION,
 reviewed_exclusion_v3:{source_id:result.source_id,channel:result.channel,source_hash:p.sourceHash,policy_hash:p.policyHash,digest:c.digest,writer_request_id:c.writerRequestId,review_request_id:c.reviewRequestId,reason:c.report.exclusion_reason,evidence_ids:c.report.outcome.evidence_ids}};
}
function bindState(state,result,channel,expectedPrepared){
 const next=structuredClone(state);
 const sourceId=channel==='manual'?next.input?.public_id:(next.caseItem?.metadata?.airtable_record_id||next.caseItem?.metadata?.source_airtable_record_id||next.caseItem?.source?.['Source Airtable Record ID']||next.caseItem?.case_id);
 if(!['official','manual'].includes(channel)||!sourceId||result.source_id!==String(sourceId)||result.channel!==channel||!['completed','excluded'].includes(result.status))throw Error('Completed source/channel mismatch');
 const projected=result.status==='excluded'?excludedProjection(result,expectedPrepared):project(result.payload,String(sourceId),channel);
 next.provider_results=[...(next.provider_results||[]),...(result.provider_results||[])];
 next.coaching_raw=projected;next.reviewed_coaching_v3=projected.reviewed_coaching_v3;next.coaching_version=record.GENERATION;
 next.coaching_safety_log=result.status==='excluded'?{reviewed_exclusion_v3:projected.reviewed_exclusion_v3}:{candidate_digest:projected.reviewed_coaching_v3.digest,safety:projected.reviewed_coaching_v3.safety};
 return next;
}
module.exports={project,bindState,excludedProjection};
