// Scoped follow-up to the deployed Tyler core. Never sends requests or activates workflows.
const {runtime,replaceOnce}=require('./parent-workflows.cjs');
const {patchRetainedContractProvider}=require('./terminal-provider.cjs');
function replaceRuntime(code) {
 const start=code.indexOf('const structuredClone=value=>JSON.parse(JSON.stringify(value));');
 const marker='  return require_stdin();\n})();\n';
 const end=code.indexOf(marker,start);
 if(start<0||end<start||code.indexOf(marker,end+marker.length)!==-1)throw Error('Bundled runtime anchor drift');
 return code.slice(0,start)+runtime()+code.slice(end+marker.length);
}
function patchParents(baselines,coreWorkflowId) {
 if(!coreWorkflowId)throw Error('New reviewed core required');
 const output={};
 for(const [id,channel,adapter,provider]of[
  ['L8Nn7xncA9ZPDdWA','official','MM Reliable Coaching','MM Coaching Provider'],
  ['BMRrGxHyXMcgO6j3','manual','MM Manual Build Factual Audit','MM Manual Structured Coaching Provider']]){
  const w=structuredClone(baselines[id]),get=name=>{const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('Missing '+name);return n;};
  const a=get(adapter);a.parameters.jsCode=replaceRuntime(a.parameters.jsCode);
  a.parameters.jsCode=replaceOnce(a.parameters.jsCode,`prepared.state,$json,"${channel}")`,`prepared.state,$json,"${channel}",prepared.foundations_input?.prepared)`);
  get(provider).parameters.workflowId.value=coreWorkflowId;
  if(channel==='manual'){
   const f=get('MM Manual Finalize Coaching');f.parameters.jsCode=replaceRuntime(f.parameters.jsCode);
   f.parameters.jsCode=replaceOnce(f.parameters.jsCode,"const parsed=MM_FOUNDATIONS.project(state.coaching_raw,state.input.public_id,'manual');","const parsed=state.coaching_raw?.reviewed_exclusion_v3?state.coaching_raw:MM_FOUNDATIONS.project(state.coaching_raw,state.input.public_id,'manual');");
  }
  output[id]=w;
 }
 return output;
}
module.exports={patchParents,patchRetainedContractProvider};
