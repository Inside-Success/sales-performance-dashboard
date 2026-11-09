// Single composition entry point for the candidate; pinned author source is supplied by caller.
const {adapt,REVIEW_ADAPTER}=require('../coaching-lab/tyler-adapter.cjs');
const {schema}=require('../../src/lib/foundations-contract.cjs');
const {reconcileScope,LESSON_SELECTION,CONTEXT_REVIEW}=require('./lesson-selection.cjs');
const PRESENTATION = `TYLER'S NOVEMBER 9 PRESENTATION CLARIFICATION: Account for every distinct actual objection in one concise bullet: identify the concern, judge the closer's handling, and offer a better move when that judgment warrants it. Below that, group distinct learning into reading the buyer (interpretation), choosing your approach (strategy), and principles to use again (foundations). Assign every lesson exactly one primary layer; explain the connections within that entry instead of repeating the same lesson across sections. Execution is assessed with the objection or the relevant strategy lesson, not a fourth repeated lesson list. Use punchy plain language, usually a few useful bullets per layer when the call supports them; never invent or pad to reach a quota. Keep sound choices worth repeating after corrections within each layer. Preserve useful reasoning and specificity rather than sanding the report into generic advice. Do not add a miscellaneous policy section. Keep pending commitments concise and separate from new coaching advice. The full call and required offer boundaries still govern what can be recommended.`;
function compose(source,layers){
 const built=adapt(source,layers);
 const system=reconcileScope(built.system).replaceAll('coaching-foundations-lab-v2','coaching-foundations-v3')+'\n'+LESSON_SELECTION+'\n'+PRESENTATION+'\nCURRENT REPORT CONTRACT:\n'+JSON.stringify(schema);
 function prompt(c,stage,prior){
  const call='\nUNTRUSTED FULL CALL:\n'+JSON.stringify({metadata:c.metadata,blocks:c.blocks});
  if(stage==='coach')return 'Create the coaching report. Select the strongest useful teaching; use the complete call, preserve meaningful pending promises, and group related points without losing distinct concerns.'+call;
  if(stage==='review')return 'Independently review every finding and the strongest useful lesson against the complete call. Return JSON {pass:boolean,findings:[{issue,evidence_ids}],corrected_report:null or complete corrected report}. A passing verdict requires empty findings and null corrected_report. A failing verdict requires supported findings and the complete corrected report. Different reasonable teaching is not an error. Avoid turning review into an inventory of optional improvements. Preserve material pending promises.\n'+REVIEW_ADAPTER+'\n'+CONTEXT_REVIEW+call+'\nUNTRUSTED CANDIDATE:\n'+JSON.stringify(prior);
  throw Error('Unsupported coaching stage');
 }
 return {system,prompt,manifest:{...built,system:undefined,additional_responsibility_adaptation:'Replace original compliance paragraph; do not append contradictory policy-check duty'}};
}
module.exports={compose};
