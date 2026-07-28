import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicPolicy,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { retrieveV510Policies } from "@/lib/ask-sales-faq/v5-10/retrieval";
import { V511_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-11/knowledge";

export type V511DecisionFamily =
  | "standard_payment_before_contract"
  | "vip_platform_submission_boundary"
  | "scheduled_keap_email_optout_call"
  | "license_pdf_email_last_resort";

function immutableNeedText(need: V4SystemicNeed) {
  return [need.authorityText, need.originalRequestText, need.text, ...need.domains, ...need.actions, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

/**
 * Activation requires the material relationship and its distinguishing scope.
 * Explicit exception contexts are rejected instead of being silently folded
 * into a general rule.
 */
export function v511DecisionFamilyForNeed(need: V4SystemicNeed): V511DecisionFamily | null {
  // Model-created retrieval queries are intentionally excluded. They may add
  // a hypothetical exception (for example "wire") that the user never named.
  const text = immutableNeedText(need);

  const paymentAndContract = /\b(?:payment|pay|paid|funds?)\b/i.test(text) && /\b(?:contract|agreement)\b/i.test(text);
  const sequence = /\b(?:before|after|first|then|sequence|order|tonight|tomorrow|later)\b/i.test(text);
  if (paymentAndContract && sequence && !/\b(?:wire|ach|bank\s+transfer)\b/i.test(text)) {
    return "standard_payment_before_contract";
  }

  if (
    /\bvip\b/i.test(text) &&
    /\b(?:platform|amazon\s+prime|apple\s+tv|tubi|submission|placement)\b/i.test(text) &&
    /\b(?:extra|additional|several|multiple|many|include|includes|cover|place|submit|purchase|pay)\w*\b/i.test(text)
  ) return "vip_platform_submission_boundary";

  const keapOptOut = /\bkeap\b/i.test(text) && /\bopt(?:ed)?[- ]?out\b/i.test(text);
  const alreadyScheduled = /\b(?:already\s+scheduled|scheduled\s+(?:for\s+)?(?:today|call)|call\s*1\s+(?:today|scheduled)|booked\s+(?:call|audition))\b/i.test(text);
  const callDecision = /\b(?:cancel|keep|join|run|proceed|call|audition)\b/i.test(text);
  const explicitDnc = /\b(?:said|replied|texted|requested?)\s+["'“”]?stop\b|\bdo[- ]?not[- ]?contact\b|\bdnc\b|\bexplicit(?:ly)?\s+(?:cancel|opt(?:ed)?[- ]?out)\b/i.test(text);
  if (keapOptOut && alreadyScheduled && callDecision && !explicitDnc) {
    return "scheduled_keap_email_optout_call";
  }

  const licenseArtifact = /\b(?:license\s+options?|approved\s+pdf|sales\s+slide\s*deck|slide\s*deck|slides?)\b/i.test(text);
  const emailForTeam = /\b(?:email|send|share)\b/i.test(text) &&
    /\b(?:insist|team|review|show|something|pdf|deck)\b/i.test(text);
  if (licenseArtifact && emailForTeam) return "license_pdf_email_last_resort";

  return null;
}

function policyForFamily(family: V511DecisionFamily) {
  const id = family === "standard_payment_before_contract"
    ? "v511src-standard-payment-before-contract"
    : family === "vip_platform_submission_boundary"
      ? "v511src-vip-platform-submission-boundary"
      : family === "scheduled_keap_email_optout_call"
        ? "v511src-scheduled-keap-email-optout-call"
        : "v511src-license-pdf-email-last-resort";
  return V511_SOURCE_REVIEWED_POLICIES.find((policy) => policy.id === id)!;
}

function familyCandidate(policy: V4SystemicPolicy, need: V4SystemicNeed): V4SystemicCandidate {
  const score = 900 + policy.specificity_priority;
  const matchedDecisionId = `${policy.id}::v510-decision-family`;
  return {
    policy,
    rank: 0.05,
    score,
    matchedQueries: [need.authorityText || need.text],
    matchedTerms: [policy.title, ...policy.question_families],
    lexicalScore: score,
    familyScore: score,
    characterScore: 0,
    structuredScore: 24,
    authorityScore: Math.min(3, policy.authority / 4),
    relationScore: 24,
    semanticVectorScore: 0,
    matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: {
      [need.id]: {
        score,
        rank: 0.05,
        lexicalScore: score,
        familyScore: score,
        characterScore: 0,
        structuredScore: 24,
        semanticVectorScore: 0,
        relationScore: 24,
        matchedDecisionId,
        matchedDecisionText: policy.decision,
      },
    },
  };
}

export function retrieveV511Policies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
): V4SystemicRetrieval {
  const base = retrieveV510Policies(turn, plan);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  const selectedByNeed = new Map<string, string>();

  for (const need of plan.needs) {
    const family = v511DecisionFamilyForNeed(need);
    if (!family) continue;
    const policy = policyForFamily(family);
    selectedByNeed.set(need.id, policy.id);
    const injected = familyCandidate(policy, need);
    const existing = byId.get(policy.id);
    byId.set(policy.id, existing ? {
      ...existing,
      rank: Math.min(existing.rank, injected.rank),
      score: Math.max(existing.score, injected.score),
      matchedQueries: [...new Set([...existing.matchedQueries, ...injected.matchedQueries])],
      needScores: { ...(existing.needScores || {}), ...injected.needScores },
    } : injected);
  }

  let exclusions = 0;
  const candidates = [...byId.values()].flatMap((candidate) => {
    const needScores = { ...(candidate.needScores || {}) };
    for (const [needId, winnerId] of selectedByNeed) {
      if (!needScores[needId] || candidate.policy.id === winnerId) continue;
      delete needScores[needId];
      exclusions += 1;
    }
    return Object.keys(needScores).length ? [{ ...candidate, needScores }] : [];
  });

  return {
    ...base,
    candidates,
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v511-source-reconciled-decisions`,
      needs: base.diagnostics.needs.map((diagnostic) => ({
        ...diagnostic,
        selectedPolicyIds: candidates.filter((candidate) => candidate.needScores?.[diagnostic.needId]).map((candidate) => candidate.policy.id),
      })),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v511SourceReconciledDecisionMatches: selectedByNeed.size,
      v511SourceReconciledDecisionExclusions: exclusions,
    },
  };
}

export function v511ReviewedPolicyForNeed(need: V4SystemicNeed, retrieval: V4SystemicRetrieval) {
  if (!v511DecisionFamilyForNeed(need)) return null;
  return retrieval.candidates.find((candidate) =>
    candidate.needScores?.[need.id] && candidate.policy.quality_flags.includes("isolated_v511")) || null;
}
