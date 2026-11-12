// Patch only verified live bundles; retain all wiring/settings/credentials.
const {repairableReviewerReceipt}=require('../../src/lib/foundations-terminal-receipt.cjs');
const {replaceRuntime}=require('./production-upgrade.cjs');
function patchProvider(baseline){
 const w=structuredClone(baseline);
 for(const name of ['Restore Cached Result','Validate Result']){
  const n=w.nodes.find(n=>n.name===name);if(!n)throw Error('Missing provider node');
  const from=name==='Restore Cached Result'?'if(!repairableSafetyReceipt(terminal.call_purpose,terminal.checkpoint.result)&&!retainedContractReceipt(terminal.call_purpose,terminal.checkpoint.result))':'valid:Boolean(valid || repairableSafetyReceipt(s.call_purpose,r))';
  const to=name==='Restore Cached Result'?'if(!repairableSafetyReceipt(terminal.call_purpose,terminal.checkpoint.result)&&!retainedContractReceipt(terminal.call_purpose,terminal.checkpoint.result)&&!repairableReviewerReceipt(terminal.call_purpose,terminal.checkpoint.result))':'valid:Boolean(valid || repairableSafetyReceipt(s.call_purpose,r) || repairableReviewerReceipt(s.call_purpose,r))';
  if(n.parameters.jsCode.split(from).length!==2)throw Error('Reviewer provider anchor drift');
  n.parameters.jsCode='const repairableReviewerReceipt='+repairableReviewerReceipt.toString()+';\n'+n.parameters.jsCode.replace(from,to);
 }
 return w;
}
function patchCore(baseline){
 const w=structuredClone(baseline),bundle=require('./n8n-workflow.cjs').bundle();
 for(const name of ['Start','Advance']){
  const n=w.nodes.find(n=>n.name===name),code=n.parameters.jsCode,at=code.indexOf('\nfunction envelope(t)');
  if(at<0)throw Error('Core envelope drift');n.parameters.jsCode=bundle+code.slice(at);
 }
 return w;
}
function patchParent(baseline,channel){
 const w=structuredClone(baseline),names=channel==='official'?['MM Reliable Coaching','MM Build Safety Screen Request']:['MM Manual Build Factual Audit'];
 for(const name of names){
 const n=w.nodes.find(n=>n.name===name);if(!n?.parameters.jsCode.includes('bindState'))throw Error('Parent binding drift: '+name);
 n.parameters.jsCode=replaceRuntime(n.parameters.jsCode);
 }return w;
}
module.exports={patchCore,patchProvider,patchParent};
