import {describe,it,expect} from 'vitest';
const transition=require('../../scripts/coaching-foundations/transition.cjs');
const record=require('../../src/lib/foundations-record.cjs');
const safety=require('../../scripts/coaching-foundations/safety.cjs');
const blocks=[{id:'T0001',timestamp:'00:01',text:'Please send the overview. I will send it.'}];
const report={version:'coaching-foundations-v3',status:'completed',exclusion_reason:'',offer_family:'reality',show:'Island',outcome:{payment:'not_confirmed',text:'Overview requested.',evidence_ids:['T0001']},objections:[],lessons:[{id:'L1',purpose:'repeat',layer:'strategy',title:'Answer the request',observation:'You offered the overview.',teaching:'Provide the requested information.',example:'',evidence_ids:['T0001'],counterevidence_ids:[]}],focus_id:'L1',next_steps:[{kind:'promised',text:'Send the overview.',evidence_ids:['T0001']}]};
const reorder=(x:any):any=>Array.isArray(x)?x.map(reorder):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).reverse().map(k=>[k,reorder(x[k])])):x;
const start=()=>transition.start({prepared:record.prepare({sourceId:'recRecovery',policyRevision:'v1',policyText:'Scoped facts',blocks}),call:{metadata:{show:'Island',client:'Buyer'},blocks},system:'Same bound knowledge',models:{writer:'sonnet',reviewer:'terra',safety:'deepseek'},channel:'official'});
const receipt=(s:any,value:any)=>({ok:true,request_id:s.request.request_id,provider_response_id:'saved-'+s.request.stage,parsed_json:value,stop_reason:'stop'});
describe('checkpoint JSONB round-trip identity',()=>{
 it('keeps writer, reviewer and safety requests identical after saved object keys reorder',()=>{
  const a=start(),b=reorder(a);expect(a.request).toEqual(b.request);
  const ar=transition.advance(a,receipt(a,report)),br=transition.advance(b,reorder(receipt(b,reorder(report))));expect(br.request).toEqual(ar.request);expect(br.request.system).toBe(a.request.system);
  const verdict={pass:true,findings:[],corrected_report:null};const as=transition.advance(ar,receipt(ar,verdict)),bs=transition.advance(br,reorder(receipt(br,verdict)));expect(bs.request).toEqual(as.request);
  const findings=[{path:'outcome.text',before:'Overview requested.',reason:'Test finding'}];expect(safety.repairRequest(as.candidate,findings)).toEqual(safety.repairRequest(reorder(as.candidate),reorder(findings)));
 });
 it('still changes identity for a substantive changed report',()=>{const a=start();const first=transition.advance(a,receipt(a,report));const changed=structuredClone(report);changed.outcome.text='A different supported outcome.';expect(transition.advance(a,receipt(a,changed)).request.request_id).not.toBe(first.request.request_id);});
});
