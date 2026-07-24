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
const HIGH_RISK_OPERATIONAL_DOMAIN = /\b(?:background|billing|casting|cohort|commission|compliance|contract|eligibility|financ(?:e|ial)|greenlight|lawsuit|legal|payment|pricing|refund|reapply|royalt|wire|ach)\b/i;
const TEMPORAL_OR_QUOTA_RULE = /\b(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|weekend|next\s+week|upcoming|per\s+(?:day|week|month|year)|one\s+time|one\s+(?:day|week|month|year|ticket)|two\s+(?:day|week|month|year)|three\s+(?:day|week|month|year)|deadline|cohort)\b/i;
const SENSITIVE_CASE_DECISION = /\b(?:criminal|prison|disqualif|reject(?:ion)?|close\s+(?:the\s+)?applicant|not\s+a\s+fit|sex\s+work|adult\s+entertainer|background\s+check|royalt|monetary\s+value|investment\s+required)\b/i;
const DEICTIC_OR_PERSONAL_ROUTE = /\b(?:not\s+here|in\s+here|dm\s+(?:madeline|rudy|rich|raul|mike|zubair)|contact\s+(?:madeline|rudy|rich|raul|mike|zubair))\b/i;
const SENIOR_OPERATIONAL_APPROVER = /\b(?:rich|mike|rudy)\b/i;
const HARD_LIVE_OR_VOLATILE = /https?:\/\/|\bwww\.|\b(?:current|latest|today|tomorrow|right\s+now|at\s+the\s+moment|this\s+(?:week|month|cohort))\b.{0,90}\b(?:status|availability|capacity|cap|quota|inventory|slots?|rate|percentage|metric|date|time|link|url|form|sheet|schedule|price|pricing|discount|offer|casting)\b|\b(?:status|availability|capacity|cap|quota|inventory|slots?|rate|percentage|metric|date|time|link|url|form|sheet|schedule|price|pricing|discount|offer|casting)\b.{0,90}\b(?:current|latest|today|tomorrow|right\s+now|at\s+the\s+moment|this\s+(?:week|month|cohort))\b/i;
const UNRESOLVED_OR_NONFINAL = /\b(?:no\s+clear\s+(?:answer|decision|resolution|directive|policy)|not\s+(?:confirmed|finalized|resolved)|unclear|unknown|conflicting\s+(?:guidance|information|views)|further\s+(?:discussion|review)\s+(?:is\s+)?(?:needed|required)|does\s+not\s+(?:definitively\s+)?(?:answer|confirm|establish|resolve))\b/i;
const CONTEXT_BOUND_OR_ONE_OFF = /\b(?:one[- ]off\s+exception|as\s+an?\s+exception|email\s+is\s+(?:well[- ]crafted|approved)|shorten(?:ed)?\s+(?:the|this)\s+email|you\s+should\s+not\s+be\s+on\b|not\s+yet\s+assigned|ask\s+the\s+specified\s+person|ask\s+tech\s+for\s+assistance)\b/i;
const LIVE_LIFECYCLE_OR_FUTURE_STATE = /\b(?:currently\s+paused|production\s+is\s+(?:currently\s+)?paused|new\s+crm\s+should|next\s+event|occasionally\s+announced|once\s+or\s+twice\s+a\s+year)\b/i;
const HIGH_VOLATILITY_OFFER = /\b(?:one[- ]on[- ]one\s+meeting\s+with\s+daymond\s+john|vip\s+ticket|oscars?|major\s+premieres?)\b/i;
const ACTIVE_SCOPED_WINDOW_DAYS = 60;

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

export type V53OperationalTier = "stable_answer" | "active_scoped_answer" | "historical_support" | "live_route_only";

