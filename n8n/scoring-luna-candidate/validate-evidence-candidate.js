// ISOLATED EVALUATION ONLY. Not the live scorer.
function single(name) { const rows = $(name).all(); if(rows.length !== 1) throw new Error('Expected one aligned scoring item: '+name); return rows[0].json; }
function parseJson(text) {
  const source = String(text || '').trim();
  if (!source) return null;
  try { return JSON.parse(source); } catch {}
  const fenced = source.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) { try { return JSON.parse(fenced[1].trim()); } catch {} }
  const start = source.indexOf('{');
  const end = source.lastIndexOf('}');
  if (start >= 0 && end > start) { try { return JSON.parse(source.slice(start, end + 1)); } catch {} }
  return null;
}
const DIMS = ['frame_and_control','prospect_read_and_tailoring','objection_handling','close_mechanics_and_momentum'];
const SIGNALS = ['direct_commitment_ask','payment_or_deposit_action','payment_or_deposit_confirmed','agreement_confirmed','onboarding_or_handoff_confirmed','specific_followup_agreed'];
const WEIGHTS = { frame_and_control:20, prospect_read_and_tailoring:25, objection_handling:25, close_mechanics_and_momentum:30 };
const POINTS = { absent:10, attempted:32, adequate:55, strong:76, exemplary:93 };
const CAPS = { no_close_attempt:49, no_concrete_next_step:54, abandoned_primary_objection:59, lost_control_unrecovered:49, no_adaptation_after_clear_signal:64 };
const COACHING = ['one_line_verdict','biggest_strength','what_id_polish','coaching_tip','rudys_note','what_went_well','what_to_improve','why_no_close','what_made_this_close_work','objections_surfaced'];
const normalized = (value) => String(value || '').replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/\s+/g, ' ').trim().toLowerCase();
function wordTokens(value) {
  const source = String(value || '').replace(/[\u2018\u2019]/g, "'").toLowerCase();
  const tokens = [];
  const pattern = /[a-z0-9]+(?:'[a-z0-9]+)*/g;
  let match;
  while ((match = pattern.exec(source)) !== null) tokens.push({ value:match[0], start:match.index, end:pattern.lastIndex });
  return tokens;
}
function resolveEvidence(evidence, transcript, requiredSpeaker = '') {
  if (!evidence || !evidence.quote) return null;
  if(evidence.turn_id){
    const source=String(transcript).split(/Full Transcript\s*\n/).pop();
    const turns=[...source.matchAll(/^\[([^\]]+)\]\s*([^:\n]+):\s*(.*)$/gm)];
    const index=Number(String(evidence.turn_id).replace(/^T/,''))-1;
    const t=turns[index];
    if(!t || evidence.turn_id!=='T'+String(index+1).padStart(4,'0') || evidence.timestamp!=='['+t[1]+']' || evidence.quote!==t[3] || evidence.speaker!==t[2].trim() || (requiredSpeaker && normalized(requiredSpeaker)!==normalized(t[2])))return null;
    return {...evidence};
  }
  const wanted = wordTokens(evidence.quote);
  if (wanted.length < 2) return null;
  const transcriptLines = String(transcript || '').split(/\r?\n/);
  if (wanted.length < 5) {
    const shortMatches = [];
    for (const line of transcriptLines) {
      const timestamp = line.match(/\[[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?\]/);
      if (!timestamp || !line.slice(timestamp.index + timestamp[0].length).includes(':')) continue;
      const actual = wordTokens(line);
      for (let i = 0; i <= actual.length - wanted.length; i++) {
        if (!wanted.every((token, offset) => actual[i + offset].value === token.value)) continue;
        shortMatches.push({ timestamp:timestamp[0], quote:line.slice(actual[i].start, actual[i + wanted.length - 1].end) });
      }
    }
    return shortMatches.length === 1 ? shortMatches[0] : null;
  }
  for (const line of transcriptLines) {
    const timestamp = line.match(/\[[0-9]{2}:[0-9]{2}:[0-9]{2}(?:\.[0-9]{1,3})?\]/);
    if (!timestamp) continue;
    if (requiredSpeaker) {
      const spokenBy = normalized(line.slice(timestamp.index + timestamp[0].length)).split(':')[0];
      if (spokenBy !== normalized(requiredSpeaker)) continue;
    }
    const afterTimestamp = line.slice(timestamp.index + timestamp[0].length);
    if (!afterTimestamp.includes(':')) continue;
    const actual = wordTokens(line);
    const longest = Math.min(10, wanted.length);
    for (let length = longest; length >= 5; length--) {
      for (let i = 0; i <= actual.length - length; i++) {
        let same = true;
        for (let j = 0; j < length; j++) {
          if (actual[i + j].value !== wanted[j].value) { same = false; break; }
        }
        if (!same) continue;
        return { timestamp:timestamp[0], quote:line.slice(actual[i].start, actual[i + length - 1].end) };
      }
    }
    const target = wanted.slice(0, 10);
    let targetIndex = 0;
    let firstActual = -1;
    let lastActual = -1;
    for (let i = 0; i < actual.length && targetIndex < target.length; i++) {
      if (actual[i].value !== target[targetIndex].value) continue;
      if (firstActual < 0) firstActual = i;
      lastActual = i;
      targetIndex++;
    }
    const span = lastActual - firstActual + 1;
    if (targetIndex >= 5 && targetIndex / target.length >= 0.8 && span <= target.length + 2) {
      return { timestamp:timestamp[0], quote:line.slice(actual[firstActual].start, actual[lastActual].end) };
    }
  }
  return null;
}
function invalid(reason, build, provider, coaching, exclusionCategory = null, managerMessage = null) {
  const message = managerMessage || (exclusionCategory === 'excluded_post_sale_or_onboarding'
    ? 'Excluded — post-sale or onboarding call; not included in the closer score.'
    : exclusionCategory === 'excluded_scheduling_or_bridge'
      ? 'Excluded — scheduling or bridge call; not included in the closer score.'
      : 'Not scored — this call did not provide enough reliable Call 2 closing evidence.');
  const rejectedAnalysis = provider.parsed_json || parseJson(provider.model_text) || parseJson(provider.text) || parseJson(provider.body);
  const rejectedEvidence = reason.startsWith('ungrounded_dimension_evidence:')
    ? rejectedAnalysis?.manager_score?.dimensions?.[reason.split(':')[1]]?.evidence
    : /^(invalid_direct_ask_evidence|contradictory_direct_ask):/.test(reason)
      ? rejectedAnalysis?.manager_score?.close_signals?.direct_commitment_ask?.evidence : null;
  const rejectedTimestamp = resolveEvidence(rejectedEvidence, build.transcript)?.timestamp || rejectedEvidence?.timestamp;
  const sourceLine = rejectedTimestamp ? String(build.transcript || '').split(/\r?\n/).find(line => line.includes(String(rejectedTimestamp))) : null;
  const diagnostic = rejectedEvidence ? { rejected_evidence: rejectedEvidence, rejected_request_text: rejectedAnalysis?.manager_score?.close_signals?.direct_commitment_ask?.request_text || null, actual_timestamp_line: sourceLine ? sourceLine.slice(0, 4000) : null } : null;
  return [{ json: {
    preview_only:false,
    score_version:build.score_version,
    call:{ call_type:build.call_type, ...build.metadata },
    coaching_analysis:coaching,
    current_call_score:{ eligible:false, reason, exclusion_category:exclusionCategory, manager_message:message },
    provider_costs:provider.costs || null,
    validation:{ valid:false, errors:[reason], evidence_diagnostic:diagnostic },
    release_boundary:'LIVE CALL 2 COACHING + MANAGER SCORE — manager scores persist only after validation; Coaching output remains separately consumed.'
  }}];
}
const provider = $json || {};
const build = single('Build Analysis Request');
if (provider.ok === false) throw new Error('Provider failed: ' + (provider.error || 'unknown error'));
const parsedAnalysis = provider.parsed_json || parseJson(provider.model_text) || parseJson(provider.text) || parseJson(provider.body);
const analysis = parsedAnalysis ? JSON.parse(JSON.stringify(parsedAnalysis)) : null;
if (!analysis || typeof analysis !== 'object') return invalid('provider_unparseable_json', build, provider, {});
const coaching = {};
const humanSpeakers = new Set(String(build.transcript).split(/\r?\n/).map(line => line.match(/^\[[^\]]+\]\s*([^:]+):/)?.[1]?.trim().toLowerCase()).filter(name => name && !/^(audio shared|video|recording|shared audio)/.test(name)));
const explicitPractice = /\b(?:mock (?:call|summary|pitch|presentation)|role[ -]?play|rehears(?:al|ing)|practi[cs]ing (?:the|my|this) (?:script|pitch|call))\b/i.test(String(build.transcript).split(/Full Transcript\s*\n/).pop());
if(humanSpeakers.size === 1 && explicitPractice) return invalid('excluded_single_speaker_practice_evidence',build,provider,coaching,'insufficient_scoring_opportunity');
for (const field of COACHING) {
  if (!(field in analysis)) return invalid('missing_coaching_field:' + field, build, provider, coaching);
  coaching[field] = analysis[field];
}
const a = analysis.manager_score;
if (!a || typeof a !== 'object') return invalid('missing_manager_score', build, provider, coaching);
if (!a.review || typeof a.review.real_prospect_confirmed !== 'boolean' || typeof a.review.closing_stage_observable !== 'boolean') return invalid('missing_score_review', build, provider, coaching);
if(a.review.real_prospect_confirmed !== true) return invalid('excluded_rehearsal_or_unconfirmed_prospect',build,provider,coaching,'insufficient_scoring_opportunity');
if(a.review.closing_stage_observable !== true) return invalid('insufficient_scoring_opportunity',build,provider,coaching,'insufficient_scoring_opportunity');
if (a.call_phase === 'post_sale_or_onboarding') return invalid('post_sale_or_onboarding', build, provider, coaching, 'excluded_post_sale_or_onboarding');
if (a.call_phase === 'scheduling_or_bridge') return invalid('scheduling_or_bridge', build, provider, coaching, 'excluded_scheduling_or_bridge');
if (a.call_phase !== 'closing_call') return invalid(String(a.ineligible_reason || 'insufficient_call_phase'), build, provider, coaching, 'insufficient_scoring_opportunity');
if (a.eligible !== true) return invalid(String(a.ineligible_reason || 'model_marked_ineligible'), build, provider, coaching, 'model_marked_ineligible');
if (!['high','medium','low'].includes(a.confidence)) return invalid('invalid_confidence', build, provider, coaching);
if (!a.lead_context || !['full','partial'].includes(a.lead_context.scoring_opportunity)) return invalid('insufficient_scoring_opportunity', build, provider, coaching, 'insufficient_scoring_opportunity');
for(const key of ['ended_by_unrecovered_technical_failure','definitive_affordability_decline','contract_review_continuation']) if(typeof a.review[key] !== 'boolean') return invalid('missing_score_review',build,provider,coaching);
a.review.evidence_revision = 'factual-check-2026-09-10';
const evidenceWarnings = [];
const signals = {};
for (const name of SIGNALS) {
  const signal = a.close_signals && a.close_signals[name];
  if (!signal || typeof signal.present !== 'boolean') return invalid('invalid_close_signal:' + name, build, provider, coaching);
  if (signal.present) {
    const resolved = resolveEvidence(signal.evidence, build.transcript);
    if (!resolved) {
      evidenceWarnings.push('ignored_ungrounded_close_signal:' + name);
      signals[name] = { present:false, evidence:null };
      continue;
    }
    if (name === 'direct_commitment_ask') {
      const requestText = String(signal.request_text || '').trim();
      const evidenceTurn = resolved.turn_id ? resolved.quote : (String(build.transcript || '').split(/\r?\n/).find(line => line.includes(resolved.timestamp)) || '');
      if (wordTokens(requestText).length < 3 || !normalized(evidenceTurn).includes(normalized(requestText))) return invalid('invalid_direct_ask_evidence:quote_the_complete_actual_request_from_the_timestamp_turn_or_mark_false', build, provider, coaching);
    }
    signals[name] = { present:true, evidence:resolved, ...(name === 'direct_commitment_ask' ? {request_text:String(signal.request_text).trim()} : {}) };
  } else signals[name] = { present:false, evidence:null };
}
// A claimed direct ask cannot simultaneously be described as merely implicit/indirect.
const closeReason = normalized(a.dimensions?.close_mechanics_and_momentum?.reason);
if (signals.direct_commitment_ask.present && /(?:commitment|payment|deposit|decision) ask implicitly|(?:implicit|indirect|hypothetical) (?:commitment |payment |deposit |decision )?ask/.test(closeReason)) {
  return invalid('contradictory_direct_ask:implicit_or_hypothetical_is_not_an_actual_request', build, provider, coaching);
}
if(a.review.ended_by_unrecovered_technical_failure && !signals.direct_commitment_ask.present) return invalid('insufficient_scoring_opportunity',build,provider,coaching,'insufficient_scoring_opportunity');
let weighted = 0;
let applicableWeight = 0;
for (const dimension of DIMS) {
  const item = a.dimensions && a.dimensions[dimension];
  if (!item) return invalid('missing_dimension:' + dimension, build, provider, coaching);
  if(typeof item.reason !== 'string' || !item.reason.trim() || !Array.isArray(item.counterevidence)) return invalid('missing_dimension_review:' + dimension, build, provider, coaching);
  const resolvedCounterevidence = item.counterevidence.map(e => resolveEvidence(e, build.transcript));
  if (resolvedCounterevidence.some(e => !e)) return invalid('invalid_counterevidence:' + dimension, build, provider, coaching);
  item.counterevidence = resolvedCounterevidence;
  if (item.band === 'not_applicable') {
    if (dimension !== 'objection_handling') return invalid('invalid_not_applicable:' + dimension, build, provider, coaching);
    continue;
  }
  if (!(item.band in POINTS)) return invalid('invalid_band:' + dimension, build, provider, coaching);
  const resolved = resolveEvidence(item.evidence, build.transcript);
  if (!resolved) return invalid('ungrounded_dimension_evidence:' + dimension, build, provider, coaching);
  if (String(item.evidence.timestamp) !== resolved.timestamp) evidenceWarnings.push('corrected_timestamp:' + dimension);
  if (normalized(item.evidence.quote) !== normalized(resolved.quote)) evidenceWarnings.push('canonicalized_quote:' + dimension);
  item.evidence = resolved;
  let calibratedBand = item.band;
  if (dimension === 'close_mechanics_and_momentum') {
    const order = ['absent','attempted','adequate','strong','exemplary'];
    // Adequate closing requires a real ask/path, not a pricing description alone.
    const hasCloseAction = signals.direct_commitment_ask.present || signals.payment_or_deposit_action.present || signals.payment_or_deposit_confirmed.present || signals.agreement_confirmed.present || signals.onboarding_or_handoff_confirmed.present;
    if (!hasCloseAction && !a.review.definitive_affordability_decline && order.indexOf(calibratedBand) > order.indexOf('attempted')) {
      evidenceWarnings.push('calibrated_close_ceiling:no_direct_ask_or_close_action');
      calibratedBand = 'attempted';
      item.reason = signals.specific_followup_agreed.present ? 'A specific follow-up was agreed, but no direct commitment request or concrete payment/agreement action was evidenced. Close execution is limited to attempted.' : 'No direct commitment request or concrete payment/agreement action was evidenced. Close execution is limited to attempted.';
    }
    const floor = signals.payment_or_deposit_confirmed.present && signals.agreement_confirmed.present && signals.onboarding_or_handoff_confirmed.present ? 'exemplary'
      : signals.direct_commitment_ask.present && signals.specific_followup_agreed.present && (signals.payment_or_deposit_action.present || signals.agreement_confirmed.present) ? 'strong'
        : signals.direct_commitment_ask.present && signals.specific_followup_agreed.present ? 'adequate' : calibratedBand;
    if (order.indexOf(floor) > order.indexOf(calibratedBand)) {
      evidenceWarnings.push('calibrated_close_floor:' + calibratedBand + '_to_' + floor);
      calibratedBand = floor;
    }
    item.model_band = item.band;
    item.band = calibratedBand;
  }
  weighted += POINTS[calibratedBand] * WEIGHTS[dimension];
  applicableWeight += WEIGHTS[dimension];
}
if (applicableWeight < 75) return invalid('insufficient_applicable_weight', build, provider, coaching);
const events = [];
for (const event of Array.isArray(a.critical_events) ? a.critical_events : []) {
  if (!event || !(event.type in CAPS)) {
    evidenceWarnings.push('ignored_invalid_critical_event');
    continue;
  }
  if(event.counterevidence_checked !== true || typeof event.reason !== 'string' || !event.reason.trim()) { evidenceWarnings.push('ignored_unreviewed_critical_event:' + event.type); continue; }
  const resolved = resolveEvidence(event.evidence, build.transcript);
  if (!resolved) {
    evidenceWarnings.push('ignored_ungrounded_critical_event:' + event.type);
    continue;
  }
  if (String(event.evidence.timestamp) !== resolved.timestamp) evidenceWarnings.push('corrected_timestamp:critical_event:' + event.type);
  if (normalized(event.evidence.quote) !== normalized(resolved.quote)) evidenceWarnings.push('canonicalized_quote:critical_event:' + event.type);
  event.evidence = resolved;
  if ((event.type === 'no_close_attempt' && signals.direct_commitment_ask.present)
    || (event.type === 'no_concrete_next_step' && (signals.specific_followup_agreed.present || signals.payment_or_deposit_action.present))) {
    evidenceWarnings.push('ignored_contradictory_critical_event:' + event.type);
    continue;
  }
  if((event.type === 'no_concrete_next_step' && (a.review.ended_by_unrecovered_technical_failure || a.review.definitive_affordability_decline)) || (event.type === 'abandoned_primary_objection' && (a.review.contract_review_continuation || a.review.definitive_affordability_decline))) { evidenceWarnings.push('ignored_context_contradicted_cap:' + event.type); continue; }
  events.push(event.type);
}
const uncapped = Math.round((weighted / applicableWeight) * 10) / 10;
const cap = events.length ? Math.min(...events.map((type) => CAPS[type])) : null;
const score = Math.round(Math.min(uncapped, cap === null ? 100 : cap) * 10) / 10;
const repEmail = String(build.metadata?.rep_email || '').toLowerCase();
const prior = (Array.isArray(build.recent_scores) ? build.recent_scores : [])
  .filter((row) => row && typeof row === 'object')
  .filter((row) => !row.rep_email || String(row.rep_email).toLowerCase() === repEmail)
  .filter((row) => /^call\s*2$/i.test(String(row.call_type || 'Call 2')))
  .map((row) => ({ score:Number(row.score ?? row.execution_score), scored_at:row.scored_at || row.call_date || '' }))
  .filter((row) => Number.isFinite(row.score))
  .sort((x,y) => String(y.scored_at).localeCompare(String(x.scored_at)))
  .slice(0,4);
