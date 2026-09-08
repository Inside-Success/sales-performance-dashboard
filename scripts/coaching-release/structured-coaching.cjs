// n8n Code nodes exchange JSON; structuredClone is not available in its sandbox.
function cloneCoachingJson(value) { return value === undefined ? undefined : JSON.parse(JSON.stringify(value)); }
// Pure parsing, validation and rendering. No network or storage. Citation existence is not semantic proof.
const VERSION='magic-mike-call2-coaching-2026-09-08';
function transcriptBlocks(transcript) {
 const text=String(transcript||'').replace(/\r/g,'');
 const markers=[...text.matchAll(/^\[(\d{1,2}:\d{2}:\d{2}(?:\.\d+)?)\]/gm)];
 if(!markers.length) return text.split(/\n\s*\n/).filter(x=>x.trim()).map((x,i)=>({id:`T${String(i+1).padStart(4,'0')}`,timestamp:null,text:x.trim()}));
 return markers.map((m,i)=>({id:`T${String(i+1).padStart(4,'0')}`,timestamp:m[1],text:text.slice(m.index+m[0].length,markers[i+1]?.index??text.length).trim()}));
}
function renderCoaching(analysis,blocks,options={}) {
 const string=(v,label)=>{if(typeof v!=='string'||!v.trim())throw Error(`Missing ${label}`);return v.trim()};
 if(!analysis||typeof analysis!=='object')throw Error('Missing structured coaching');
 const status=analysis.status;
 if(!['completed','refused'].includes(status))throw Error('Invalid coaching status');
 const refusalStatuses=['call_1','prospect_no_show','rep_no_show','transcript_too_short','internal_training'];
 if(status==='refused') {
  if(!refusalStatuses.includes(analysis.call_status))throw Error('Invalid refusal status');
  return {status,call_status:analysis.call_status,refusal_reason:string(analysis.refusal_reason,'refusal reason')};
 }
 if(analysis.call_status!=='scored')throw Error('Completed coaching must be scored status');
 const byId=new Map(blocks.map(b=>[b.id,b]));
 const refs=(ids,optional=false)=>{
  if(!Array.isArray(ids)||(!optional&&!ids.length)||ids.some(id=>typeof id!=='string'||!byId.has(id)))throw Error('Invalid transcript evidence reference');
  const timestamps=[...new Set(ids.map(id=>byId.get(id).timestamp).filter(Boolean))];
  return timestamps.length?` [${timestamps.slice(0,3).join(', ')}]`:'';
 };
 const lists=['payment_actions','strengths','improvements','blockers','next_steps'];
 for(const key of lists)if(!Array.isArray(analysis[key]))throw Error(`Missing ${key}`);
 const outcome=analysis.outcome;
 if(!outcome||!['confirmed','not_confirmed','unclear'].includes(outcome.payment))throw Error('Invalid payment status');
 const summary=string(outcome.summary,'outcome')+refs(outcome.evidence_ids);
 for(const row of analysis.payment_actions){string(row.action,'payment action');refs(row.evidence_ids)}
 const strengths=analysis.strengths.map(row=>{
  const observation=string(row.observation,'strength')+refs(row.evidence_ids);
  // A missing explanation must not erase a supported action or invent its benefit.
  if(row.why_useful==null||row.why_useful==='')return observation;
  return observation+' '+string(row.why_useful,'strength effect');
 });
 const improvements=analysis.improvements.map(row=>{
  if(!['material','optional'].includes(row.priority))throw Error('Invalid improvement priority');
  string(row.counterevidence_summary,'counterevidence review');refs(row.counterevidence_ids,true);
  refs(row.evidence_ids);
  const example=typeof row.example==='string'?row.example.trim():'';
  // Example dialogue stays internal. Publish the concrete better_action instead;
  // this avoids turning a hypothetical script into an unverified offer or promise.
  return {row,text:(row.priority==='optional'?'Optional polish: ':'')+string(row.observation,'improvement')+refs([...row.evidence_ids,...row.counterevidence_ids])+ '\nPossible effect: '+string(row.possible_effect,'possible effect')+'\nBetter action: '+string(row.better_action,'better action')};
 }).filter(({row})=>{
  if(options.materialOnly&&row.priority!=='material')return false;
  if(options.excludePolicyChanges){
   const action=row.better_action;
   // Coaching must not invent a smaller commitment, a holding arrangement or written delivery guarantees.
   if(/\b(?:smaller|lower|reduced|minimal)\s+(?:initial\s+)?(?:payment|amount|commitment|installment|deposit)\b/i.test(action))return false;
   if(/\b(?:hold|keep|reserve)\b.{0,45}\b(?:spot|place)\b/i.test(action))return false;
   if(/\b(?:invoice|in writing|written|documented)\b.{0,100}\b(?:timeline|deadline|delivery|benchmark)|\b(?:timeline|deadline|delivery|benchmark)\b.{0,100}\b(?:invoice|in writing|written|documented)\b/i.test(action))return false;
  }
  return true;
 });
 const primary=improvements.find(x=>x.row.priority==='material')||improvements[0];
 const concerns=analysis.blockers.map(r=>string(r.observation,'blocker')+refs(r.evidence_ids));
 const next=analysis.next_steps.map(r=>string(r.observation,'next step')+refs(r.evidence_ids));
 const join=rows=>rows.map((s,i)=>`${i+1}. ${s}`).join('\n\n');
 const noIssue='No additional coaching recommendation met the evidence threshold for this report.';
 const coaching={
  one_line_verdict:string(outcome.summary,'outcome'),
  biggest_strength:strengths[0]||'No distinct strength stands out clearly enough to name from this transcript.',
  what_id_polish:primary?primary.text:noIssue,
  coaching_tip:primary?(primary.row.priority==='optional'?'Optional polish: ':'')+primary.row.better_action:'Keep the next action clear and confirm what actually completes.',
  rudys_note:primary?(primary.row.priority==='optional'?'Optional polish: ':'')+primary.row.better_action:(strengths[0]||noIssue),
  what_went_well:strengths.length?join(strengths):'No specific repeatable strength is established by the available transcript.',
  what_to_improve:improvements.length?join(improvements.map(x=>x.text)):noIssue,
  why_no_close:outcome.payment==='confirmed'?'Not applicable: payment was confirmed on this call.':summary+(concerns.length?'\n\nObserved concerns:\n'+join(concerns):'')+(next.length?'\n\nAgreed next steps:\n'+join(next):'\nNo further next step is confirmed in the available transcript.'),
  what_made_this_close_work:outcome.payment==='confirmed'?summary+(strengths.length?'\n\n'+join(strengths):''):'No completed payment was confirmed on this call.',
  objections_surfaced:concerns.length?join(concerns):'No substantive objection was observed in the available transcript.',
  winnability:summary,
 };
 return {status:'completed',call_status:'scored',refusal_reason:null,...coaching};
}
function applyAudit(analysis,audit,blocks) {
 if (!audit || audit.outcome_pass!==true) throw Error('Coaching outcome failed factual audit');
 const result=cloneCoachingJson(analysis); const known=new Set(blocks.map(b=>b.id));
 const listMap={rejected_strengths:'strengths',rejected_improvements:'improvements',rejected_examples:'improvements',rejected_blockers:'blockers',rejected_next_steps:'next_steps'};
 for(const [key,list] of Object.entries(listMap)) {
  const indexes=audit[key];
  if(!Array.isArray(indexes)||new Set(indexes).size!==indexes.length||indexes.some(i=>!Number.isInteger(i)||i<0||i>=analysis[list].length))throw Error('Invalid coaching audit indexes');
 }
 const reviews=audit.improvement_reviews;
 if(!Array.isArray(reviews)||reviews.length!==analysis.improvements.length||new Set(reviews.map(r=>r.index)).size!==reviews.length)throw Error('Incomplete improvement audit');
 for(const r of reviews) {
  if(!Number.isInteger(r.index)||r.index<0||r.index>=analysis.improvements.length||!['keep','reject'].includes(r.verdict)||typeof r.reason!=='string'||!r.reason.trim()||!Array.isArray(r.counterevidence_ids)||r.counterevidence_ids.some(id=>!known.has(id)))throw Error('Invalid improvement review');
  if((r.verdict==='reject')!==audit.rejected_improvements.includes(r.index))throw Error('Conflicting improvement audit');
 }
 if(!Array.isArray(audit.findings))throw Error('Missing audit findings');
 for(const f of audit.findings) {
  if(!Array.isArray(f.evidence_ids)||f.evidence_ids.some(id=>!known.has(id)))throw Error('Invalid audit evidence');
 }
 result.improvements=result.improvements.map((row,i)=>({...row,example:audit.rejected_examples.includes(i)?'':row.example}));
 for(const [key,list] of Object.entries(listMap))if(key!=='rejected_examples')result[list]=result[list].filter((_,i)=>!audit[key].includes(i));
 return result;
}
function applyAuditConsensus(analysis,first,second,blocks) {
 // Validate each complete independent review before combining its rejections.
 applyAudit(analysis,first,blocks);applyAudit(analysis,second,blocks);
 const combined=cloneCoachingJson(first);
 for(const key of ['rejected_strengths','rejected_improvements','rejected_examples','rejected_blockers','rejected_next_steps'])combined[key]=[...new Set([...first[key],...second[key]])];
 combined.improvement_reviews=first.improvement_reviews.map(r=>combined.rejected_improvements.includes(r.index)?{...(r.verdict==='reject'?r:second.improvement_reviews.find(s=>s.index===r.index)),verdict:'reject'}:r);
 combined.findings=[...first.findings,...second.findings];
 return applyAudit(analysis,combined,blocks);
}
function applySingleAudit(analysis,audit,blocks) {
 // Preserve every rejection when the model's redundant verdict/index fields disagree.
 // All shape, index and evidence validation remains in applyAudit.
 const normalized=cloneCoachingJson(audit);
 let reviewedAnalysis=analysis;
 if(normalized?.outcome_pass===false && normalized.corrected_outcome){
  const outcome=normalized.corrected_outcome,known=new Set(blocks.map(b=>b.id));
  if(!['confirmed','not_confirmed','unclear'].includes(outcome.payment)||typeof outcome.summary!=='string'||!outcome.summary.trim()||!Array.isArray(outcome.evidence_ids)||!outcome.evidence_ids.length||outcome.evidence_ids.some(id=>!known.has(id)))throw Error('Invalid audited outcome correction');
  reviewedAnalysis={...analysis,outcome:cloneCoachingJson(outcome)};
  normalized.outcome_pass=true;
 }
 if(!normalized || !Array.isArray(normalized.rejected_improvements) || !Array.isArray(normalized.improvement_reviews))throw Error('Incomplete factual audit');
 const rejected=new Set(normalized.rejected_improvements);
 for(const review of normalized.improvement_reviews)if(review?.verdict==='reject')rejected.add(review.index);
 normalized.rejected_improvements=[...rejected];
 normalized.improvement_reviews=normalized.improvement_reviews.map(review=>rejected.has(review.index)?{...review,verdict:'reject'}:review);
 return applyAudit(reviewedAnalysis,normalized,blocks);
}
module.exports={cloneCoachingJson,VERSION,transcriptBlocks,renderCoaching,applyAudit,applyAuditConsensus,applySingleAudit};
