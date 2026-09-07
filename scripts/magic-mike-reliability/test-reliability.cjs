const assert=require('node:assert/strict');const fs=require('fs');const path=require('path');const {classifyFailure}=require('./retry-policy.cjs');
const root=path.resolve(__dirname,'../../..','.magic-mike-repair-2026-09-08');let checks=0;function check(x){assert.ok(x);checks++;}
for(const e of [{error:{httpCode:'403',message:'Forbidden',description:'Quota exceeded for quota metric Queries'}},{error:{message:'429 - Too many requests'}}])check(classifyFailure(e,'write',0).retry);
for(const e of [{error:{httpCode:403,message:'Forbidden: permission denied'}},{error:{httpCode:500,message:'Internal server error'}},{error:{message:'ETIMEDOUT'}}])check(!classifyFailure(e,'write',0).retry);
check(classifyFailure({error:{httpCode:529,message:'Overloaded'}},'compute',0).retry);
check(classifyFailure({error:{httpCode:404,message:'Not found'}},'download',0).retry);
check(!classifyFailure({error:{httpCode:404,message:'Not found'}},'read',0).retry);
check(!classifyFailure({error:{httpCode:429}},'write',5).retry);
check(classifyFailure({error:{httpCode:429}},'write',0).delaySeconds>=65);
const AsyncFunction=Object.getPrototypeOf(async function(){}).constructor;
for(const id of ['L8Nn7xncA9ZPDdWA','qMQYNQtQbRZWjtG2']){
 const w=JSON.parse(fs.readFileSync(path.join(root,id+'.candidate.json'))); const names=new Set(w.nodes.map(n=>n.name));check(names.size===w.nodes.length);
 for(const [source,types] of Object.entries(w.connections)){check(names.has(source));for(const branches of Object.values(types))for(const targets of branches)for(const e of targets)check(names.has(e.node));}
 for(const n of w.nodes){if(n.parameters.jsCode)new AsyncFunction(n.parameters.jsCode);if(n.name.startsWith('MM Checkpoint'))check(w.connections[n.name].main[0].length===1);}
 const pre=w.nodes.find(n=>n.name==='MM Retry Policy '+(id.startsWith('L8')?'Verify Drive Folder':'Download Zoom Transcript'));
 const original={automationKey:'call-B',__mmAttempts:{}};
 const fn=new Function('$input','$',pre.parameters.jsCode);const out=fn({all:()=>[{json:{error:{httpCode:429,message:'Quota exceeded'}}}]},()=>({itemMatching:i=>{check(i===0);return {json:original};}}));
 check(out[0].json.automationKey==='call-B');check(out[0].json.__mmFailure.retry);check(out[0].pairedItem.item===0);check(original.__mmAttempts[pre.name]===undefined);
 if(id.startsWith('L8')){
  const fail=w.nodes.find(n=>n.name==='Set: pdf_failed');const result=new Function('$input','$',fail.parameters.jsCode)({all:()=>[{json:{error_details:'quota'}}]},()=>{throw Error('Node has not executed');});check(result[0].json.error_details==='quota');
  check(!w.nodes.some(n=>n.name==='Delete Stale Folder Mapping'));check(!JSON.stringify(w.connections).includes('Delete Stale Folder Mapping'));
 }else{
  for(const suffix of ['', ' - Legacy Makers TV LLC']) {const search=w.nodes.find(n=>n.name==='Search Pending Reconciliation Rows'+suffix);check(search.parameters.returnAll===false && search.parameters.limit===25);check(w.nodes.some(n=>n.name==='MM Pending Page Filter'+suffix));}
  const n=w.nodes.find(n=>n.name==='Prepare Pending Transcript Airtable Write');
  const source={automationKey:'test-key'};const input={all:()=>[{json:{id:'rec-test',fields:{'Automation Key':'test-key','Processing Status':'Processed','Meeting Transcript Link':'existing'}}}]};
  check(new Function('$input','$',n.parameters.jsCode)(input,()=>({itemMatching:()=>({json:source})})).length===0);
 }
}
console.log(JSON.stringify({passed:checks,codeSyntax:'all candidate Code nodes compiled',networkCalls:0}));
// Replay existing successful outputs locally. No providers, document writes, or messages.
for(const [wid,eid,names] of [['L8Nn7xncA9ZPDdWA','677230',['Build PDF HTML','Parse Doc Response']],['qMQYNQtQbRZWjtG2','675031',['Parse VTT Transcript','Apply AI Sales Call Classification']]]){
 const fixture=JSON.parse(fs.readFileSync(path.join(root,eid+'.fixture.json')));const run=fixture.data.resultData.runData;
 const before=JSON.parse(fs.readFileSync(path.join(root,wid+'.before.json')));const after=JSON.parse(fs.readFileSync(path.join(root,wid+'.candidate.json')));
 const get=(name)=>run[name]?.[0]?.data?.main?.find(b=>b?.length)||[];
 for(const name of names){
  const source=run[name]?.[0]?.source?.[0]?.previousNode;if(!source)throw Error('Missing fixture source '+name);
  const input=get(source);const inputApi={all:()=>input,first:()=>input[0]};const lookup=name=>({first:()=>get(name)[0],itemMatching:i=>get(name)[i],item:get(name)[0]});
  const execute=w=>new Function('$input','$','$items','Buffer',w.nodes.find(n=>n.name===name).parameters.jsCode)(inputApi,lookup,name=>get(name),Buffer);
  assert.deepEqual(execute(after),execute(before));checks++;
 }
}
console.log(JSON.stringify({passedIncludingRecordedSuccessReplays:checks}));
const {pendingPage,advancePendingPage}=require('./pending-page.cjs');const state={};
const recent=pendingPage('TRUE()','a',state,new Date('2026-09-08T10:00:00Z'));const history=pendingPage('TRUE()','a',state,new Date('2026-09-08T11:00:00Z'));
check(recent.recent && !history.recent);check(recent.pendingFilter.includes('2026-09-06'));
advancePendingPage([{json:{id:'recAAA',fields:{'Ingested At':'2026-09-07T00:00:00Z'}}}],recent.pendingSlot,state);
check(pendingPage('TRUE()','a',state,new Date('2026-09-08T10:00:00Z')).pendingFilter.includes("RECORD_ID()='recAAA'"));
check(!pendingPage('TRUE()','a',state,new Date('2026-09-08T11:00:00Z')).pendingFilter.includes('recAAA'));
advancePendingPage([],recent.pendingSlot,state);check(!state[recent.pendingSlot]);
const failed=JSON.parse(fs.readFileSync(path.join(root,'658287.fixture.json'))).data.resultData.runData['Verify Drive Folder'][0].data.main.flat()[0].json;
check(classifyFailure(failed,'read',0).retry && classifyFailure(failed,'read',0).quota);
console.log(JSON.stringify({totalPassed:checks,externalWrites:0,providerCalls:0}));