export type V53ActiveScopedOperationalClassification = {
  eligible: boolean;
  tier: V53OperationalTier;
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

function dateTimestamp(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function daysBetween(newer: string, older: string) {
  const newest = dateTimestamp(newer);
  const oldest = dateTimestamp(older);
  return newest && oldest ? Math.max(0, (newest - oldest) / 86_400_000) : Number.POSITIVE_INFINITY;
}

/**
 * V5.3's middle tier admits recently reviewed, reusable operational rules with
 * explicit release-relative dating. It never admits live state, mutable
 * artifacts, unresolved positions, owner-review cases, or case-specific facts.
 * Numeric, temporal, or high-risk decisions additionally require a senior
 * operational approver (Rich, Mike, or Rudy).
 */
export function classifyV53ActiveScopedOperationalRule(
  policy: V4SystemicPolicy,
  referenceReviewDate: string,
): V53ActiveScopedOperationalClassification {
  if (policy.answerability === "answer_evidence") return {
    eligible: true,
    tier: "stable_answer",
    reasons: [],
  };
  const text = [policy.title, ...policy.question_families, policy.decision].join(" ");
  const reasons: string[] = [];
  if (policy.systemic.sourceClass !== "authoritative_operational_qna") reasons.push("not_authoritative_operational_qna");
  if (policy.answerability !== "route_or_support") reasons.push("not_route_or_support");
  if (policy.systemic.ownerReviewRequired) reasons.push("owner_review_required");
  if (policy.systemic.scopeRisk === "case_specific") reasons.push("case_specific");
  if (policy.systemic.temporalRisk === "live_only") reasons.push("live_only");
  if (!policy.source.ids.some((id) => id.startsWith("slack:"))) reasons.push("not_slack_sourced");
  if (!policy.source.approved_by.some((name) => AUTHORIZED_OPERATIONAL_APPROVERS.test(name))) reasons.push("no_authoritative_approver");
  if (policy.blocked_for_decision_keys.length) reasons.push("blocked_decision");
  if (!REUSABLE_RULE.test(policy.decision)) reasons.push("not_reusable_rule_shaped");
  if (HARD_LIVE_OR_VOLATILE.test(text) || VOLATILE_DECISION_KEY.test(policy.decision_key)) reasons.push("live_or_volatile_value");
  if (CHANGEABLE_ARTIFACT_OR_ACCESS.test(text)) reasons.push("changeable_artifact_or_access");
  if (UNCERTAIN_LANGUAGE.test(policy.decision)) reasons.push("uncertain_language");
  if (UNRESOLVED_OR_NONFINAL.test(policy.decision) || /(?:conflict|unresolved|unclear|unknown)/i.test(policy.decision_key)) reasons.push("unresolved_or_nonfinal");
  if (CONTEXT_BOUND_OR_ONE_OFF.test(text)) reasons.push("context_bound_or_one_off");
  if (LIVE_LIFECYCLE_OR_FUTURE_STATE.test(text)) reasons.push("live_lifecycle_or_future_state");
  if (HIGH_VOLATILITY_OFFER.test(text)) reasons.push("high_volatility_offer");
  if (SENSITIVE_CASE_DECISION.test(text)) reasons.push("sensitive_case_decision");
  if (DEICTIC_OR_PERSONAL_ROUTE.test(text)) reasons.push("deictic_or_personal_route");
  if (LIVE_CASE.test(text)) reasons.push("live_case_shaped");
  if (daysBetween(referenceReviewDate, policy.last_reviewed) > ACTIVE_SCOPED_WINDOW_DAYS) reasons.push("outside_active_review_window");
  const needsSeniorApproval = hasControlledNumericValue(policy.decision) ||
    TEMPORAL_OR_QUOTA_RULE.test(text) ||
    HIGH_RISK_OPERATIONAL_DOMAIN.test([...policy.domains, ...policy.entities, policy.decision_key, text].join(" ")) ||
    policy.risk_level === "high";
  if (needsSeniorApproval && !policy.source.approved_by.some((name) => SENIOR_OPERATIONAL_APPROVER.test(name))) {
    reasons.push("senior_approval_required");
  }
  return {
    eligible: reasons.length === 0,
    tier: reasons.some((reason) => [
      "live_only",
      "live_or_volatile_value",
      "changeable_artifact_or_access",
      "live_case_shaped",
      "context_bound_or_one_off",
      "live_lifecycle_or_future_state",
      "high_volatility_offer",
    ].includes(reason))
      ? "live_route_only"
      : reasons.length
        ? "historical_support"
        : "active_scoped_answer",
    reasons,
  };
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

function primaryDecision(value: string) {
  return value.split(/\b(?:Conditions?|Boundaries):/i)[0].replace(/\s+/g, " ").trim();
}

function datedDecision(policy: V4SystemicPolicy) {
  const decision = primaryDecision(policy.decision);
  const rest = policy.decision.slice(primaryDecision(policy.decision).length).trim();
  const framed = `As of ${policy.last_reviewed}, ${decision.charAt(0).toLowerCase()}${decision.slice(1)}`;
  return `${framed}${rest ? ` ${rest}` : ""}`;
}

function compileV53ActiveScopedPolicies(policies: V4SystemicPolicy[]) {
  const referenceReviewDate = policies
    .filter((policy) => policy.systemic.sourceClass === "authoritative_operational_qna")
    .map((policy) => policy.last_reviewed)
    .sort()
    .at(-1) || "";
  const eligible = policies.filter((policy) =>
    classifyV53ActiveScopedOperationalRule(policy, referenceReviewDate).tier === "active_scoped_answer",
  );
  const eligibleByDecision = new Map<string, V4SystemicPolicy[]>();
  for (const policy of eligible) {
    const group = eligibleByDecision.get(policy.decision_key) || [];
    group.push(policy);
    eligibleByDecision.set(policy.decision_key, group);
  }
  const existingAnswerByDecision = new Map<string, V4SystemicPolicy[]>();
  for (const policy of policies.filter((candidate) => candidate.answerability === "answer_evidence")) {
    const group = existingAnswerByDecision.get(policy.decision_key) || [];
    group.push(policy);
    existingAnswerByDecision.set(policy.decision_key, group);
  }
  const selected = new Set<string>();
  const collisionReport: Array<{ decisionKey: string; candidateIds: string[]; existingAnswerIds: string[]; disposition: string }> = [];
  for (const [decisionKey, group] of eligibleByDecision) {
    const existing = existingAnswerByDecision.get(decisionKey) || [];
    if (existing.length) {
      collisionReport.push({
        decisionKey,
        candidateIds: group.map((policy) => policy.id),
        existingAnswerIds: existing.map((policy) => policy.id),
        disposition: "withheld_existing_answer_collision",
      });
      continue;
    }
    const ordered = [...group].sort((left, right) =>
      dateTimestamp(right.effective_at || right.last_reviewed) - dateTimestamp(left.effective_at || left.last_reviewed) ||
      Number(right.systemic.scopeRisk === "scoped") - Number(left.systemic.scopeRisk === "scoped") ||
      Number(right.source.approved_by.some((name) => SENIOR_OPERATIONAL_APPROVER.test(name))) - Number(left.source.approved_by.some((name) => SENIOR_OPERATIONAL_APPROVER.test(name))) ||
      left.id.localeCompare(right.id),
    );
    selected.add(ordered[0].id);
    if (ordered.length > 1) collisionReport.push({
      decisionKey,
      candidateIds: ordered.map((policy) => policy.id),
      existingAnswerIds: [],
      disposition: "newest_active_record_selected_for_release",
    });
  }
  const promotedPolicyIds: string[] = [];
  const compiledPolicies = policies.map((policy): V4SystemicPolicy => {
    if (!selected.has(policy.id)) return policy;
    promotedPolicyIds.push(policy.id);
    return {
      ...policy,
      decision: datedDecision(policy),
      answerability: "answer_evidence",
      quality_tier: "trusted_evidence",
      quality_flags: [...new Set([
        ...policy.quality_flags.filter((flag) => !flag.startsWith("answer_withheld:")),
        "v53_active_scoped_rule_compiled",
        `v53_effective_date:${policy.last_reviewed}`,
      ])],
      route_reason: "",
    };
  });
  return { policies: compiledPolicies, promotedPolicyIds, collisionReport, referenceReviewDate };
}

// Clone before compiling and freezing so V5.2 cannot mutate V4 or V5.1's
// cached corpus. The resulting object is one process-local, versioned view.
const source = structuredClone(getV4SystemicEffectiveCorpusSnapshot());
const compiledV52 = compileV52Policies(source.policies);
const compiledV53 = compileV53ActiveScopedPolicies(compiledV52.policies);
const effective = deepFreeze({ ...source, policies: compiledV53.policies });

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
  schemaVersion: "ask-sales-v5-knowledge-snapshot-v3",
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
  stablePromotedPolicyIds: compiledV52.promotedPolicyIds,
  activeScopedPromotedPolicyIds: compiledV53.promotedPolicyIds,
  activeScopedCollisionReport: compiledV53.collisionReport,
});

const snapshot = Object.freeze({
  schemaVersion: "ask-sales-v5-knowledge-snapshot-v3" as const,
  sourceKnowledgeVersion: effective.sourceKnowledgeVersion,
  systemicKnowledgeVersion: effective.systemicKnowledgeVersion,
  atomicDecisionVersion,
  authorityResolutionVersion: getV4SystemicAuthorityVersion(),
  snapshotHash,
  knowledgeVersion: `${effective.sourceKnowledgeVersion}+v5_${snapshotHash.slice(0, 16)}`,
  policies: effective.policies,
  blockedTopics: effective.blockedTopics,
  routeCatalog: effective.routeCatalog,
  stableOperationalPromotionCount: compiledV52.promotedPolicyIds.length,
  stableOperationalPromotedPolicyIds: Object.freeze([...compiledV52.promotedPolicyIds]),
  activeScopedOperationalPromotionCount: compiledV53.promotedPolicyIds.length,
  activeScopedOperationalPromotedPolicyIds: Object.freeze([...compiledV53.promotedPolicyIds]),
  activeScopedCollisionReport: deepFreeze([...compiledV53.collisionReport]),
  referenceReviewDate: compiledV53.referenceReviewDate,
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
