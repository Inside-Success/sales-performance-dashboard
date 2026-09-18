/* eslint-disable @typescript-eslint/no-explicit-any */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// The built v3 node code is the unit under test: same bytes that ship to n8n.
const dist = (n: string) => readFileSync(new URL(`../../n8n/call2-score-v3/dist/${n}.js`, import.meta.url), 'utf8');
const finalize = dist('scorer.finalize-bounded-score');
const lib = new Function(finalize.split('function one(name)')[0] + 'return {baselineValidate,reviewedValidate,prepare,apply,acceptedReviewScope,v3Procedure,v3Ceilings,v3Outcome,V3_CHECKED_PROCEDURE,V3_REVIEW_REVISION,V3_SCORE_VERSION};')();

const REP = 'Tara Reszitnyk';
const T = {
  disclosure: '[00:00:30.000]', glStart: '[00:01:00.000]', video: '[00:06:00.000]', videoEnd: '[00:14:00.000]',
  assume: '[00:14:20.000]', passive: '[00:14:25.000]', objection: '[00:15:00.000]', value: '[00:15:30.000]', urgency: '[00:16:00.000]',
  opt1: '[00:17:00.000]', opt2: '[00:17:20.000]', opt3: '[00:17:40.000]', opt4: '[00:18:00.000]', followup: '[00:19:00.000]', frame: '[00:00:45.000]', tailor: '[00:03:00.000]', longGl: '[00:12:30.000]',
};
const LINES: Record<string, string> = {
  [T.disclosure]: `${REP}: Before we jump in, this call is being recorded for quality and training purposes, is that okay?`,
  [T.frame]: `${REP}: So today we are going to go over your greenlight and then the license details.`,
  [T.glStart]: `${REP}: Congratulations, you got greenlit by our casting team, let me walk you through the letter.`,
  [T.tailor]: `${REP}: You told me the podcast growth was the whole reason you applied, so this matters for that.`,
  [T.video]: `Audio shared by ${REP}: Hello, this is Rudy again. Firstly, congrats on being greenlit, good to have you back here.`,
  [T.videoEnd]: `Audio shared by ${REP}: From me, back to the team. Welcome to Inside Success.`,
  [T.assume]: `${REP}: So what we will do is take the first payment of twenty five hundred today and I will send you the payment link now.`,
  [T.passive]: `${REP}: What are your thoughts on everything you just saw?`,
  [T.objection]: `Prospect: Honestly the money is tight this quarter, I am not sure I can swing it right now.`,
  [T.value]: `${REP}: Take me back to why you applied in the first place, what did you want this show to do for your business?`,
  [T.urgency]: `${REP}: You said you want the podcast launched before Q4, and our casting cohort closes this Sunday night.`,
  [T.opt1]: `${REP}: We can do four payments of three thousand.`,
  [T.opt2]: `${REP}: Or three payments of four thousand if that works better.`,
  [T.opt3]: `${REP}: Or two payments of six thousand.`,
  [T.opt4]: `${REP}: Or pay in full at twelve thousand with the discount.`,
  [T.followup]: `Prospect: Let us talk tomorrow at ten, I will have an answer then.`,
  [T.longGl]: `${REP}: Okay so that is the whole greenlight letter, now let me pull up the video.`,
};
function transcript(extra: Record<string, string> = {}) {
  const all = { ...LINES, ...extra };
  return Object.entries(all).sort(([a], [b]) => a.localeCompare(b)).map(([ts, line]) => `${ts} ${line}`).join('\n');
}
const ev = (ts: string, words = 7) => ({ timestamp: ts, quote: LINES[ts].split(': ').slice(1).join(': ').split(' ').slice(0, words).join(' ') });
const build = (tx = transcript()) => ({ metadata: { rep_name: REP, rep_email: 'tara@example.com', client_name: 'Prospect', call_date: '2026-09-18T15:00:00.000Z', source_record_id: 'recFixture' }, provider_request: { request_id: 'fixture' }, score_version: lib.V3_SCORE_VERSION, call_type: 'Call 2', context_pack: {}, recent_scores: [], transcript: tx });
const COACHING = ['one_line_verdict', 'biggest_strength', 'what_id_polish', 'coaching_tip', 'rudys_note', 'what_went_well', 'what_to_improve', 'why_no_close', 'what_made_this_close_work', 'objections_surfaced'];
const SIGNALS = ['direct_commitment_ask', 'payment_or_deposit_action', 'payment_or_deposit_confirmed', 'agreement_confirmed', 'onboarding_or_handoff_confirmed', 'specific_followup_agreed'];

