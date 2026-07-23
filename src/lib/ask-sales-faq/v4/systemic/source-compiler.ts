import { createHash } from "node:crypto";

import { deterministicV4SentenceErrors } from "@/lib/ask-sales-faq/v4/facts";
import { sanitizeV4SensitiveText } from "@/lib/ask-sales-faq/v4/privacy";
import type { V3Policy } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

export type V4SystemicAuthority = "madeline" | "raul" | "rich" | "mike" | "rudy";

export type V4SystemicAuthorityReply = {
  authority: V4SystemicAuthority;
  message_ts: string;
  text: string;
};

export type V4SystemicSourceThread = {
  source_id: string;
  root_ts: string;
  root_time: string;
  question: string;
  authority_replies: V4SystemicAuthorityReply[];
  thread_messages?: Array<{
    role: "participant" | "authority";
    authority?: V4SystemicAuthority;
    message_ts: string;
    text: string;
  }>;
};

export type V4SystemicClassifiedDecision = {
  decision_key: string;
  title: string;
  question_families: string[];
  decision: string;
  conditions: string[];
  exclusions: string[];
  product_scopes: Array<"main_istv" | "dj_nlceo" | "comparison" | "unknown">;
  domains: string[];
  actions: string[];
  entities: string[];
  route_key: "sales_policy" | "sales_tech" | "finance" | "fulfillment" | "greenlight" | null;
  answerability: "answer" | "partial" | "route" | "live_lookup" | "artifact" | "clarify" | "unusable";
  temporal_risk: "stable" | "time_sensitive" | "live_only";
  scope_risk: "general" | "scoped" | "case_specific";
  authority_assessment: "direct_authority" | "authority_seeking_confirmation" | "ambiguous";
  owner_review_required: boolean;
  confidence: number;
  reason: string;
};

export type V4SystemicClassifiedThread = {
  source_id: string;
  thread_classification:
    | "reusable_answer"
    | "scoped_answer"
    | "route_only"
    | "live_lookup"
    | "artifact"
    | "case_specific"
    | "unclear"
    | "no_answer";
  decisions: V4SystemicClassifiedDecision[];
};

export type V4SystemicClassificationCheckpoint = {
  schema_version: string;
  input_sha256: string;
  model: string;
  completed: Record<string, V4SystemicClassifiedThread>;
  failures: Record<string, string>;
};

export type V4SystemicRouteCatalog = Record<string, { channel: string; description: string }>;

export type V4SystemicHoldoutItem = {
  sourceId: string;
  question: string;
  rootTimestamp: string;
  authorities: V4SystemicAuthority[];
  threadClassification: V4SystemicClassifiedThread["thread_classification"];
  expectedDecisions: Array<{
    decisionKey: string;
    decision: string;
    conditions: string[];
    exclusions: string[];
    answerability: V4SystemicClassifiedDecision["answerability"];
    temporalRisk: V4SystemicClassifiedDecision["temporal_risk"];
    scopeRisk: V4SystemicClassifiedDecision["scope_risk"];
    routeKey: V4SystemicClassifiedDecision["route_key"];
    confidence: number;
  }>;
};

export type V4SystemicCompilationResult = {
  policies: V4SystemicPolicy[];
  holdout: V4SystemicHoldoutItem[];
  metrics: {
    sourceThreads: number;
    classifiedThreads: number;
    runtimeThreads: number;
    developmentThreads: number;
    holdoutThreads: number;
    answerPolicies: number;
    routePolicies: number;
    excludedDecisions: number;
    exactDuplicatesMerged: number;
    conflictingDecisionGroups: number;
    governedDuplicatesOmitted: number;
    governedConflictsOmitted: number;
    classificationFailures: number;
  };
};

type Candidate = {
  source: V4SystemicSourceThread;
  classification: V4SystemicClassifiedThread;
  decision: V4SystemicClassifiedDecision;
  temporalRisk: V4SystemicClassifiedDecision["temporal_risk"];
  answerability: V3Policy["answerability"];
  exclusionReason: string | null;
};

