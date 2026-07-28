import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type { V4SystemicCandidate, V4SystemicNeed, V4SystemicPolicy, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { retrieveV512Policies } from "@/lib/ask-sales-faq/v5-12/retrieval";
import { V513_CURRENT_STUDIO_ADDRESS_POLICY, V513_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-13/knowledge";

const CURRENT_STUDIO_ADDRESS = /\bstudio\b[\s\S]{0,80}\b(?:address|location|located|where)\b|\b(?:address|location|located|where)\b[\s\S]{0,80}\bstudio\b|\b(?:inside\s+success|istv)\b[\s\S]{0,80}\b(?:address|location|located)\b|\b(?:address|location|located)\b[\s\S]{0,80}\b(?:inside\s+success|istv)\b/i;
const VISIT_OR_ACCESS = /\b(?:visit|tour|walkthrough|stop\s+by|come\s+by|access|permission|allowed)\b/i;

function immutableNeedText(need: V4SystemicNeed) {
  return [need.text, need.authorityText, need.originalRequestText, ...need.actions, ...need.entities].filter(Boolean).join(" ");
}

export function isV513CurrentStudioAddressNeed(need: V4SystemicNeed) {
  const text = immutableNeedText(need);
  return CURRENT_STUDIO_ADDRESS.test(text) && !VISIT_OR_ACCESS.test(text);
}

function reviewedPoliciesForNeed(need: V4SystemicNeed) {
  const text = immutableNeedText(need);
  const ids: string[] = [];
  if (/\boutbound\b/i.test(text) && /\b(?:previous|previously|before|prior)\b/i.test(text) && /\b(?:rep|representative)\b/i.test(text) && /\b(?:pass|handoff|return|dealt|assign)\w*\b/i.test(text)) {
    ids.push("v513src-prior-applicant-previous-rep-handoff");
  }
  if (/\b(?:discount|reduction|\$?2[, ]?000|2k)\b/i.test(text) && /\b(?:same\s+day|next\s+day|tomorrow|yesterday|recording\s+date)\b/i.test(text)) {
    ids.push("v513src-same-day-discount-date-boundary");
  }
  return V513_SOURCE_REVIEWED_POLICIES.filter((policy) => ids.includes(policy.id));
}

function reviewedCandidate(need: V4SystemicNeed, policy: typeof V513_CURRENT_STUDIO_ADDRESS_POLICY): V4SystemicCandidate {
  const score = 1400;
  return {
    policy,
    rank: 0,
    score,
    matchedQueries: [need.text],
    matchedTerms: ["current studio address", "751 Collins Avenue"],
    lexicalScore: score,
    familyScore: score,
    characterScore: 0,
    structuredScore: 40,
    authorityScore: 4,
    relationScore: 40,
    semanticVectorScore: 0,
    matchedDecisionId: `${policy.id}::owner-current-address`,
    matchedDecisionText: policy.decision,
    needScores: {
      [need.id]: {
        score,
        rank: 0,
        lexicalScore: score,
        familyScore: score,
        characterScore: 0,
        structuredScore: 40,
        semanticVectorScore: 0,
        relationScore: 40,
        matchedDecisionId: `${policy.id}::owner-current-address`,
        matchedDecisionText: policy.decision,
      },
    },
  };
}

export function retrieveV513Policies(turn: V3TurnResolution, plan: V4SystemicQueryPlan): V4SystemicRetrieval {
  const base = retrieveV512Policies(turn, plan);
  const addressNeeds = new Set(plan.needs.filter(isV513CurrentStudioAddressNeed).map((need) => need.id));
  const reviewedByNeed = new Map<string, V4SystemicPolicy[]>();
  for (const need of plan.needs) {
    const policies = reviewedPoliciesForNeed(need);
    if (policies.length) reviewedByNeed.set(need.id, policies);
  }
  if (!addressNeeds.size && !reviewedByNeed.size) return base;

  const candidates: V4SystemicCandidate[] = base.candidates.flatMap((candidate): V4SystemicCandidate[] => {
    const needScores = { ...(candidate.needScores || {}) };
    for (const needId of [...addressNeeds, ...reviewedByNeed.keys()]) delete needScores[needId];
    return Object.keys(needScores).length ? [{ ...candidate, needScores }] : [];
  });
  for (const need of plan.needs) {
    if (addressNeeds.has(need.id)) candidates.push(reviewedCandidate(need, V513_CURRENT_STUDIO_ADDRESS_POLICY));
    for (const policy of reviewedByNeed.get(need.id) || []) candidates.push(reviewedCandidate(need, policy));
  }

  return {
    ...base,
    candidates,
    corpusSize: base.corpusSize + 1 + V513_SOURCE_REVIEWED_POLICIES.length,
    stageTimings: { ...base.stageTimings, v513CurrentAddressMatches: addressNeeds.size, v513ReviewedDecisionMatches: [...reviewedByNeed.values()].reduce((total, policies) => total + policies.length, 0) },
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v513-decision-contract-address-r1`,
      needs: base.diagnostics.needs.map((item) => {
        if (addressNeeds.has(item.needId)) return { ...item, selectedPolicyIds: [V513_CURRENT_STUDIO_ADDRESS_POLICY.id] };
        const reviewed = reviewedByNeed.get(item.needId);
        return reviewed?.length ? { ...item, selectedPolicyIds: reviewed.map((policy) => policy.id) } : item;
      }),
    } : base.diagnostics,
  };
}
