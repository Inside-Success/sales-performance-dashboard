import { neon } from "@neondatabase/serverless";
import { compareKnowledgeRefreshCandidate } from "@/lib/ask-sales-faq/knowledge-refresh-governance";
import { getPendingAskSalesQualityAuditPackets } from "@/lib/ask-sales-faq/quality-review-store";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required for the read-only relevance audit");
}

const sql = neon(process.env.DATABASE_URL);
const candidates = await sql`
  select
    c.id,
    c.title,
    c.proposed_policy,
    c.decision_key,
    c.product_scopes,
    coalesce(to_jsonb(c)->'policy_domains', '[]'::jsonb) as policy_domains,
    coalesce(to_jsonb(c)->'policy_actions', '[]'::jsonb) as policy_actions,
    coalesce(to_jsonb(c)->'policy_entities', '[]'::jsonb) as policy_entities,
    to_jsonb(c)->>'policy_object' as policy_object,
    to_jsonb(c)->>'policy_conditions' as policy_conditions,
    c.conflict_level,
    c.blocked_topic_ids
  from ask_sales_faq_refresh_candidates c
  join ask_sales_faq_refresh_sources s on s.id = c.source_id
  where c.status in ('needs_review', 'needs_owner')
    and c.snapshot_hash = s.last_content_hash
  order by c.updated_at desc
`;

const comparisons = candidates.map((candidate) => {
  const next = compareKnowledgeRefreshCandidate({
    title: String(candidate.title),
    proposedPolicy: String(candidate.proposed_policy),
    decisionKey: candidate.decision_key ? String(candidate.decision_key) : null,
    productScopes: Array.isArray(candidate.product_scopes) ? candidate.product_scopes.map(String) : [],
    domains: Array.isArray(candidate.policy_domains) ? candidate.policy_domains.map(String) : [],
    actions: Array.isArray(candidate.policy_actions) ? candidate.policy_actions.map(String) : [],
    entities: Array.isArray(candidate.policy_entities) ? candidate.policy_entities.map(String) : [],
    policyObject: candidate.policy_object ? String(candidate.policy_object) : null,
    conditions: candidate.policy_conditions ? String(candidate.policy_conditions) : null,
  });
  const previousBlocked = Array.isArray(candidate.blocked_topic_ids) ? candidate.blocked_topic_ids.map(String) : [];
  return {
    id: String(candidate.id),
    title: String(candidate.title),
    previousConflictLevel: String(candidate.conflict_level),
    nextConflictLevel: next.conflictLevel,
    previousBlocked,
    nextBlocked: next.blockedTopicIds,
    changed:
      String(candidate.conflict_level) !== next.conflictLevel ||
      JSON.stringify(previousBlocked) !== JSON.stringify(next.blockedTopicIds),
  };
});
const qualityPackets = await getPendingAskSalesQualityAuditPackets(100);
const includeDetails = process.argv.includes("--details");

console.log(JSON.stringify({
  mode: "read_only",
  actionableCandidates: comparisons.length,
  previouslyBlocked: comparisons.filter((candidate) => candidate.previousBlocked.length > 0).length,
  blockedAfterPrecisionCheck: comparisons.filter((candidate) => candidate.nextBlocked.length > 0).length,
  changed: comparisons.filter((candidate) => candidate.changed),
  qualityAudit: {
    pendingPackets: qualityPackets.length,
    packetsWithSameDecisionPolicy: qualityPackets.filter((packet) =>
      packet.currentPolicies.some((policy) => policy.applicability === "same_decision"),
    ).length,
    packetsWithIrrelevantRuntimeSelection: qualityPackets.filter((packet) =>
      packet.currentPolicies.some((policy) => policy.selectedByRuntime && policy.applicability !== "same_decision"),
    ).length,
    ...(includeDetails ? {
      policyApplicability: qualityPackets.map((packet) => ({
        messageId: packet.messageId,
        question: packet.question,
        policies: packet.currentPolicies.map((policy) => ({
          id: policy.id,
          title: policy.title,
          applicability: policy.applicability,
          selectedByRuntime: policy.selectedByRuntime,
          matchReason: policy.matchReason,
        })),
      })),
    } : {}),
  },
}, null, 2));