const DIRECT_CONFIDENCE_THRESHOLD = 0.88;
const AUTHORITY_SCORE: Record<V4SystemicAuthority, number> = {
  madeline: 9.5,
  raul: 9.5,
  // Head-of-Sales decisions control conflicting Sales Ops answers for the
  // same decision and scope. This is deliberately a role rule, not recency.
  rich: 10,
  mike: 10,
  rudy: 10,
};
const TEMPORAL_PATTERN = /\b(?:current|currently|latest|today|tomorrow|tonight|this (?:week|month|quarter|year)|next (?:week|month|event)|upcoming|still (?:available|active|casting|sent|offered)|schedule|calendar|opening slots?|availability|recently|now|no longer|new policy|new process|new limit|increased|decreased|rolled out|launching|casting status|on pause|paused|capacity|quota|daily limit|weekly limit|monthly limit|per day|per week|per month|will be (?:added|updated)|pending update|documentation update)\b|\b20\d{2}\b/i;
const COMMERCIAL_CHANGE_PATTERN = /(?:\$\s*\d|\b\d+(?:\.\d+)?\s*%\b)|\b(?:discount|promotion|promo|price|pricing|payment terms?|installment plan|refund policy|license cost|special offer)\b/i;
const NAMED_CONTACT_PATTERN = /\b(?:tag|DM|message|ask|escalate to|loop in|reach out to)\s+[A-Z][a-z]+\b/;
const LIVE_OWNER_OR_CHANNEL_PATTERN = /\b(?:channel|current owner|designated person|who handles|who owns)\b/i;
const TENTATIVE_PATTERN = /\b(?:maybe|possibly|probably|i think|i believe|i guess|should be|not sure|double[- ]check|check with|confirm with|need to confirm|waiting (?:on|for)|let me (?:ask|check|confirm))\b/i;
const DIRECT_PROCEDURAL_HEDGE_PATTERN = /\bi guess\s+(?:you(?:'d| would)?\s+)?(?:have to|would need to)\b/i;
const SOURCE_REVIEW_PATTERN = /\b(?:madeline|raul|rich|mike|rudy)\b.{0,35}\b(?:said|says|confirmed|approved|replied|answered)\b/i;
const PARTICIPANT_REVIEW_PATTERN = /\bparticipant(?:'s)?\s+(?:suggestion|answer|advice|proposal)\b/i;
const HIGH_RISK_PATTERN = /\b(?:legal|lawyer|attorney|contract(?:\s+(?:terms?|rights?|clauses?|language|edits?|changes?|obligations?))|redline|section\s+\d+|licensing rights?|content rights?|privacy|confidential|medical|health advice|diagnosis|regulated|compliance|ftc|bank account|credit card|chargeback|tax advice|refunds?|non[- ]refundable|cancellation period|payment failure|telephone payments?|payment handling|scam|wire transfer|ach payment)\b/i;
const CIRCULAR_CONDITION_PATTERN = /\b(?:must be|if (?:they|the (?:client|prospect|applicant)|the person) (?:is|are)|provided (?:they|the (?:client|prospect|applicant)) (?:is|are))\s+(?:eligible|approved|qualified)\b|\bcase[- ]by[- ]case\b/i;
const REDACTION_MARKER = /\[(?:redacted|person)\b/i;
const CASE_BOUND_ARTIFACT_PATTERN = /\b(?:the|this|provided|attached)\s+(?:email|message|script|template|document|copy|wording)\b.{0,80}\b(?:looks good|is good|is compliant|approved|acceptable|fine)\b/i;

function clean(value: unknown, limit = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function safeText(value: unknown, limit = 4000) {
  return sanitizeV4SensitiveText(clean(value, limit), limit).text;
}

function safeList(value: unknown, max = 16, limit = 500) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => safeText(item, limit)).filter(Boolean))].slice(0, max);
}

function normalizedClaim(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9%$]+/g, " ").replace(/\s+/g, " ").trim();
}

function claimTokens(value: string) {
  const stop = new Set([
    "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "has", "have", "if", "in", "is", "it", "may", "of", "on", "or", "should", "that", "the", "their", "this", "to", "was", "when", "will", "with",
  ]);
  return normalizedClaim(value).split(" ").filter((token) => token.length >= 2 && !stop.has(token));
}

