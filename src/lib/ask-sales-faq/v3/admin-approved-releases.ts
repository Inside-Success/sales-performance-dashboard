import "server-only";

import { createHash } from "node:crypto";
import baseRegistryJson from "@/lib/ask-sales-faq/generated/v3-policy-registry.json";
import releaseLedgerJson from "@/lib/ask-sales-faq/generated/v3-admin-approved-releases.json";
import type { V3Policy, V3PolicyRegistry } from "@/lib/ask-sales-faq/v3/types";

export type V3AdminApprovedRelease = {
  release_id: string;
  status: "approved_for_publish";
  base_knowledge_version: string;
  expected_knowledge_version: string;
  prepared_at: string;
  prepared_by: string;
  candidate_ids: string[];
  policies: V3Policy[];
  supersessions: Array<{
    decision_key: string;
    active_policy_ids: string[];
    superseded_policy_ids: string[];
    reason: string;
    effective_at: string;
    release_id: string;
  }>;
  resolved_blocked_topics: Array<{
    id: string;
    status: "resolved";
    resolution: string;
    effective_at: string;
    last_reviewed: string;
    release_id: string;
  }>;
  source_snapshot_hashes: string[];
};

export type V3AdminApprovedReleaseLedger = {
  schema_version: 1;
  description: string;
  releases: V3AdminApprovedRelease[];
};

export type V3AdminReleaseCandidate = {
  id: string;
  title: string;
  summary: string;
  proposedPolicy: string;
  decisionKey: string;
  productScopes: string[];
  domains: string[];
  actions: string[];
  entities: string[];
  policyObject: string | null;
  conditions: string | null;
  effectiveDate: string | null;
  answerImpact: "material" | "possible" | "none";
  sourceAuthority: "owner_confirmed" | "manager_guidance" | "rep_answer" | "rep_question" | "unknown";
  authorityName: string | null;
  authorityBasis: string | null;
  sourceId: string;
  sourceLabel: string;
  sourceRevision: string | null;
  evidenceQuotes: string[];
  snapshotHash: string;
  approvedBy: string;
  approvedAt: string;
  conflictLevel: "none" | "possible" | "direct" | "blocked";
  conflictResolution: "supersede" | "scoped_coexistence" | null;
  conflictingPolicyIds: string[];
  blockedTopicIds: string[];
};

const baseRegistry = baseRegistryJson as V3PolicyRegistry;
const releaseLedger = releaseLedgerJson as V3AdminApprovedReleaseLedger;

export function getV3AdminApprovedReleaseLedger() {
  return releaseLedger;
}

export function getMaterializedV3Registry() {
  return materializeV3Registry(baseRegistry, releaseLedger);
}

export function buildV3AdminApprovedRelease(input: {
  releaseId: string;
  preparedAt: string;
  preparedBy: string;
  baseKnowledgeVersion: string;
  candidates: V3AdminReleaseCandidate[];
}) {
  if (!input.candidates.length) throw new Error("An approved release must contain at least one candidate");
  const policies = input.candidates.map((candidate) => buildReleasePolicy(input, candidate));
  const policyIds = policies.map((policy) => policy.id);
  if (new Set(policyIds).size !== policyIds.length) throw new Error("Approved release policy IDs must be unique");

  const supersessions = input.candidates.flatMap((candidate, index) => {
    if (candidate.conflictResolution !== "supersede" || !candidate.conflictingPolicyIds.length) return [];
    return [{
      decision_key: candidate.decisionKey,
      active_policy_ids: [policies[index].id],
      superseded_policy_ids: [...new Set(candidate.conflictingPolicyIds)].sort(),
      reason: `Exact-admin release ${input.releaseId} approved the newer governed decision for ${candidate.decisionKey}.`,
      effective_at: normalizeEffectiveAt(candidate.effectiveDate, candidate.approvedAt),
      release_id: input.releaseId,
    }];
  });
  const resolvedBlockedTopics = input.candidates.flatMap((candidate) =>
    [...new Set(candidate.blockedTopicIds)].sort().map((id) => ({
      id,
      status: "resolved" as const,
      resolution: `Resolved by exact-admin release ${input.releaseId}: ${candidate.proposedPolicy}`,
      effective_at: normalizeEffectiveAt(candidate.effectiveDate, candidate.approvedAt),
      last_reviewed: input.preparedAt.slice(0, 10),
      release_id: input.releaseId,
    })),
  );

  const withoutExpected: Omit<V3AdminApprovedRelease, "expected_knowledge_version"> = {
    release_id: input.releaseId,
    status: "approved_for_publish",
    base_knowledge_version: input.baseKnowledgeVersion,
    prepared_at: input.preparedAt,
    prepared_by: input.preparedBy,
    candidate_ids: input.candidates.map((candidate) => candidate.id),
    policies,
    supersessions,
    resolved_blocked_topics: resolvedBlockedTopics,
    source_snapshot_hashes: [...new Set(input.candidates.map((candidate) => candidate.snapshotHash))].sort(),
  };
  return {
    ...withoutExpected,
    expected_knowledge_version: nextKnowledgeVersion(input.baseKnowledgeVersion, withoutExpected),
  } satisfies V3AdminApprovedRelease;
}

