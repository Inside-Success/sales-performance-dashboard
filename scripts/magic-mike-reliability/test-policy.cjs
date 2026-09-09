const test=require('node:test');const assert=require('node:assert/strict');
const {classifyFailure}=require('./retry-policy.cjs');const {pendingPage,advancePendingPage}=require('./pending-page.cjs');
test('quota rejection retries writes; permissions and ambiguous outcomes do not',()=>{
 assert.equal(classifyFailure({error:{httpCode:403,description:'Quota exceeded'}},'write',0).retry,true);
 for(const e of [{httpCode:403,message:'Permission denied'},{httpCode:500,message:'Server error'},{message:'ETIMEDOUT'}])assert.equal(classifyFailure({error:e},'write',0).retry,false);
});
test('transcript availability and classifier overload can recover with bounded waits',()=>{
 assert.equal(classifyFailure({error:{httpCode:404}},'download',0).retry,true);
 assert.equal(classifyFailure({error:{httpCode:529}},'compute',0).retry,true);
 assert.equal(classifyFailure({error:{httpCode:429}},'write',5).retry,false);
 assert.equal(classifyFailure({error:{httpCode:429}},'write',0).delaySeconds,65);
});
test('recent and historical cursor state remain separate',()=>{
 const state={};const at=new Date('2026-09-08T10:00:00Z');const p=pendingPage('TRUE()','example',state,at);
 advancePendingPage([{json:{id:'recExample',fields:{'Ingested At':'2026-09-07T00:00:00Z'}}}],p.pendingSlot,state);
 assert.match(pendingPage('TRUE()','example',state,at).pendingFilter,/recExample/);
 assert.doesNotMatch(pendingPage('TRUE()','example',state,new Date('2026-09-08T11:00:00Z')).pendingFilter,/recExample/);
 assert.doesNotMatch(pendingPage('TRUE()','anotherAccount',state,at).pendingFilter,/recExample/);
});
test('equal timestamps advance by record ID and empty pages reset only their cursor',()=>{
 const state={other:{date:'unchanged'}};const rows=id=>[{json:{id,fields:{'Ingested At':'2026-09-07T00:00:00Z'}}}];
 advancePendingPage(rows('recFirst'),'queue',state);advancePendingPage(rows('recSecond'),'queue',state);
 assert.deepEqual(state.queue.ids,['recFirst','recSecond']);advancePendingPage([],'queue',state);
 assert.equal(state.queue,undefined);assert.deepEqual(state.other,{date:'unchanged'});
});