function assessment(overrides: Record<string, unknown> = {}, procedureOverrides: Record<string, unknown> = {}, signalsPresent: string[] = ['specific_followup_agreed']) {
  const dimensions = Object.fromEntries(['frame_and_control', 'prospect_read_and_tailoring', 'objection_handling', 'close_mechanics_and_momentum'].map((k) => [k, { band: 'strong', reason: 'Observed conduct supports this band.', evidence: ev(k === 'frame_and_control' ? T.frame : k === 'prospect_read_and_tailoring' ? T.tailor : k === 'objection_handling' ? T.value : T.assume), counterevidence: [] }]));
  const close_signals = Object.fromEntries(SIGNALS.map((k) => [k, { present: signalsPresent.includes(k), evidence: signalsPresent.includes(k) ? ev(k === 'specific_followup_agreed' ? T.followup : T.assume) : null, request_text: null }]));
  const procedure = {
    recording_disclosure: { status: 'yes', evidence: ev(T.disclosure) },
    greenlight: { start_timestamp: T.glStart, end_timestamp: T.video, prospect_driven_extension: false, reason: 'Greenlight review ran about five minutes.' },
    greenlight_screen_share: { status: 'unable_to_determine', evidence: null },
    rudy_video: { status: 'yes', start_timestamp: T.video, end_timestamp: T.videoEnd, evidence: ev(T.video) },
    assumptive_close_after_video: { status: 'yes', evidence: ev(T.assume), reason: 'Rep moved straight to the first payment.' },
    objection_occurred: { status: 'yes', evidence: ev(T.objection) },
    value_reestablished: { status: 'yes', evidence: ev(T.value) },
    prospect_verbalized_value: { status: 'no', evidence: ev(T.value) },
    prospect_specific_urgency: { status: 'yes', evidence: ev(T.urgency), reason: 'Tied to the Q4 podcast goal and the cohort deadline.' },
    payment_options: { status: 'yes', options: [{ label: '4 x $3,000', evidence: ev(T.opt1) }], offered_before_value: false, evidence: ev(T.opt1) },
    onboarding_call_booked: { status: 'not_applicable', evidence: null },
    welcome_email_explained: { status: 'not_applicable', evidence: null },
    ...procedureOverrides,
  };
  const manager_score = { eligible: true, call_phase: 'closing_call', confidence: 'high', lead_context: { scoring_opportunity: 'full', disposition: 'engaged' }, review: { real_prospect_confirmed: true, closing_stage_observable: true, ended_by_unrecovered_technical_failure: false, definitive_affordability_decline: false, contract_review_continuation: false, reason: 'Real prospect.' }, dimensions, close_signals, critical_events: [], procedure, call_outcome: { classification: 'follow_up_agreed', reason: 'Follow-up agreed at ' + T.followup }, ...overrides };
  return { ok: true, costs: { total_cost_usd: 0.1 }, parsed_json: { ...Object.fromEntries(COACHING.map((k) => [k, ''])), manager_score } };
}
const score = (provider: unknown, b = build()) => lib.baselineValidate(provider, b)[0].json;
const check = (result: any, name: string) => result.procedural_checks.find((c: any) => c.name === name);

