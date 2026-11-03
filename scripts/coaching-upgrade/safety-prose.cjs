// The safety stage edits prose, never audited identity, taxonomy or evidence IDs.
function enhancedSafetyProsePath(path) {
 return /^(summary|no_objections_reason|outcome\.summary)$/.test(path) ||
  /^objections\.\d+\.(title|concern|response|assessment|recommendation|suggested_words)$/.test(path) ||
  /^improvements\.\d+\.(title|observation|why_it_matters|action)$/.test(path) ||
  /^strengths\.\d+\.(title|observation|why_it_matters)$/.test(path) ||
  /^next_steps\.\d+\.observation$/.test(path);
}
function guardEnhancedSafetyTargets(coaching,item,targets) {
 if(coaching?.version!=='objection-coaching-v2')return targets;
 const prefix=typeof item==='string'?item.match(/^([a-z_]+(?:\.\w+)*)\s*:/i)?.[1]:null;
 const rawExplicit=typeof item==='object'?item?.path:prefix&&(prefix.includes('.')||Object.hasOwn(coaching,prefix.toLowerCase()))?prefix.toLowerCase():null;
 const explicit=typeof rawExplicit==='string'?rawExplicit.replace(/\[(0|[1-9]\d*)\]/g,'.$1'):rawExplicit;
 if(explicit&&!enhancedSafetyProsePath(explicit))throw Error('Enhanced coaching safety hold: finding targets non-prose metadata');
 if(!targets.length||targets.some(t=>!enhancedSafetyProsePath(t.path)))throw Error('Enhanced coaching safety hold: unmapped prose finding');
 return targets;
}
module.exports={enhancedSafetyProsePath,guardEnhancedSafetyTargets};