export function previewV3AdminApprovedRelease(entry: V3AdminApprovedRelease) {
  const current = getMaterializedV3Registry();
  return materializeV3Registry(current, {
    schema_version: 1,
    description: releaseLedger.description,
    releases: [entry],
  });
}

export function materializeV3Registry(
  startingRegistry: V3PolicyRegistry,
  ledger: V3AdminApprovedReleaseLedger,
): V3PolicyRegistry {
  if (ledger.schema_version !== 1 || !Array.isArray(ledger.releases)) throw new Error("Invalid admin-approved release ledger");
  let registry = structuredClone(startingRegistry);
  const seenReleaseIds = new Set<string>();

  for (const release of ledger.releases) {
    validateRelease(release, registry, seenReleaseIds);
    seenReleaseIds.add(release.release_id);

    const supersededIds = new Set(release.supersessions.flatMap((item) => item.superseded_policy_ids));
    const activeById = new Map(registry.policies.map((policy) => [policy.id, policy]));
    const newlySuperseded = [...supersededIds].map((id) => activeById.get(id)).filter((policy): policy is V3Policy => Boolean(policy));
    const remainingPolicies = registry.policies.filter((policy) => !supersededIds.has(policy.id));
    const existingSuperseded = registry.superseded_policies || [];
    const supersededPolicies = dedupePolicies([...existingSuperseded, ...newlySuperseded]);
    const resolvedIds = new Set(release.resolved_blocked_topics.map((topic) => topic.id));
    const blockedTopics = registry.blocked_topics.filter((topic) => !resolvedIds.has(topic.id));
    const resolvedOverrides = dedupeRecords([
      ...registry.resolved_overrides,
      ...release.resolved_blocked_topics,
    ], "id");
    const supersessionResolutions = dedupeRecords([
      ...(registry.supersession_resolutions || []),
      ...release.supersessions,
    ], "release_id", "decision_key");
    const policies = [...remainingPolicies, ...release.policies]
      .sort((left, right) => right.authority - left.authority || left.policy_key.localeCompare(right.policy_key) || left.id.localeCompare(right.id));
    const knowledgeVersion = nextKnowledgeVersion(registry.knowledge_version, release);
    if (knowledgeVersion !== release.expected_knowledge_version) {
      throw new Error(`Release ${release.release_id} expected knowledge ${release.expected_knowledge_version} but compiled ${knowledgeVersion}`);
    }

    const record = registry as V3PolicyRegistry & Record<string, unknown>;
    const existingStats = (record.stats || {}) as Record<string, unknown>;
    const sourceCoverage = (registry.source_coverage || {}) as Record<string, unknown>;
    registry = {
      ...registry,
      knowledge_version: knowledgeVersion,
      generated_at: release.prepared_at,
      policies,
      blocked_topics: blockedTopics,
      resolved_overrides: resolvedOverrides,
      supersession_resolutions: supersessionResolutions,
      superseded_policies: supersededPolicies,
      source_coverage: {
        ...sourceCoverage,
        admin_release_count: Number(sourceCoverage.admin_release_count || 0) + 1,
        admin_release_policy_count: Number(sourceCoverage.admin_release_policy_count || 0) + release.policies.length,
        admin_release_ids: [...new Set([...(Array.isArray(sourceCoverage.admin_release_ids) ? sourceCoverage.admin_release_ids as string[] : []), release.release_id])],
      } as unknown as V3PolicyRegistry["source_coverage"],
    };
    (registry as V3PolicyRegistry & Record<string, unknown>).stats = {
      ...existingStats,
      policy_count: policies.length,
      blocked_topic_count: blockedTopics.length,
      superseded_policy_count: supersededPolicies.length,
      admin_release_count: Number(existingStats.admin_release_count || 0) + 1,
    };
  }

  return registry;
}

function buildReleasePolicy(
  input: { releaseId: string; preparedAt: string; preparedBy: string },
  candidate: V3AdminReleaseCandidate,
): V3Policy {
  const id = `kr_${createHash("sha256").update(`${input.releaseId}:${candidate.id}`).digest("hex").slice(0, 16)}`;
  const routeKey = routeKeyFor(candidate.proposedPolicy);
  const questionFamilies = [...new Set([
    candidate.title,
    candidate.summary,
    candidate.policyObject || "",
    candidate.conditions || "",
  ].map((value) => value.trim()).filter(Boolean))];
  return {
    id,
    decision_key: candidate.decisionKey,
    policy_key: `admin-release-${normalizeKey(candidate.decisionKey)}-${id.slice(-8)}`,
    title: candidate.title,
    question_families: questionFamilies,
    decision: candidate.proposedPolicy,
    product_scopes: candidate.productScopes,
    domains: candidate.domains.length ? candidate.domains : ["general_sales"],
    actions: candidate.actions.length ? candidate.actions : ["explain"],
    entities: candidate.entities,
    risk_level: candidate.answerImpact === "material" || candidate.conflictLevel !== "none" ? "high" : "low",
    answerability: "answer_evidence",
    quality_tier: "canonical",
    quality_flags: [],
    route_key: routeKey,
    route_channel: routeKey ? routeCatalog[routeKey].channel : null,
    route_reason: routeKey ? `Use the exact approved route stated in release ${input.releaseId}.` : "",
    authority: candidate.sourceAuthority === "owner_confirmed" ? 118 : 115,
    effective_at: normalizeEffectiveAt(candidate.effectiveDate, candidate.approvedAt),
    last_reviewed: input.preparedAt.slice(0, 10),
    source: {
      kind: "admin_approved_knowledge_release",
      article_id: null,
      ids: [`knowledge-refresh:${input.releaseId}:${candidate.id}`, candidate.sourceId],
      approved_by: [candidate.approvedBy || input.preparedBy],
    },
    search_text: normalizeSearch([
      candidate.title,
      ...questionFamilies,
      candidate.proposedPolicy,
      ...candidate.productScopes,
      ...candidate.domains,
      ...candidate.actions,
      ...candidate.entities,
    ].join(" ")),
    specificity_priority: candidate.conflictLevel === "none" ? 8 : 14,
    blocked_for_decision_keys: [],
  };
}

