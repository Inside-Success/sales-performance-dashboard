const root = $json || {};
const result = root.result && typeof root.result === 'object' ? root.result : {};
const call = root.call && typeof root.call === 'object' ? root.call : (result.call || {});
const score = result.current_call_score || {};
if (result.validation?.valid !== true || score.eligible !== true || !Number.isFinite(Number(score.score))) {
  return [{ json: { route:'not_scored', write_enabled:false, reason:result.validation?.errors?.[0] || score.reason || 'invalid_score' } }];
}
const scorerVersion = String(result.score_version || '');
if (!['magic-mike-call2-evidence-score-v1','magic-mike-call2-evidence-score-v2'].includes(scorerVersion)) return [{json:{route:'not_scored',write_enabled:false,reason:'unsupported_scorer_version'}}];
const sourceId = String(call.source_record_id || call.meeting_id || '').trim();
if (!sourceId) return [{ json: { route:'not_scored', write_enabled:false, reason:'missing_source_identity' } }];
const assessmentId = scorerVersion + ':' + sourceId;
const transcript = String(root.transcript || call.transcript || '');
const speakerAt = (timestamp) => {
  const line = transcript.split(/\r?\n/).find((entry) => entry.includes(String(timestamp || ''))) || '';
  const match = line.match(/^\[[^\]]+\]\s*([^:]+):/);
  return match ? match[1].trim() : '';
};
const labels = {
  frame_and_control:'Frame and control',
  prospect_read_and_tailoring:'Prospect read and tailoring',
  objection_handling:'Objection handling',
  close_mechanics_and_momentum:'Close mechanics and momentum'
};
const bandPoints = { absent:10, attempted:32, adequate:55, strong:76, exemplary:93 };
const dimensions = Object.entries(score.dimensions || {}).map(([key, item]) => {
  const evidence = item?.evidence ? [{ timestamp:item.evidence.timestamp, speaker:speakerAt(item.evidence.timestamp), quote:item.evidence.quote }] : [];
  return { key, label:labels[key] || key, points:item?.band === 'not_applicable' ? null : (bandPoints[item?.band] ?? null), rating:item?.band || 'unknown', applicability:item?.band === 'not_applicable' ? 'not_applicable' : 'applicable', reason:String(item?.reason || ''), criteria:[{ id:key, label:labels[key] || key, status:item?.band || 'unknown', confidence:score.confidence || 'low', reason:String(item?.reason || ''), evidence, counterevidence:Array.isArray(item?.counterevidence) ? item.counterevidence : [] }] };
});
const critical = (score.applied_critical_events || []).map((type) => ({ label:String(type).replace(/_/g,' '), reason:String((score.critical_event_evidence || []).find(event => event.type === type)?.reason || 'Deterministic score cap applied after evidence validation.'), evidence:(score.critical_event_evidence || []).filter(event => event.type === type && event.evidence).map(event => event.evidence) }));
const coaching = result.coaching_analysis || {};
const band = Number(score.score) >= 90 ? 'Exceptional' : Number(score.score) >= 80 ? 'Strong' : Number(score.score) >= 70 ? 'Acceptable' : Number(score.score) >= 55 ? 'Weak' : Number(score.score) >= 40 ? 'Poor' : 'Serious concern';
const scoreFields = {
  'Assessment ID':assessmentId,
  'Source Record ID':sourceId,
  'Scored Rep Email':String(call.rep_email || '').toLowerCase(),
  'Scored Rep Label':String(call.rep_name || call.rep_email || 'Unknown rep'),
  'Call Type':'Call 2+',
  'Meeting Start At':String(call.call_date || ''),
  'Show Name':String(call.show_name || ''),
  'Transcript URL':String(call.transcript_url || ''),
  'Composite Score':Number(score.score),
  'Display Band':band,
  'Dimensions JSON':JSON.stringify(dimensions),
  'Behaviour Checks JSON':'[]',
  'Critical Events JSON':JSON.stringify(critical),
  'Observations JSON':'[]',
  'Call Context JSON':JSON.stringify({
    transcript_reliability:{ grade:score.confidence === 'low' ? 'limited' : 'usable', reason:'' },
    opportunity:{ classification:score.lead_context?.scoring_opportunity || 'full', reason:String(score.review?.reason || ''), correct_disposition:score.lead_context?.disposition || 'unknown' },
    outcome:{ classification:'unknown', reason:'' },
    findings:{ main_finding:coaching.one_line_verdict || '', strengths:[], improvements:[] },
    external_factors:[score.lead_context?.disposition || 'unknown'],
    validation:{ warnings:result.validation?.warnings || [] },
    material_adjudication:{ required:false, applied:false, reason:'' }
  }),
  'Internal Inconsistency':'false',
  'Scorer Version':scorerVersion,
  'Scored At':new Date().toISOString()
};
return [{ json: { route:'scored', write_enabled:root.write_enabled === true, assessmentId, scoreFields } }];
