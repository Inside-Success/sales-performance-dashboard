const test=require('node:test'),assert=require('node:assert/strict');
const {schema,validate,render}=require('./contract.cjs');
test('one-party promises remain distinct from mutual agreement and new advice',()=>{
 const r={...schema,status:'completed',offer_family:'main_istv',show:'Example',outcome:{payment:'not_confirmed',text:'No payment confirmed.',evidence_ids:['T0001']},objections:[],lessons:[],focus_id:'',next_steps:[{kind:'promised',text:'You will email the requested materials.',evidence_ids:['T0001']},{kind:'agreed',text:'Reconnect tomorrow.',evidence_ids:['T0001']},{kind:'recommended',text:'Verify the current package.',evidence_ids:['T0001']}]};
 const blocks=[{id:'T0001'}];validate(r,blocks);const text=render(r,blocks);assert(text.includes('Promised: You will email'));assert(text.includes('Agreed: Reconnect'));assert(text.includes('Suggested: Verify'));assert.throws(()=>validate({...r,next_steps:[{...r.next_steps[0],kind:'offered'}]},blocks),/next step/);assert.throws(()=>validate({...r,next_steps:[{...r.next_steps[0],evidence_ids:['unknown']}]},blocks),/evidence/);
});
