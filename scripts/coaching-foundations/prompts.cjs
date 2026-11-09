// Single composition entry point for the candidate; pinned author source is supplied by caller.
const {adapt}=require('../coaching-lab/tyler-adapter.cjs');
const {schema}=require('../../src/lib/foundations-contract.cjs');
const {reconcileScope,LESSON_SELECTION}=require('./lesson-selection.cjs');
const PRESENTATION = `TYLER'S NOVEMBER 9 PRESENTATION CLARIFICATION: Account for every distinct actual objection in one concise bullet: identify the concern, judge the closer's handling, and offer a better move when that judgment warrants it. Below that, group distinct learning into reading the buyer (interpretation), choosing your approach (strategy), and principles to use again (foundations). Assign every lesson exactly one primary layer; explain the connections within that entry instead of repeating the same lesson across sections. Execution is assessed with the objection or the relevant strategy lesson, not a fourth repeated lesson list. Use punchy plain language, usually a few useful bullets per layer when the call supports them; never invent or pad to reach a quota. Keep sound choices worth repeating after corrections within each layer. Preserve useful reasoning and specificity rather than sanding the report into generic advice. Do not add a miscellaneous policy section. Keep pending commitments concise and separate from new coaching advice. The full call and required offer boundaries still govern what can be recommended.`;
function compose(source,layers){
 const built=adapt(source,layers);
 const system=reconcileScope(built.system).replaceAll('coaching-foundations-lab-v2','coaching-foundations-v3')+'\n'+LESSON_SELECTION+'\n'+PRESENTATION+'\nCURRENT REPORT CONTRACT:\n'+JSON.stringify(schema);
 const prompt=require('./transition.cjs').prompt;
 return {system,prompt,manifest:{...built,system:undefined,additional_responsibility_adaptation:'Replace original compliance paragraph; do not append contradictory policy-check duty'}};
}
module.exports={compose};
