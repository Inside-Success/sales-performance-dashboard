import fs from 'node:fs';
import assert from 'node:assert/strict';
import {buildHandoffSafety} from './build-handoff-safety.mjs';
const b=JSON.parse(fs.readFileSync(new URL('./handoff-before-2026-10-21.json',import.meta.url)));
const ops=buildHandoffSafety(b);
const names=new Set(b.official.nodes.map(n=>n.name));
for(const branch of Object.values(ops))for(const op of branch)if(op.node?.parameters?.jsCode)new Function('$input','$','$json','$execution',op.node.parameters.jsCode);
const source=ops.official.find(o=>o.node?.name==='MM Claim Source').node;
assert.equal(source.onError,'continueErrorOutput');
assert(ops.official.some(o=>o.source===source.name&&o.sourceIndex===1&&o.target==='Set: fetch_failed'));
assert(ops.official.some(o=>o.source==='MM Source Acquired'&&o.sourceIndex===1&&o.target==='MM Can Check Previous Source'));
assert(ops.official.some(o=>o.source==='MM Previous Source Terminal'&&o.sourceIndex===1&&o.target==='Loop Over Items'));
for(const n of ['MM Save Coaching Delivery','MM Save Coaching Exclusion','MM Save Classifier Exclusion','MM Save Unfinished Coaching']){
 assert(names.has(n));assert(ops.official.some(o=>o.source===n&&o.target==='MM Settle Source Claim'));
}
const code=ops.coverage.find(o=>o.nodeName==='Plan Coverage Outcome').updates['parameters.jsCode'];
const plan=new Function(code.slice(0,code.indexOf("const plan=coveragePlan"))+';return coveragePlan')();
assert.deepEqual(plan({status:'ready',token:'t',source_ids:['a','b','c'],never_started_ids:['a','b','c']},[{source_id:'b',status:'needs_review'},{source_id:'c',status:'queued'}]).queue_ids,['a']);
assert.deepEqual(plan({status:'ready',token:'t',source_ids:['a'],never_started_ids:[]},[]).queue_ids,[]);
assert.deepEqual(plan({status:'ready',token:'t',source_ids:['a'],never_started_ids:['a'],delivered_ids:['a']},[]).queue_ids,[]);
// Verify escaping in the actual n8n expression, including quote/backslash recording labels.
const expr=ops.official.find(o=>o.nodeName==='MM Recovery Existing Reports').updates['parameters.queryParameters'].parameters[0].value;
const evalExpression=new Function('$','return ('+expr.slice(3,-2).trim()+')');
const formula=evalExpression(name=>({item:{json:name==='MM Recovery Entry'?{source_id:'recA'}:{fields:{'Automation Key':"zoom:a'b\\c"}}}}));
assert(formula.includes("zoom:a\\'b\\\\c"));
console.log('Handoff safety: syntax, error branches, settlement, bounded queue eligibility and identity escaping passed.');
