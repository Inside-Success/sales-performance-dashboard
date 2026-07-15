import registryJson from "@/lib/ask-sales-faq/generated/v3-policy-registry.json";
import ragIndexJson from "@/lib/ask-sales-faq/generated/policy-aware-rag-index.json";
import type { V3BlockedTopic, V3Policy, V3PolicyRegistry } from "@/lib/ask-sales-faq/v3/types";

const registry = registryJson as V3PolicyRegistry;
const ragIndex = ragIndexJson as KnowledgeRefreshRagIndex;

type KnowledgeRefreshRagChunk = {
  id: string;
  heading: string;
  text: string;
  source_title: string;
  source_type: string;
  trust_label: string;
  authority: number;
  last_reviewed: string;
};

type KnowledgeRefreshRagIndex = {
  chunks: KnowledgeRefreshRagChunk[];
};

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

export type KnowledgeRefreshConflictEvidenceContext = {
  id: string;
  heading: string;
  text: string;
  sourceTitle: string;
  sourceType: string;
  trustLabel: string;
  authority: number;
  lastReviewed: string;
  sourceReference: string | null;
  sourceUrl: string | null;
};

export type KnowledgeRefreshBlockedTopicContext = {
  id: string;
  found: boolean;
  reviewReady: boolean;
  title: string;
  status: string;
  explanation: string;
  questionFamilies: string[];
  productScopes: string[];
  domains: string[];
  effectiveAt: string | null;
  lastReviewed: string | null;
  sourceIds: string[];
  currentPolicies: KnowledgeRefreshPolicyContext[];
  evidence: KnowledgeRefreshConflictEvidenceContext[];
};

