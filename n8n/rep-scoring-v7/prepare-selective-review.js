const inbound = $input.first()?.json || {};
const source = $('Prepare V7 JSON Repair').item.json;

function parseResponse(response, label) {
  if (response?.error) throw new Error(`${label}_provider_error:${String(response.error.message || response.error)}`);
  const content = response?.choices?.[0]?.message?.content;
  if (!content) throw new Error(`${label}_empty_response`);
  return typeof content === 'string' ? JSON.parse(content) : content;
}

let assessment = source.primaryParsed;
let parseError = '';
try {
  if (source.providerError) throw new Error(source.providerError);
  if (source.needsRepair) assessment = parseResponse(inbound, 'repair');
  if (!assessment || typeof assessment !== 'object') throw new Error('assessment_not_object');
} catch (error) {
  parseError = String(error.message || error);
}

if (parseError) {
  return [{ json: { ...source, finalAssessment: null, materialReviewRequired: false, materialReviewReason: 'unavailable_primary', materialReviewParseError: parseError, repairResponse: source.needsRepair ? inbound : null } }];
}

const criteria = (Array.isArray(assessment.dimensions) ? assessment.dimensions : [])
  .flatMap((dimension) => (Array.isArray(dimension?.criteria) ? dimension.criteria.map((criterion) => ({
    dimensionKey: String(dimension?.key || ''),
    criterionId: String(criterion?.id || ''),
    status: String(criterion?.status || ''),
    reason: String(criterion?.reason || ''),
    evidence: Array.isArray(criterion?.evidence) ? criterion.evidence : [],
  })) : []));
const riskyCriteria = criteria.filter((criterion) => criterion.status === 'harmful');
const exceptionalCriteria = criteria.filter((criterion) => criterion.status === 'exceptional');
const primaryCritical = Array.isArray(assessment?.findings?.critical_findings) ? assessment.findings.critical_findings : [];
const reliability = String(assessment?.transcript_reliability?.grade || '');
const pressure = assessment?.decision_facts?.pressure || {};
const transaction = assessment?.decision_facts?.transaction || {};
const followUp = assessment?.decision_facts?.follow_up || {};
const outcome = String(assessment?.outcome?.classification || 'unknown');
const opportunity = assessment?.opportunity || {};
const call2 = source.callType === 'Call 2+';
const declaredSaleWithoutFacts = call2 && outcome === 'sale' && !(transaction.payment_completed === true && transaction.agreement_confirmed === true);
const declaredDepositWithoutFacts = call2 && outcome === 'deposit' && transaction.deposit_confirmed !== true;
const declaredFollowUpWithoutFacts = call2 && outcome === 'concrete_follow_up' && !(followUp.agreed_time === true || (followUp.specific_action === true && String(followUp.owner || '').trim() && String(followUp.deadline || '').trim()));
const call1DecisionUnknown = !call2 && (!['viable', 'limited', 'not_currently_closable'].includes(String(opportunity.classification || '')) || String(opportunity.correct_disposition || 'unknown') === 'unknown');
const unclosableClassificationRisk = String(opportunity.classification || '') === 'not_currently_closable';
const pressureRisk = pressure.arbitrary_urgency === true || pressure.ignored_clear_refusal === true || pressure.unsupported_claim === true || pressure.dismissed_time_request === true;

const reviewReasons = [];
if (primaryCritical.length) reviewReasons.push('primary_critical_finding');
if (riskyCriteria.length) reviewReasons.push('harmful_criterion');
if (pressureRisk) reviewReasons.push('material_pressure_risk');
if (reliability === 'partially_gradeable') reviewReasons.push('material_transcript_limitation');
if (declaredSaleWithoutFacts || declaredDepositWithoutFacts || declaredFollowUpWithoutFacts) reviewReasons.push('outcome_fact_contradiction');
if (call1DecisionUnknown) reviewReasons.push('call1_progression_uncertain');
if (unclosableClassificationRisk) reviewReasons.push('unclosable_classification_requires_verification');
if (exceptionalCriteria.length) reviewReasons.push('exceptional_claim_requires_verification');

const materialReviewRequired = reviewReasons.length > 0;
if (!materialReviewRequired) {
  return [{ json: { ...source, finalAssessment: assessment, materialReviewRequired: false, materialReviewReason: 'no_material_risk_gate', repairResponse: source.needsRepair ? inbound : null } }];
}

