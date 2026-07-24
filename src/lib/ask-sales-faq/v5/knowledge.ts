import "server-only";

import { createHash } from "node:crypto";

import {
  getV4SystemicAuthorityVersion,
  getV4SystemicEffectiveCorpusSnapshot,
  getV4SystemicOperationalPolicyCount,
} from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { getV4AtomicDecisionLedgerVersion } from "@/lib/ask-sales-faq/v4/systemic/decision-ledger";
import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

function deepFreeze<T>(value: T): T {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  return Object.freeze(value);
}

const AUTHORIZED_OPERATIONAL_APPROVERS = /\b(?:rich|mike|rudy|raul|madeline)\b/i;
const VOLATILE_DECISION = /\b(?:current|currently|latest|today|tomorrow|now|old|new|in\s+the\s+meantime|this\s+(?:week|month|cohort)|available|availability|status|pending|live|right\s+now|capacity|cap|quota|inventory|slot|exact\s+(?:date|time|link|url|amount|price)|send\s+window|tracking\s+sheet|end\s+of\s+day|being\s+(?:assigned|updated|changed)|will\s+be\s+(?:updated|changed|increased|removed|added))\b|https?:\/\/|\bwww\./i;
const LIVE_CASE = /\b(?:this|that|the)\s+(?:specific\s+)?(?:client|lead|prospect|cast\s+member|application|transaction|payment|contract|record|booking|appointment)\b/i;
const REUSABLE_RULE = /\b(?:must|must\s+not|should|should\s+not|can|cannot|do\s+not|don't|never|only|allowed|not\s+allowed|use|route|send|submit|post|book|schedule|control|maintain|prequalify|wrap\s+up|follow|ask|tell|check|verify|provide|share|record|keep)\b/i;
const VOLATILE_DECISION_KEY = /(?:current|latest|status|availability|capacity|quota|live|link|url|price|pricing|discount|payment-plan|send-window|exact-date|exact-time|schedule-date)/i;
const CHANGEABLE_ARTIFACT_OR_ACCESS = /\b(?:article|board|channel\s+rename|email\s+template|form|landing\s+page|link|loom|script|sheet|slide|spreadsheet|thread|tool\s+access|login|password)\b/i;
const UNCERTAIN_LANGUAGE = /\b(?:probably|possibly|maybe|might|should\s+be\s+able|i\s+think|not\s+sure|ideally)\b/i;
const HIGH_RISK_OPERATIONAL_DOMAIN = /\b(?:background|billing|casting|cohort|commission|compliance|contract|eligibility|finance|greenlight|legal|payment|pricing|refund|reapply|royalt|wire|ach)\b/i;
const TEMPORAL_OR_QUOTA_RULE = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|next\s+week|upcoming|per\s+(?:day|week|month|year)|one\s+time|one\s+(?:day|week|month|year|ticket)|two\s+(?:day|week|month|year)|three\s+(?:day|week|month|year)|deadline|cohort)\b/i;
const SENSITIVE_CASE_DECISION = /\b(?:criminal|prison|disqualif|reject(?:ion)?|close\s+(?:the\s+)?applicant|not\s+a\s+fit|sex\s+work|adult\s+entertainer|background\s+check|royalt|monetary\s+value|investment\s+required)\b/i;
const DEICTIC_OR_PERSONAL_ROUTE = /\b(?:not\s+here|in\s+here|dm\s+(?:madeline|rudy|rich|raul|mike|zubair)|contact\s+(?:madeline|rudy|rich|raul|mike|zubair))\b/i;

function hasControlledNumericValue(value: string) {
  const withoutStableStages = value
    .replace(/\bcall\s*(?:1|2|one|two|first|second)\b/gi, "")
    .replace(/\b(?:first|second)\s+call\b/gi, "");
  return /\$|\b\d/.test(withoutStableStages);
}

export type V52StableOperationalClassification = {
  eligible: boolean;
  reasons: string[];
};

/**
 * Compiles only reusable, source-attributed Slack decisions into answer evidence.
 * This is intentionally conservative: amounts, durations, current artifacts,
 * live cases, and unresolved conflicts stay non-answering even when an approved
 * person supplied the original Slack reply.
 */
