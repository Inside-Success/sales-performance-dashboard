// Surgical transforms for reviewed coaching. Run on a freshly retrieved node body.
// Exports contain no customer data, credentials, or deployable full workflow.
function replaceOnce(source,before,after) {
 if(source.split(before).length!==2)throw Error('Patch anchor changed: '+before.slice(0,60));
 return source.replace(before,after);
}
const PACK=`
 const times=ids=>[...new Set(ids.map(id=>byId.get(id)?.timestamp).filter(Boolean))];
 const finding=(row,kind,index)=>({id:kind+'-'+(row.evidence_ids||[]).slice(0,4).join('-')+'-'+index,observation:row.observation,evidence:times(row.evidence_ids||[])});
 const reviewed_coaching_v1={version:'coaching-review-v1',source_id:'pending',
  outcome:{payment:outcome.payment,summary:outcome.summary,evidence:times(outcome.evidence_ids)},
  strengths:analysis.strengths.map((row,index)=>({...finding(row,'strength',index),why_useful:row.why_useful||''})),
  improvements:improvements.map(({row},index)=>({...finding(row,'improvement',index),priority:row.priority,title:row.title||undefined,possible_effect:row.possible_effect,better_action:row.better_action})),
  blockers:analysis.blockers.map((row,index)=>finding(row,'blocker',index)),
  next_steps:analysis.next_steps.map((row,index)=>finding(row,'next',index))};
`;
const GUARD=`
function safeReviewedCoaching(coaching,final,sourceId){
 const record=coaching?.reviewed_coaching_v1;
 if(!record||record.version!=='coaching-review-v1'||!sourceId)return null;
 // Never bypass a later safety repair with an earlier structured finding.
 const fields=['one_line_verdict','what_to_improve','what_went_well','why_no_close','what_made_this_close_work','objections_surfaced'];
 if(fields.some(key=>JSON.stringify(coaching[key])!==JSON.stringify(final[key])))return null;
 return {...record,source_id:String(sourceId)};
}
`;
function reviewedRenderer(source){
 source=replaceOnce(source,' const rejected=new Set(normalized.rejected_improvements);',` const corrections=normalized.corrected_improvements||[];
 if(!Array.isArray(corrections)||new Set(corrections.map(x=>x.index)).size!==corrections.length)throw Error('Invalid improvement corrections');
 const known=new Set(blocks.map(x=>x.id));
 for(const correction of corrections){
  const {index,replacement:row}=correction;
  if(!Number.isInteger(index)||index<0||index>=analysis.improvements.length||normalized.rejected_improvements.includes(index)||normalized.improvement_reviews.find(x=>x.index===index)?.verdict!=='keep')throw Error('Unreviewed correction');
  if(!row||!['material','optional'].includes(row.priority)||['observation','possible_effect','better_action','counterevidence_summary'].some(key=>typeof row[key]!=='string'||!row[key].trim())||!Array.isArray(row.evidence_ids)||!row.evidence_ids.length||!Array.isArray(row.counterevidence_ids)||[...row.evidence_ids,...row.counterevidence_ids].some(id=>!known.has(id)))throw Error('Unsupported correction shape');
  if(row.title!=null&&(typeof row.title!=='string'||row.title.length>180))throw Error('Invalid correction title');
  reviewedAnalysis={...reviewedAnalysis,improvements:reviewedAnalysis.improvements.map((item,i)=>i===index?{...row,example:''}:item)};
 }
 const rejected=new Set(normalized.rejected_improvements);`);
 source=replaceOnce(source,'{optionalFallbackOnly:true,excludePolicyChanges:true}' ,'{excludePolicyChanges:true}');
 source=replaceOnce(source,"return {status:'completed',call_status:'scored',refusal_reason:null,...coaching};",PACK+"return {status:'completed',call_status:'scored',refusal_reason:null,...coaching,reviewed_coaching_v1};");
 source=replaceOnce(source,"const primary=improvements.find(x=>x.row.priority==='material')||improvements[0];","improvements.sort((a,b)=>(a.row.priority==='material'?0:1)-(b.row.priority==='material'?0:1));\n const primary=improvements.find(x=>x.row.priority==='material')||improvements[0];");
 // Keep the public optional label removed, including Slack/docs for future reports.
 source=source.replaceAll("(row.priority==='optional'?'Optional polish: ':'')+",'').replaceAll("(primary.row.priority==='optional'?'Optional polish: ':'')+",'');
 return source.replaceAll('call2-sonnet5-efficiency-2026-09-08','call2-reviewed-coaching-2026-09-30');
}
function officialFinal(source){
 source=replaceOnce(source,'const output = buildScoredOutput(state, complete.coaching);',GUARD+'\nconst reviewed_coaching_v1=safeReviewedCoaching({...state.coaching_raw,reviewed_coaching_v1:state.reviewed_coaching_v1||state.coaching_raw?.reviewed_coaching_v1},complete.coaching,sourceIdFromState(state));\nconst output = buildScoredOutput(state, complete.coaching);');
 return replaceOnce(source,'...state.caseItem.source, output, agent_version:', '...state.caseItem.source, output, reviewed_coaching_v1, agent_version:');
}
function manualFinal(source){
 source=replaceOnce(source,'const final = { ...complete.coaching, status:',GUARD+'\nconst reviewed_coaching_v1=safeReviewedCoaching(state.coaching_raw,complete.coaching,state.input?.public_id);\nconst final = { ...complete.coaching, reviewed_coaching_v1, status:');return source;
}
const COVERAGE='\nCOACHING COVERAGE: Review the whole call for distinct useful opportunities in answering direct questions, adapting to stated constraints, understanding objections, connecting value to the buyer, and agreeing concrete next steps. Normally surface two or three meaningful distinct actions when actually supported, more if useful, but never fill a quota. Credit later corrections and resolved concerns. Add a concise factual title to each improvement (3-8 words) describing its action; the reviewer must check it too. Optional practical advice may be published if evidence-supported and actually useful; it is not automatically a fault. Preserve factual and policy safeguards. An empty improvements list is valid if whole-call review finds no supported useful change.\n';
function writerCoverage(source){source=source.replaceAll('\"claude-sonnet-5\"','\"claude-sonnet-5-5\"').replaceAll('\"prompt_cache\": false','\"prompt_cache\": true').replaceAll('call2-sonnet5-presentation-2026-09-08','call2-reviewed-coaching-2026-09-30');return replaceOnce(source,'}; return {json:{state,blocks,provider_request}};','}; provider_request.prompt += '+JSON.stringify(COVERAGE)+'; return {json:{state,blocks,provider_request}};');}
function documentSections(source){
 const start=source.indexOf('function coachingSections(report) {'),end=source.indexOf('function coachingEvidence(value)',start);
 if(start<0||end<0)throw Error('Document section anchors changed');
 return source.slice(0,start)+`function coachingSections(report){
 const r=report.reviewed_coaching_v1;
 const line=x=>x.observation+(x.evidence.length?' ['+x.evidence.join(', ')+']':'');
 if(r&&r.version==='coaching-review-v1')return [
 {key:'outcome',title:'Call outcome',items:[r.outcome.summary]},
 {key:'improvements',title:'What to improve',items:r.improvements.length?r.improvements.map(x=>line(x)+'\\nWhy it matters: '+x.possible_effect+'\\nNext time: '+x.better_action):['No specific sales-execution improvement was supported by this call.']},
 {key:'strengths',title:'What you did well',items:r.strengths.map(x=>line(x)+(x.why_useful?' '+x.why_useful:''))},
 {key:'objections',title:'Buyer concerns',items:r.blockers.map(line)},
 {key:'next-steps',title:'Agreed next steps',items:r.next_steps.map(line)}].filter(x=>x.items.length);
 const strengths=uniqueCoachingItems([report.what_went_well,report.biggest_strength]);
 const improvements=uniqueCoachingItems([report.what_to_improve,report.what_id_polish||report.biggest_fix]);
 const close=coachingClose(report);
 const outcome=coachingText(report.one_line_verdict);
 const remainder=coachingText(close.text).replace(outcome,'').trim();
 return [{key:'outcome',title:'Call outcome',items:[outcome].filter(Boolean)},{key:'improvements',title:'What to improve',items:improvements},{key:'strengths',title:'What you did well',items:strengths},{key:'close',title:close.title,items:[remainder].filter(Boolean)}].filter(x=>x.items.length);
}
`+source.slice(end);
}
const CORRECTION_REVIEW='\nPRACTICAL COACHING REVIEW: Factual correctness is essential. Distinguish a useful optional refinement from an unsupported accusation. A buyer need not visibly express confusion for a narrowly worded practical clarification to be useful. Credit an existing follow-up and later recovery; never accuse a missing action that happened. If the core observed behavior and concrete action are supported but a qualifier, title or speculative effect overstates it, you may narrow that SAME point using corrected_improvements:[{index,replacement:{priority,title,observation,evidence_ids,counterevidence_ids,counterevidence_summary,possible_effect,better_action,example:""}}]. Review the entire replacement against the whole call, including all counterevidence; use verdict keep and do not include that index in rejected_improvements. Do not add new advice or points, manufacture a flaw, or rescue a contradicted core premise. Reject an unsupported core premise. If no correction is needed, omit corrected_improvements or use []. No forced count. Review titles as factual claims too.\n';
function auditCoverage(source){source=source.replaceAll('\"claude-sonnet-5\"','\"claude-sonnet-5-5\"').replaceAll('\"prompt_cache\": false','\"prompt_cache\": true').replaceAll('\"reasoning_effort\": \"medium\"','\"reasoning_effort\": \"high\"');return replaceOnce(source,'\\nUNTRUSTED ANALYSIS:', JSON.stringify(CORRECTION_REVIEW).slice(1,-1)+'\\nUNTRUSTED ANALYSIS:').replace('optional advice stays internal','supported optional advice can be published as a practical improvement');}
function preserveReviewedHandoff(source){
 return replaceOnce(source,'state.coaching_raw = normalizeCoaching(providerParsed(coachingResult, "coaching"));','const reviewedResult = providerParsed(coachingResult, "coaching");\nstate.coaching_raw = normalizeCoaching(reviewedResult);\n// Preserve optional enrichment separately so existing safety prompts see their original flat fields.\nstate.reviewed_coaching_v1 = reviewedResult.reviewed_coaching_v1 || null;');
}
module.exports={preserveReviewedHandoff,CORRECTION_REVIEW,auditCoverage,writerCoverage,documentSections,COVERAGE,replaceOnce,reviewedRenderer,officialFinal,manualFinal,GUARD};