function validateRelease(release: V3AdminApprovedRelease, registry: V3PolicyRegistry, seenReleaseIds: Set<string>) {
  if (!release.release_id || seenReleaseIds.has(release.release_id)) throw new Error(`Duplicate or missing release ID: ${release.release_id}`);
  if (release.status !== "approved_for_publish") throw new Error(`Release ${release.release_id} is not approved for publication`);
  if (release.base_knowledge_version !== registry.knowledge_version) {
    throw new Error(`Release ${release.release_id} was built for knowledge ${release.base_knowledge_version}, not ${registry.knowledge_version}`);
  }
  if (!release.policies.length || release.policies.length > 50) throw new Error(`Release ${release.release_id} has an invalid policy count`);
  const activeIds = new Set(registry.policies.map((policy) => policy.id));
  const releaseIds = release.policies.map((policy) => policy.id);
  if (new Set(releaseIds).size !== releaseIds.length || releaseIds.some((id) => activeIds.has(id))) {
    throw new Error(`Release ${release.release_id} contains a duplicate policy ID`);
  }
  for (const policy of release.policies) {
    if (!policy.id || !policy.decision_key || !policy.decision || !policy.product_scopes.length || !policy.source.ids.length || !policy.source.approved_by.length) {
      throw new Error(`Release ${release.release_id} contains an incomplete policy`);
    }
    if (policy.source.kind !== "admin_approved_knowledge_release" || policy.quality_tier !== "canonical") {
      throw new Error(`Release ${release.release_id} contains a policy outside the governed admin-release authority lane`);
    }
  }
  for (const supersession of release.supersessions) {
    if (!supersession.decision_key || !supersession.active_policy_ids.length || !supersession.superseded_policy_ids.length) {
      throw new Error(`Release ${release.release_id} contains an incomplete supersession`);
    }
    const missing = supersession.superseded_policy_ids.filter((id) => !activeIds.has(id));
    if (missing.length) throw new Error(`Release ${release.release_id} supersedes missing policies: ${missing.join(", ")}`);
  }
}

function nextKnowledgeVersion(baseKnowledgeVersion: string, release: Omit<V3AdminApprovedRelease, "expected_knowledge_version"> | V3AdminApprovedRelease) {
  const payload = {
    base_knowledge_version: baseKnowledgeVersion,
    release_id: release.release_id,
    candidate_ids: release.candidate_ids,
    policies: release.policies,
    supersessions: release.supersessions,
    resolved_blocked_topics: release.resolved_blocked_topics,
    source_snapshot_hashes: release.source_snapshot_hashes,
  };
  return createHash("sha256").update(canonicalJson(payload)).digest("hex").slice(0, 16);
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0)
      .map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function normalizeEffectiveAt(effectiveDate: string | null, approvedAt: string) {
  if (effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate)) return `${effectiveDate}T00:00:00.000Z`;
  if (effectiveDate && !Number.isNaN(new Date(effectiveDate).getTime())) return new Date(effectiveDate).toISOString();
  return new Date(approvedAt).toISOString();
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "policy";
}

function normalizeSearch(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9#$]+/g, " ").replace(/\s+/g, " ").trim();
}

const routeCatalog: Record<string, { channel: string }> = {
  finance: { channel: "#sales-finance-requests" },
  sales_tech: { channel: "#sales-tech-requests" },
  sales_policy: { channel: "#sales-questions-requests" },
  greenlight: { channel: "#greenlight-requests" },
};

function routeKeyFor(value: string) {
  const normalized = value.toLowerCase();
  const matches = Object.entries(routeCatalog).filter(([, route]) => normalized.includes(route.channel));
  return matches.length === 1 ? matches[0][0] : null;
}

function dedupePolicies(policies: V3Policy[]) {
  return [...new Map(policies.map((policy) => [policy.id, policy])).values()];
}

function dedupeRecords(records: Array<Record<string, unknown>>, ...keys: string[]) {
  return [...new Map(records.map((record) => [keys.map((key) => String(record[key] || "")).join(":"), record])).values()];
}
