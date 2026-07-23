import "server-only";

import { createHash } from "node:crypto";

import {
  getV4SystemicAuthorityVersion,
  getV4SystemicEffectiveCorpusSnapshot,
  getV4SystemicOperationalPolicyCount,
} from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { getV4AtomicDecisionLedgerVersion } from "@/lib/ask-sales-faq/v4/systemic/decision-ledger";

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

// Clone before freezing so V5 cannot mutate the V4 module's cached corpus.
// The resulting object is one process-local, version-addressed knowledge view.
const effective = deepFreeze(structuredClone(getV4SystemicEffectiveCorpusSnapshot()));

function stableHash(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function validateSnapshot() {
  const errors: string[] = [];
  const ids = new Set<string>();
  for (const policy of effective.policies) {
    if (ids.has(policy.id)) errors.push(`duplicate active policy id ${policy.id}`);
    ids.add(policy.id);
    if (policy.quality_tier === "discovery_only" || policy.answerability === "discovery_only") {
      errors.push(`discovery-only policy leaked into the effective corpus: ${policy.id}`);
    }
    if (!policy.source.ids.length) errors.push(`policy has no source lineage: ${policy.id}`);
    if (policy.route_key && !effective.routeCatalog[policy.route_key]) {
      errors.push(`policy ${policy.id} references unknown route ${policy.route_key}`);
    }
  }
  if (!effective.policies.length) errors.push("effective corpus is empty");
  if (!effective.sourceKnowledgeVersion) errors.push("governed source knowledge version is missing");
  if (errors.length) throw new Error(`Invalid V5 knowledge snapshot: ${errors.slice(0, 20).join("; ")}`);
}

validateSnapshot();

const atomicDecisionVersion = getV4AtomicDecisionLedgerVersion();
const snapshotHash = stableHash({
  schemaVersion: "ask-sales-v5-knowledge-snapshot-v1",
  sourceKnowledgeVersion: effective.sourceKnowledgeVersion,
  systemicKnowledgeVersion: effective.systemicKnowledgeVersion,
  atomicDecisionVersion,
  authorityResolutionVersion: getV4SystemicAuthorityVersion(),
  policies: effective.policies.map((policy) => ({
    id: policy.id,
    decisionKey: policy.decision_key,
    decision: policy.decision,
    scopes: policy.product_scopes,
    answerability: policy.answerability,
    qualityTier: policy.quality_tier,
    authority: policy.authority,
    effectiveAt: policy.effective_at,
    sourceIds: policy.source.ids,
    sourceClass: policy.systemic.sourceClass,
    temporalRisk: policy.systemic.temporalRisk,
  })),
  blockedTopics: effective.blockedTopics,
  routeCatalog: effective.routeCatalog,
});

const snapshot = Object.freeze({
  schemaVersion: "ask-sales-v5-knowledge-snapshot-v1" as const,
  sourceKnowledgeVersion: effective.sourceKnowledgeVersion,
  systemicKnowledgeVersion: effective.systemicKnowledgeVersion,
  atomicDecisionVersion,
  authorityResolutionVersion: getV4SystemicAuthorityVersion(),
  snapshotHash,
  knowledgeVersion: `${effective.sourceKnowledgeVersion}+v5_${snapshotHash.slice(0, 16)}`,
  policies: effective.policies,
  blockedTopics: effective.blockedTopics,
  routeCatalog: effective.routeCatalog,
  operationalPolicyCount: getV4SystemicOperationalPolicyCount(),
});

export function getV5KnowledgeSnapshot() {
  return snapshot;
}

export function getV5KnowledgeVersion() {
  return snapshot.knowledgeVersion;
}

export function getV5OperationalPolicyCount() {
  return snapshot.operationalPolicyCount;
}