describe('v3 procedural checklist', () => {
  it('produces the fourteen manager checks with grounded evidence', () => {
    const r = score(assessment());
    expect(r.validation.valid).toBe(true);
    expect(r.procedural_checks.map((c: any) => c.name)).toEqual(['recording_disclosure', 'greenlight_duration', 'greenlight_under_10', 'greenlight_screen_share', 'rudy_video', 'assumptive_close_after_video', 'objection_occurred', 'value_reestablished', 'prospect_verbalized_value', 'prospect_specific_urgency', 'payment_options_appropriate', 'more_than_3_payment_options', 'concrete_next_step', 'onboarding_call_booked', 'welcome_email_explained']);
    expect(check(r, 'recording_disclosure')).toMatchObject({ status: 'yes', timestamp: T.disclosure, speaker: REP });
    expect(check(r, 'greenlight_duration').status).toBe('5');
    expect(check(r, 'greenlight_under_10').status).toBe('yes');
    expect(check(r, 'rudy_video')).toMatchObject({ status: 'yes', timestamp: T.video });
    expect(check(r, 'greenlight_screen_share').status).toBe('unable_to_determine');
    expect(check(r, 'concrete_next_step')).toMatchObject({ status: 'yes', validation_note: 'derived_from_verified_close_signals' });
    expect(check(r, 'onboarding_call_booked').status).toBe('not_applicable');
    expect(r.call_outcome).toMatchObject({ classification: 'follow_up_agreed', basis: 'verified_signal' });
    expect(r.score_version).toBe('magic-mike-call2-evidence-score-v3');
  });
  it('downgrades an unverifiable yes instead of trusting it', () => {
    const r = score(assessment({}, { recording_disclosure: { status: 'yes', evidence: { timestamp: '[00:00:30.000]', quote: 'words that are not on that line' } } }), build(transcript({ [T.disclosure]: `${REP}: Great to see you again, how has your week been going so far?` })));
    expect(check(r, 'recording_disclosure')).toMatchObject({ status: 'unable_to_determine' });
  });
  it('finds the disclosure line when the model missed it and never fails the score over screen share', () => {
    const r = score(assessment({}, { recording_disclosure: { status: 'no', evidence: null }, greenlight_screen_share: { status: 'no', evidence: null } }));
    expect(check(r, 'recording_disclosure')).toMatchObject({ status: 'yes', validation_note: 'code_found_disclosure_model_missed' });
    expect(check(r, 'greenlight_screen_share').status).toBe('unable_to_determine');
  });
  it('detects Rudy video from shared audio when the model was unsure', () => {
    const r = score(assessment({}, { rudy_video: { status: 'unable_to_determine', evidence: null } }));
    expect(check(r, 'rudy_video')).toMatchObject({ status: 'yes', validation_note: 'code_detected_shared_audio' });
  });
  it('never marks video as skipped when the transcript has no shared audio', () => {
    const tx = transcript({ [T.video]: `${REP}: Let me tell you about the license in my own words.`, [T.videoEnd]: `${REP}: That is the overview.` });
    const r = score(assessment({}, { rudy_video: { status: 'unable_to_determine', evidence: null }, assumptive_close_after_video: { status: 'not_applicable', evidence: null, reason: 'No video.' } }), build(tx));
    expect(check(r, 'rudy_video').status).toBe('unable_to_determine');
  });
});