export type KnowledgeRefreshGovernanceMatch = {
  conflictLevel: KnowledgeRefreshConflictLevel;
  conflictSummary: string;
  conflictingPolicyIds: string[];
  relatedPolicies: KnowledgeRefreshPolicyContext[];
  blockedTopicIds: string[];
  blockedTopics: KnowledgeRefreshBlockedTopicContext[];
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

function humanizeIdentifier(value: string) {
  return value
    .replace(/^blocked_/, "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function sourceReferenceUrl(sourceReference: string | null) {
  if (!sourceReference) return null;
  const match = /^slack:(#[^:]+):(\d+)\.(\d+)$/.exec(sourceReference);
  if (!match) return null;
  const channelIds: Record<string, string> = {
    "#sales-questions-requests": "C0AUQKNR8CF",
    "#2026-main-all-sales-reps-no-questions": "C09AF0NQJE7",
  };
  const channelId = channelIds[match[1]];
  return channelId ? `https://istvoffical.slack.com/archives/${channelId}/p${match[2]}${match[3]}` : null;
}

function cleanEvidenceText(value: string) {
  return value
    .split("\n")
    .filter((line) => !/^#{1,6}\s/.test(line) && !/^- Link:\s*\[internal link\]/i.test(line))
    .map((line) => line.replace(/^[-*]\s*/, "").replace(/`/g, ""))
    .filter(Boolean)
    .join("\n");
}

function blockedTopicEvidence(topic: V3BlockedTopic) {
  const sourceIds = topic.source_ids || [];
  const sourceTimestamps = sourceIds.map((id) => id.split(":").at(-1)).filter(Boolean) as string[];
  const familyHeadings = new Set((topic.question_families || []).map(normalize));
  const matches = ragIndex.chunks.filter((chunk) =>
    sourceTimestamps.some((timestamp) => chunk.text.includes(timestamp)) || familyHeadings.has(normalize(chunk.heading)),
  );
  const deduped = new Map<string, KnowledgeRefreshConflictEvidenceContext>();
  for (const chunk of matches) {
    const sourceReference = sourceIds.find((sourceId) => {
      const timestamp = sourceId.split(":").at(-1);
      return Boolean(timestamp && chunk.text.includes(timestamp));
    }) || sourceIds[0] || null;
    deduped.set(chunk.id, {
      id: chunk.id,
      heading: chunk.heading,
      text: cleanEvidenceText(chunk.text),
      sourceTitle: chunk.source_title,
      sourceType: chunk.source_type,
      trustLabel: chunk.trust_label,
      authority: chunk.authority,
      lastReviewed: chunk.last_reviewed,
      sourceReference,
      sourceUrl: sourceReferenceUrl(sourceReference),
    });
  }
  return Array.from(deduped.values()).slice(0, 3);
}

export function getKnowledgeRefreshBlockedTopicContexts(ids: string[]): KnowledgeRefreshBlockedTopicContext[] {
  return Array.from(new Set(ids)).map((id) => {
    const topic = registry.blocked_topics.find((candidate) => candidate.id === id);
    if (!topic) {
      return {
        id,
        found: false,
        reviewReady: false,
        title: humanizeIdentifier(id),
        status: "unresolved",
        explanation: "This blocker could not be resolved in the deployed registry. Approval must remain unavailable; use Needs owner or Defer.",
        questionFamilies: [],
        productScopes: [],
        domains: [],
        effectiveAt: null,
        lastReviewed: null,
        sourceIds: [],
        currentPolicies: [],
        evidence: [],
      };
    }

    const currentPolicies = topic.authoritative_article_id
      ? registry.policies.filter((policy) => policy.source.article_id === topic.authoritative_article_id).map(policyContext)
      : [];
    const evidence = blockedTopicEvidence(topic);
    const title = topic.question_families?.at(-1) || humanizeIdentifier(topic.blocked_topic_ids?.[0] || topic.id);
    const hasApprovedPolicy = currentPolicies.length > 0;
    const explanation = hasApprovedPolicy
      ? "A current approved policy already covers this topic. Compare it with the new proposal before deciding whether to replace it or define a narrower scope."
      : topic.resolution === "curated evidence explicitly records an unresolved conflict"
        ? "Existing governed evidence contains different answers, and no current answer has been approved. Compare the evidence with the new proposal before deciding."
        : topic.resolution || "This topic is blocked because the governed knowledge does not yet contain one approved current answer.";

    return {
      id: topic.id,
      found: true,
      reviewReady: hasApprovedPolicy || evidence.length > 0,
      title,
      status: topic.status,
      explanation,
      questionFamilies: topic.question_families || [],
      productScopes: topic.product_scopes || [],
      domains: topic.domains || [],
      effectiveAt: topic.effective_at || null,
      lastReviewed: topic.last_reviewed || null,
      sourceIds: topic.source_ids || [],
      currentPolicies,
      evidence,
    };
  });
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
  const blockedTopics = getKnowledgeRefreshBlockedTopicContexts(blockedTopicIds);
  const conflictingPolicyIds = Array.from(new Set(exactDecisionKey.map((policy) => policy.id)));

  if (blockedTopicIds.length) {
    const titles = blockedTopics.map((topic) => topic.title).join("; ");
    const currentPolicyCount = blockedTopics.reduce((total, topic) => total + topic.currentPolicies.length, 0);
    return {
      conflictLevel: "blocked",
      conflictSummary: `This proposal touches ${blockedTopicIds.length === 1 ? "an unresolved governed topic" : "unresolved governed topics"}: ${titles}. ${currentPolicyCount ? "Compare the current approved policy with the proposal before deciding." : "No approved current policy exists; compare the governed evidence with the proposal before deciding."}`,
      conflictingPolicyIds,
      relatedPolicies,
      blockedTopicIds,
      blockedTopics,
    };
  }

  if (exactDecisionKey.length) {
    return {
      conflictLevel: "direct",
      conflictSummary: `The decision key already has ${exactDecisionKey.length} current governed polic${exactDecisionKey.length === 1 ? "y" : "ies"}. A reviewer must explicitly supersede, scope, or retain the existing decision.`,
      conflictingPolicyIds,
      relatedPolicies: mergePolicyContexts(exactDecisionKey, relatedPolicies),
      blockedTopicIds,
      blockedTopics,
    };
  }

  if (relatedPolicies.length) {
    return {
      conflictLevel: "possible",
      conflictSummary: "The proposal is adjacent to current governed policy. Review scope, authority, effective date, and whether both rules can coexist before approval.",
      conflictingPolicyIds: relatedPolicies.slice(0, 3).map((policy) => policy.id),
      relatedPolicies,
      blockedTopicIds,
      blockedTopics,
    };
  }

  return {
    conflictLevel: "none",
    conflictSummary: "No close governed policy or open blocker was found automatically. Human review is still required.",
    conflictingPolicyIds: [],
    relatedPolicies: [],
    blockedTopicIds: [],
    blockedTopics: [],
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