const reviewTargets = {
  reasons: reviewReasons,
  transcript_reliability: assessment.transcript_reliability,
  opportunity: assessment.opportunity,
  outcome: assessment.outcome,
  decision_facts: assessment.decision_facts,
  critical_findings: primaryCritical,
  targeted_criteria: [
    ...riskyCriteria,
    ...exceptionalCriteria,
  ],
};
const reviewSystem = [
  'You are the selective evidence verifier for Magic Mike V7 shadow validation.',
  'You are not a second full-call scorer. Review only the listed material risks, decision facts, and targeted criteria; do not reassess unlisted ordinary criteria.',
  'Use the transcript and exact evidence. Functional equivalents to the Call 1 or Call 2 script count.',
  'A critical or harmful judgment requires exact rep evidence plus exact demonstrated material impact or prospect reaction.',
  'A sale requires verified agreement plus verified completed payment. A concrete follow-up requires an agreed date/time or a specific agreed action with owner and deadline.',
  'A difficult prospect, lead quality, or technical issue is not a rep fault. Opportunity is context only and never a direct score adjustment.',
  'A prospect refusal alone does not prove the opportunity was unclosable. Confirm a specific outside blocker and reasonable rep diagnosis before supporting not_currently_closable.',
  'Exceptional is rare. Strong requires complete and tailored execution. Competent means acceptable but ordinary or noticeably incomplete. Do not upgrade a criterion because the call advanced or sold.',
  'For opportunity, supported means your returned classification is supported by exact evidence; it does not mean you agree with the primary classification. Correct an unsupported not_currently_closable result to viable, limited, or unknown as the evidence requires.',
  'For every targeted criterion, return a verdict. Preserve a high status only when the transcript demonstrates the full anchor; otherwise return the evidence-supported lower status.',
  'Return one valid JSON object and no prose outside it.',
].join('\n');
const schema = {
  opportunity: { supported: false, classification: 'viable|limited|not_currently_closable|unknown', correct_disposition: 'advance|decline|follow_up|close|unknown', reason: 'brief evidence-based reason', evidence: [{ timestamp: 'exact', speaker: 'exact', quote: 'exact' }] },
  decision_facts: {
    follow_up: { agreed_time: false, time_text: '', specific_action: false, action: '', owner: '', deadline: '', evidence: [{ timestamp: 'exact', speaker: 'exact', quote: 'exact' }] },
    transaction: { payment_completed: false, deposit_confirmed: false, agreement_confirmed: false, onboarding_confirmed: false, evidence: [{ timestamp: 'exact', speaker: 'exact', quote: 'exact' }] },
    pressure: { truthful_deadline: false, arbitrary_urgency: false, ignored_clear_refusal: false, unsupported_claim: false, dismissed_time_request: false, material_negative_reaction: false, evidence: [{ timestamp: 'exact', speaker: 'exact', quote: 'exact' }] },
  },
  criterion_verdicts: [{ dimension_key: 'targeted dimension', criterion_id: 'targeted criterion', corroborated: false, corrected_status: 'exceptional|strong|competent|partial|weak|missed|harmful|not_applicable|not_observable', reason: 'brief factual reason', evidence: [{ timestamp: 'exact', speaker: 'exact', quote: 'exact' }] }],
  critical_findings: [{ corroborated: false, label: 'material verified concern', risk_type: 'deception|coercion|clear_refusal_ignored|material_terms_misrepresented|other', material_impact: 'demonstrated|not_demonstrated', reason: 'brief factual reason', rep_evidence: [{ timestamp: 'exact', speaker: 'exact', quote: 'exact' }], prospect_reaction_evidence: [{ timestamp: 'exact', speaker: 'exact', quote: 'exact' }] }],
  rationale: 'brief verification summary',
};
const reviewUser = [
  `CALL TYPE: ${source.callType}`,
  `RESOLVED REP: ${source.resolvedRepName}`,
  'VERIFY ONLY THESE PRIMARY CLAIMS:',
  JSON.stringify(reviewTargets),
  '',
  'Return exactly this shape:',
  JSON.stringify(schema),
  '',
  'TRANSCRIPT:',
  source.transcript,
].join('\n');
const requestBody = { model: 'deepseek-v4-pro', messages: [{ role: 'system', content: reviewSystem }, { role: 'user', content: reviewUser }], thinking: { type: 'disabled' }, temperature: 0, response_format: { type: 'json_object' }, stream: false, max_tokens: 6000 };

return [{ json: { ...source, finalAssessment: assessment, materialReviewRequired: true, materialReviewReason: reviewReasons.join('|'), reviewTargets, repairResponse: source.needsRepair ? inbound : null, requestBody } }];
