import "server-only";

import { getMaterializedV3Registry } from "@/lib/ask-sales-faq/v3/admin-approved-releases";
import type { V3Policy } from "@/lib/ask-sales-faq/v3/types";

const registry = getMaterializedV3Registry();

export function getV4KnowledgeVersion() {
  return registry.knowledge_version;
}

export function getV4RouteCatalog() {
  return registry.route_catalog;
}

export function getV4BlockedTopics() {
  return registry.blocked_topics;
}

export function getV4Corpus(): V3Policy[] {
  return registry.policies
    .filter((policy) => policy.quality_tier !== "discovery_only")
    .filter((policy) => policy.answerability !== "discovery_only")
    .sort((left, right) =>
      right.authority - left.authority ||
      right.specificity_priority - left.specificity_priority ||
      left.decision_key.localeCompare(right.decision_key) ||
      left.id.localeCompare(right.id),
    );
}

export function policyEvidenceText(policy: V3Policy) {
  return [
    policy.title,
    ...policy.question_families,
    policy.decision,
    ...policy.product_scopes,
    ...policy.domains,
    ...policy.actions,
    ...policy.entities,
  ].filter(Boolean).join(" ");
}
