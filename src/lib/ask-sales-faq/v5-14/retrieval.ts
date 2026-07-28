import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { retrieveV3Policies } from "@/lib/ask-sales-faq/v3/retrieval";
import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import type { V4SystemicCandidate, V4SystemicNeed, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { v4SystemicNeedPolicyRelationErrors } from "@/lib/ask-sales-faq/v4/systemic/relations";
import { v513DecisionContractErrors } from "@/lib/ask-sales-faq/v5-13/decision-contract";
import { retrieveV513Policies } from "@/lib/ask-sales-faq/v5-13/retrieval";
import { V56_OWNER_CONFIRMED_POLICIES } from "@/lib/ask-sales-faq/v5-6/knowledge";
import { V512_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-12/knowledge";
import { V514_CALL2_QUOTE_SEQUENCE_POLICY, V514_CURRENT_PRICES_AND_PLANS_POLICY, V514_DOCTOR_NURSE_ELIGIBILITY_POLICY, V514_ROI_BOUNDARY_POLICY, V514_WEEKLY_SUPPORT_DISCONTINUED_POLICY } from "@/lib/ask-sales-faq/v5-14/knowledge";

const systemicById = new Map([
  ...getV4SystemicCorpus(),
  ...V56_OWNER_CONFIRMED_POLICIES,
  ...V512_SOURCE_REVIEWED_POLICIES,
  V514_ROI_BOUNDARY_POLICY,
  V514_WEEKLY_SUPPORT_DISCONTINUED_POLICY,
  V514_DOCTOR_NURSE_ELIGIBILITY_POLICY,
  V514_CALL2_QUOTE_SEQUENCE_POLICY,
  V514_CURRENT_PRICES_AND_PLANS_POLICY,
].map((policy) => [policy.id, policy]));

function exactFamilyIds(need: V4SystemicNeed) {
  const text = [need.originalRequestText, need.authorityText, need.text, ...need.actions, ...need.entities].filter(Boolean).join(" ");
  if (/\b(?:roi|return\s+on\s+investment)\b/i.test(text)) {
    return [V514_ROI_BOUNDARY_POLICY.id];
  }
  if (/\b(?:istv|inside\s+success)\b/i.test(text) && /\b(?:price|pricing|cost)\w*\b/i.test(text) &&
    /\b(?:payment\s+plans?|installments?|split\s+payments?)\b/i.test(text)) {
    return [V514_CURRENT_PRICES_AND_PLANS_POLICY.id];
  }
  if ((/\b(?:call\s*2|call\s*two|second\s+call)\b/i.test(text) ||
      /(?:\b20k\b|\$20,?000\b)[\s\S]{0,180}\b(?:price\s+objection|too\s+expensive|lite)\b/i.test(text)) &&
    /\b(?:package|pricing|prices?|quote|standard|vip|lite|upsell|downsell)\b/i.test(text) &&
    /\b(?:present|show|offer|quote|start|lead|choose|choice|upsell|downsell|all\s+three|which\s+package|package\s+first)\b/i.test(text)) {
    return [V514_CALL2_QUOTE_SEQUENCE_POLICY.id];
  }
  if (/\b(?:contract|agreement)\b/i.test(text) &&
    /\b(?:attorney|lawyer|legal\s+(?:team|review))\b/i.test(text) &&
    /\b(?:send|share|copy|review|walk\s+through)\b/i.test(text)) {
    return ["v512src-attorney-contract-review-sequence"];
  }
  if (/\b(?:pay|paid|purchase)\b[\s\S]{0,80}\b(?:extra|more|additional)\b[\s\S]{0,100}\b(?:guarantee|force)\b[\s\S]{0,80}\b(?:apple\s*tv|tier[- ]?1|platform|placement|submission)\b|\b(?:guarantee|force)\b[\s\S]{0,80}\b(?:apple\s*tv|tier[- ]?1|platform|placement|submission)\b[\s\S]{0,100}\b(?:pay|paid|purchase)\b/i.test(text)) {
    return ["owner-vip-tier-one-platform-boundary"];
  }
  if (/\b(?:america['’]?s\s+(?:best|top)\s+doctors?|doctors?\s+show)\b/i.test(text) &&
    /\b(?:doctor|physician|m\.?d\.?)\b/i.test(text) && /\b(?:nurse|r\.?n\.?)\b/i.test(text) &&
    /\b(?:qualif|eligible|eligibility|fit)\w*\b/i.test(text)) {
    return [V514_DOCTOR_NURSE_ELIGIBILITY_POLICY.id];
  }
  if (/\b(?:call\s*1|first\s+call|audition)\b[\s\S]{0,120}\b(?:not\s+(?:on|there)|hasn['’]?t\s+joined|isn['’]?t\s+there|waiting|wait|no[- ]?show)\b|\b(?:not\s+(?:on|there)|hasn['’]?t\s+joined|isn['’]?t\s+there|waiting|wait|no[- ]?show)\b[\s\S]{0,120}\b(?:call\s*1|first\s+call|audition)\b/i.test(text)) {
    return ["v3src_no_show_attempts_and_late_join"];
  }
  if (!/\bmoney\s+mondays?\b/i.test(text) && /\b(?:six[ -]?months?|weekly)\b[\s\S]{0,100}\b(?:training|social\s+media\s+support)\b|\b(?:training|social\s+media\s+support)\b[\s\S]{0,100}\b(?:six[ -]?months?|weekly)\b/i.test(text)) {
    return [V514_WEEKLY_SUPPORT_DISCONTINUED_POLICY.id];
  }
  if (/\bvip\b[\s\S]{0,80}\b(?:highest|top|largest|premium)\b[\s\S]{0,40}\b(?:package|tier|license)\b|\b(?:highest|top|largest)\b[\s\S]{0,80}\bvip\b/i.test(text)) {
    return ["claim_c9e50172a4cd057b"];
  }
  if (/\b(?:outbound\s+(?:dialing|call)|dialing\s+list)\b[\s\S]{0,120}\b(?:communications?|messages?|email|sms|text)\b|\b(?:communications?|messages?|email|sms|text)\b[\s\S]{0,120}\b(?:outbound\s+(?:dialing|call)|dialing\s+list)\b/i.test(text)) {
    return ["claim_3585b16e8ef643a9"];
  }
  if (/\bmastermind\b[\s\S]{0,120}\b(?:networking|marketing)\b[\s\S]{0,60}\b(?:or|purpose|learn)\b|\b(?:networking|marketing)\b[\s\S]{0,80}\b(?:or|purpose|learn)\b[\s\S]{0,120}\bmastermind\b/i.test(text)) {
    return ["operational_c034c7d5961ca0e6"];
  }
  return [];
}

function exactFamilyCandidate(need: V4SystemicNeed, id: string): V4SystemicCandidate | null {
  const policy = systemicById.get(id);
  if (!policy || policy.answerability !== "answer_evidence") return null;
  // Exact families are activated by a complete relationship-specific guard.
  // The later generic contract can reject valid negative answers (for example,
  // "there is no start date because the program ended"), so only apply it to
  // records that were not introduced as reviewed exact-family decisions.
  const reviewedExactFamily = policy.id.startsWith("v514src-") ||
    policy.id === "owner-call2-baseline-package-sequence" ||
    policy.id === "owner-vip-tier-one-platform-boundary" ||
    policy.id === "v512src-attorney-contract-review-sequence";
  if (!reviewedExactFamily && v513DecisionContractErrors(need, policy).length) return null;
  const score = 1250 + policy.specificity_priority;
  const matchedDecisionId = `${policy.id}::v514-exact-material-family`;
  return {
    policy, rank: 0.1, score, matchedQueries: [need.originalRequestText || need.text], matchedTerms: [policy.title],
    lexicalScore: score, familyScore: score, characterScore: 0, structuredScore: 30,
    authorityScore: Math.min(3, policy.authority / 4), relationScore: 30, semanticVectorScore: 0,
    matchedDecisionId, matchedDecisionText: policy.decision,
    needScores: { [need.id]: {
      score, rank: 0.1, lexicalScore: score, familyScore: score, characterScore: 0, structuredScore: 30,
      semanticVectorScore: 0, relationScore: 30, matchedDecisionId, matchedDecisionText: policy.decision,
    } },
  };
}

function preservedCandidate(need: V4SystemicNeed, match: ReturnType<typeof retrieveV3Policies>["candidates"][number]): V4SystemicCandidate | null {
  const policy = systemicById.get(match.policy.id);
  if (!policy || policy.answerability !== "answer_evidence") return null;
  if (policy.systemic.ownerReviewRequired || policy.systemic.temporalRisk === "live_only") return null;
  if (v4SystemicNeedPolicyRelationErrors(need, policy).length || v513DecisionContractErrors(need, policy).length) return null;
  if (match.matchedTerms.length < 2 && match.familyScore < 5.4 && match.contextScore <= 0) return null;

  const score = Math.max(240, match.score + 180);
  const matchedDecisionId = `${policy.id}::v514-governed-v3-preservation`;
  return {
    policy,
    rank: 0.25,
    score,
    matchedQueries: [need.originalRequestText || need.authorityText || need.text],
    matchedTerms: match.matchedTerms,
    lexicalScore: match.lexicalScore,
    familyScore: match.familyScore,
    characterScore: match.trigramScore,
    structuredScore: match.phraseScore,
    authorityScore: Math.min(3, policy.authority / 4),
    relationScore: 24,
    semanticVectorScore: 0,
    matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: {
      [need.id]: {
        score,
        rank: 0.25,
        lexicalScore: match.lexicalScore,
        familyScore: match.familyScore,
        characterScore: match.trigramScore,
        structuredScore: match.phraseScore,
        semanticVectorScore: 0,
        relationScore: 24,
        matchedDecisionId,
        matchedDecisionText: policy.decision,
      },
    },
  };
}

/**
 * V5.14 keeps V5.13's relationship contract but restores governed V3 records
 * that the later retrieval stack accidentally pruned. Historical V3 answers
 * are never reused: only current corpus records that independently pass both
 * relationship contracts are admitted to the normal raw-entailment gate.
 */
export function retrieveV514Policies(turn: V3TurnResolution, plan: V4SystemicQueryPlan): V4SystemicRetrieval {
  const base = retrieveV513Policies(turn, plan);
  // The bridge is relation-filtered below, so a wider deterministic recall
  // window is safer than letting V3's diversity cap hide a valid sibling.
  const legacy = retrieveV3Policies(turn, 64);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  const preservedByNeed = new Map<string, string[]>();
  const exactByNeed = new Map<string, string[]>();

  for (const need of plan.needs) {
    const exact = exactFamilyIds(need).flatMap((id) => {
      const candidate = exactFamilyCandidate(need, id);
      return candidate ? [candidate] : [];
    });
    if (exact.length) {
      exactByNeed.set(need.id, exact.map((candidate) => candidate.policy.id));
      for (const injected of exact) byId.set(injected.policy.id, injected);
    }
    const preserved = legacy.candidates.flatMap((match) => {
      if (exact.some((candidate) => candidate.policy.id === match.policy.id)) return [];
      const candidate = preservedCandidate(need, match);
      return candidate ? [candidate] : [];
    }).slice(0, 10);
    if (!preserved.length) continue;
    preservedByNeed.set(need.id, preserved.map((candidate) => candidate.policy.id));
    for (const injected of preserved) {
      const existing = byId.get(injected.policy.id);
      byId.set(injected.policy.id, existing ? {
        ...existing,
        score: Math.max(existing.score, injected.score),
        matchedQueries: [...new Set([...existing.matchedQueries, ...injected.matchedQueries])],
        matchedTerms: [...new Set([...existing.matchedTerms, ...injected.matchedTerms])],
        relationScore: Math.max(existing.relationScore, injected.relationScore),
        needScores: { ...(existing.needScores || {}), ...injected.needScores },
      } : injected);
    }
  }

  const candidates = [...byId.values()].flatMap((candidate) => {
    const needScores = { ...(candidate.needScores || {}) };
    for (const [needId, exactIds] of exactByNeed) {
      if (needScores[needId] && !exactIds.includes(candidate.policy.id)) delete needScores[needId];
    }
    return Object.keys(needScores).length ? [{ ...candidate, needScores }] : [];
  }).sort((left, right) => left.rank - right.rank || right.score - left.score);
  return {
    ...base,
    candidates,
    corpusSize: base.corpusSize,
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v514-governed-v3-source-preservation-r1`,
      needs: base.diagnostics.needs.map((diagnostic) => ({
        ...diagnostic,
        selectedPolicyIds: [...new Set([
          ...diagnostic.selectedPolicyIds,
          ...(preservedByNeed.get(diagnostic.needId) || []),
        ])],
      })),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v514GovernedPreservationMatches: [...preservedByNeed.values()].reduce((sum, ids) => sum + ids.length, 0),
      v514ExactMaterialFamilyMatches: [...exactByNeed.values()].reduce((sum, ids) => sum + ids.length, 0),
    },
  };
}