const window = [{ score, scored_at:build.metadata?.call_date || '' }, ...prior].slice(0,5);
const rolling = Math.round((window.reduce((sum,row) => sum + row.score, 0) / window.length) * 10) / 10;
const attention = rolling < 50 ? 'urgent' : rolling < 60 ? 'review' : rolling < 70 ? 'watch' : 'none';
return [{ json: {
  preview_only:false,
  score_version:build.score_version,
  call:{ call_type:build.call_type, ...build.metadata },
  context_pack:{ source:build.context_pack.source, doc_id:build.context_pack.doc_id, chars:build.context_pack.chars, fetched_at:build.context_pack.fetched_at, fetch_error:build.context_pack.fetch_error },
  coaching_analysis:coaching,
  current_call_score:{ eligible:true, score, uncapped_score:uncapped, cap, applied_critical_events:events, applicable_weight:applicableWeight, confidence:a.confidence, call_phase:a.call_phase, dimensions:a.dimensions, review:a.review, critical_event_evidence:a.critical_events, close_signals:signals, lead_context:a.lead_context },
  manager_snapshot:{ rolling_execution_score:rolling, manager_attention:attention, calls_in_window:window.length, provisional:window.length < 3, latest_execution_score:score, window },
  provider_costs:provider.costs || null,
  validation:{ valid:true, errors:[], warnings:evidenceWarnings },
  release_boundary:'LIVE CALL 2 COACHING + MANAGER SCORE — manager scores persist only after validation; Coaching output remains separately consumed.'
}}];