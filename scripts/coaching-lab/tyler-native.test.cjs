const test=require('node:test'),assert=require('node:assert/strict');
const {adaptNative}=require('./tyler-adapter.cjs');
test('unknown Tyler revision is rejected before native adaptation',()=>assert.throws(()=>adaptNative('modified',[]),/revision changed/));
const {nativeSections}=require('./native-preview.cjs');
const {normalizeObjectionReport,objectionSections}=require('../../src/lib/objection-coaching.cjs');
test('strengths move last without changing any reviewed content or leaking source metadata',()=>{
 const blocks=[{id:'T0001',text:'Buyer wants a review tomorrow.',timestamp:'00:01:00'}];
 const r=normalizeObjectionReport({version:'objection-coaching-v2',show:'Example',offer_family:'main_istv',evidence_quality:'limited',summary:'Support the agreed review.',outcome:{payment:'not_confirmed',summary:'Review agreed.',evidence_ids:['T0001']},objections:[],no_objections_reason:'The limited excerpt does not establish an objection.',not_raised:[],improvements:[],strengths:[{title:'Respect the review',observation:'You agreed to reconnect.',why_it_matters:'The buyer has time to review.',evidence_ids:['T0001']}],next_steps:[{kind:'agreed',observation:'Speak tomorrow.',evidence_ids:['T0001']}],source_id:'private-record'});
 const before=JSON.stringify(r),sections=nativeSections(r,blocks);
 assert.equal(sections.at(-1).key,'strengths');
 assert.deepEqual(sections.toSorted((a,b)=>a.key.localeCompare(b.key)),objectionSections(r,blocks).toSorted((a,b)=>a.key.localeCompare(b.key)));
 assert.equal(JSON.stringify(r),before);assert(!JSON.stringify(sections).includes('private-record'));assert(!JSON.stringify(sections).includes('T0001'));
});
