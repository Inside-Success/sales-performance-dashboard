// Pure, fail-closed patch builder. Live baselines stay private; this never deploys.
const fs = require('node:fs');
const {guardEnhancedSafetyTargets,enhancedSafetyProsePath} = require('./safety-prose.cjs');
function once(code, before, after) {
  if (code.split(before).length !== 2) throw Error('Safety boundary anchor drift: '+before.slice(0,90));
  return code.replace(before, after);
}
function patchPrepare(code) {
  const start = code.indexOf('function guardEnhancedSafetyTargets(');
  const end = code.indexOf('\nfunction ', start + 1);
  if(start < 0 || end < 0) throw Error('Missing safety guard boundary');
  code = code.slice(0,start)+guardEnhancedSafetyTargets.toString()+code.slice(end);
  return once(code,
    'function mapScreenItemToTarget(caseId,coaching,item,prefix,index){return guardEnhancedSafetyTargets(coaching,item,mapScreenItemToTargetLegacy(caseId,coaching,item,prefix,index));}',
    "function mapScreenItemToTarget(caseId,coaching,item,prefix,index){if(coaching?.version==='objection-coaching-v2'&&item&&typeof item==='object'&&typeof item.path==='string')item={...item,path:item.path.replace(/\\[(0|[1-9]\\d*)\\]/g,'.$1')};return guardEnhancedSafetyTargets(coaching,item,mapScreenItemToTargetLegacy(caseId,coaching,item,prefix,index));}");
}
function patchFinal(code) {
  if(!code.includes("function enhancedSafetyProsePath("))code=enhancedSafetyProsePath.toString()+"\n"+code;
  code = once(code,'if (typeof next[field] !== "string") continue;',
    'if (typeof next[field] !== "string") continue;\n    if (state.coaching_version===OBJECTION_VERSION && !enhancedSafetyProsePath(field)) continue;');
  // Placeholder completion must respect the same boundary as wording cleanup.
  code = once(code,'function completeCoachingValue(value) {','function completeCoachingValue(value, path = []) {');
  code = once(code,"  if (typeof value === 'string') return completeCoachingText(value);",
    "  if (typeof value === 'string') return state.coaching_version===OBJECTION_VERSION&&!enhancedSafetyProsePath(path.join('.'))?value:completeCoachingText(value);");
  code = once(code,'return value.map(completeCoachingValue);','return value.map((child,index)=>completeCoachingValue(child,[...path,String(index)]));');
  return once(code,'[key, completeCoachingValue(child)]','[key, completeCoachingValue(child,[...path,key])]');
}
function buildSafetyBoundary(baselines) {
  const result = {};
  for(const [id,prepare,final] of [
    ['L8Nn7xncA9ZPDdWA','MM Prepare Repair','Performance Agent'],
    ['BMRrGxHyXMcgO6j3','MM Manual Prepare Repair','MM Manual Finalize Coaching'],
  ]) {
    const workflow=structuredClone(baselines[id]);
    for(const [name,patch] of [[prepare,patchPrepare],[final,patchFinal]]) {
      const node=workflow.nodes.find(n=>n.name===name);
      if(!node)throw Error('Missing node '+name);
      node.parameters.jsCode=patch(node.parameters.jsCode);
      new (Object.getPrototypeOf(async function(){}).constructor)('$json','$',node.parameters.jsCode);
    }
    result[id]=workflow;
  }
  return result;
}
module.exports={patchPrepare,patchFinal,buildSafetyBoundary};
if(require.main===module)fs.writeFileSync(process.argv[3],JSON.stringify(buildSafetyBoundary(JSON.parse(fs.readFileSync(process.argv[2])))));
