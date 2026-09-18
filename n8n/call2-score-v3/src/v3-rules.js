// ---- Call 2 scorer v3: Raul procedure rubric (September 2026) ----
// Appended to the shared scorer library inside every v3 Code node. Plain
// functions only; no imports. Evidence is always resolved against the actual
// transcript before it is trusted, exactly like the dimension evidence.
const V3_SCORE_VERSION = 'magic-mike-call2-evidence-score-v3';
const V3_REVIEW_REVISION = 'raul-procedure-2026-09-18';
const V3_BAND_ORDER = ['absent', 'attempted', 'adequate', 'strong', 'exemplary'];
const V3_STATUSES = ['yes', 'no', 'not_applicable', 'unable_to_determine'];
const V3_PROCEDURE_LABELS = {
  recording_disclosure: 'Recording disclosure',
  greenlight_duration: 'Greenlight duration (minutes)',
  greenlight_under_10: 'Greenlight under 10 minutes',
  greenlight_screen_share: 'Greenlight screen share',
  rudy_video: 'Rudy video played/shared',
  assumptive_close_after_video: 'Assumptive close after video',
  objection_occurred: 'Objection occurred',
  value_reestablished: 'Re-established prospect value',
  prospect_specific_urgency: 'Created prospect-specific urgency',
  payment_options_appropriate: 'Payment solutions offered appropriately',
  more_than_3_payment_options: 'More than 3 payment options offered',
  concrete_next_step: 'Concrete next step secured',
  onboarding_call_booked: 'Onboarding call booked',
  welcome_email_explained: 'Welcome email/next steps explained',
  prospect_verbalized_value: 'Prospect verbalized their own value',
};
// Boolean procedure items the factual checker verifies. The three that move a
// ceiling go through reassessment decisions; the rest accept the grounded
// checker verdict directly because they never change a band.
const V3_CHECKED_PROCEDURE = {
  recording_disclosure: { text: 'Near the start the rep disclosed that the call is recorded for quality, training or compliance purposes.', affects: 'frame_and_control' },
  rudy_video: { text: "Rudy's licensing video was played or shared during this call.", affects: null },
  assumptive_close_after_video: { text: "Right after Rudy's video ended, the rep moved the prospect into the enrollment or payment process as the next action (assumed the sale) instead of waiting for the prospect or asking a passive opinion question.", affects: 'close_mechanics_and_momentum' },
  objection_occurred: { text: 'The prospect raised a genuine objection or hesitation about proceeding.', affects: null },
  value_reestablished: { text: 'After an objection, the rep reconnected the prospect to why they applied or wanted to be on the show before discussing payment logistics.', affects: 'objection_handling' },
  prospect_verbalized_value: { text: 'The prospect stated the value of the opportunity in their own words after the rep prompted for it.', affects: null },
  prospect_specific_urgency: { text: "The rep created urgency tied to something this prospect said (goal, timeline, business stage) or to a real stated deadline, rather than generic pressure.", affects: null },
  onboarding_call_booked: { text: 'The onboarding call was booked or confirmed on this call.', affects: null },
  welcome_email_explained: { text: 'The rep told the prospect a welcome or onboarding email with next steps is coming.', affects: null },
};