export function classifyV52StableOperationalRule(policy: V4SystemicPolicy): V52StableOperationalClassification {
  const text = [policy.title, ...policy.question_families, policy.decision].join(" ");
  const reasons: string[] = [];
  if (policy.systemic.sourceClass !== "authoritative_operational_qna") reasons.push("not_authoritative_operational_qna");
  if (policy.answerability !== "route_or_support") reasons.push("not_route_or_support");
  if (policy.systemic.ownerReviewRequired) reasons.push("owner_review_required");
  if (policy.systemic.scopeRisk === "case_specific") reasons.push("case_specific");
  if (!policy.source.ids.some((id) => id.startsWith("slack:"))) reasons.push("not_slack_sourced");
  if (!policy.source.approved_by.some((name) => AUTHORIZED_OPERATIONAL_APPROVERS.test(name))) reasons.push("no_authoritative_approver");
  if (policy.blocked_for_decision_keys.length) reasons.push("blocked_decision");
  if (!REUSABLE_RULE.test(policy.decision)) reasons.push("not_reusable_rule_shaped");
  if (VOLATILE_DECISION.test(text) || VOLATILE_DECISION_KEY.test(policy.decision_key)) reasons.push("volatile_or_current");
  if (hasControlledNumericValue(policy.decision)) reasons.push("controlled_numeric_value");
  if (CHANGEABLE_ARTIFACT_OR_ACCESS.test(text)) reasons.push("changeable_artifact_or_access");
  if (UNCERTAIN_LANGUAGE.test(policy.decision)) reasons.push("uncertain_language");
  if (HIGH_RISK_OPERATIONAL_DOMAIN.test([...policy.domains, ...policy.entities, policy.decision_key].join(" "))) reasons.push("high_risk_operational_domain");
  if (TEMPORAL_OR_QUOTA_RULE.test(text)) reasons.push("temporal_or_quota_rule");
  if (SENSITIVE_CASE_DECISION.test(text)) reasons.push("sensitive_case_decision");
  if (DEICTIC_OR_PERSONAL_ROUTE.test(text)) reasons.push("deictic_or_personal_route");
  if (LIVE_CASE.test(text)) reasons.push("live_case_shaped");
  return { eligible: reasons.length === 0, reasons };
}

function compileV52Policies(policies: V4SystemicPolicy[]) {
  const promotedPolicyIds: string[] = [];
  const compiled = policies.map((policy): V4SystemicPolicy => {
    const classification = classifyV52StableOperationalRule(policy);
    if (!classification.eligible) return policy;
    promotedPolicyIds.push(policy.id);
    return {
      ...policy,
      answerability: "answer_evidence",
      quality_tier: "trusted_evidence",
      quality_flags: [...new Set([
        ...policy.quality_flags.filter((flag) => !flag.startsWith("answer_withheld:")),
        "v52_stable_rule_compiled",
      ])],
      route_reason: "",
      systemic: { ...policy.systemic, temporalRisk: "stable" },
    };
  });
  return { policies: compiled, promotedPolicyIds };
}

// Clone before compiling and freezing so V5.2 cannot mutate V4 or V5.1's
// cached corpus. The resulting object is one process-local, versioned view.
const source = structuredClone(getV4SystemicEffectiveCorpusSnapshot());
const compiled = compileV52Policies(source.policies);
const effective = deepFreeze({ ...source, policies: compiled.policies });

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
  schemaVersion: "ask-sales-v5-knowledge-snapshot-v2",
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
  promotedPolicyIds: compiled.promotedPolicyIds,
});

const snapshot = Object.freeze({
  schemaVersion: "ask-sales-v5-knowledge-snapshot-v2" as const,
  sourceKnowledgeVersion: effective.sourceKnowledgeVersion,
  systemicKnowledgeVersion: effective.systemicKnowledgeVersion,
  atomicDecisionVersion,
  authorityResolutionVersion: getV4SystemicAuthorityVersion(),
  snapshotHash,
  knowledgeVersion: `${effective.sourceKnowledgeVersion}+v5_${snapshotHash.slice(0, 16)}`,
  policies: effective.policies,
  blockedTopics: effective.blockedTopics,
  routeCatalog: effective.routeCatalog,
  stableOperationalPromotionCount: compiled.promotedPolicyIds.length,
  stableOperationalPromotedPolicyIds: Object.freeze([...compiled.promotedPolicyIds]),
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
