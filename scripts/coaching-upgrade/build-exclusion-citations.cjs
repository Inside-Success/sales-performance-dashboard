// Scoped pure-function replacement. Caller must verify the live baseline first.
const {replaceFunction}=require('./build-repair-contract.cjs');
const {normalizeObjectionReport}=require('../../src/lib/objection-coaching.cjs');
function buildExclusionCitations(baselines){
 const result={};
 for(const id of ['L8Nn7xncA9ZPDdWA','BMRrGxHyXMcgO6j3','X9L4JtDbpkSCflxZ','FShnTde2OGhIUZE4']){
  const w=structuredClone(baselines[id]);let count=0;
  for(const n of w.nodes){const code=n.parameters?.jsCode;if(code?.includes('function normalizeObjectionReport(')){n.parameters.jsCode=replaceFunction(code,'normalizeObjectionReport',normalizeObjectionReport.toString());count++;}}
  if(!count)throw Error('Missing normalization contract: '+id);result[id]=w;
 }
 return result;
}
module.exports={buildExclusionCitations};
