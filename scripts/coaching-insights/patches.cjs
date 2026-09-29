// Surgical transforms for reviewed coaching. Run on a freshly retrieved node body.
// Exports contain no customer data, credentials, or deployable full workflow.
function replaceOnce(source,before,after) {
 if(source.split(before).length!==2)throw Error('Patch anchor changed: '+before.slice(0,60));
 return source.replace(before,after);
}
const PACK=`
 const times=ids=>[...new Set(ids.map(id=>byId.get(id)?.timestamp).filter(Boolean))];
 const finding=(row,kind,index)=>({id:kind+'-'+(row.evidence_ids||[]).join('-')+'-'+index,observation:row.observation,evidence:times(row.evidence_ids||[])});
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
 source=replaceOnce(source,'{optionalFallbackOnly:true,excludePolicyChanges:true}','{excludePolicyChanges:true}');
 source=replaceOnce(source,"return {status:'completed',call_status:'scored',refusal_reason:null,...coaching};",PACK+"return {status:'completed',call_status:'scored',refusal_reason:null,...coaching,reviewed_coaching_v1};");
 source=replaceOnce(source,"const primary=improvements.find(x=>x.row.priority==='material')||improvements[0];","improvements.sort((a,b)=>(a.row.priority==='material'?0:1)-(b.row.priority==='material'?0:1));\n const primary=improvements.find(x=>x.row.priority==='material')||improvements[0];");
 // Keep the public optional label removed, including Slack/docs for future reports.
 source=source.replaceAll("(row.priority==='optional'?'Optional polish: ':'')+",'').replaceAll("(primary.row.priority==='optional'?'Optional polish: ':'')+",'');
 return source;
}
function officialFinal(source){
 source=replaceOnce(source,'const output = buildScoredOutput(state, complete.coaching);',GUARD+'\nconst reviewed_coaching_v1=safeReviewedCoaching(state.coaching_raw,complete.coaching,sourceIdFromState(state));\nconst output = buildScoredOutput(state, complete.coaching);');
 return replaceOnce(source,'...state.caseItem.source, output, agent_version:', '...state.caseItem.source, output, reviewed_coaching_v1, agent_version:');
}
function manualFinal(source){
 source=replaceOnce(source,'const final = { ...complete.coaching, status:',GUARD+'\nconst reviewed_coaching_v1=safeReviewedCoaching(state.coaching_raw,complete.coaching,state.input?.public_id);\nconst final = { ...complete.coaching, reviewed_coaching_v1, status:');return source;
}
module.exports={replaceOnce,reviewedRenderer,officialFinal,manualFinal,GUARD};
