import "server-only";

import { createHash } from "node:crypto";

import curatedAuthorityJson from "@/lib/ask-sales-faq/v4/systemic/curated-authority-supplement.json";
import operationalQnaJson from "@/lib/ask-sales-faq/v4/systemic/generated-operational-qna.json";
import {
  getV4BlockedTopics,
  getV4Corpus,
  getV4KnowledgeVersion,
  getV4RouteCatalog,
} from "@/lib/ask-sales-faq/v4/corpus";
import type { V3Policy } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

type OperationalQnaBundle = {
  schema_version: string;
  generated_at: string;
  source_sha256: string;
  classification_sha256: string;
  policies: V4SystemicPolicy[];
};

type CuratedAuthorityBundle = {
  schema_version: string;
  generated_at: string;
  source_sha256: string;
  evidence_register: Array<Record<string, unknown>>;
  policies: V4SystemicPolicy[];
};

const operationalBundle = operationalQnaJson as OperationalQnaBundle;
const curatedAuthorityBundle = curatedAuthorityJson as CuratedAuthorityBundle;

function governedMetadata(policy: V3Policy): V4SystemicPolicy["systemic"] {
  const decision = policy.decision.toLowerCase();
  const liveOnly = /\b(?:current|latest|updated|live)\s+(?:date|schedule|availability|status|owner|venue|location|address|link|url|form|template|artifact)\b/.test(decision) ||
    /\b(?:today|tomorrow|tonight|this week|next (?:event|week|month)|upcoming event)\b/.test(decision);
  const requiresCurrentVerification = /\b(?:check|confirm|verify|route|ask)\b.{0,120}\b(?:current|latest|updated|live|owner|date|schedule|availability|venue|location|address|link|url|form|template|artifact)\b/.test(decision);
  // A governed answer remains usable until governance supersedes it. Merely
  // mentioning an event, form, or owner does not make a stable entitlement or
  // procedure live-only; the actual decision must depend on changing state.
  const timeSensitive = liveOnly || requiresCurrentVerification || policy.answerability !== "answer_evidence";
  return {
    temporalRisk: liveOnly ? "live_only" : timeSensitive ? "time_sensitive" : "stable",
    scopeRisk: "general",
    sourceClass: "governed_policy",
    ownerReviewRequired: false,
    sourceIds: [...policy.source.ids],
  };
}

function validOperationalPolicy(value: unknown): value is V4SystemicPolicy {
  if (!value || typeof value !== "object") return false;
  const policy = value as Partial<V4SystemicPolicy>;
  return Boolean(
    policy.id &&
    policy.decision_key &&
    policy.decision &&
    Array.isArray(policy.question_families) &&
    policy.systemic?.sourceClass === "authoritative_operational_qna" &&
    Array.isArray(policy.systemic.sourceIds),
  );
}

const governedPolicies = getV4Corpus().map((policy): V4SystemicPolicy => ({
  ...policy,
  systemic: governedMetadata(policy),
}));

const operationalPolicies = operationalBundle.policies
  .filter(validOperationalPolicy)
  .filter((policy) => policy.quality_tier !== "discovery_only")
  .filter((policy) => policy.answerability !== "discovery_only");

const curatedAuthorityPolicies = curatedAuthorityBundle.policies
  .filter(validOperationalPolicy)
  .filter((policy) => policy.quality_tier !== "discovery_only")
  .filter((policy) => policy.answerability !== "discovery_only");

const corpus = [...governedPolicies, ...operationalPolicies, ...curatedAuthorityPolicies]
  .sort((left, right) =>
    right.authority - left.authority ||
    right.specificity_priority - left.specificity_priority ||
    left.decision_key.localeCompare(right.decision_key) ||
    left.id.localeCompare(right.id),
  );

const systemicVersion = createHash("sha256")
  .update(JSON.stringify({
    governedKnowledgeVersion: getV4KnowledgeVersion(),
    operationalSource: operationalBundle.source_sha256,
    operationalClassification: operationalBundle.classification_sha256,
    curatedAuthoritySource: curatedAuthorityBundle.source_sha256,
    policies: corpus.map((policy) => ({
      id: policy.id,
      decisionKey: policy.decision_key,
      decision: policy.decision,
      answerability: policy.answerability,
      sourceClass: policy.systemic.sourceClass,
      temporalRisk: policy.systemic.temporalRisk,
    })),
  }))
  .digest("hex")
  .slice(0, 16);

export function getV4SystemicCorpus() {
  return corpus;
}

export function getV4SystemicOperationalPolicyCount() {
  return operationalPolicies.length + curatedAuthorityPolicies.length;
}

export function getV4SystemicCuratedAuthorityPolicyCount() {
  return curatedAuthorityPolicies.length;
}

export function getV4SystemicKnowledgeVersion() {
  return `${getV4KnowledgeVersion()}+${systemicVersion}`;
}

export function getV4SystemicBlockedTopics() {
  return getV4BlockedTopics();
}

export function getV4SystemicRouteCatalog() {
  return getV4RouteCatalog();
}

export function getV4SystemicEffectiveCorpusSnapshot() {
  return {
    sourceKnowledgeVersion: getV4KnowledgeVersion(),
    systemicKnowledgeVersion: getV4SystemicKnowledgeVersion(),
    policies: corpus,
    blockedTopics: getV4SystemicBlockedTopics(),
    routeCatalog: getV4SystemicRouteCatalog(),
  };
}

export function v4SystemicPolicyText(policy: V4SystemicPolicy) {
  return [
    policy.title,
    ...policy.question_families,
    policy.decision,
    ...policy.product_scopes,
    ...policy.domains,
    ...policy.actions,
    ...policy.entities,
    ...policy.systemic.sourceIds,
  ].filter(Boolean).join(" ");
}
