const {test}=require('node:test'),assert=require('node:assert/strict');
const {schema,validate}=require('./contract.cjs');
const {repair}=require('./prose-boundary.cjs');
const {hash}=require('./accounting.cjs');
const blocks=[{id:'T0001',text:'Buyer: Please explain the payment schedule.'}];
function fixture(){return {...schema,status:'completed',exclusion_reason:'',offer_family:'main_istv',show:'Test',outcome:{payment:'not_confirmed',text:'Payment was not confirmed.',evidence_ids:['T0001']},objections:[],lessons:[{id:'L1',purpose:'repeat',title:'Answer directly',observation:'You answered the question.',teaching:'Use a direct answer when the question is clear.',example:'',evidence_ids:['T0001'],counterevidence_ids:[]}],focus_id:'L1',next_steps:[]};}
test('repair covers new teaching prose but cannot change facts, evidence, ownership or verdict',()=>{
 const r=fixture(),before=JSON.stringify(r);
 const fixed=repair(r,blocks,[{path:'lessons.0.teaching',value:'Answer the actual question before elaborating.'}],hash(r));
 assert.equal(fixed.requiresFreshReview,true);assert.match(fixed.rendered,/actual question/);assert.equal(JSON.stringify(r),before);
 for(const path of ['status','outcome.payment','lessons.0.id','lessons.0.purpose','lessons.0.evidence_ids','focus_id','offer_family','__proto__.x'])assert.throws(()=>repair(r,blocks,[{path,value:'changed'}],hash(r)),/Invalid/);
 assert.throws(()=>repair(r,blocks,[],hash({...r,show:'Other'})),/Stale/);
 assert.throws(()=>repair(r,blocks,[{path:'outcome.text',value:'x'},{path:'outcome.text',value:'y'}],hash(r)),/Invalid/);
});
test('uncertain or sound handling cannot smuggle in corrective examples; exclusion cannot publish advice',()=>{
 const r=fixture();r.objections=[{id:'O1',category:'cost',title:'Payment concern',concern:'A concern',response:'A response',handling:'sound',resolution:'unclear',assessment:'Assessment',teaching:'Conditional teaching',example:'You should instead say this.',evidence_ids:['T0001'],counterevidence_ids:[]}];
 assert.throws(()=>validate(r,blocks),/Corrective/);r.objections[0].handling='uncertain';assert.throws(()=>validate(r,blocks),/Corrective/);
 const excluded={...fixture(),status:'excluded',exclusion_reason:'Insufficient evidence',lessons:[],focus_id:'',next_steps:[{kind:'recommended',text:'Call them',evidence_ids:['T0001']}]};assert.throws(()=>validate(excluded,blocks),/exclusion/);
});