describe('v3 assumptive close', () => {
  it('counts a grounded assumptive move as a close and suppresses a contradictory no_close_attempt cap', () => {
    const a = assessment({ critical_events: [{ type: 'no_close_attempt', reason: 'No literal question.', evidence: ev(T.passive), counterevidence_checked: true }] });
    const r = score(a);
    expect(r.current_call_score.applied_critical_events).toEqual([]);
    expect(r.validation.warnings).toContain('ignored_contradictory_critical_event:no_close_attempt');
    expect(r.current_call_score.cap).toBeNull();
    expect(r.current_call_score.dimensions.close_mechanics_and_momentum.band).toBe('strong');
  });
  it('gives the adequate floor to assumptive close plus agreed follow-up with no literal ask', () => {
    const a = assessment();
    a.parsed_json.manager_score.dimensions.close_mechanics_and_momentum.band = 'attempted';
    const r = score(a);
    expect(r.current_call_score.dimensions.close_mechanics_and_momentum.band).toBe('adequate');
    expect(r.validation.warnings).toContain('calibrated_close_floor:attempted_to_adequate');
  });
  it('rejects a passive question as an assumptive close and applies the attempted ceiling', () => {
    const a = assessment({}, { assumptive_close_after_video: { status: 'yes', evidence: ev(T.passive), reason: 'Asked for thoughts.' } });
    const r = score(a);
    expect(check(r, 'assumptive_close_after_video')).toMatchObject({ status: 'no', validation_note: 'passive_question_is_not_assumptive' });
    expect(r.current_call_score.dimensions.close_mechanics_and_momentum.band).toBe('attempted');
    expect(r.validation.warnings).toContain('calibrated_close_ceiling:no_direct_ask_or_close_action');
  });
  it('does not accept prospect speech as the rep assuming the sale', () => {
    const a = assessment({}, { assumptive_close_after_video: { status: 'yes', evidence: ev(T.objection), reason: 'x' } });
    const r = score(a);
    expect(check(r, 'assumptive_close_after_video').status).toBe('unable_to_determine');
    expect(r.current_call_score.dimensions.close_mechanics_and_momentum.band).toBe('attempted');
  });
});

describe('v3 ceilings from the procedure', () => {
  it('limits objection handling to attempted when four options are dumped', () => {
    const a = assessment({}, { payment_options: { status: 'no', options: [{ label: '4 x $3,000', evidence: ev(T.opt1) }, { label: '3 x $4,000', evidence: ev(T.opt2) }, { label: '2 x $6,000', evidence: ev(T.opt3) }, { label: 'pay in full $12,000', evidence: ev(T.opt4) }, { label: '4 x $3,000 again', evidence: ev(T.opt1) }], offered_before_value: false, evidence: ev(T.opt1) } });
    const r = score(a);
    expect(check(r, 'more_than_3_payment_options')).toMatchObject({ status: 'yes' });
    expect(check(r, 'payment_options_appropriate').validation_note).toContain('4 distinct option(s)');
    expect(r.current_call_score.dimensions.objection_handling.band).toBe('attempted');
    expect(r.validation.warnings).toContain('v3_procedure_ceiling:objection_handling:attempted');
  });
  it('limits objection handling to adequate when payment options came before value', () => {
    const a = assessment({}, { payment_options: { status: 'no', options: [{ label: '4 x $3,000', evidence: ev(T.opt1) }], offered_before_value: true, evidence: ev(T.opt1) } });
    const r = score(a);
    expect(r.current_call_score.dimensions.objection_handling.band).toBe('adequate');
  });
  it('limits frame to adequate for a long greenlight unless the prospect drove it', () => {
    const long = assessment({}, { greenlight: { start_timestamp: T.glStart, end_timestamp: T.longGl, prospect_driven_extension: false, reason: 'long' } });
    const r = score(long);
    expect(check(r, 'greenlight_duration').status).toBe('11.5');
    expect(check(r, 'greenlight_under_10').status).toBe('no');
    expect(r.current_call_score.dimensions.frame_and_control.band).toBe('adequate');
    const driven = assessment({}, { greenlight: { start_timestamp: T.glStart, end_timestamp: T.longGl, prospect_driven_extension: true, reason: 'prospect' } });
    expect(score(driven).current_call_score.dimensions.frame_and_control.band).toBe('strong');
  });
  it('blocks an exemplary frame when no disclosure exists', () => {
    const tx = transcript({ [T.disclosure]: `${REP}: Great to see you again, how has your week been going so far?` });
    const a = assessment({}, { recording_disclosure: { status: 'no', evidence: null } });
    a.parsed_json.manager_score.dimensions.frame_and_control.band = 'exemplary';
    const r = score(a, build(tx));
    expect(check(r, 'recording_disclosure').status).toBe('no');
    expect(r.current_call_score.dimensions.frame_and_control.band).toBe('strong');
  });
  it('leaves weights, bands, caps and the composite arithmetic unchanged', () => {
    const r = score(assessment());
    expect(r.current_call_score.uncapped_score).toBe(76);
    expect(r.current_call_score.score).toBe(76);
    const capped = assessment({ critical_events: [{ type: 'abandoned_primary_objection', reason: 'left it', evidence: ev(T.objection), counterevidence_checked: true }] });
    expect(score(capped).current_call_score.score).toBe(59);
  });
});

