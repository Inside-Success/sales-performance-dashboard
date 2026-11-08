// Scoped pure-function replacement. Caller must verify the live baseline first.
const {replaceFunction}=require('./build-repair-contract.cjs');
const {guardEnhancedAuditRepair}=require('./stages.cjs');
const runtime=require('../../src/lib/objection-coaching.cjs');
const {normalizeObjectionReport}=runtime;
function buildExclusionCitations(baselines){
 const result={};
 for(const id of ['L8Nn7xncA9ZPDdWA','BMRrGxHyXMcgO6j3','X9L4JtDbpkSCflxZ','FShnTde2OGhIUZE4']){
  const w=structuredClone(baselines[id]);let count=0;
  for(const n of w.nodes){const code=n.parameters?.jsCode;if(code?.includes('function normalizeObjectionReport(')){n.parameters.jsCode=replaceFunction(code,'normalizeObjectionReport',normalizeObjectionReport.toString());count++;}}
  if(id==='FShnTde2OGhIUZE4'){
   const n=w.nodes.find(n=>n.name==='Audit Repair Request');
   const anchor="if(ep.state?.coaching_version===\"magic-mike-objection-coaching-2026-10-29\")return";
   if(n.parameters.jsCode.split(anchor).length!==2)throw Error('Audit repair anchor drift');
   n.parameters.jsCode='const OBJECTION_SCHEMA_VERSION='+JSON.stringify(runtime.OBJECTION_SCHEMA_VERSION)+';const OBJECTION_CATEGORIES='+JSON.stringify(runtime.OBJECTION_CATEGORIES)+';\n'+runtime.objectionErrors.toString()+'\n'+normalizeObjectionReport.toString()+'\n'+guardEnhancedAuditRepair.toString()+'\n'+n.parameters.jsCode.replace(anchor,"if(ep.state?.coaching_version===\"magic-mike-objection-coaching-2026-10-29\")guardEnhancedAuditRepair($('Factual Audit Provider').item.json.parsed_json,ep.blocks);"+anchor);
  }
  if(!count)throw Error('Missing normalization contract: '+id);result[id]=w;
 }
 return result;
}
module.exports={buildExclusionCitations};
