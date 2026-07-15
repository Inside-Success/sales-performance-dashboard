import registryJson from "@/lib/ask-sales-faq/generated/v3-policy-registry.json";
import type { V3BlockedTopic, V3Policy, V3PolicyRegistry } from "@/lib/ask-sales-faq/v3/types";

const registry = registryJson as V3PolicyRegistry;

const STOPWORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "between", "but",
  "can", "could", "does", "for", "from", "have", "into", "its", "just", "more", "not", "only", "our", "should",
  "that", "the", "their", "then", "there", "these", "they", "this", "those", "through", "too", "under", "was",
  "were", "what", "when", "where", "which", "while", "who", "will", "with", "would", "you", "your",
]);

export type KnowledgeRefreshConflictLevel = "none" | "possible" | "direct" | "blocked";

export type KnowledgeRefreshPolicyContext = {
  id: string;
  decisionKey: string;
  title: string;
  decision: string;
  productScopes: string[];
  domains: string[];
  effectiveAt: string;
  authority: number;
  sourceKind: string;
};

export type KnowledgeRefreshGovernanceMatch = {
  conflictLevel: KnowledgeRefreshConflictLevel;
  conflictSummary: string;
  conflictingPolicyIds: string[];
  relatedPolicies: KnowledgeRefreshPolicyContext[];
  blockedTopicIds: string[];
};

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9#$]+/g, " ").replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  return new Set(
    normalize(value)
      .split(" ")
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

function overlapScore(query: Set<string>, text: string) {
  const target = tokens(text);
  if (!query.size || !target.size) return 0;
  let overlap = 0;
  for (const token of query) if (target.has(token)) overlap += 1;
  return overlap / Math.sqrt(query.size * target.size);
}

function policyContext(policy: V3Policy): KnowledgeRefreshPolicyContext {
  return {
    id: policy.id,
    decisionKey: policy.decision_key,
    title: policy.title,
    decision: policy.decision,
    productScopes: policy.product_scopes,
    domains: policy.domains,
    effectiveAt: policy.effective_at,
    authority: policy.authority,
    sourceKind: policy.source.kind,
  };
}

function topPolicies(value: string, limit = 12) {
  const query = tokens(value.slice(0, 80_000));
  return registry.policies
    .map((policy) => ({
      policy,
      score: overlapScore(query, `${policy.title} ${policy.question_families.join(" ")} ${policy.decision} ${policy.search_text}`),
    }))
    .filter((item) => item.score > 0.025)
    .sort((left, right) => right.score - left.score || right.policy.authority - left.policy.authority)
    .slice(0, limit)
    .map((item) => policyContext(item.policy));
}

function topBlockedTopics(value: string, limit = 6) {
  const query = tokens(value.slice(0, 80_000));
  return registry.blocked_topics
    .map((topic) => ({ topic, score: overlapScore(query, blockedTopicText(topic)) }))
    .filter((item) => item.score > 0.08)
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.topic.id);
}

function candidateBlockedTopics(value: string, productScopes: string[], limit = 6) {
  const query = tokens(value.slice(0, 80_000));
  const normalizedScopes = new Set(productScopes.map(normalize));
  return registry.blocked_topics
    .map((topic) => ({ topic, score: overlapScore(query, blockedTopicText(topic)) }))
    .filter(({ topic, score }) => {
      if (score < 0.24) return false;
      const topicScopes = (topic.product_scopes || []).map(normalize).filter(Boolean);
      return !topicScopes.length || normalizedScopes.has("all") || topicScopes.includes("all") || topicScopes.some((scope) => normalizedScopes.has(scope));
    })
    .sort((left, right) => right.score - left.score)
    .slice(0, limit)
    .map((item) => item.topic.id);
}

function blockedTopicText(topic: V3BlockedTopic) {
  return [
    topic.id,
    topic.resolution || "",
    ...(topic.question_families || []),
    ...(topic.product_scopes || []),
    ...(topic.domains || []),
    ...(topic.actions || []),
    ...(topic.entities || []),
  ].join(" ");
}

export function buildKnowledgeRefreshAnalysisContext(content: string) {
  return {
    knowledgeVersion: registry.knowledge_version,
    generatedAt: registry.generated_at,
    relatedPolicies: topPolicies(content),
    blockedTopicIds: topBlockedTopics(content),
    authorityRule:
      "Raw Slack and Google content is discovery evidence only. Recency is a signal, not automatic authority. Human approval and explicit supersession are required before runtime use.",
  };
}

export function compareKnowledgeRefreshCandidate(input: {
  title: string;
  proposedPolicy: string;
  decisionKey: string | null;
  productScopes: string[];
}) : KnowledgeRefreshGovernanceMatch {
  const text = `${input.title} ${input.proposedPolicy} ${input.decisionKey || ""} ${input.productScopes.join(" ")}`;
  const relatedPolicies = topPolicies(text, 8);
  const exactDecisionKey = input.decisionKey
    ? registry.policies.filter((policy) => policy.decision_key === input.decisionKey).map(policyContext)
    : [];
  const blockedTopicIds = candidateBlockedTopics(text, input.productScopes);
  const conflictingPolicyIds = Array.from(new Set(exactDecisionKey.map((policy) => policy.id)));

  if (blockedTopicIds.length) {
    return {
      conflictLevel: "blocked",
      conflictSummary: `The proposal overlaps unresolved governed topic${blockedTopicIds.length === 1 ? "" : "s"}: ${blockedTopicIds.join(", ")}.`,
      conflictingPolicyIds,
      relatedPolicies,
      blockedTopicIds,
    };
  }

  if (exactDecisionKey.length) {
    return {
      conflictLevel: "direct",
      conflictSummary: `The decision key already has ${exactDecisionKey.length} current governed polic${exactDecisionKey.length === 1 ? "y" : "ies"}. A reviewer must explicitly supersede, scope, or retain the existing decision.`,
      conflictingPolicyIds,
      relatedPolicies: mergePolicyContexts(exactDecisionKey, relatedPolicies),
      blockedTopicIds,
    };
  }

  if (relatedPolicies.length) {
    return {
      conflictLevel: "possible",
      conflictSummary: "The proposal is adjacent to current governed policy. Review scope, authority, effective date, and whether both rules can coexist before approval.",
      conflictingPolicyIds: relatedPolicies.slice(0, 3).map((policy) => policy.id),
      relatedPolicies,
      blockedTopicIds,
    };
  }

  return {
    conflictLevel: "none",
    conflictSummary: "No close governed policy or open blocker was found automatically. Human review is still required.",
    conflictingPolicyIds: [],
    relatedPolicies: [],
    blockedTopicIds: [],
  };
}

function mergePolicyContexts(primary: KnowledgeRefreshPolicyContext[], secondary: KnowledgeRefreshPolicyContext[]) {
  const result = new Map<string, KnowledgeRefreshPolicyContext>();
  for (const policy of [...primary, ...secondary]) result.set(policy.id, policy);
  return Array.from(result.values()).slice(0, 8);
}

export function getKnowledgeRefreshRegistryVersion() {
  return registry.knowledge_version;
}
