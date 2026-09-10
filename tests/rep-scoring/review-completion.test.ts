import {readFileSync} from 'node:fs';
import {describe,it,expect} from 'vitest';
const read=(n:string)=>readFileSync(new URL(`../../n8n/review-completion/${n}.js`,import.meta.url),'utf8');
const code=read('finalize-bounded-score');
const lib=new Function(code.split('function one(name)')[0]+'return {reviewedValidate,acceptedReviewScope,apply};')();
function fixture(quote='You ready?', grounded=true){
 const evidence={timestamp:'[00:01:00.000]',speaker:'Rep',quote,...(grounded?{turn_id:'T0001'}:{})};
 const build={metadata:{rep_name:'Rep',client_name:'Client'},provider_request:{request_id:'fixture'},score_version:'magic-mike-call2-evidence-score-v2',call_type:'Call 2',context_pack:{},recent_scores:[],transcript:`[00:01:00.000] Rep: ${quote}\n[00:02:00.000] Client: Yes, send the deposit link.`};
 const dimensions=Object.fromEntries(['frame_and_control','prospect_read_and_tailoring','objection_handling','close_mechanics_and_momentum'].map(k=>[k,{band:'adequate',reason:'An indirect conditional commitment ask was made.',evidence,counterevidence:[]}]));
 const close_signals=Object.fromEntries(['direct_commitment_ask','payment_or_deposit_action','payment_or_deposit_confirmed','agreement_confirmed','onboarding_or_handoff_confirmed','specific_followup_agreed'].map(k=>[k,{present:k==='direct_commitment_ask',evidence:k==='direct_commitment_ask'?evidence:null,request_text:k==='direct_commitment_ask'?quote:null}]));
 const parsed_json={...Object.fromEntries(['one_line_verdict','biggest_strength','what_id_polish','coaching_tip','rudys_note','what_went_well','what_to_improve','why_no_close','what_made_this_close_work','objections_surfaced'].map(k=>[k,''])),manager_score:{eligible:true,call_phase:'closing_call',confidence:'high',lead_context:{scoring_opportunity:'full'},dimensions,close_signals,critical_events:[],review:{real_prospect_confirmed:true,closing_stage_observable:true,ended_by_unrecovered_technical_failure:false,definitive_affordability_decline:false,contract_review_continuation:false}}};
 return {raw:{ok:true,parsed_json,costs:{}},build};
}
const audit={claims:[{id:'signal.payment_or_deposit_action',kind:'boolean',draft_value:false}],checks:[{id:'signal.payment_or_deposit_action',status:'uncertain',verified_value:false,evidence_ids:[],counterevidence_ids:[]}]};
describe('reviewed evidence validation',()=>{
 it('allows short exact grounded speech after factual review without treating indirect as false',()=>{const {raw,build}=fixture();expect(lib.reviewedValidate(raw,build)[0].json.validation.valid).toBe(true);});
 it('retains the stricter fallback for an unindexed short quote',()=>{const {raw,build}=fixture('You ready?',false);expect(lib.reviewedValidate(raw,build)[0].json.validation.valid).toBe(false);});
 it('rejects an invented request even with a real source turn',()=>{const {raw,build}=fixture();raw.parsed_json.manager_score.close_signals.direct_commitment_ask.request_text='Can you pay the deposit?';expect(lib.reviewedValidate(raw,build)[0].json.validation.valid).toBe(false);});
 it('cannot convert extra model fields into permission to edit',()=>{
  const {raw,build}=fixture();const review={decisions:[{claim_id:'signal.payment_or_deposit_action',accepted:false}],dimensions:[{name:'frame_and_control',band:'exemplary'}],signals:[{name:'agreement_confirmed',present:true}],events:[{index:0,retain:false}],review_reason:'Rewrite everything'};
  const scoped=lib.acceptedReviewScope(raw,build,audit,review);expect(scoped).toMatchObject({dimensions:[],signals:[],events:[],review_reason:null});expect(lib.apply(raw,build,audit,scoped).parsed_json).toEqual(raw.parsed_json);
 });
 it('never treats missing decisions as rejection or acceptance',()=>{const {raw,build}=fixture();expect(()=>lib.acceptedReviewScope(raw,build,audit,{decisions:[]})).toThrow('Incomplete reassessment decisions');});
});
describe('bounded completion repair',()=>{
 const execute=(state:unknown)=>new Function('$input','$','$json',code)({all:()=>[{json:state}]},()=>({all:()=>[]}),state)[0].json;
 const state=()=>({...fixture(),audit,review:{decisions:[]},status:'checked',should_review:true,needs_reassessment:true,responses:[{ok:true,costs:{}}],baseline:{current_call_score:{score:55},validation:{valid:true,warnings:[]}}});
 it('offers repair for a known incomplete response while preserving the paid baseline',()=>{const r=execute(state());expect(r.current_call_score.score).toBe(55);expect(r.factual_review.status).toBe('failed');expect(r.__review_recovery).toBeDefined();});
 it('never loops after the single completion repair',()=>{expect(execute({...state(),completion_repair_attempted:true}).__review_recovery).toBeUndefined();});
 it('does not automatically resend an uncertain failed provider request',()=>{const s=state();s.responses=[{ok:false,costs:{}}];expect(execute(s).__review_recovery).toBeUndefined();});
});
