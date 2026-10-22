import assert from 'node:assert/strict';
import fs from 'node:fs';
import {accountUpstreamOutcome,buildUpstreamNoShowAccounting,code} from './build-upstream-no-show-accounting.mjs';
const before=JSON.parse(fs.readFileSync(new URL('../../tests/fixtures/upstream-no-show-before.json',import.meta.url)));
const ops=buildUpstreamNoShowAccounting(before);
assert.equal(ops.length,2);
assert.equal(ops[1].branch,'true');
assert.equal(ops[1].source,'If Upstream Rep No Show');
const row={'Source Airtable Record ID':'recfi7BZrStgDeQ3p'};
const input={...row,'Upstream Attendance Status':'rep_no_show','Upstream Attendance Reason':'Prospect joined; rep absent from speaker list and transcript.'};
const run=(r,i)=>new Function('$','$json','$execution',code)(name=>name==='Loop Over Items'?{item:{json:r}}:{isExecuted:false},i,{id:'1230994'});
const receipt=run(row,input);
assert.deepEqual(receipt.pairedItem,{item:0});
assert.equal(receipt.json.source_id,row['Source Airtable Record ID']);
assert.equal(receipt.json.status,'excluded');
assert.equal(JSON.parse(receipt.json.message).reason,input['Upstream Attendance Reason']);
for(const bad of [{...input,'Source Airtable Record ID':'recOther'}, {...input,'Upstream Attendance Status':'normal'}, {...input,'Upstream Attendance Reason':' '}, {...input,_mm_classifier_gate:'{}'}]) assert.throws(()=>run(row,bad));
assert.throws(()=>run({},input));
assert.throws(()=>run(row,{...input,call_status:'rep_no_show'})); // shared classifier Set must not get a second writer
assert.equal(run(row,{call_status:'call_1_skipped'}).json.status,'excluded');
assert.equal(run(row,{call_status:'transcript_too_short'}).json.status,'needs_review');
assert.throws(()=>run(row,{call_status:'call_1_skipped',_mm_classifier_gate:JSON.stringify({call_status:'call_2',classification_reason:'sales'})}));
// Real mixed-execution source identities stay separate; no first-item lookup.
const mixed=[input,{'Source Airtable Record ID':'recZOlhtbn3oAz8JO',call_status:'call_1_skipped'},{'Source Airtable Record ID':'rechQTR1fCF7n03JR',call_status:'call_1_skipped'}];
assert.deepEqual(mixed.map(i=>run(i,i).json.source_id),mixed.map(i=>i['Source Airtable Record ID']));
const c=structuredClone(before.connections);
c[ops[1].source].main[0].push({node:ops[1].target,type:'main',index:0});
assert.deepEqual(c['If Upstream Rep No Show'].main[1],before.connections['If Upstream Rep No Show'].main[1]);
assert.deepEqual(c['Set: rep_no_show'],before.connections['Set: rep_no_show']);
assert.deepEqual(c['MM Account Early Outcome'].main[0],[{node:'MM Save Classifier Exclusion',type:'main',index:0}]);
assert.deepEqual(c['MM Save Classifier Exclusion'].main[0],[{node:'MM Settle Source Claim',type:'main',index:0}]);
for(const name of ['MM Account Early Outcome','MM Save Classifier Exclusion','MM Settle Source Claim']) {
  assert(c[name].main[1].some(e=>e.node==='MM Accounting Incident'));
  assert(!c[name].main.flat().some(e=>e.node==='Loop Over Items'));
}
assert.throws(()=>buildUpstreamNoShowAccounting({...before,connections:c}));
assert.equal(accountUpstreamOutcome(row,input,'1230994',2).attempts,2);
console.log('Upstream no-show receipt, mixed-source pairing, exclusions, drift guards and failure routing passed');