describe('v3 outcome classification', () => {
  it('prefers verified signals over the model label', () => {
    expect(lib.v3Outcome({ payment_or_deposit_confirmed: { present: true } }, { classification: 'declined' }).classification).toBe('closed_on_call');
    expect(lib.v3Outcome({ payment_or_deposit_action: { present: true } }, {}).classification).toBe('payment_path_offered');
    expect(lib.v3Outcome({ payment_or_deposit_action: { present: true }, specific_followup_agreed: { present: true } }, {}).classification).toBe('follow_up_agreed');
    expect(lib.v3Outcome({ agreement_confirmed: { present: true } }, {}).classification).toBe('agreement_pending_payment');
    expect(lib.v3Outcome({}, { classification: 'declined', reason: 'no' })).toMatchObject({ classification: 'declined', basis: 'model_classification' });
    expect(lib.v3Outcome({}, { classification: 'closed_on_call' }).classification).toBe('no_decision');
  });
});

describe('v3 factual checker integration', () => {
  const claimsFor = (a: any) => {
    const m = a.parsed_json.manager_score; const claims: any[] = [];
    for (const [k, d] of Object.entries<any>(m.dimensions)) claims.push({ id: 'dimension.' + k, kind: 'text', text: d.reason });
    for (const [k, d] of Object.entries<any>(m.close_signals)) claims.push({ id: 'signal.' + k, kind: 'boolean', text: k, draft_value: d.present });
    claims.push({ id: 'review.reason', kind: 'text', text: m.review.reason });
    for (const [k, def] of Object.entries<any>(lib.V3_CHECKED_PROCEDURE)) { const st = String(m.procedure[k]?.status || '').toLowerCase(); if (st === 'yes' || st === 'no') claims.push({ id: 'proc.' + k, kind: 'boolean', text: def.text, draft_value: st === 'yes' }); }
    return claims;
  };
  const turnOf = (b: any, ts: string) => 'T' + String(b.transcript.split('\n').findIndex((l: string) => l.startsWith(ts)) + 1).padStart(4, '0');
  it('the checker claim builder in the built node emits procedure claims', () => {
    const code = dist('scorer.build-bounded-fact-check');
    expect(code).toContain("claims.push({id:'proc.'+k");
  });
  it('a contradicted non-scoring item flips directly; a scoring item waits for reassessment', () => {
    const a = assessment(); const b = build(); const claims = claimsFor(a);
    const checks = claims.map((c) => ({ id: c.id, status: 'supported', explanation: '', corrected_text: null, verified_value: c.kind === 'boolean' ? c.draft_value : null, evidence_ids: c.id.startsWith('dimension.') ? [turnOf(b, T.frame)] : c.id.startsWith('signal.') && c.draft_value ? [turnOf(b, T.followup)] : [], counterevidence_ids: [] }));
    const welcome = checks.find((c) => c.id === 'proc.welcome_email_explained'); expect(welcome).toBeUndefined(); // not_applicable items are not claimed
    const video = checks.find((c) => c.id === 'proc.rudy_video')!; video.status = 'contradicted'; video.verified_value = false; video.evidence_ids = [turnOf(b, T.frame)];
    const assume = checks.find((c) => c.id === 'proc.assumptive_close_after_video')!; assume.status = 'contradicted'; assume.verified_value = false; assume.evidence_ids = [turnOf(b, T.passive)];
    const p = lib.prepare(a, b, { claims, checks });
    expect(p.manager.procedure.rudy_video).toMatchObject({ status: 'no', checker_corrected: true });
    expect(p.manager.procedure.assumptive_close_after_video.status).toBe('yes');
    expect(p.affected_dimensions).toContain('close_mechanics_and_momentum');
    expect(p.decisions.map((d: any) => d.id)).toEqual(['proc.assumptive_close_after_video']);
    const review = { decisions: [{ claim_id: 'proc.assumptive_close_after_video', accepted: true, explanation: 'passive question only' }], dimensions: [{ name: 'close_mechanics_and_momentum', band: 'attempted', reason: 'No assumptive move or ask.', evidence_id: turnOf(b, T.passive), counterevidence_ids: [] }], signals: [], events: [], review_reason: null };
    const scoped = lib.acceptedReviewScope(a, b, { claims, checks }, review);
    expect(scoped.dimensions.map((d: any) => d.name)).toEqual(['close_mechanics_and_momentum']);
    const applied = lib.apply(a, b, { claims, checks }, scoped);
    expect(applied.parsed_json.manager_score.procedure.assumptive_close_after_video.status).toBe('no');
    const r = lib.reviewedValidate(applied, b)[0].json;
    expect(r.validation.valid).toBe(true);
    expect(r.current_call_score.dimensions.close_mechanics_and_momentum.band).toBe('attempted');
    expect(check(r, 'assumptive_close_after_video').status).toBe('no');
  });
  it('a rejected procedure correction leaves the original item intact', () => {
    const a = assessment(); const b = build(); const claims = claimsFor(a);
    const checks = claims.map((c) => ({ id: c.id, status: 'supported', explanation: '', corrected_text: null, verified_value: c.kind === 'boolean' ? c.draft_value : null, evidence_ids: c.id.startsWith('dimension.') ? [turnOf(b, T.frame)] : c.id.startsWith('signal.') && c.draft_value ? [turnOf(b, T.followup)] : [], counterevidence_ids: [] }));
    const disc = checks.find((c) => c.id === 'proc.recording_disclosure')!; disc.status = 'contradicted'; disc.verified_value = false; disc.evidence_ids = [turnOf(b, T.frame)];
    const audit = { claims, checks };
    const review = { decisions: [{ claim_id: 'proc.recording_disclosure', accepted: false, explanation: 'disclosure is present' }], dimensions: [], signals: [], events: [], review_reason: null };
    const applied = lib.apply(a, b, audit, lib.acceptedReviewScope(a, b, audit, review));
    expect(applied.parsed_json.manager_score.procedure.recording_disclosure.status).toBe('yes');
  });
});

