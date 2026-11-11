// Lab-only prompt assembly: presentation belongs to expression, not judgment.
const layered=require('./layered-candidate.cjs'),reasoning=require('./source-reasoning.cjs'),decision=require('./decision-plan.cjs');
const {digest}=require('../../src/lib/coaching-canonical.cjs');
function compose(source,layers){
 const built=layered.compose(source,layers);
 const clean=text=>text.replace(layered.PRESENTATION,'Internal plan uses presentation="tyler-review-v2"; report fields carry decisions, source accounts, qualifications and useful teaching. Wording is handled in a separate expression stage.').replace(require('./judgment-review.cjs').GUIDANCE,'')+'\n'+reasoning.PRINCIPLES;
 const system=clean(built.system);
 return {...built,system,reasoning:{version:decision.VERSION},manifest:{...built.manifest,revision:decision.VERSION,system:digest(system),planner:digest(decision.PLANNING),reviewer:digest(decision.REVIEW),expression:digest(decision.EXPRESSION)},knowledgeTemplate:{...built.knowledgeTemplate,foundation:clean(built.knowledgeTemplate.foundation)}};
}
module.exports={compose};
