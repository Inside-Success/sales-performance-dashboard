// Lab-only composition: keep production and the earlier candidate reproducible.
const layered=require('./layered-candidate.cjs'),reasoning=require('./source-reasoning.cjs');
const {digest}=require('../../src/lib/coaching-canonical.cjs');
function compose(source,layers,{analyst=false}={}){
 const built=layered.compose(source,layers);
 const editorial=require('node:fs').readFileSync(require('node:path').join(__dirname,'layers/editorial.md'),'utf8');
 const system=built.system+'\n'+reasoning.PRINCIPLES+'\n'+editorial;
 return {...built,system,reasoning:{version:reasoning.VERSION,analyst},manifest:{...built.manifest,revision:reasoning.VERSION,editorial:digest(editorial),system:digest(system)},knowledgeTemplate:{...built.knowledgeTemplate,foundation:built.knowledgeTemplate.foundation+'\n'+reasoning.PRINCIPLES+'\n'+editorial}};
}
module.exports={compose};
