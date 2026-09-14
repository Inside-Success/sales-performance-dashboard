import type { V3Policy, V3PolicyRegistry } from "../v3/types";
import type { Evidence } from "./types";
export function evidenceToPolicy(record: Evidence, base: V3PolicyRegistry): V3Policy {
  return {
    id: record.id, decision_key: record.decisionKey, policy_key: record.decisionKey,
    title: record.title, question_families: record.questions, decision: record.text,
    product_scopes: record.scopes, domains: record.domains || [], actions: record.actions || [], entities: record.entities || [],
    risk_level: record.risk, answerability: record.conditions.includes("route_or_support") ? "route_or_support" : "answer_evidence",
    quality_tier: "trusted_evidence", quality_flags: record.conditions,
    route_key: record.routeKey, route_channel: record.routeKey ? base.route_catalog[record.routeKey]?.channel || null : null,
    route_reason: "", authority: record.authority, effective_at: record.reviewedAt, last_reviewed: record.reviewedAt,
    source: { kind: record.sourceKind || record.kind, article_id: null, ids: record.sourceIds, approved_by: record.approvedBy || [] },
    search_text: [record.title, ...record.questions, record.text].join(" "), specificity_priority: 0, blocked_for_decision_keys: [],
  };
}
export function policyToEvidence(policy: V3Policy): Evidence {
  return { id: policy.id, decisionKey: policy.decision_key, title: policy.title, questions: policy.question_families,
    text: policy.decision, scopes: policy.product_scopes, sourceIds: policy.source.ids,
    reviewedAt: policy.last_reviewed || policy.effective_at, authority: policy.authority,
    kind: policy.source.kind === "coaching" ? "coaching" : policy.source.kind === "resource" ? "resource" : "policy",
    risk: policy.risk_level, routeKey: policy.route_key, conditions: policy.quality_flags, supersedes: [],
    domains: policy.domains, actions: policy.actions, entities: policy.entities, sourceKind:policy.source.kind, approvedBy:policy.source.approved_by };
}
