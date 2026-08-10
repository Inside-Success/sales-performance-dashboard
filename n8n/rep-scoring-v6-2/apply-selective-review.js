const inbound = $input.first()?.json || {};
const source = $('Prepare V6.2 Selective Review').item.json;
const assessment = source.finalAssessment;

if (!assessment || typeof assessment !== 'object') {
  return [{ json: { ...source, adjudicationApplied: false, adjudicationResponse: null, materialReviewProviderResponse: null } }];
}
if (!source.materialReviewRequired) {
  return [{ json: { ...source, adjudicationApplied: false, adjudicationResponse: null, materialReviewProviderResponse: null } }];
}

const prepared = $('Prepare Selective Review JSON Repair').item.json;
let review = prepared.independentParsed;
let providerResponse = prepared.independentResponse || inbound;
try {
  if (prepared.independentProviderError) throw new Error(String(prepared.independentProviderError));
  if (prepared.needsIndependentRepair) {
    if (inbound?.error) throw new Error(String(inbound.error.message || inbound.error));
    const repairedContent = inbound?.choices?.[0]?.message?.content;
    review = typeof repairedContent === 'string' ? JSON.parse(repairedContent) : repairedContent;
    providerResponse = inbound;
  }
  if (!review || typeof review !== 'object') throw new Error('selective_review_not_object');
} catch (error) {
  return [{ json: { ...source, finalAssessment: null, adjudicationApplied: false, adjudicationResponse: null, materialReviewProviderResponse: providerResponse, materialReviewError: String(error.message || error), independentRepairAttempted: Boolean(prepared.needsIndependentRepair) } }];
}

const merged = JSON.parse(JSON.stringify(assessment));
if (review.opportunity?.supported === true) {
  merged.opportunity = { ...merged.opportunity, ...review.opportunity };
}
if (review.decision_facts && typeof review.decision_facts === 'object') {
  merged.decision_facts = {
    ...(merged.decision_facts || {}),
    ...review.decision_facts,
    follow_up: { ...(merged.decision_facts?.follow_up || {}), ...(review.decision_facts.follow_up || {}) },
    transaction: { ...(merged.decision_facts?.transaction || {}), ...(review.decision_facts.transaction || {}) },
    pressure: { ...(merged.decision_facts?.pressure || {}), ...(review.decision_facts.pressure || {}) },
  };
}

const verdicts = new Map((Array.isArray(review.criterion_verdicts) ? review.criterion_verdicts : []).map((row) => [`${String(row?.dimension_key || '')}.${String(row?.criterion_id || '')}`, row]));
merged.dimensions = (Array.isArray(merged.dimensions) ? merged.dimensions : []).map((dimension) => ({
  ...dimension,
  criteria: (Array.isArray(dimension?.criteria) ? dimension.criteria : []).map((criterion) => {
    const verdict = verdicts.get(`${String(dimension?.key || '')}.${String(criterion?.id || '')}`);
    if (!verdict) return criterion;
    const corrected = String(verdict.corrected_status || '');
    const allowed = new Set(['met', 'partial', 'missed', 'harmful', 'not_applicable', 'not_observable']);
    const status = verdict.corroborated === true && allowed.has(corrected) ? corrected : (criterion.status === 'harmful' ? 'missed' : criterion.status);
    return { ...criterion, status, confidence: verdict.corroborated === true ? 'high' : 'medium', reason: String(verdict.reason || criterion.reason || ''), evidence: Array.isArray(verdict.evidence) && verdict.evidence.length ? verdict.evidence : criterion.evidence };
  }),
}));

const corroboratedCritical = (Array.isArray(review.critical_findings) ? review.critical_findings : [])
  .filter((row) => row?.corroborated === true && row?.material_impact === 'demonstrated');
merged.findings = merged.findings && typeof merged.findings === 'object' ? merged.findings : {};
merged.findings.critical_findings = corroboratedCritical;

return [{ json: { ...source, finalAssessment: merged, adjudicationApplied: true, adjudicationResponse: review, materialReviewProviderResponse: providerResponse, materialReviewError: '' } }];
