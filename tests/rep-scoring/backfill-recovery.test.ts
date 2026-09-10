import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const code=readFileSync(new URL('../../n8n/backfill-recovery/prepare-affected-fields.js',import.meta.url),'utf8');
const f=new Function(code.split('function baselineValidate')[0]+'return {canonicalTurnId,sourceEvidence,isRepSpeaker,prepare,apply};')();
const transcript='[00:01:00.000] Alex - Casting Manager: Would you like to pay the deposit now?\n[00:02:00.000] Client: I need time.';
const build={metadata:{rep_name:'Alex Smith',client_name:'Client'},transcript};
const turns=[{id:'T0001',speaker:'Alex - Casting Manager',timestamp:'[00:01:00.000]',text:'Would you like to pay the deposit now?'},{id:'T0002',speaker:'Client',timestamp:'[00:02:00.000]',text:'I need time.'}];
describe('backfill reviewer recovery boundaries',()=>{
 it('normalizes only numeric zero padding and retains exact source speech',()=>{
  expect(f.sourceEvidence(turns,'T1')).toEqual(f.sourceEvidence(turns,'T0001'));
  for(const id of ['T9999','T0','T1-T2','T1abc','1'])expect(()=>f.sourceEvidence(turns,id)).toThrow();
 });
 it('accepts an unambiguous display label but never attributes client speech to a rep',()=>{
  expect(f.isRepSpeaker('Alex - Casting Manager',build,turns)).toBe(true);
  expect(f.isRepSpeaker('Client',build,turns)).toBe(false);
  expect(f.isRepSpeaker('Gregory - DJ Casting Manager',{metadata:{rep_name:'Greg Easthouse',client_name:'Lisa Burns'}},[{speaker:'Gregory - DJ Casting Manager'},{speaker:'Lisa’s iPhone'}])).toBe(true);
  expect(f.isRepSpeaker('Dale Smith',{metadata:{rep_name:'Jordann Barker',client_name:'Room'}},[{speaker:'Dale Smith'},{speaker:'Jordann Barker'}])).toBe(false);
 });
 it('rejecting a proposed signal correction preserves original evidence',()=>{
  const signal={present:false,evidence:null,request_text:null};
  const raw={parsed_json:{manager_score:{dimensions:{},close_signals:{direct_commitment_ask:signal},critical_events:[],review:{}}}};
  const audit={claims:[{id:'signal.direct_commitment_ask',kind:'boolean',draft_value:false}],checks:[{id:'signal.direct_commitment_ask',status:'contradicted',verified_value:true,evidence_ids:['T1'],counterevidence_ids:[]}]};
  const r=f.apply(raw,build,audit,{decisions:[{claim_id:'signal.direct_commitment_ask',accepted:false}],dimensions:[],signals:[],events:[]});
  expect(r.parsed_json.manager_score.close_signals.direct_commitment_ask).toEqual(signal);
 });
 it('accepts omission of a no-change false signal, never omission of a changed signal',()=>{
  const raw={parsed_json:{manager_score:{dimensions:{},close_signals:{onboarding_or_handoff_confirmed:{present:false,evidence:null}},critical_events:[],review:{}}}};
  const audit={claims:[{id:'signal.onboarding_or_handoff_confirmed',kind:'boolean',draft_value:false}],checks:[{id:'signal.onboarding_or_handoff_confirmed',status:'uncertain',verified_value:false,evidence_ids:[]}]};
  const review={decisions:[{claim_id:'signal.onboarding_or_handoff_confirmed',accepted:true}],dimensions:[],signals:[],events:[]};
  expect(f.apply(raw,build,audit,review).parsed_json.manager_score.close_signals.onboarding_or_handoff_confirmed.present).toBe(false);
  audit.checks[0].verified_value=true;expect(()=>f.apply(raw,build,audit,review)).toThrow('Missing signal decisions');
 });
});
