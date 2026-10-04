import fs from 'node:fs';import vm from 'node:vm';import assert from 'node:assert/strict';
const dir=process.argv[2];const load=name=>JSON.parse(fs.readFileSync(`${dir}/${name}.json`));
const manual=load('manual-candidate'), worker=load('worker-candidate'), failure=load('failure-candidate');
const baseline=load('BMRrGxHyXMcgO6j3.before');
for(const n of baseline.nodes)if(!['Manual Feedback Webhook','Normalize Input','Post Callback'].includes(n.name))assert.deepEqual(manual.nodes.find(x=>x.name===n.name),n,'Coaching/document node changed outside delivery scope: '+n.name);
const find=(w,name)=>w.nodes.find(n=>n.name===name);
const run=(w,name,input,refs={})=>new Function('$input','$','$json',find(w,name).parameters.jsCode)({first:()=>({json:input}),all:()=>[{json:input}]},key=>({item:{json:refs[key]},first:()=>({json:refs[key]})}),input);
const id='716dd1bd1e2944e6acf8660cf70c853e';const origin='https://sales-performance-dashboard-rose.vercel.app';
const valid={public_id:id,rep_name:'Test',input_type:'transcript',transcript_text:'x'.repeat(100),callback_url:origin+'/api/manual-reports/callback',report_url:origin+'/self-report/'+id};
assert.equal(run(manual,'Normalize Input',{body:valid})[0].json.valid,true);
for(const callback_url of ['http://localhost:3000/api/manual-reports/callback','https://attacker.test',origin+'/api/other'])assert.equal(run(manual,'Normalize Input',{body:{...valid,callback_url}})[0].json.valid,false);
const row={id:123,public_id:id,payload:JSON.stringify({public_id:id,status:'completed'}),attempts:1};
const receipt={ok:true,public_id:id,status:'completed'};
assert.equal(run(worker,'Check Saved Delivery Receipt',receipt,{'Reserve Manual Delivery Attempt':row})[0].json.status,'delivered');
for(const bad of [{...receipt,public_id:'wrong'},{...receipt,status:'failed'},{ok:false},{}])assert.equal(run(worker,'Check Saved Delivery Receipt',bad,{'Reserve Manual Delivery Attempt':row})[0].json.status,'queued');
assert.equal(run(worker,'Record Manual Delivery Retry',{}, {'Reserve Manual Delivery Attempt':{...row,attempts:8}})[0].json.status,'needs_review');
assert.equal(run(worker,'Record Manual Delivery Retry',{}, {'Reserve Manual Delivery Attempt':row})[0].json.payload,row.payload);
assert.equal(run(worker,'Check Saved Delivery Receipt',{}, {'Reserve Manual Delivery Attempt':{...row,attempts:8}})[0].json.status,'needs_review');
const exec={id:'test',workflowId:'BMRrGxHyXMcgO6j3',data:{resultData:{runData:{'Normalize Input':[{data:{main:[[{json:{...valid,valid:true}}]]}}]}}}};
assert.equal(JSON.parse(run(failure,'Recover Manual Terminal Result',exec)[0].json.payload).status,'failed');
exec.data.resultData.runData['Build Complete Callback']=[{data:{main:[[{json:{...valid,status:'completed'}}]]}}];
assert.equal(JSON.parse(run(failure,'Recover Manual Terminal Result',exec)[0].json.payload).status,'completed');
exec.data.resultData.runData['Save Manual Result']=[{data:{main:[[{json:{id:123}}]]}}];assert.equal(run(failure,'Recover Manual Terminal Result',exec).length,0);
for(const w of [manual,worker,failure]) {
 const names=new Set(w.nodes.map(n=>n.name));assert.equal(names.size,w.nodes.length);
 for(const [source,links]of Object.entries(w.connections)){assert(names.has(source));for(const targets of Object.values(links).flat())for(const t of targets)assert(names.has(t.node));}
 for(const n of w.nodes){if(n.parameters.jsCode)new vm.Script('(async function(){'+n.parameters.jsCode+'})');if(n.onError==='continueErrorOutput')assert(w.connections[n.name]?.main?.[1]?.length);}
}
for(const w of [manual,worker])for(const n of w.nodes)if(['Post Callback','Deliver Saved Manual Result'].includes(n.name))assert.equal(n.parameters.contentType,'json','Use native JSON; raw requests can return unresolved streams');
assert(!worker.nodes.some(n=>/langchain|Google Doc|Provider/.test(n.type+n.name)));
assert(!failure.nodes.some(n=>/langchain|Google Doc|Provider/.test(n.type+n.name)));
console.log('Delivery checks passed: unsafe destinations, saved payload identity, callback receipts, bounded retries, generation failures, and no AI/doc regeneration.');
