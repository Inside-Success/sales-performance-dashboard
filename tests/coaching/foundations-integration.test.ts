import {normalizeIngestPayload} from '../../src/lib/ingest';
import {normalizeManualCallback} from '../../src/lib/manual-reports';
import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url);
const a=require('../../scripts/coaching-foundations/integration.cjs');
const report={version:'coaching-foundations-v3',status:'completed',exclusion_reason:'',offer_family:'reality',show:'Island',outcome:{payment:'not_confirmed',text:'Follow-up agreed.',evidence_ids:['T0001']},objections:[],lessons:[{id:'L1',purpose:'repeat',title:'Clarify the goal',observation:'You asked what mattered.',teaching:'Clarify before proposing a package.',example:'',evidence_ids:['T0001'],counterevidence_ids:[]}],focus_id:'L1',next_steps:[{kind:'promised',text:'Send the overview.',evidence_ids:['T0001']}]};
const prepared=()=>a.prepare({sourceId:'recA',policyRevision:'test',policyText:'Approved rules',blocks:[{id:'T0001',timestamp:'00:01',text:'I will send the overview.'}]});
const response=(id:string,value:unknown)=>({ok:true,request_id:id,provider_response_id:'provider-'+id,parsed_json:value,stop_reason:'stop'});
const candidate=()=>a.accept({prepared:prepared(),draftResponse:response('write',report),draftRequestId:'write',reviewResponse:response('review',{pass:true,findings:[],corrected_report:null}),reviewRequestId:'review'});
const cleared=(c=candidate())=>a.safety(c,{candidateDigest:c.digest,requestId:'safety',pass:true,unresolvedFindings:[]});
describe('foundations offline publication boundary',()=>{
 it.each(['official','manual'])('round trips %s through JSONB key order without losing promises or positive lessons',channel=>{
  const payload=a.publish(cleared(),{sourceId:'recA',channel});
  const reorder=(v:any):any=>Array.isArray(v)?v.map(reorder):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).reverse().map(k=>[k,reorder(v[k])])):v;
  const loaded=a.read(reorder(payload),'recA',channel);
  expect(loaded.markdown).toBe(payload.markdown);expect(loaded.report.next_steps[0].kind).toBe('promised');expect(loaded.report.lessons[0].purpose).toBe('repeat');
 });
 it('rejects source, channel and provider receipt mismatches',()=>{
  expect(()=>a.publish(cleared(),{sourceId:'recB',channel:'official'})).toThrow();
  const p=a.publish(cleared(),{sourceId:'recA',channel:'official'});expect(()=>a.read(p,'recA','manual')).toThrow();
  expect(()=>a.accept({prepared:prepared(),draftResponse:response('other',report),draftRequestId:'write'})).toThrow();
 });
 it('never publishes a draft or repairs classification/evidence',()=>{
  expect(()=>a.publish(candidate(),{sourceId:'recA',channel:'official'})).toThrow();
  const c=cleared();for(const path of ['offer_family','focus_id','lessons.0.purpose','lessons.0.evidence_ids.0'])expect(()=>a.repair(c,c.digest,[{path,before:'x',after:'y'}])).toThrow();
 });
 it('requires a fresh safety decision after an atomic prose repair',()=>{
  const c=cleared(),r=a.repair(c,c.digest,[{path:'lessons.0.teaching',before:report.lessons[0].teaching,after:'Ask which goal matters before proposing a package.'}]);
  expect(()=>a.publish(r,{sourceId:'recA',channel:'official'})).toThrow();
  expect(()=>a.safety(r,{candidateDigest:c.digest,requestId:'stale',pass:true,unresolvedFindings:[]})).toThrow();
  expect(a.publish(cleared(r),{sourceId:'recA',channel:'official'}).markdown).toContain('Ask which goal');
 });
 it('holds unresolved safety findings and tampered saved content',()=>{
  const c=candidate();expect(()=>a.safety(c,{candidateDigest:c.digest,requestId:'safety',pass:true,unresolvedFindings:['still unsafe']})).toThrow();
  const p=a.publish(cleared(),{sourceId:'recA',channel:'official'});p.reviewed_coaching_v3.report.outcome.payment='confirmed';expect(()=>a.read(p,'recA','official')).toThrow();
 });
 it('renders a real objection without exposing internal IDs or accepting unknown metadata',()=>{
  const contract=require('../../src/lib/foundations-contract.cjs');const r=structuredClone(report) as any;
  r.objections=[{id:'O1',category:'practical',title:'Bank check',concern:'Needs a bank check.',response:'You agreed to wait.',handling:'sound',resolution:'unresolved',assessment:'You respected the check.',teaching:'Wait for the actual result at T0001.',example:'',evidence_ids:['T0001'],counterevidence_ids:[]}];
  expect(contract.render(r,prepared().blocks)).toContain('the exchange at 00:01');
  r.objections[0].source_id='other';expect(()=>contract.render(r,prepared().blocks)).toThrow('fields');
 });
 it('leaves legacy generations to their existing reader',()=>expect(a.read({coaching_version:'magic-mike-objection-coaching-2026-10-29'},'recA','official')).toBeNull());
});

it.each(['magic-mike-tyler-coaching-2026-11-10','magic-mike-foundations-candidate-2026-11-06'])('validates delayed historical generation %s at both delivery APIs',generation=>{
 for(const channel of ['official','manual']){
  const p={...a.publish(cleared(),{sourceId:'recA',channel}),coaching_version:generation};
  const raw={...p,source_airtable_record_id:'recA',public_id:'recA',call_status:'scored',status:'completed'};
  const normalize=channel==='official'?normalizeIngestPayload:normalizeManualCallback;
  expect(()=>normalize(raw)).not.toThrow();
  raw.reviewed_coaching_v3.report.outcome.payment='confirmed';
  expect(()=>normalize(raw)).toThrow();
 }
});