function v3TimestampMs(value) {
  const match = String(value || '').match(/(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?/);
  if (!match) return null;
  return ((Number(match[1]) * 60 + Number(match[2])) * 60 + Number(match[3])) * 1000 + Number(String(match[4] || '0').padEnd(3, '0'));
}
function v3Lines(transcript) {
  const source = String(transcript || '').split(/Full Transcript\s*\n/).pop();
  return [...source.matchAll(/^\[([^\]]+)\]\s*([^:\n]+):\s*(.*)$/gm)].map((m) => ({ timestamp: '[' + m[1] + ']', ms: v3TimestampMs(m[1]), speaker: m[2].trim(), text: m[3] }));
}
function v3Excerpt(text, words = 8) {
  const tokens = String(text || '').trim().split(/\s+/).filter(Boolean);
  return tokens.slice(0, Math.max(5, Math.min(words, tokens.length))).join(' ');
}
function v3LineExists(lines, timestamp) {
  const wanted = String(timestamp || '').replace(/^\[|\]$/g, '');
  return wanted ? lines.find((line) => line.timestamp === '[' + wanted + ']') || null : null;
}
// Zoom labels played media as "Audio shared by <name>". Rudy's recorded voice
// carries recognizable phrases. Code detection only ever adds certainty; it
// never marks a video as skipped.
function v3DetectVideo(lines) {
  const shared = lines.filter((line) => /^(audio shared|shared audio|video)/i.test(line.speaker));
  const rudyLines = shared.filter((line) => /\b(this is rudy|i'?m rudy|hello,? it'?s rudy|congrats on being greenlit|how the licensing works|license fee|licensing)\b/i.test(line.text));
  const anchor = rudyLines[0] || shared[0] || null;
  if (!anchor) return { status: 'unable_to_determine', start: null, end: null, evidence: null };
  const last = shared[shared.length - 1];
  return { status: 'yes', start: anchor.timestamp, end: last.timestamp, evidence: { timestamp: anchor.timestamp, speaker: anchor.speaker, quote: v3Excerpt(anchor.text) } };
}
function v3DetectDisclosure(lines, repKey) {
  const cutoff = lines.length ? Math.max(20, Math.floor(lines.length * 0.35)) : 0;
  for (const line of lines.slice(0, cutoff)) {
    if (repKey && speakerKey(line.speaker) !== repKey && speakerKey(line.speaker).split(' ')[0] !== repKey.split(' ')[0]) continue;
    if (/\brecord(ed|ing)\b/i.test(line.text) && /\b(quality|training|compliance|assurance|purposes?|consent|okay with that|is that okay|is that alright)\b/i.test(line.text)) {
      return { timestamp: line.timestamp, speaker: line.speaker, quote: v3Excerpt(line.text) };
    }
  }
  return null;
}
function v3Status(value, allowed) {
  let status = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (['n_a', 'na', 'not_applicable', 'notapplicable'].includes(status)) status = 'not_applicable';
  if (['unable', 'unknown', 'undetermined', 'unable_to_determine', 'cannot_determine'].includes(status)) status = 'unable_to_determine';
  // A graded answer (attempted, partial, weak, generic) means the step was not
  // completed as trained; the checklist is binary on purpose.
  if (['attempted', 'partial', 'partially', 'weak', 'generic', 'incomplete'].includes(status)) status = allowed.includes('no') ? 'no' : status;
  return allowed.includes(status) ? status : null;
}
// Build the fourteen-item checklist plus the facts the ceilings need. `resolve`
// is the validator's evidence resolver (quote must exist on the transcript line).
function v3Procedure(a, build, signals, resolve) {
  const procedure = a && a.procedure && typeof a.procedure === 'object' ? a.procedure : {};
  const lines = v3Lines(build.transcript);
  const repKey = speakerKey(build.metadata && build.metadata.rep_name);
  const notes = [];
  const checks = [];
  const facts = { assumptiveClose: false, disclosure: null, greenlightMinutes: null, greenlightUnder10: null, prospectDriven: false, objection: null, paymentOptionsCount: 0, offeredBeforeValue: false, videoStatus: 'unable_to_determine' };
  const groundedEvidence = (evidence, requireRep = false) => {
    if (!evidence || !evidence.quote) return null;
    const resolved = resolve(evidence, build.transcript);
    if (!resolved) return null;
    const line = v3LineExists(lines, resolved.timestamp);
    const speaker = line ? line.speaker : '';
    if (requireRep && !(line && isRepSpeaker(speaker, build, v3Turns(lines)))) return null;
    return { timestamp: resolved.timestamp, speaker, quote: resolved.quote };
  };
  const push = (name, status, evidence, note = '') => {
    checks.push({ name, label: V3_PROCEDURE_LABELS[name] || name, status, timestamp: evidence ? evidence.timestamp : '', speaker: evidence ? evidence.speaker : '', quote: evidence ? evidence.quote : '', validation_note: note });
  };
  const item = (name, allowed = V3_STATUSES, requireRep = false) => {
    const raw = procedure[name] || {};
    let status = v3Status(raw.status, allowed);
    let note = status ? '' : 'model_status_missing';
    if (!status) status = 'unable_to_determine';
    let evidence = null;
    if (status === 'yes' || status === 'no') {
      evidence = groundedEvidence(raw.evidence, requireRep);
      if (!evidence && raw.evidence) { note = requireRep ? 'evidence_not_rep_speech_or_not_found' : 'evidence_not_found_in_transcript'; }
    }
    return { status, evidence, note, raw };
  };

  // 1. Recording disclosure: model claim, verified; code can supply a grounded line when the model missed it.
  const disclosure = item('recording_disclosure', ['yes', 'no']);
  const codeDisclosure = v3DetectDisclosure(lines, repKey);
  if (disclosure.status === 'yes' && disclosure.evidence) {
    const line = v3LineExists(lines, disclosure.evidence.timestamp);
    if (!(line && /\brecord(ed|ing)\b/i.test(line.text))) { disclosure.evidence = null; disclosure.note = 'cited_line_does_not_mention_recording'; }
  }
  if (disclosure.status === 'yes' && !disclosure.evidence && codeDisclosure) { disclosure.evidence = codeDisclosure; disclosure.note = 'code_located_disclosure_line'; }
  if (disclosure.status === 'no' && codeDisclosure) { disclosure.status = 'yes'; disclosure.evidence = codeDisclosure; disclosure.note = 'code_found_disclosure_model_missed'; }
  if (disclosure.status === 'yes' && !disclosure.evidence) { disclosure.status = 'unable_to_determine'; disclosure.note = disclosure.note || 'unverified_yes_downgraded'; }
  facts.disclosure = disclosure.status === 'yes' ? true : disclosure.status === 'no' ? false : null;
  push('recording_disclosure', disclosure.status, disclosure.evidence, disclosure.note);

  // 2. Greenlight duration from model-marked boundaries that must exist in the transcript.
  const gl = procedure.greenlight || {};
  const video = v3DetectVideo(lines);
  const start = v3LineExists(lines, gl.start_timestamp);
  const endCandidate = v3LineExists(lines, gl.end_timestamp) || (video.start ? v3LineExists(lines, video.start) : null);
  facts.prospectDriven = gl.prospect_driven_extension === true;
  if (start && endCandidate && endCandidate.ms !== null && start.ms !== null && endCandidate.ms >= start.ms) {
    facts.greenlightMinutes = Math.round(((endCandidate.ms - start.ms) / 60000) * 10) / 10;
    facts.greenlightUnder10 = facts.greenlightMinutes <= 10;
    push('greenlight_duration', String(facts.greenlightMinutes), { timestamp: start.timestamp, speaker: start.speaker, quote: v3Excerpt(start.text) }, `ends ${endCandidate.timestamp}${facts.prospectDriven ? '; prospect-driven extension reported' : ''}`);
    push('greenlight_under_10', facts.greenlightUnder10 ? 'yes' : 'no', null, facts.prospectDriven && !facts.greenlightUnder10 ? 'prospect_driven_extension' : '');
  } else {
    push('greenlight_duration', 'unable_to_determine', null, 'segment_boundaries_not_located');
    push('greenlight_under_10', 'unable_to_determine', null, 'segment_boundaries_not_located');
  }

  // 3. Screen share: only an explicit spoken statement can support yes.
  const share = item('greenlight_screen_share');
  if (share.status === 'yes' && !(share.evidence && /\b(shar(e|ing)|screen)\b/i.test(share.evidence.quote))) { share.status = 'unable_to_determine'; share.note = 'screen_share_not_observable_in_transcript'; share.evidence = null; }
  if (share.status === 'no') { share.status = 'unable_to_determine'; share.note = 'screen_share_not_observable_in_transcript'; share.evidence = null; }
  push('greenlight_screen_share', share.status, share.evidence, share.note);

  // 4. Rudy's video: code detection can upgrade to yes; a model "no" contradicted by shared audio becomes yes.
  const rv = item('rudy_video');
  let videoStatus = rv.status; let videoEvidence = rv.evidence; let videoNote = rv.note;
  if (video.status === 'yes' && videoStatus !== 'yes') { videoStatus = 'yes'; videoEvidence = video.evidence; videoNote = rv.status === 'no' ? 'shared_audio_contradicts_model_no' : 'code_detected_shared_audio'; }
  if (videoStatus === 'yes' && !videoEvidence) { videoStatus = 'unable_to_determine'; videoNote = 'unverified_yes_downgraded'; }
  facts.videoStatus = videoStatus;
  push('rudy_video', videoStatus, videoEvidence, videoNote);

  // 5. Assumptive close: rep speech only. This is the one procedural item that
  //    changes the close requirement, so it is held to the same standard as a direct ask.
  const ac = item('assumptive_close_after_video', V3_STATUSES, true);
  if (ac.status === 'yes' && !ac.evidence) { ac.status = 'unable_to_determine'; ac.note = ac.note || 'unverified_yes_downgraded'; }
  if (ac.status === 'yes' && /^(what (did|do) you think|what are your thoughts|how are you feeling)/i.test(ac.evidence.quote)) { ac.status = 'no'; ac.note = 'passive_question_is_not_assumptive'; }
  facts.assumptiveClose = ac.status === 'yes';
  push('assumptive_close_after_video', ac.status, ac.evidence, ac.note);

  // 6. Objection occurred, value re-established, prospect verbalized value.
  const ob = item('objection_occurred', ['yes', 'no']);
  if (ob.status === 'yes' && !ob.evidence) { ob.status = 'unable_to_determine'; ob.note = ob.note || 'unverified_yes_downgraded'; }
  facts.objection = ob.status === 'yes' ? true : ob.status === 'no' ? false : null;
  push('objection_occurred', ob.status, ob.evidence, ob.note);
  for (const name of ['value_reestablished', 'prospect_verbalized_value', 'prospect_specific_urgency']) {
    const it = item(name);
    if (facts.objection === false && it.status !== 'not_applicable' && name !== 'prospect_specific_urgency') { it.status = 'not_applicable'; it.note = 'no_objection_occurred'; it.evidence = null; }
    if (it.status === 'yes' && !it.evidence) { it.status = 'unable_to_determine'; it.note = it.note || 'unverified_yes_downgraded'; }
    if (name === 'prospect_specific_urgency' && it.status === 'yes' && it.evidence && /\b(only|last|final) (spot|seat|slot)s?\b|\bprices? (go|goes) up\b|\bexpires? (tonight|today)\b/i.test(it.evidence.quote) && !/\b(cohort|sunday|deadline|week)\b/i.test(it.evidence.quote)) { it.note = 'possible_generic_scarcity_review'; }
    push(name, it.status, it.evidence, it.note);
  }

  // 7. Payment options: count distinct grounded options; flag more than three.
  const po = procedure.payment_options || {};
  const options = Array.isArray(po.options) ? po.options : [];
  const seen = new Set(); const seenLines = new Set(); const grounded = [];
  for (const option of options) {
    const ev = groundedEvidence(option && option.evidence, false);
    const label = String(option && option.label || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
    // One transcript line is one option, however it is labelled; restating a structure is not a new option.
    if (!ev || !label || seen.has(label) || seenLines.has(ev.timestamp)) continue;
    seen.add(label); seenLines.add(ev.timestamp); grounded.push({ label: String(option.label), evidence: ev });
  }
  facts.paymentOptionsCount = grounded.length;
  facts.offeredBeforeValue = po.offered_before_value === true && facts.objection !== false;
  const poStatus = v3Status(po.status, V3_STATUSES) || (grounded.length ? 'unable_to_determine' : 'not_applicable');
  push('payment_options_appropriate', poStatus, grounded[0] ? grounded[0].evidence : null, grounded.length ? `${grounded.length} distinct option(s)${facts.offeredBeforeValue ? '; offered before value was re-established' : ''}` : (poStatus === 'not_applicable' ? 'no_payment_structure_discussion' : ''));
  push('more_than_3_payment_options', grounded.length ? (grounded.length > 3 ? 'yes' : 'no') : 'not_applicable', grounded.length > 3 ? grounded[3].evidence : null, grounded.length ? grounded.map((o) => o.label).join(' | ') : '');

  // 8. Concrete next step from verified close signals.
  const sig = signals || {};
  const nextStep = !!(sig.specific_followup_agreed && sig.specific_followup_agreed.present) || !!(sig.payment_or_deposit_action && sig.payment_or_deposit_action.present) || !!(sig.agreement_confirmed && sig.agreement_confirmed.present) || !!(sig.onboarding_or_handoff_confirmed && sig.onboarding_or_handoff_confirmed.present);
  const nextEvidence = ['specific_followup_agreed', 'payment_or_deposit_action', 'agreement_confirmed', 'onboarding_or_handoff_confirmed'].map((k) => sig[k] && sig[k].present && sig[k].evidence).find(Boolean) || null;
  push('concrete_next_step', nextStep ? 'yes' : 'no', nextEvidence ? { timestamp: nextEvidence.timestamp, speaker: nextEvidence.speaker || '', quote: nextEvidence.quote } : null, 'derived_from_verified_close_signals');

  // 9. Handoff items apply only when the prospect moved forward.
  const enrolled = !!(sig.payment_or_deposit_confirmed && sig.payment_or_deposit_confirmed.present) || !!(sig.agreement_confirmed && sig.agreement_confirmed.present) || !!(sig.payment_or_deposit_action && sig.payment_or_deposit_action.present);
  for (const name of ['onboarding_call_booked', 'welcome_email_explained']) {
    const it = item(name);
    if (!enrolled && it.status === 'no') { it.status = 'not_applicable'; it.note = 'prospect_did_not_move_forward'; it.evidence = null; }
    if (it.status === 'yes' && !it.evidence) { it.status = 'unable_to_determine'; it.note = it.note || 'unverified_yes_downgraded'; }
    push(name, it.status, it.evidence, it.note);
  }
  return { checks, facts, notes };
}
function v3Turns(lines) { return lines.map((line, index) => ({ id: 'T' + String(index + 1).padStart(4, '0'), timestamp: line.timestamp, speaker: line.speaker, text: line.text })); }
function v3MinBand(current, ceiling) {
  return V3_BAND_ORDER.indexOf(current) > V3_BAND_ORDER.indexOf(ceiling) ? ceiling : current;
}
// Deterministic ceilings from Raul's guidance. Returns {dimension: {ceiling, reason}}.
function v3Ceilings(facts) {
  const out = {};
  // Raul: a greenlight "materially exceeding 10 minutes" without a prospect-driven
  // reason lowers Frame. The checklist reports under/over 10; the ceiling applies
  // from 12 minutes so a borderline review is shown but not penalized.
  if (facts.greenlightMinutes !== null && facts.greenlightMinutes > 12 && !facts.prospectDriven) out.frame_and_control = { ceiling: 'adequate', reason: `Greenlight review ran ${facts.greenlightMinutes} minutes without a prospect-driven reason; Frame and Control is limited to adequate.` };
  else if (facts.disclosure === false) out.frame_and_control = { ceiling: 'strong', reason: 'No recording disclosure was found; Frame and Control cannot be exemplary.' };
  if (facts.objection !== false && facts.paymentOptionsCount > 3) out.objection_handling = { ceiling: 'attempted', reason: `${facts.paymentOptionsCount} distinct payment options were offered before a resolution check; Objection Handling is limited to attempted.` };
  // Naming one payment structure as the normal close path is never penalized
  // (Raul); the value-first rule bites when the rep answers an objection with plans.
  else if (facts.offeredBeforeValue && facts.paymentOptionsCount >= 2) out.objection_handling = { ceiling: 'adequate', reason: 'Payment options were offered before value was re-established; Objection Handling is limited to adequate.' };
  return out;
}
function v3Outcome(signals, modelOutcome) {
  const sig = signals || {}; const present = (k) => !!(sig[k] && sig[k].present);
  const model = modelOutcome && typeof modelOutcome === 'object' ? modelOutcome : {};
  const reason = String(model.reason || '').slice(0, 300);
  if (present('payment_or_deposit_confirmed')) return { classification: 'closed_on_call', reason: reason || 'Payment or deposit confirmed on the call.', basis: 'verified_signal' };
  if (present('agreement_confirmed')) return { classification: 'agreement_pending_payment', reason: reason || 'Prospect agreed to proceed; payment not confirmed in the transcript.', basis: 'verified_signal' };
  if (present('specific_followup_agreed')) return { classification: 'follow_up_agreed', reason: reason || 'A specific follow-up was agreed without a decision.', basis: 'verified_signal' };
  const cls = String(model.classification || '').toLowerCase();
  if (cls === 'declined') return { classification: 'declined', reason: reason || 'Prospect declined or could not proceed.', basis: 'model_classification' };
  // The payment_or_deposit_action signal also covers a proposed payment path, so it never means money changed hands.
  if (present('payment_or_deposit_action')) return { classification: 'payment_path_offered', reason: reason || 'A payment path was proposed or started; no agreement, decline or dated follow-up was reached.', basis: 'verified_signal' };
  return { classification: 'no_decision', reason: reason || 'The call ended without agreement, decline or a specific continuation.', basis: cls ? 'model_classification' : 'default' };
}
