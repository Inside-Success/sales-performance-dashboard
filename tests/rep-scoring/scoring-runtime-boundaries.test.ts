import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = (file: string) => readFileSync(new URL(`../../n8n/call2-score-v2/${file}.js`, import.meta.url), 'utf8');
const persist = new Function('$json', source('build-immutable-call-2-score-record'));
const base = (score: unknown, version = 'magic-mike-call2-evidence-score-v2') => ({ result: { score_version: version, validation: {valid:true}, current_call_score: {eligible:true, score, dimensions:{}} }, call:{source_record_id:'fixture-only'}, write_enabled:false });

describe('actual persistence Code node boundaries', () => {
  it.each([null, undefined, '', '55', NaN, Infinity, -1, 101])('withholds invalid numeric score %s', score => {
    expect(persist(base(score))[0].json).toMatchObject({route:'not_scored',write_enabled:false});
  });
  it.each(['magic-mike-call2-evidence-score-v1','magic-mike-call2-evidence-score-v2'])('retains immutable identity for %s', version => {
    expect(persist(base(55,version))[0].json).toMatchObject({assessmentId:`${version}:fixture-only`,write_enabled:false});
  });
  it('rejects unknown versions', () => expect(persist(base(55,'unknown'))[0].json.route).toBe('not_scored'));
  it.each([0,100])('accepts legitimate scale endpoint %s', score => expect(persist(base(score))[0].json.scoreFields['Composite Score']).toBe(score));
});

describe('actual retry Code node boundary', () => {
  const decide = new Function('$input', source('decide-automatic-validation-retry'));
  it('retries a contradictory direct ask once through the existing retry route', () => {
    expect(decide({all:()=>[{json:{validation:{valid:false},current_call_score:{reason:'contradictory_direct_ask:implicit_or_hypothetical_is_not_an_actual_request'}}}]})[0].json.__automatic_retry_required).toBe(true);
  });
  it('does not spend another generation on an intentional exclusion', () => {
    expect(decide({all:()=>[{json:{validation:{valid:false},current_call_score:{reason:'insufficient_scoring_opportunity',exclusion_category:'insufficient_scoring_opportunity'}}}]})[0].json.__automatic_retry_required).toBe(false);
  });
  it('rejects mixed call items', () => expect(()=>decide({all:()=>[{json:{}},{json:{}}]})).toThrow());
});

describe('actual scoring Code semantic guards', () => {
  const run = (quote: string, direct = true, requestText = quote) => {
    const evidence={timestamp:'[00:01:00.000]',quote};
    const build={score_version:'magic-mike-call2-evidence-score-v2',call_type:'Call 2',metadata:{},context_pack:{},recent_scores:[],transcript:`[00:01:00.000] Rep: ${quote}\n[00:01:10.000] Prospect: Yes please send me those details.`};
    const dimensions=Object.fromEntries(['frame_and_control','prospect_read_and_tailoring','objection_handling','close_mechanics_and_momentum'].map(k=>[k,{band:'adequate',evidence,reason:'Observed conduct supports this band.',counterevidence:[]}]));
    const close_signals=Object.fromEntries(['direct_commitment_ask','payment_or_deposit_action','payment_or_deposit_confirmed','agreement_confirmed','onboarding_or_handoff_confirmed','specific_followup_agreed'].map(k=>[k,{present:k==='direct_commitment_ask'&&direct,request_text:requestText,evidence:k==='direct_commitment_ask'&&direct?evidence:null}]));
    const parsed_json={...Object.fromEntries(['one_line_verdict','biggest_strength','what_id_polish','coaching_tip','rudys_note','what_went_well','what_to_improve','why_no_close','what_made_this_close_work','objections_surfaced'].map(k=>[k,''])),manager_score:{eligible:true,call_phase:'closing_call',confidence:'high',lead_context:{scoring_opportunity:'full'},review:{real_prospect_confirmed:true,closing_stage_observable:true,ended_by_unrecovered_technical_failure:false,definitive_affordability_decline:false,contract_review_continuation:false},dimensions,close_signals,critical_events:[]}};
    const execute=new Function('$json','$input','$',source('validate-evidence-compute-manager-score'));
    return execute({parsed_json},{all:()=>[{json:{parsed_json}}]},()=>({all:()=>[{json:build}]}))[0].json;
  };
  it.each(['if you join today then you get a discount','if money was not an issue today','what kind of value do you see here','what are your thoughts on this package'])('does not credit a non-request excerpt: %s', quote => {
    expect(run(quote).current_call_score.reason).toMatch(/^invalid_direct_ask_evidence:/);
  });
  it('rejects an invented complete question even when the short excerpt exists', () => expect(run('We can lower the price if you join today',true,'Would you like to join today?').current_call_score.reason).toMatch(/^invalid_direct_ask_evidence:/));
  it('allows exact quoted speech after a complete real question', () => expect(run('Would you like to pay the deposit? We can start today.').validation.valid).toBe(true));
  it('accepts evidence of a real commitment request', () => expect(run('Would you like to proceed with the deposit?').validation.valid).toBe(true));
  it('does not invent an adequate closing band without an ask or close action', () => expect(run('We discussed the package and its total price',false).current_call_score.dimensions.close_mechanics_and_momentum.band).toBe('attempted'));
});


describe('provider configuration and retry diagnostic boundary', () => {
  it('keeps the scoring model tier and uses temperature zero without extra thinking', () => {
    const build=new Function('$json',source('build-analysis-request'));
    const r=build({transcript:'fixture',metadata:{},score_version:'test',call_type:'Call 2'})[0].json.provider_request;
    expect(r.model).toBe('claude-sonnet-4-6');expect(r.temperature).toBe(0);expect(r.thinking).toBeUndefined();
  });
  it('keeps rejected transcript evidence out of system instructions', () => {
    const run=new Function('$input','$',source('build-one-validation-retry'));
    const original={provider_request:{system:'Trusted rules',prompt:'Original transcript',request_id:'fixture'}};
    const failed={__automatic_retry_reason:'invalid_direct_ask_evidence:fixture',validation:{evidence_diagnostic:{rejected_evidence:{quote:'UNTRUSTED_FIXTURE'},actual_timestamp_line:'UNTRUSTED_FIXTURE'}}};
    const r=run({all:()=>[{json:failed}]},()=>({all:()=>[{json:original}]}))[0].json;
    expect(r.retry_attempt).toBe(1);expect(r.provider_request.prompt).toContain('UNTRUSTED_FIXTURE');expect(r.provider_request.system).not.toContain('UNTRUSTED_FIXTURE');
  });
});