function jaccard(left: string, right: string) {
  const a = new Set(claimTokens(left));
  const b = new Set(claimTokens(right));
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((token) => b.has(token)).length;
  return intersection / (a.size + b.size - intersection);
}

function sourceSupportScore(claim: string, evidence: string) {
  const claimSet = new Set(claimTokens(claim));
  const evidenceSet = new Set(claimTokens(evidence));
  if (!claimSet.size) return 0;
  return [...claimSet].filter((token) => evidenceSet.has(token)).length / claimSet.size;
}

function standaloneEndorsedDecision(value: string) {
  return value.replace(
    /\b(?:a\s+)?participant(?:'s)?\s+suggestion\s+to\s+(.+?)\s+is\s+(?:great|good|correct|right|approved|perfect|spot[ -]on)\.?/gi,
    (_match, proposal: string) => {
      const standalone = clean(proposal).replace(/^[A-Z]/, (letter) => letter.toLowerCase());
      return standalone ? `One approved workaround is to ${standalone}.` : "";
    },
  ).replace(/\.\s*\./g, ".");
}

function hash(value: string, length = 16) {
  return createHash("sha256").update(value).digest("hex").slice(0, length);
}

/**
 * A source-level split keeps every decision from one Slack thread on one side.
 * The fixed salt and 20% threshold are intentionally independent of topic and
 * model output so the held-out questions cannot be selected for easy results.
 */
export function v4SystemicSourcePartition(sourceId: string): "development" | "holdout" {
  const bucket = Number.parseInt(hash(`ask-sales-v4-systemic-holdout-v1:${sourceId}`, 8), 16) % 100;
  return bucket < 20 ? "holdout" : "development";
}

function effectiveTemporalRisk(decision: V4SystemicClassifiedDecision) {
  if (decision.temporal_risk === "live_only") return "live_only" as const;
  const text = [decision.title, decision.decision, ...decision.conditions, ...decision.question_families].join(" ");
  return decision.temporal_risk === "time_sensitive" || TEMPORAL_PATTERN.test(text) || COMMERCIAL_CHANGE_PATTERN.test(text) || NAMED_CONTACT_PATTERN.test(text) || LIVE_OWNER_OR_CHANNEL_PATTERN.test(text)
    ? "time_sensitive" as const
    : "stable" as const;
}

function sourceEvidence(source: V4SystemicSourceThread) {
  return source.thread_messages?.length
    ? source.thread_messages.map((message) => message.text).join(" ")
    : [source.question, ...source.authority_replies.map((reply) => reply.text)].join(" ");
}

function answerExclusionReason(candidate: Omit<Candidate, "answerability" | "exclusionReason">) {
  const { source, classification, decision, temporalRisk } = candidate;
  const evidence = sourceEvidence(source);
  if (!['reusable_answer', 'scoped_answer'].includes(classification.thread_classification)) return "thread is not classified as reusable or scoped";
  if (decision.answerability !== "answer") return "decision is not fully answerable";
  if (decision.authority_assessment !== "direct_authority") return "authority is not direct";
  if (decision.owner_review_required) return "owner review is required";
  if (decision.confidence < DIRECT_CONFIDENCE_THRESHOLD) return "classification confidence is below the direct-answer threshold";
  if (decision.scope_risk === "case_specific") return "decision is case specific";
  if (temporalRisk !== "stable") return "decision requires current or time-sensitive verification";
  if (!decision.question_families.some((family) => clean(family))) return "no reusable question family was extracted";
  const authorityText = source.authority_replies.map((reply) => reply.text).join(" ");
  const materialTentativeText = authorityText.replace(DIRECT_PROCEDURAL_HEDGE_PATTERN, "");
  if (TENTATIVE_PATTERN.test(materialTentativeText)) return "source reply is tentative";
  if (/\b(?:might|could|may) be\b/i.test(decision.decision)) return "decision remains tentative";
  if (HIGH_RISK_PATTERN.test([decision.title, decision.decision, ...decision.question_families].join(" "))) return "high-risk topic requires owner review";
  if (CIRCULAR_CONDITION_PATTERN.test(decision.conditions.join(" "))) return "source does not define the stated eligibility condition";
  if (CASE_BOUND_ARTIFACT_PATTERN.test([decision.decision, ...decision.conditions].join(" "))) return "approval applies to a source artifact that is not present in the reusable policy";
  if (REDACTION_MARKER.test([decision.decision, ...decision.conditions, ...decision.exclusions].join(" "))) return "source-bound redaction prevents a complete reusable answer";
  if (SOURCE_REVIEW_PATTERN.test(decision.decision)) return "decision is not standalone";
  if (PARTICIPANT_REVIEW_PATTERN.test(decision.decision)) return "decision is not standalone";
  if (deterministicV4SentenceErrors(decision.decision, evidence).length) return "decision contains unsupported deterministic facts";
  if (sourceSupportScore(decision.decision, evidence) < 0.22) return "decision has insufficient lexical support in the source thread";
  return null;
}

function candidateFrom(source: V4SystemicSourceThread, classification: V4SystemicClassifiedThread, decision: V4SystemicClassifiedDecision): Candidate {
  const standaloneDecision = { ...decision, decision: standaloneEndorsedDecision(decision.decision) };
  const temporalRisk = effectiveTemporalRisk(standaloneDecision);
  const base = { source, classification, decision: standaloneDecision, temporalRisk };
  const exclusionReason = answerExclusionReason(base);
  const canRoute = decision.answerability !== "unusable" && classification.thread_classification !== "no_answer";
  return {
    ...base,
    answerability: exclusionReason ? (canRoute ? "route_or_support" : "discovery_only") : "answer_evidence",
    exclusionReason,
  };
}

function decisionText(decision: V4SystemicClassifiedDecision) {
  const parts = [safeText(decision.decision, 1800)];
  const conditions = safeList(decision.conditions, 8, 400);
  const exclusions = safeList(decision.exclusions, 8, 400);
  if (conditions.length) parts.push(`Conditions: ${conditions.join("; ")}.`);
  if (exclusions.length) parts.push(`Boundaries: ${exclusions.join("; ")}.`);
  return parts.filter(Boolean).join(" ").replace(/\.\s*\./g, ".").trim();
}

function policyFromCandidate(candidate: Candidate, routeCatalog: V4SystemicRouteCatalog, sourceIds: string[]): V4SystemicPolicy {
  const { source, decision, temporalRisk, answerability } = candidate;
  const authorities = [...new Set(source.authority_replies.map((reply) => reply.authority))];
  const approvedBy = authorities.map((authority) => authority.charAt(0).toUpperCase() + authority.slice(1));
  const route = decision.route_key ? routeCatalog[decision.route_key] : null;
  const text = decisionText(decision);
  const productScopes = safeList(decision.product_scopes, 4, 50);
  const questionFamilies = safeList(decision.question_families, 6, 500);
  const domains = safeList(decision.domains, 8, 160);
  const actions = safeList(decision.actions, 8, 160);
  const entities = safeList(decision.entities, 8, 160);
  const date = new Date(Number.parseFloat(source.root_ts) * 1000);
  const iso = Number.isFinite(date.getTime()) ? date.toISOString() : "2026-07-22T00:00:00.000Z";
  const qualityFlags = [
    "isolated_operational_overlay",
    "source_only_compiled",
    temporalRisk,
    decision.scope_risk,
    ...(candidate.exclusionReason ? [`answer_withheld:${candidate.exclusionReason}`] : []),
  ];
  const policyId = `operational_${hash(`${decision.decision_key}\n${text}\n${sourceIds.sort().join("\n")}`)}`;
  return {
    id: policyId,
    decision_key: safeText(decision.decision_key, 160).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
    policy_key: `v4-systemic-${policyId}`,
    title: safeText(decision.title, 200) || decision.decision_key.replace(/-/g, " "),
    question_families: questionFamilies,
    decision: text,
    product_scopes: productScopes.length ? productScopes : ["unknown"],
    domains,
    actions,
    entities,
    risk_level: decision.owner_review_required || HIGH_RISK_PATTERN.test(text) ? "high" : temporalRisk === "stable" ? "medium" : "high",
    answerability,
    quality_tier: answerability === "answer_evidence" ? "trusted_evidence" : answerability === "route_or_support" ? "contextual_evidence" : "discovery_only",
    quality_flags: qualityFlags,
    route_key: decision.route_key,
    route_channel: route?.channel || null,
    route_reason: answerability === "answer_evidence" ? "" : candidate.exclusionReason || safeText(decision.reason, 500) || "Current or owner-verified guidance is required.",
    authority: Math.max(...authorities.map((authority) => AUTHORITY_SCORE[authority]), 0),
    effective_at: iso,
    last_reviewed: iso.slice(0, 10),
    source: {
      kind: "authoritative_slack_operational_qna",
      article_id: null,
      ids: [...sourceIds].sort(),
      approved_by: approvedBy.sort(),
    },
    search_text: [decision.title, ...questionFamilies, text, ...productScopes, ...domains, ...actions, ...entities].filter(Boolean).join(" "),
    specificity_priority: decision.scope_risk === "scoped" ? 55 : answerability === "answer_evidence" ? 45 : 30,
    blocked_for_decision_keys: [],
    systemic: {
      temporalRisk,
      scopeRisk: decision.scope_risk,
      sourceClass: "authoritative_operational_qna",
      ownerReviewRequired: decision.owner_review_required || Boolean(candidate.exclusionReason && HIGH_RISK_PATTERN.test(text)),
      sourceIds: [...sourceIds].sort(),
    },
  };
}

function sameScope(left: Candidate, right: Candidate) {
  const a = [...new Set(left.decision.product_scopes)].sort().join(",");
  const b = [...new Set(right.decision.product_scopes)].sort().join(",");
  return a === b || a === "unknown" || b === "unknown";
}

function candidateAuthorities(candidate: Candidate) {
  return new Set(candidate.source.authority_replies.map((reply) => reply.authority));
}

function candidateAuthorityScore(candidate: Candidate) {
  return Math.max(...[...candidateAuthorities(candidate)].map((authority) => AUTHORITY_SCORE[authority]), 0);
}

function richControlledClustersForMadelineOnlyConflicts(clusters: Candidate[][]) {
  const answerClusters = clusters.filter((cluster) => cluster.some((candidate) => candidate.answerability === "answer_evidence"));
  return new Set(answerClusters.filter((richCluster) => {
    if (!richCluster.some((candidate) => candidateAuthorities(candidate).has("rich"))) return false;
    const opposing = answerClusters.filter((cluster) => cluster !== richCluster && sameScope(cluster[0], richCluster[0]));
    const opposingAuthorities = opposing.flatMap((cluster) =>
      cluster.flatMap((candidate) => [...candidateAuthorities(candidate)]),
    );
    return opposingAuthorities.length > 0 && opposingAuthorities.every((authority) => authority === "madeline");
  }));
}

function holdoutItem(source: V4SystemicSourceThread, classification: V4SystemicClassifiedThread): V4SystemicHoldoutItem {
  return {
    sourceId: source.source_id,
    question: safeText(source.question, 2500),
    rootTimestamp: source.root_ts,
    authorities: [...new Set(source.authority_replies.map((reply) => reply.authority))].sort(),
    threadClassification: classification.thread_classification,
    expectedDecisions: classification.decisions.map((decision) => ({
      decisionKey: safeText(decision.decision_key, 160),
      decision: safeText(decision.decision, 1800),
      conditions: safeList(decision.conditions, 8, 400),
      exclusions: safeList(decision.exclusions, 8, 400),
      answerability: decision.answerability,
      temporalRisk: effectiveTemporalRisk(decision),
      scopeRisk: decision.scope_risk,
      routeKey: decision.route_key,
      confidence: decision.confidence,
    })),
  };
}

export function compileV4SystemicOperationalKnowledge(input: {
  sources: V4SystemicSourceThread[];
  checkpoint: V4SystemicClassificationCheckpoint;
  governedPolicies: V3Policy[];
  routeCatalog: V4SystemicRouteCatalog;
}): V4SystemicCompilationResult {
  const sourceById = new Map(input.sources.map((source) => [source.source_id, source]));
  const classified = Object.values(input.checkpoint.completed).filter((item) => sourceById.has(item.source_id));
  const holdout: V4SystemicHoldoutItem[] = [];
  const developmentCandidates: Candidate[] = [];
  let excludedDecisions = 0;

  for (const classification of classified) {
    const source = sourceById.get(classification.source_id)!;
    if (v4SystemicSourcePartition(source.source_id) === "holdout") {
      holdout.push(holdoutItem(source, classification));
    }
    for (const decision of classification.decisions) {
      const candidate = candidateFrom(source, classification, decision);
      if (candidate.answerability === "discovery_only") excludedDecisions += 1;
      else developmentCandidates.push(candidate);
    }
  }

  const groups = new Map<string, Candidate[]>();
  for (const candidate of developmentCandidates) {
    const key = candidate.decision.decision_key.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    groups.set(key, [...(groups.get(key) || []), candidate]);
  }

  const governedByKey = new Map(input.governedPolicies.map((policy) => [policy.decision_key, policy]));
  const policies: V4SystemicPolicy[] = [];
  let exactDuplicatesMerged = 0;
  let conflictingDecisionGroups = 0;
  let governedDuplicatesOmitted = 0;
  let governedConflictsOmitted = 0;

  for (const [decisionKey, group] of groups) {
    const clusters: Candidate[][] = [];
    for (const candidate of group.sort((left, right) =>
      candidateAuthorityScore(right) - candidateAuthorityScore(left) ||
      right.decision.confidence - left.decision.confidence,
    )) {
      const cluster = clusters.find((items) => sameScope(items[0], candidate) && jaccard(items[0].decision.decision, candidate.decision.decision) >= 0.72);
      if (cluster) {
        cluster.push(candidate);
        exactDuplicatesMerged += 1;
      } else {
        clusters.push([candidate]);
      }
    }
    const answerClusters = clusters.filter((cluster) => cluster.some((candidate) => candidate.answerability === "answer_evidence"));
    const hasUnresolvedConflict = answerClusters.some((cluster, index) =>
      answerClusters.slice(index + 1).some((other) => sameScope(cluster[0], other[0])),
    );
    if (hasUnresolvedConflict) conflictingDecisionGroups += 1;
    const richControlledClusters = hasUnresolvedConflict
      ? richControlledClustersForMadelineOnlyConflicts(clusters)
      : new Set<Candidate[]>();

    for (const cluster of clusters) {
      const representative = cluster[0];
      const sourceIds = [...new Set(cluster.map((candidate) => candidate.source.source_id))];
      const clusterHasConflict = answerClusters.some((other) => other !== cluster && sameScope(cluster[0], other[0]));
      if (clusterHasConflict && representative.answerability === "answer_evidence" && !richControlledClusters.has(cluster)) {
        representative.answerability = "route_or_support";
        representative.exclusionReason = richControlledClusters.size
          ? "a conflicting Sales Ops decision is superseded by Rich for the same decision and scope"
          : "multiple authoritative source threads produced materially different decisions";
      }

      const governed = governedByKey.get(decisionKey);
      if (governed && representative.answerability === "answer_evidence") {
        if (jaccard(governed.decision, representative.decision.decision) >= 0.65) governedDuplicatesOmitted += 1;
        else governedConflictsOmitted += 1;
        continue;
      }
      policies.push(policyFromCandidate(representative, input.routeCatalog, sourceIds));
    }
  }

  policies.sort((left, right) =>
    right.authority - left.authority ||
    right.specificity_priority - left.specificity_priority ||
    left.decision_key.localeCompare(right.decision_key) ||
    left.id.localeCompare(right.id),
  );
  holdout.sort((left, right) => left.sourceId.localeCompare(right.sourceId));
  const holdoutThreads = classified.filter((item) => v4SystemicSourcePartition(item.source_id) === "holdout").length;

  return {
    policies,
    holdout,
    metrics: {
      sourceThreads: input.sources.length,
      classifiedThreads: classified.length,
      runtimeThreads: classified.length,
      developmentThreads: classified.length - holdoutThreads,
      holdoutThreads,
      answerPolicies: policies.filter((policy) => policy.answerability === "answer_evidence").length,
      routePolicies: policies.filter((policy) => policy.answerability === "route_or_support").length,
      excludedDecisions,
      exactDuplicatesMerged,
      conflictingDecisionGroups,
      governedDuplicatesOmitted,
      governedConflictsOmitted,
      classificationFailures: Object.keys(input.checkpoint.failures).length,
    },
  };
}
