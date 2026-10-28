import {describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {OBJECTION_VERSION,OBJECTION_CATEGORIES,objectionErrors,objectionProviderErrors,readObjectionCoaching,renderObjectionReport,objectionSections} from '../../src/lib/objection-coaching.cjs';
import {validProviderResult} from '../../src/lib/provider-checkpoint-policy';
import {summarizeCoachingInsights,type InsightCall} from '../../src/lib/coaching-insights';
const require=createRequire(import.meta.url);
const {validateEnhancedDraft,acceptEnhancedAudit,bindEnhancedAfterSafety,enhancedSafetyView,finishEnhancedSafety}=require('../../scripts/coaching-upgrade/stages.cjs');
const blocks=[{id:'T0001',timestamp:'00:01:20',text:'Buyer: I need my co-owner to approve this.'},{id:'T0002',timestamp:'00:02:10',text:'Seller: Shall we speak together tomorrow? Buyer: Yes.'}];
function report(){return {version:'objection-coaching-v2' as const,source_id:'recExample',show:'Example',offer_family:'main_istv',evidence_quality:'sufficient' as const,summary:'Agree a joint conversation with the co-owner.',outcome:{payment:'not_confirmed' as const,summary:'A joint follow-up was agreed; no payment was confirmed.',evidence_ids:['T0002']},objections:[{category:'approval',title:'Co-owner approval needed',concern:'The buyer needs joint approval.',response:'You offered a joint conversation.',handling:'handled_well' as const,resolution:'unresolved' as const,assessment:'The follow-up addresses the decision process; approval remains pending.',recommendation:'',suggested_words:'',evidence_ids:['T0001','T0002'],counterevidence_ids:[]}],no_objections_reason:'',not_raised:Object.keys(OBJECTION_CATEGORIES).filter(k=>!['approval','unclassified'].includes(k)),improvements:[],strengths:[],next_steps:[{kind:'agreed' as const,observation:'Speak with both owners tomorrow.',evidence_ids:['T0002']}]};}
const response=(parsed_json:unknown,request_id='req')=>({ok:true,stop_reason:'end_turn',parsed_json,request_id,model:'test'});
const prepared=()=>({state:{coaching_version:OBJECTION_VERSION,coaching_policy_revision:'test'},blocks,provider_request:{request_id:'req-audit'},analysis:report(),generated:response(report())});
describe('objection report evidence and delivery contract',()=>{
 it('keeps handling, resolution and payment independent and hides internal taxonomy accounting',()=>{
  const r=report();expect(objectionErrors(r,blocks)).toEqual([]);
  const text=objectionSections(r,blocks).flatMap(s=>s.items).join('\n');
  expect(text).toContain('Handled well · Unresolved');expect(text).toContain('00:01:20');expect(text).not.toContain('T0001');expect(text).not.toContain('not_raised');
 });
 it('rejects unknown evidence, contradictory absent categories and invented advice for good handling',()=>{
  const r=report();r.objections[0].evidence_ids=['T9999'];r.not_raised.push('approval');r.objections[0].recommendation='Pressure them to pay now';
  expect(objectionErrors(r,blocks)).toEqual(expect.arrayContaining(['Invalid evidence for objection','Contradictory category accounting','Advice for sound or uncertain handling']));
 });
 it('does not equate insufficient evidence with no objections',()=>{
  const r={...report(),evidence_quality:'limited',objections:[],not_raised:[],no_objections_reason:'No objections identified'};
  expect(objectionErrors(r)).toContain('Missing evidence is not no objections');r.no_objections_reason='The available transcript does not show enough of the conversation to establish concerns.';expect(objectionErrors(r)).toEqual([]);
 });
 it('binds the version and source and rejects mismatched or malformed rich payloads',()=>{
  const payload={coaching_version:OBJECTION_VERSION,reviewed_coaching_v2:report()};
  expect(readObjectionCoaching(payload,'recExample')).not.toBeNull();
  expect(readObjectionCoaching(payload,'recOther')).toBeNull();expect(readObjectionCoaching({...payload,coaching_version:'old'},'recExample')).toBeNull();
  expect(readObjectionCoaching({...payload,reviewed_coaching_v2:{...report(),objections:null}},'recExample')).toBeNull();
 });
 it('never publishes a rich report that bypasses downstream safety edits',()=>{
  const flat=renderObjectionReport(report(),blocks,'recExample');
  expect(bindEnhancedAfterSafety(flat.reviewed_coaching_v2,flat,{...flat},'recExample').source_id).toBe('recExample');
  expect(()=>bindEnhancedAfterSafety(flat.reviewed_coaching_v2,flat,{...flat,coaching_tip:'Safety replacement'},'recExample')).toThrow('safety hold');
 });
 it('keeps deterministic wording cleanup consistent across structured and flat content',()=>{
  const r=report();r.summary='Ask a clean question and listen properly.';
  const flat=renderObjectionReport(r,blocks,'recExample',{policy_text:'Keep policy wording properly unchanged.'});
  const saved=flat.reviewed_coaching_v2 as {summary:string;provenance:{policy_text:string}};
  expect(saved.summary).toBe('Ask a direct question and listen.');
  expect(flat.rudys_note).toBe(saved.summary);
  expect(saved.provenance.policy_text).toBe('Keep policy wording properly unchanged.');
 });
 it('renders safety repairs consistently without changing classifications or leaking metadata',()=>{
  const original={...report(),provenance:{policy_text:'Private policy context'}};
  const analysis=enhancedSafetyView(original);expect(JSON.stringify(analysis)).not.toContain('policy_text');
  analysis.objections[0].assessment='A supported, safer explanation.';
  const state={reviewed_coaching_v2:original,coaching_evidence_index:blocks,repair_rows:[{applied:true}]};
  const result=finishEnhancedSafety(state,analysis,'recExample');
  expect(result.objections_surfaced).toContain('A supported, safer explanation.');
  expect(result.reviewed_coaching_v2.objections[0].assessment).toBe('A supported, safer explanation.');
  expect(result.reviewed_coaching_v2.provenance.safety_repaired).toBe(true);
  analysis.objections[0].resolution='resolved';expect(()=>finishEnhancedSafety(state,analysis,'recExample')).toThrow('classification changed');
  expect(()=>finishEnhancedSafety({...state,safety_screen_error:'timeout'},enhancedSafetyView(original),'recExample')).toThrow('incomplete safety');
 });
 it('requires exact request alignment and only one repair for a malformed writer result',()=>{
  const p={prepared:{state:{coaching_version:OBJECTION_VERSION},blocks,provider_request:{request_id:'req'}},provider_request:{request_id:'req-schema-repair'}};
  expect(()=>validateEnhancedDraft(p,response(report(),'wrong'))).toThrow('alignment');
  expect(validateEnhancedDraft(p,response({}),false).needs_repair).toBe(true);
  expect(()=>validateEnhancedDraft(p,response({},'req-schema-repair'),true)).toThrow('after one repair');
  expect(validateEnhancedDraft(p,response(report(),'req-schema-repair'),true).eligible).toBe(true);
 });
 it('requires an explicit, supported audit and applies a complete correction',()=>{
  const p=prepared();expect(()=>acceptEnhancedAudit(p,response({pass:true,findings:[{issue:'error',evidence_ids:['T0001']}],corrected_report:null},'req-audit'),'req-audit')).toThrow('Conflicting');
  const corrected={...report(),summary:'Supported correction'};
  const out=acceptEnhancedAudit(p,response({pass:false,findings:[{issue:'Incorrect summary',evidence_ids:['T0001']}],corrected_report:corrected},'req-audit'),'req-audit');
  expect(out.reviewed_coaching_v2.summary).toBe('Supported correction');
  expect(()=>acceptEnhancedAudit(p,response({pass:false,findings:[],corrected_report:corrected},'req-audit'),'req-audit')).toThrow('explicit findings');
 });
 it('never caches malformed writer or audit contracts as completed',()=>{
  for(const stage of ['objection_v2_writer','objection_v2_repair','objection_v2_audit','objection_v2_audit_repair'])expect(validProviderResult({...response({}),call_purpose:stage})).toBe(false);
  expect(validProviderResult({...response(report()),call_purpose:'objection_v2_writer'})).toBe(true);
  expect(objectionProviderErrors('objection_v2_audit',{pass:true,findings:[],corrected_report:null})).toEqual([]);
  expect(validProviderResult({...response(report()),stop_reason:'max_tokens',call_purpose:'objection_v2_writer'})).toBe(false);
 });
 it('deduplicates sources, retains occurrence-level resolution and separates legacy keywords',()=>{
  const base:InsightCall={id:'1',rep_name:'Example',rep_slug:'example',client_name:'Buyer',call_date:null,one_line_verdict:null,what_to_improve:[],objections_surfaced:[],source_id:'recExample',report_type:'official',source_payload:{coaching_version:OBJECTION_VERSION,reviewed_coaching_v2:report()}};
  const old={...base,id:'2',source_id:'recOld',source_payload:null,objections_surfaced:['Buyer needs partner approval.']};
  const result=summarizeCoachingInsights([base,{...base,id:'3'},old]);
  expect(result.enhanced.total).toBe(1);expect(result.enhanced.objections).toBe(1);expect(result.enhanced.categories[0]).toMatchObject({key:'approval',handledWell:1,unresolved:1,resolved:0});expect(result.total).toBe(1);
 });
});


describe('audit checkpoint request identity',()=>{
 it('reuses the same request after JSONB changes object key order, but not changed evidence',()=>{
  const {reviewerPrompt}=require('../../scripts/coaching-upgrade/prompts.cjs');
  const reorder=(value:unknown):unknown=>Array.isArray(value)?value.map(reorder):value&&typeof value==='object'?Object.fromEntries(Object.entries(value).reverse().map(([k,v])=>[k,reorder(v)])):value;
  const metadata={rep_name:'Rep',show_name:'Example'};
  const first=reviewerPrompt(metadata,blocks,report());
  expect(reviewerPrompt(reorder(metadata),reorder(blocks),reorder(report()))).toBe(first);
  expect(reviewerPrompt(metadata,[...blocks].reverse(),report())).not.toBe(first);
  expect(reviewerPrompt(metadata,blocks,{...report(),summary:'Changed advice'})).not.toBe(first);
 });
});


describe('manual local safety repair',()=>{
 it('preserves useful advice without inventing a missing model response',()=>{
  const {manualLocalSafetyRepairs}=require('../../scripts/coaching-upgrade/manual-safety.cjs');
  const state={safety_screen:{case_pass:true,unsupported_specifics:[],collisions:[],additional_safety_hits:[]},repair_targets:[{id:'r1',layer:'L1',rule:'certification',path:'objections.0.recommendation',before:'Confirm the exact approved payment plan and explain the total.'}]};
  expect(manualLocalSafetyRepairs(state)[0].after).toBe('Confirm the current payment plan and explain the total.');
  expect(()=>manualLocalSafetyRepairs({...state,safety_screen:{...state.safety_screen,case_pass:false}})).toThrow('requires review');
  expect(()=>manualLocalSafetyRepairs({...state,repair_targets:[{...state.repair_targets[0],path:'objections.0.response'}]})).toThrow('unsupported local repair');
  expect(()=>manualLocalSafetyRepairs({...state,repair_targets:[{...state.repair_targets[0],before:'Promise a refund.'}]})).toThrow('unsupported local repair');
 });
});


describe('checkpoint downstream identity',()=>{
 it('restores original object order only when values and array order match',()=>{
  const {checkpointJsonOrder}=require('../../scripts/coaching-upgrade/checkpoint-json.cjs');
  const original={z:{b:2,a:1},rows:[{y:4,x:3}]};const stored={rows:[{x:3,y:4}],z:{a:1,b:2}};
  expect(JSON.stringify(checkpointJsonOrder(stored,JSON.stringify(original)))).toBe(JSON.stringify(original));
  expect(checkpointJsonOrder(stored,JSON.stringify({...original,z:{b:9,a:1}}))).toBe(stored);
  expect(checkpointJsonOrder(stored,'invalid JSON')).toBe(stored);
  expect(checkpointJsonOrder([1,2],'[2,1]')).toEqual([1,2]);
 });
});
