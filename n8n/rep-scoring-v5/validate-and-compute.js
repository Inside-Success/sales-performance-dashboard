const verifierResponse = $input.first()?.json || {};
const source = $('Prepare Verifier Request').first().json;
const fail = (reason, diagnostic) => [{ json: { ...source, route: 'quarantine', quarantineFields: {
  'Quarantine ID': 'quarantine-' + source.idempotencyKey,
  'Idempotency Key': source.idempotencyKey,
  'Source Record ID': source.sourceRecordId,
  'Automation Key': source.automationKey,
  'Call Type': source.callType,
  'Assigned Rep Email': source.repEmail,
  'Resolved Rep Label': source.resolvedRepName || '',
  'Reason': reason,
  'Diagnostic JSON': JSON.stringify({ meetingStartAt: source.meetingStartAt, sourceRecordId: source.sourceRecordId, ...(diagnostic || {}) }).slice(0, 90000),
  'Scorer Version': source.scorerVersion,
  'Quarantined At': new Date().toISOString(),
  'Resolved': 'false',
} } }];

const parseModel = (response, label) => {
  if (response?.error) throw new Error(`${label}_provider_error:${response.error.message || String(response.error)}`);
  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${label}_empty_response`);
  try { return typeof content === 'string' ? JSON.parse(content) : content; }
  catch (error) { throw new Error(`${label}_invalid_json:${error.message}`); }
};

let primary;
let verifier;
try {
  primary = parseModel(source.primaryResponse, 'primary');
  verifier = parseModel(verifierResponse, 'verifier');
} catch (error) {
  return fail('v5_model_response_invalid', { message: error.message });
}

const reliabilityGrade = String(primary?.transcript_reliability?.grade || 'unknown');
if (!['gradeable', 'partially_gradeable', 'not_gradeable'].includes(reliabilityGrade)) return fail('v5_invalid_reliability_grade', { reliabilityGrade });
const opportunityClass = String(primary?.opportunity?.classification || 'unknown');
if (!['viable', 'limited', 'not_currently_closable', 'unknown'].includes(opportunityClass)) return fail('v5_invalid_opportunity_classification', { opportunityClass });

const definitions = Array.isArray(source.checkpointDefinitions) ? source.checkpointDefinitions : [];
const requiredKeys = definitions.map(row => row.key);
const byKey = new Map((Array.isArray(primary.checkpoints) ? primary.checkpoints : []).map(row => [String(row?.key || ''), row]));
if (requiredKeys.some(key => !byKey.has(key))) return fail('v5_missing_checkpoint', { missing: requiredKeys.filter(key => !byKey.has(key)) });

const normalize = (value) => String(value || '').toLowerCase().replace(/\s+/g, ' ').replace(/[“”]/g, '"').replace(/[‘’]/g, "'").trim();
const transcriptNorm = normalize(source.transcript);
const timestampOk = (value) => /\b(?:\d{1,2}:)?\d{1,2}:\d{2}(?:\.\d+)?\b/.test(String(value || ''));
const allSpeakers = new Set((source.allSpeakerLabels || []).map(normalize));
const evidenceOk = (evidence) => {
  const quote = normalize(evidence?.quote);
  return timestampOk(evidence?.timestamp) && allSpeakers.has(normalize(evidence?.speaker)) && quote.length >= 8 && transcriptNorm.includes(quote);
};
const validEvidence = (value) => (Array.isArray(value) ? value : []).filter(evidenceOk).map(row => ({ timestamp: String(row.timestamp || ''), speaker: String(row.speaker || ''), quote: String(row.quote || '') }));

const invalidKeys = new Set(Array.isArray(verifier.invalid_checkpoint_keys) ? verifier.invalid_checkpoint_keys.map(String) : []);
const verifierWarnings = Array.isArray(verifier.warnings) ? verifier.warnings.map(String).filter(Boolean) : [];
const points = { completed: 100, partial: 60, missed: 20 };
const checkpoints = [];
let weighted = 0;
let denominator = 0;
let applicableCount = 0;
const validationWarnings = [...verifierWarnings];

for (const definition of definitions) {
  const raw = byKey.get(definition.key) || {};
  let applicability = String(raw.applicability || 'not_observable');
  let status = String(raw.status || 'not_scored');
  const evidence = validEvidence(raw.evidence);
  if (!['applicable', 'not_applicable', 'not_observable'].includes(applicability)) applicability = 'not_observable';
  if (!['completed', 'partial', 'missed'].includes(status)) status = 'not_scored';
  if (applicability === 'applicable' && (!evidence.length || invalidKeys.has(definition.key))) {
    validationWarnings.push(`${definition.key}: excluded because evidence verification did not pass.`);
    applicability = 'not_observable';
    status = 'not_scored';
  }
  const weight = Number(definition.weight) || 0;
  if (applicability === 'applicable' && points[status] !== undefined && reliabilityGrade !== 'not_gradeable') {
    weighted += points[status] * weight;
    denominator += weight;
    applicableCount += 1;
  }
  checkpoints.push({ key: definition.key, label: definition.label, weight, applicability, status, reason: String(raw.reason || ''), evidence });
}

const materiallyAccepted = verifier.accepted === true && verifier.material_disagreement !== true;
const scoreAllowed = reliabilityGrade !== 'not_gradeable' && materiallyAccepted && applicableCount >= 3 && denominator > 0;
const composite = scoreAllowed ? Math.round((weighted / denominator) * 10) / 10 : null;
if (!materiallyAccepted) validationWarnings.push(String(verifier.reason || 'Independent verifier reported a material disagreement.'));
if (reliabilityGrade !== 'not_gradeable' && applicableCount < 3) validationWarnings.push('Fewer than three evidence-verified checkpoints were observable; no numeric score was issued.');

const validateFindings = (rows) => (Array.isArray(rows) ? rows : []).flatMap(row => {
  const label = String(row?.label || '').trim();
  const evidence = validEvidence(row?.evidence);
  if (!label || !evidence.length) return [];
  return [{ label, reason: String(row?.reason || ''), evidence }];
});
const invalidFindingLabels = new Set(Array.isArray(verifier.invalid_finding_labels) ? verifier.invalid_finding_labels.map(String) : []);
const findings = primary.findings && typeof primary.findings === 'object' ? primary.findings : {};
const strengths = validateFindings(findings.strengths).filter(row => !invalidFindingLabels.has(row.label));
const improvements = validateFindings(findings.improvements).filter(row => !invalidFindingLabels.has(row.label));
const criticalFindings = validateFindings(findings.critical_findings).filter(row => !invalidFindingLabels.has(row.label));
const finalBand = composite === null ? 'Not scored — evidence limitation' : composite < 40 ? 'Unacceptable' : composite < 60 ? 'Needs Improvement' : composite < 75 ? 'Developing' : composite < 90 ? 'Meets Expectations' : 'Excellent';
const validationStatus = scoreAllowed ? 'verified' : 'needs_human_review';
const now = new Date().toISOString();
const assessmentId = 'assessment-' + source.idempotencyKey;
const context = {
  transcript_reliability: primary.transcript_reliability,
  opportunity: primary.opportunity,
  external_factors: Array.isArray(primary.external_factors) ? primary.external_factors.map(String) : [],
  findings: { main_finding: String(findings.main_finding || 'No supported priority finding.'), strengths, improvements, critical_findings: criticalFindings },
  call_context: primary.call_context || {},
  validation: { status: validationStatus, accepted: materiallyAccepted, reason: String(verifier.reason || ''), warnings: validationWarnings, invalid_checkpoint_keys: [...invalidKeys], invalid_finding_labels: [...invalidFindingLabels] },
  attribution: { assignedRepEmail: source.repEmail, assignedRepName: source.repName, resolvedRepEmail: source.resolvedRepEmail, resolvedRepName: source.resolvedRepName, substituted: Boolean(source.attributionSubstituted), method: source.speakerResolutionMethod, confidence: source.speakerResolutionConfidence, allowedSpeakerLabels: source.resolvedSpeakerLabels, diagnostic: source.speakerResolutionDiagnostic },
  source_v4_3: source.sourceV43 || {},
};
const scoreFields = {
  'Assessment ID': assessmentId,
  'Idempotency Key': source.idempotencyKey,
  'Source Base ID': source.sourceBaseId,
  'Source Table ID': source.sourceTableId,
  'Source Record ID': source.sourceRecordId,
  'Automation Key': source.automationKey,
  'Zoom Meeting UUID': source.zoomMeetingUuid,
  'Recording File ID': source.recordingFileId,
  'Transcript Google Doc ID': source.docId,
  'Transcript URL': source.transcriptUrl,
  'Meeting Start At': source.meetingStartAt,
  'Show Name': source.showName,
  'Show Family': source.showName,
  'Call Type': source.callType,
  'Call Stage': source.callType === 'Call 1' ? 'progression_decision' : 'execution_and_close',
  'Scored Rep ID': source.resolvedRepEmail,
  'Scored Rep Email': source.resolvedRepEmail,
  'Scored Rep Label': source.resolvedRepName,
  'Airtable Rep Email': source.repEmail,
  'Airtable Rep Name': source.repName,
  'Attribution Substituted': String(Boolean(source.attributionSubstituted)),
  'Speaker Resolution Method': source.speakerResolutionMethod,
  'Speaker Resolution Confidence': source.speakerResolutionConfidence,
  'Status': 'scored',
  ...(composite === null ? {} : { 'Composite Score': composite }),
  'Display Band': finalBand,
  'Dimensions JSON': JSON.stringify(checkpoints),
  'Behaviour Checks JSON': JSON.stringify([]),
  'Critical Events JSON': JSON.stringify(criticalFindings),
  'Call Context JSON': JSON.stringify(context).slice(0, 90000),
  'Observations JSON': JSON.stringify([]),
  'Evidence JSON': JSON.stringify(checkpoints.flatMap(row => row.evidence)).slice(0, 90000),
  'Raw Model Response JSON': JSON.stringify({ primary, verifier }).slice(0, 90000),
  'Applicable Dimensions': applicableCount,
  'Weight Denominator': denominator,
  'Internal Inconsistency': 'false',
  'Scorer Version': source.scorerVersion,
  'Prompt Version': source.promptVersion,
  'Rubric Version': source.rubricVersion,
  'Weights Version': source.weightsVersion,
  'Band Points Version': source.bandPointsVersion,
  'Model': source.model,
  'Model Params Hash': 'v5-calibration-primary-verifier-nonthinking-temperature0-json',
  'Config Version': source.configVersion,
  'Scored At': now,
  'Created At': now,
};
const usage = [source.primaryResponse?.usage, verifierResponse?.usage].reduce((sum, row) => ({ prompt_tokens: sum.prompt_tokens + (Number(row?.prompt_tokens) || 0), completion_tokens: sum.completion_tokens + (Number(row?.completion_tokens) || 0), total_tokens: sum.total_tokens + (Number(row?.total_tokens) || 0) }), { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 });
return [{ json: { ...source, route: 'scored', assessmentId, providerUsage: usage, scoreFields } }];
