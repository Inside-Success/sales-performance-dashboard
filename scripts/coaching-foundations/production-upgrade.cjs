// Offline scoped upgrade of verified live foundations parents. No network calls.
const {runtime,replaceOnce}=require('./parent-workflows.cjs');
const {GENERATION}=require('../../src/lib/foundations-record.cjs');
const PREVIOUS='magic-mike-tyler-coaching-2026-11-10';
function replaceRuntime(code){
 const first='const structuredClone=value=>JSON.parse(JSON.stringify(value));',last='  return require_stdin();\n})();\n',start=code.indexOf(first),end=code.indexOf(last,start);
 if(start<0||end<start||code.indexOf(last,end+last.length)!==-1)throw Error('Runtime anchor drift');
 return code.slice(0,start)+runtime()+code.slice(end+last.length);
}
function assignment(code,name,value){const expression=new RegExp('^const '+name+'=.*;$','gm'),matches=code.match(expression);if(matches?.length!==1)throw Error('Configuration anchor drift: '+name);return code.replace(expression,()=>`const ${name}=${JSON.stringify(value)};`);}
function patchParents(baselines,{coreWorkflowId,knowledgeTemplate,models,modelConfigs,reasoning}){
 if(!coreWorkflowId||coreWorkflowId==='cslaPe5OU7T3VpFs'||!knowledgeTemplate||reasoning?.auditProtocol!=='request-bound-audit-v1')throw Error('Explicit new core/config required');
 const out={};
 for(const [id,channel,start,provider] of [['L8Nn7xncA9ZPDdWA','official','MM Build Coaching Request','MM Coaching Provider'],['BMRrGxHyXMcgO6j3','manual','MM Manual Build Structured Coaching','MM Manual Structured Coaching Provider']]){
 const w=structuredClone(baselines[id]);if(!w)throw Error('Missing live baseline');
 for(const n of w.nodes){let code=n.parameters.jsCode;if(!code)continue;
 // Only explicit generation dispatch literals change; old data and in-flight snapshots remain intact.
 code=code.replaceAll(JSON.stringify(PREVIOUS),JSON.stringify(GENERATION));
 if(code.includes('const structuredClone=value=>JSON.parse(JSON.stringify(value));'))code=replaceRuntime(code);
 n.parameters.jsCode=code;}
 const initial=w.nodes.find(n=>n.name===start);let code=assignment(initial.parameters.jsCode,'knowledgeTemplate',knowledgeTemplate);
 const old=code.match(/^p\.foundations_input=.*;$/gm);if(old?.length!==1)throw Error('Foundations input anchor drift');
 code=replaceOnce(code,old[0],`p.foundations_input={prepared,call,system:knowledge.system,models:${JSON.stringify(models)},channel:${JSON.stringify(channel)},reasoning:${JSON.stringify(reasoning)}};`);
 const cfg=code.match(/^const t=MM_FOUNDATIONS\.transition\.start\(p\.foundations_input\),cfg=.*;$/gm);if(cfg?.length!==1)throw Error('Provider config anchor drift');
 code=replaceOnce(code,cfg[0],`const t=MM_FOUNDATIONS.transition.start(p.foundations_input),cfg=${JSON.stringify(modelConfigs)}[t.request.model];`);
 initial.parameters.jsCode=code;
 const node=w.nodes.find(n=>n.name===provider);if(node?.parameters.workflowId.value!=='cslaPe5OU7T3VpFs')throw Error('Prior core drift');node.parameters.workflowId.value=coreWorkflowId;
 out[id]=w;
 }return out;
}
function patchProvider(baseline){const w=structuredClone(baseline),fn=require('../../src/lib/foundations-terminal-receipt.cjs').repairableSafetyReceipt.toString();for(const name of ['Restore Cached Result','Validate Result']){const n=w.nodes.find(n=>n.name===name),s=n?.parameters.jsCode;const begin=s?.indexOf('const repairableSafetyReceipt=function repairableSafetyReceipt('),end=s?.indexOf('\n};',begin);if(begin<0||end<begin)throw Error('Provider predicate anchor drift');n.parameters.jsCode=s.slice(0,begin)+'const repairableSafetyReceipt='+fn+';'+s.slice(end+3);}return w;}
module.exports={patchParents,patchProvider,replaceRuntime};
