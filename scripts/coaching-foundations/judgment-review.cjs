// Opt-in candidate review contract. Failure uses the existing single bounded review repair.
const MARKER='JUDGMENT REVIEW CONTRACT v2';
const defects=['misunderstood_concern','unsupported_claim','unaddressed_material_question','counterproductive_response','ignored_refusal'];
const GUIDANCE=`${MARKER}
Handling and resolution are independent. A buyer may understand and reject a legitimate proposition; continued disagreement is not evidence the rep failed to explain it. Before marking handling needs_work, consider the complete explanation, videos, later recovery and what was knowable at that moment. Distinguish a genuine behavioral defect from a helpful alternative or missed optional technique. Prioritize the learning that advances the buyer's actual decision, not the easiest policy correction.
Reviewer only: when changing an objection from sound/uncertain to needs_work, or adding a new needs_work objection, include judgment_changes in the review envelope. It is an array (empty when none). Each item: {objection_id,defect,buyer_need,behavioral_defect,why_not_outcome_only,counterevidence,source_quote:{id,text}}. defect must be one of ${defects.join(', ')}. source_quote must be an exact nonempty excerpt from a supplied transcript block documenting the interaction, not metadata or imagined speech. Explain the specific need the response missed, the actual behavior, what supporting or later corrective behavior you considered, and why the criticism would remain valid even if the eventual sale outcome were different. If you cannot justify that, preserve sound handling and teach a genuinely useful alternative as an optional lesson instead. Do not fabricate a defect to fill this structure. An unresolved concern by itself cannot be the defect. This private justification is not printed in the rep report.`;
function validate(draft,audit,blocks){
 if(!audit||audit.pass||!audit.corrected_report)return;
 const old=new Map(draft.objections.map(o=>[o.id,o]));
 const changed=audit.corrected_report.objections.filter(o=>o.handling==='needs_work'&&old.get(o.id)?.handling!=='needs_work');
 const proofs=audit.judgment_changes||[];
 if(!Array.isArray(proofs)||proofs.length!==changed.length||new Set(proofs.map(p=>p.objection_id)).size!==proofs.length)throw Error('Missing or conflicting judgment-change justification');
 for(const o of changed){
  const p=proofs.find(p=>p.objection_id===o.id);
  if(!p||!defects.includes(p.defect)||['buyer_need','behavioral_defect','why_not_outcome_only','counterevidence'].some(k=>typeof p[k]!=='string'||!p[k].trim()))throw Error('Incomplete behavioral judgment justification');
  let q;try{q=require('./source-quote.cjs').resolve(p.source_quote,blocks);}catch{throw Error('Judgment justification quote is not source-bound');}
  if(q.text.length<12)throw Error('Judgment justification quote is not source-bound');
 }
}
module.exports={MARKER,GUIDANCE,validate};