describe('v3 persistence node', () => {
  const persist = new Function('$json', dist('persist.build-immutable-call-2-score-record'));
  it('accepts v3, stores the checklist and the outcome, and keeps the immutable identity', () => {
    const r = score(assessment());
    const out = persist({ result: r, call: { source_record_id: 'recFixture', rep_email: 'tara@example.com', rep_name: REP, call_date: '2026-09-18T15:00:00.000Z' }, transcript: build().transcript, write_enabled: false })[0].json;
    expect(out.route).toBe('scored');
    expect(out.assessmentId).toBe('magic-mike-call2-evidence-score-v3:recFixture');
    const checks = JSON.parse(out.scoreFields['Behaviour Checks JSON']);
    expect(checks).toHaveLength(15);
    expect(checks[0]).toMatchObject({ name: 'recording_disclosure', status: 'yes' });
    expect(JSON.parse(out.scoreFields['Call Context JSON']).outcome).toMatchObject({ classification: 'follow_up_agreed' });
    expect(out.scoreFields['Scorer Version']).toBe('magic-mike-call2-evidence-score-v3');
  });
  it('still rejects unknown versions and invalid scores', () => {
    expect(persist({ result: { score_version: 'magic-mike-call2-evidence-score-v9', validation: { valid: true }, current_call_score: { eligible: true, score: 50 } }, call: { source_record_id: 'x' }, write_enabled: false })[0].json.route).toBe('not_scored');
  });
});
