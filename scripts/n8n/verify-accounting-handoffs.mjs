import assert from 'node:assert/strict';
import fs from 'node:fs';
import {buildAccountingContainment,accountEarlyOutcome} from './build-accounting-containment.mjs';
const baseline=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/coaching-accounting-handoffs.json',import.meta.url)));
const ops=buildAccountingContainment(baseline);
const early={parameters:{jsCode:ops.find(op=>op.nodeName==='MM Account Early Outcome').updates['parameters.jsCode']}};
const actualStatus=baseline.nodes.find(n=>n.name==='Set: call_1').parameters.assignments.assignments.find(a=>a.name==='call_status').value;
const row={'Source Airtable Record ID':'recActualCallOne'};
const result=new Function('$','$json','$execution',early.parameters.jsCode)(()=>({item:{json:row},isExecuted:false}),{call_status:actualStatus,skip_reason:'Discovery / casting call - not graded.'},{id:'123'});
assert.equal(result.json.status,'excluded');
assert.equal(JSON.parse(result.json.message).status,'call_1');
assert.equal(result.json.source_id,row['Source Airtable Record ID']);
assert.equal(accountEarlyOutcome(row,{call_status:'transcript_too_short'},'123').status,'needs_review');
assert.throws(()=>accountEarlyOutcome({}, {call_status:actualStatus},'123'));
assert.throws(()=>accountEarlyOutcome(row, {call_status:'something_new'},'123'));
const gate={call_status:'call_1',classification_reason:'Original specific reason',guard_revision:'original-guard',classifier_original_status:'call_1'};
const withGate=accountEarlyOutcome(row,{call_status:actualStatus,_mm_classifier_gate:JSON.stringify(gate)},'123');
assert.equal(JSON.parse(withGate.message).reason,gate.classification_reason);
assert.equal(JSON.parse(withGate.message).revision,gate.guard_revision);
assert.throws(()=>accountEarlyOutcome(row,{call_status:actualStatus,_mm_classifier_gate:JSON.stringify({...gate,call_status:'scored'})},'123'));
const assignments=ops.find(op=>op.nodeName==='Set: call_1').updates['parameters.assignments.assignments'];
const evaluate=(expr,input)=>new Function('$json','$','return ('+expr.slice(3,-2)+');')(input,()=>({item:{json:row}}));
const setNode=input=>Object.fromEntries(assignments.map(a=>[a.name,typeof a.value==='string'&&a.value.startsWith('={{')?evaluate(a.value,input):a.value]));
assert.equal(JSON.parse(setNode({pipeline:{gate_output:gate}})._mm_classifier_gate).classification_reason,gate.classification_reason);
assert.equal(setNode({})._mm_classifier_gate,'null','No previous loop classifier provenance');
assert.equal(accountEarlyOutcome(row,setNode({}),'123').status,'excluded');
const gateExpr=ops.find(op=>op.nodeName==='MM Record Recovery Classifier Gate').updates['parameters.conditions.conditions.0.leftValue'];
assert.equal(evaluate(gateExpr,{gate_output:gate}),false,'Call 1 has only one receipt writer');
assert.equal(evaluate(gateExpr,{gate_output:{call_status:'rep_no_show'}}),true);
const graph=structuredClone(baseline.connections);
for(const op of ops.filter(op=>op.type==='addConnection')){graph[op.source]??={main:[]};graph[op.source].main[op.sourceIndex||0]??=[];graph[op.source].main[op.sourceIndex||0].push({node:op.target,type:'main',index:0});}
for(const name of ['MM Account Early Outcome','MM Recovered Classifier Exclusion','MM Save Classifier Exclusion']) {
 assert.equal(ops.find(op=>op.nodeName===name).updates.onError,'continueErrorOutput');
 assert(graph[name].main[1].some(e=>e.node==='MM Accounting Incident'));
}
assert(!ops.some(op=>op.target==='Loop Over Items'||/Coaching Provider|Compliance|Scoring|Send Top Level|Send Thread Reply/.test(op.nodeName||'')));
for(const op of ops){const code=op.node?.parameters?.jsCode||op.updates?.['parameters.jsCode'];if(code)new Function(code);}
for(const sink of ['MM Store Accounting Incident','MM Notify Accounting Incident']) {
 assert.equal(ops.find(op=>op.node?.name===sink).node.onError,'continueRegularOutput');
 assert(!graph[sink],'Incident logging cannot restart the loop');
}
for(const order of [['call1'],['call1','call2'],['call2','call1'],['call1','call2','call1'],['call1','call1','call2']])for(const failStore of [false,true]) {
 const delivered=[],receipts=[],incidents=[];
 for(const [i,type] of order.entries()) {
  const current={'Source Airtable Record ID':'recSource'+i};
  if(type==='call2'){delivered.push(current);continue;}
  try{const receipt=accountEarlyOutcome(current,setNode({}),'123');if(failStore)throw Error('Injected table outage');receipts.push(receipt);}
  catch(error){assert(graph['MM Save Classifier Exclusion'].main[1].some(e=>e.node==='MM Accounting Incident'));incidents.push(current);}
 }
 assert.equal(delivered.length,order.filter(x=>x==='call2').length);
 assert.equal(receipts.length+incidents.length,order.filter(x=>x==='call1').length);
 assert.equal(new Set([...receipts.map(r=>r.source_id),...incidents.map(r=>r['Source Airtable Record ID'])]).size,receipts.length+incidents.length);
}
console.log('Accounting handoffs: actual Set expressions, provenance, source pairing, mixed batches, one writer and contained table failures passed.');
