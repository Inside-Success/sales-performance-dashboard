// Lab-only composition: keep production and the earlier candidate reproducible.
const layered=require('./layered-candidate.cjs'),reasoning=require('./source-reasoning.cjs');
const {digest}=require('../../src/lib/coaching-canonical.cjs');
function compose(source,layers,{analyst=false}={}){
 const built=layered.compose(source,layers);
 const system=built.system+'\n'+reasoning.PRINCIPLES;
 return {...built,system,reasoning:{version:reasoning.VERSION,analyst},manifest:{...built.manifest,revision:reasoning.VERSION,system:digest(system)},knowledgeTemplate:{...built.knowledgeTemplate,foundation:built.knowledgeTemplate.foundation+'\n'+reasoning.PRINCIPLES}};
}
module.exports={compose};
