function cloneJson(v){return JSON.parse(JSON.stringify(v));}
const {transcriptTurns,sourceEvidence}=require('../scoring-luna-candidate/evidence-contract.cjs');
const DIMS=['frame_and_control','prospect_read_and_tailoring','objection_handling','close_mechanics_and_momentum'];
function prepare(raw,build,audit){
 const m=cloneJson(raw.parsed_json.manager_score),tt=transcriptTurns(build.transcript);
 const ids=audit.claims.map(x=>x.id),checks=cloneJson(audit.checks);
 if(new Set(ids).size!==ids.length||checks.length!==ids.length||new Set(checks.map(x=>x.id)).size!==ids.length||checks.some(x=>!ids.includes(x.id)))throw Error('Incomplete or duplicate claim audit');
 const changed=new Set(),events=[],decisions=[];
 for(const c of checks){
  if(!['supported','contradicted','uncertain'].includes(c.status))throw Error('Unknown verdict');
  for(const id of [...c.evidence_ids,...c.counterevidence_ids])sourceEvidence(tt,id);
  const claim=audit.claims.find(x=>x.id===c.id);
  if(claim.kind==='boolean' && c.status!=='uncertain'){
   if(typeof c.verified_value!=='boolean')throw Error('Missing verified boolean');
   // The model verdict may describe the affirmative claim instead of its draft value.
   // Route by the explicit verified value; every proposed truth-value change still needs reassessment.
   c.model_status=c.status;c.status=c.verified_value===claim.draft_value?'supported':'contradicted';
  }
  if(c.id.startsWith('dimension.')){
   const k=c.id.slice(10);if(!DIMS.includes(k))throw Error('Unknown dimension');
   if(!c.evidence_ids.length && m.dimensions[k].band!=='not_applicable')throw Error('Dimension evidence unresolved');
   m.dimensions[k].evidence=c.evidence_ids.length?sourceEvidence(tt,c.evidence_ids[0]):null;m.dimensions[k].counterevidence=c.counterevidence_ids.map(id=>sourceEvidence(tt,id));
   if(c.status==='contradicted'){if(!c.corrected_text)throw Error('Missing correction');changed.add(k);decisions.push(c);}
  }else if(c.id.startsWith('signal.')){
   const k=c.id.slice(7),sig=m.close_signals[k];if(!sig)throw Error('Unknown signal');
   const present=c.status==='uncertain'?sig.present:c.verified_value;
   if(present&&!c.evidence_ids.length)throw Error('Present signal unresolved');
   sig.evidence=present?sourceEvidence(tt,c.evidence_ids[0]):null;
   if(k==='direct_commitment_ask'&&present){if(sig.evidence.speaker.split(/[|｜]/)[0].trim().toLowerCase()!==build.metadata.rep_name.trim().toLowerCase())throw Error('Ask is not rep speech');sig.request_text=sig.evidence.quote;}
   else sig.request_text=null;
   if(c.status!=='supported'){changed.add('close_mechanics_and_momentum');decisions.push(c);}
   // Reassessment must explicitly accept a changed signal. Preserve the original truth value until then.
  }else if(c.id.startsWith('event.')){
   const i=Number(c.id.slice(6));if(!m.critical_events[i])throw Error('Unknown event');
   if(c.status==='contradicted'){events.push(i);decisions.push(c);}else if(c.evidence_ids.length)m.critical_events[i].evidence=sourceEvidence(tt,c.evidence_ids[0]);
  }else if(c.id==='review.reason'&&c.status==='contradicted')decisions.push(c);
 }
 return {manager:m,affected_dimensions:[...changed],affected_events:events,decisions,turns:tt};
}
function apply(raw,build,audit,review){
 const p=prepare(raw,build,audit),m=p.manager,byid=new Map(p.turns.map(t=>[t.id,t]));
 const source=id=>sourceEvidence(p.turns,id);
 const expected=p.decisions.map(x=>x.id),answers=review.decisions||[];
 if(answers.length!==expected.length||new Set(answers.map(x=>x.claim_id)).size!==expected.length||answers.some(x=>!expected.includes(x.claim_id)||typeof x.accepted!=='boolean'))throw Error('Incomplete reassessment decisions');
 const rejected=id=>answers.some(x=>x.claim_id===id&&x.accepted===false);
 const requiredDims=p.affected_dimensions.filter(k=>p.decisions.some(x=>x.id==='dimension.'+k)&&!rejected('dimension.'+k));
 const dims=review.dimensions||[];
 if(requiredDims.some(k=>!dims.some(d=>d.name===k))||new Set(dims.map(x=>x.name)).size!==dims.length||dims.some(d=>!p.affected_dimensions.includes(d.name)))throw Error('Reassessment changed unapproved dimensions');
 for(const d of dims){if(!answers.some(a=>a.accepted&&(a.claim_id==='dimension.'+d.name||(d.name==='close_mechanics_and_momentum'&&a.claim_id.startsWith('signal.')))))continue;if(!['absent','attempted','adequate','strong','exemplary','not_applicable'].includes(d.band)||!d.reason)throw Error('Invalid band or reason');m.dimensions[d.name]={...m.dimensions[d.name],band:d.band,reason:d.reason,evidence:source(d.evidence_id),counterevidence:d.counterevidence_ids.map(source)};}
 const expectedSignals=p.decisions.filter(x=>x.id.startsWith('signal.')).map(x=>x.id.slice(7));
 if(expectedSignals.some(k=>!rejected('signal.'+k)&&!(review.signals||[]).some(s=>s.name===k))||new Set((review.signals||[]).map(x=>x.name)).size!==(review.signals||[]).length)throw Error('Missing signal decisions');
 for(const s of review.signals||[]){if(!expectedSignals.includes(s.name)||typeof s.present!=='boolean')throw Error('Unauthorized signal');if(rejected('signal.'+s.name))continue;const evidence=s.present?source(s.evidence_id):null;if(s.name==='direct_commitment_ask'&&s.present&&evidence.speaker.split(/[|｜]/)[0].trim().toLowerCase()!==build.metadata.rep_name.trim().toLowerCase())throw Error('Ask is not rep speech');m.close_signals[s.name]={present:s.present,evidence,request_text:s.name==='direct_commitment_ask'&&s.present?evidence.quote:null};}
 const ev=review.events||[];
 if(p.affected_events.some(i=>!rejected('event.'+i)&&!ev.some(e=>e.index===i))||new Set(ev.map(x=>x.index)).size!==ev.length||ev.some(x=>!p.affected_events.includes(x.index)))throw Error('Unauthorized event edits');
 const remove=new Set();for(const e of ev){if(rejected('event.'+e.index))continue;if(!e.retain)remove.add(e.index);else{m.critical_events[e.index]={...m.critical_events[e.index],reason:e.reason,evidence:source(e.evidence_id),counterevidence_checked:true};}}
 m.critical_events=m.critical_events.filter((e,i)=>!remove.has(i));
 if(p.decisions.some(x=>x.id==='review.reason')&&!rejected('review.reason')){if(typeof review.review_reason!=='string'||!review.review_reason)throw Error('Missing review reason');m.review.reason=review.review_reason;}else if(review.review_reason!==null&&review.review_reason!==undefined)throw Error('Unauthorized review edit');
 return {...raw,parsed_json:{...raw.parsed_json,manager_score:m}};
}
module.exports={prepare,apply};
if(require.main===module){const x=JSON.parse(require('fs').readFileSync(0,'utf8'));process.stdout.write(JSON.stringify(x.mode==='prepare'?prepare(x.raw,x.build,x.audit):apply(x.raw,x.build,x.audit,x.review)));}
