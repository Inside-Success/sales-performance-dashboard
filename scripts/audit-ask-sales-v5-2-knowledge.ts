import { getV5KnowledgeSnapshot } from "../src/lib/ask-sales-faq/v5/knowledge";

const snapshot = getV5KnowledgeSnapshot();
const promoted = snapshot.policies.filter((policy) => policy.quality_flags.includes("v52_stable_rule_compiled"));
const byApprover = promoted.reduce<Record<string, number>>((counts, policy) => {
  for (const approver of policy.source.approved_by) counts[approver] = (counts[approver] || 0) + 1;
  return counts;
}, {});
const byDomain = promoted.reduce<Record<string, number>>((counts, policy) => {
  for (const domain of policy.domains) counts[domain] = (counts[domain] || 0) + 1;
  return counts;
}, {});

process.stdout.write(`${JSON.stringify({
  schemaVersion: snapshot.schemaVersion,
  knowledgeVersion: snapshot.knowledgeVersion,
  snapshotHash: snapshot.snapshotHash,
  policyCount: snapshot.policies.length,
  operationalPolicyCount: snapshot.operationalPolicyCount,
  stableOperationalPromotionCount: snapshot.stableOperationalPromotionCount,
  promotionCountMatches: promoted.length === snapshot.stableOperationalPromotionCount,
  promotedSample: promoted.slice(0, 40).map((policy) => ({
    id: policy.id,
    title: policy.title,
    decision: policy.decision,
    approvers: policy.source.approved_by,
    effectiveAt: policy.effective_at,
  })),
  promotedPolicyIds: promoted.map((policy) => policy.id),
  byApprover,
  topDomains: Object.entries(byDomain).sort((left, right) => right[1] - left[1]).slice(0, 20),
}, null, 2)}\n`);
