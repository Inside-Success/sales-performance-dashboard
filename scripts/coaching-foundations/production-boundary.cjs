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
function bindState(state,result,channel){
 const next=structuredClone(state);
 const sourceId=channel==='manual'?next.input?.public_id:(next.caseItem?.metadata?.airtable_record_id||next.caseItem?.metadata?.source_airtable_record_id||next.caseItem?.source?.['Source Airtable Record ID']||next.caseItem?.case_id);
 if(!sourceId||result.source_id!==String(sourceId)||result.channel!==channel||result.status!=='completed')throw Error('Completed source/channel mismatch');
 const projected=project(result.payload,String(sourceId),channel);
 next.provider_results=[...(next.provider_results||[]),...(result.provider_results||[])];
 next.coaching_raw=projected;next.reviewed_coaching_v3=projected.reviewed_coaching_v3;next.coaching_version=record.GENERATION;
 next.coaching_safety_log={candidate_digest:projected.reviewed_coaching_v3.digest,safety:projected.reviewed_coaching_v3.safety};
 return next;
}
module.exports={project,bindState};
