import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicPolicy,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { retrieveV511Policies } from "@/lib/ask-sales-faq/v5-11/retrieval";
import { V512_SOURCE_REVIEWED_POLICIES } from "@/lib/ask-sales-faq/v5-12/knowledge";

export type V512DecisionFamily =
  | "amazon_duration_contract_negotiation"
  | "nurse_doctors_subcategory"
  | "missed_payment_cohort_six_month_wait"
  | "prison_intake_rejection"
  | "standard_contract_no_custom_amendments"
  | "company_crm_hubspot_keap"
  | "dj_seo_social_swag_definitions"
  | "oncehub_no_answer_text_email"
  | "dj_six_month_filming_reaudition"
  | "wire_close_finance_confirmation"
  | "current_package_upgrade_form"
  | "studio_visit"
  | "call1_no_audition_reschedule"
  | "physical_therapist_three_practices"
  | "cross_offer_owner"
  | "americas_authors_paid_collaboration"
  | "attorney_contract_review"
  | "payment_link_debit_card"
  | "franchise_brand_approval"
  | "passoff_recording_owner"
  | "missing_show_disposition"
  | "promotion_delivery_tracking"
  | "background_review_description"
  | "promotion_targeting"
  | "promotion_timeline";

function immutableNeedText(need: V4SystemicNeed) {
  return [need.originalRequestText, need.authorityText, need.text, ...need.domains, ...need.actions, ...need.entities]
    .filter(Boolean)
    .join(" ");
}

/**
 * This is a decision registry, not a phrase-to-answer table. Each activation
 * requires the material object, relationship, and distinguishing condition.
 * It intentionally ignores model-created retrieval queries.
 */
export function v512DecisionFamiliesForNeed(need: V4SystemicNeed): V512DecisionFamily[] {
  const text = immutableNeedText(need);
  const families: V512DecisionFamily[] = [];

  if (
    /\bamazon\s+prime\b/i.test(text) &&
    /\b(?:duration|how\s+long|remain|term|extension|extend|negotiat)\w*\b/i.test(text) &&
    /\b(?:episode|platform|contract|agreement|term)\w*\b/i.test(text)
  ) families.push("amazon_duration_contract_negotiation");

  if (
    /\bnurse\b/i.test(text) &&
    /\b(?:america['’]?s\s+top\s+doctors|doctors?\s+show|doctor|subcategory|season)\b/i.test(text) &&
    /\b(?:invalid|disqualif|eligib|cast|category|subcategory|doctor)\w*\b/i.test(text)
  ) families.push("nurse_doctors_subcategory");

  if (
    /\b(?:vip|lite)\b/i.test(text) &&
    /\b(?:payment|pay|funds?)\b/i.test(text) &&
    /\bcohort\b/i.test(text) &&
    /\b(?:closed|close|deadline|wait|reapply|try\s+again|transferr)\w*\b/i.test(text)
  ) families.push("missed_payment_cohort_six_month_wait");

  if (
    /\b(?:prison|incarcerat|criminal\s+history)\w*\b/i.test(text) &&
    /\b(?:intake|application|applicant|call|reject|rejection|explain)\w*\b/i.test(text)
  ) families.push("prison_intake_rejection");

  if (
    /\b(?:contract|agreement)\b/i.test(text) &&
    /\b(?:amend|customiz|custom\s+(?:clause|term)|change\s+(?:a|the)\s+(?:clause|term))\w*\b/i.test(text) &&
    /\b(?:sponsor|refund|platform|client|prospect|standard|sign)\w*\b/i.test(text)
  ) families.push("standard_contract_no_custom_amendments");

  const explicitCrmChoice = /\bcrm\b|\bhubspot\b/i.test(text) &&
    /\b(?:personal|company|track|outreach|use|moving|transition)\w*\b/i.test(text);
  const personalSystemInstead = /\bpersonal\s+(?:crm|system|tool)\b/i.test(text) && /\b(?:instead|rather|replace|use)\w*\b/i.test(text);
  if (explicitCrmChoice || personalSystemInstead) families.push("company_crm_hubspot_keap");

  const djOffer = /\b(?:daymond\s+john|dj|next\s+level\s+ceo|nlceo)\b/i.test(text);
  const benefitDefinitions = /\bseo\b/i.test(text) && /\b(?:social\s+(?:promo|promotion)|swag)\b/i.test(text) && /\b(?:mean|benefit|asset|package|explain)\w*\b/i.test(text);
  if (djOffer && benefitDefinitions) families.push("dj_seo_social_swag_definitions");

  if (
    /\boncehub\b|\bpublic\s+(?:calendar|booking)\s+link\b/i.test(text) &&
    /\b(?:no[- ]?answer|missed\s+(?:outbound\s+)?call|follow[- ]?up|initial)\w*\b/i.test(text) &&
    /\b(?:text|email|send|include|share)\w*\b/i.test(text)
  ) families.push("oncehub_no_answer_text_email");

  if (
    djOffer &&
    /\b(?:film|filming|studio)\w*\b/i.test(text) &&
    /\b(?:six|6)\s+months?\b|\b(?:delay|future\s+season|process\s+again|availability)\w*\b/i.test(text)
  ) families.push("dj_six_month_filming_reaudition");

  if (
    /\bwire(?:\s+transfer|\s+payment)?\b/i.test(text) &&
    /\b(?:contract|proof|screenshot|welcome|onboarding|pay\s*me|finance|24|48)\w*\b/i.test(text) &&
    /\b(?:sop|sequence|when|timing|steps?|process|confirm|post)\w*\b/i.test(text)
  ) families.push("wire_close_finance_confirmation");

  if (
    /\b(?:upgrade|downgrade)\w*\b/i.test(text) &&
    /\b(?:package|existing\s+client|form)\w*\b/i.test(text) &&
    /\b(?:form|process|where|find|search|use)\w*\b/i.test(text)
  ) families.push("current_package_upgrade_form");

  const studio = /\bstudio\b/i.test(text);
  const visit = /\b(?:visit|tour|stop\s+by|drop\s+by|pop[- ]?in|come\s+by|walkthrough)\b/i.test(text);
  const prospectStage = /\b(?:prospect|before\s+(?:decid|sign|filming)|informal|pre[- ]?(?:sign|filming))\w*\b/i.test(text);
  if (studio && visit && prospectStage) families.push("studio_visit");

  const call1 = /\b(?:call\s*1|first\s+(?:call|audition)|audition)\b/i.test(text);
  const notConducted = /\b(?:never|not|didn['’]?t|did\s+not|no[- ]?show)\b[\s\S]{0,90}\b(?:complete|conduct|happen|attend|audition|call)\w*\b|\bno[- ]?show\w*\b/i.test(text);
  const reschedule = /\b(?:reschedul|rebook|following\s+week|next\s+week|90\s+days?|wait|reapply)\w*\b/i.test(text);
  if (call1 && notConducted && reschedule) families.push("call1_no_audition_reschedule");

  if (
    /\b(?:physical\s+therapist|physiotherapist)\b/i.test(text) &&
    /\b(?:three|3)\b[\s\S]{0,60}\bpractice\w*\b|\bpractice\w*\b[\s\S]{0,60}\b(?:three|3)\b/i.test(text) &&
    /\b(?:best\s+doctors|doctor\w*\s+show|qualif|eligib|fit)\w*\b/i.test(text)
  ) families.push("physical_therapist_three_practices");

  const dj = /\b(?:daymond\s+john|dj|nlceo|next\s+level\s+ceo)\b/i.test(text);
  const istv = /\b(?:istv|inside\s+success|different\s+show|both\s+shows?)\b/i.test(text);
  const ownership = /\b(?:rep|owner|booking|call\s*1|first\s+call|continue|cancel|sell)\w*\b/i.test(text);
  if (dj && istv && ownership) families.push("cross_offer_owner");

  if (
    /\bamerica['’]?s\s+authors\b/i.test(text) &&
    /\b(?:paid\s+book\s+collaboration|book\s+collaboration|collaborative\s+book)\w*\b/i.test(text) &&
    /\b(?:fit|qualif|eligib|candidate|suitable)\w*\b/i.test(text)
  ) families.push("americas_authors_paid_collaboration");

  if (
    /\b(?:attorney|lawyer|legal\s+(?:counsel|review))\b/i.test(text) &&
    /\b(?:contract|agreement|pdf)\b/i.test(text) &&
    /\b(?:review|look\s+at|send|email|walk\s+through|insist)\w*\b/i.test(text)
  ) families.push("attorney_contract_review");

  if (
    /\bdebit\s+card\b/i.test(text) &&
    /\b(?:credit[- ]?card|card)\s+payment\s+link\b|\bpayment\s+link\b/i.test(text) &&
    /\b(?:can|accept|use|work|allowed|permit)\w*\b/i.test(text)
  ) families.push("payment_link_debit_card");

  if (
    /\bfranchise\s+owner\b|\bfranchisee\b/i.test(text) &&
    /\b(?:brand|ultimate|original)\b[\s\S]{0,50}\b(?:owner|decision[- ]?maker|approval)\w*\b/i.test(text)
  ) families.push("franchise_brand_approval");

  if (
    /\bpass[- ]?off\b/i.test(text) &&
    /\brecording\b/i.test(text) &&
    /\b(?:get|find|ask|owner|original|where)\w*\b/i.test(text)
  ) families.push("passoff_recording_owner");

  if (
    /\b(?:keap|disposition\s+form)\b/i.test(text) &&
    /\b(?:show|dropdown|option|list)\w*\b/i.test(text) &&
    /\b(?:missing|doesn['’]?t\s+list|not\s+listed|legacy\s+makers)\b/i.test(text)
  ) families.push("missing_show_disposition");

  if (
    /\bbackground\s+(?:check|review)\b/i.test(text) &&
    /\b(?:formal|full|social|google|describe|tell|say)\w*\b/i.test(text)
  ) families.push("background_review_description");

  const promotion = /\b(?:promotion|promotional|advertis|ad\s+campaign|guaranteed\s+views?|view\s+target|100[, ]?000|100k)\w*\b/i.test(text);
  if (promotion && /\b(?:deliver|track|dashboard|facebook|instagram)\w*\b/i.test(text) && !/\bhow\s+long\b/i.test(text)) {
    families.push("promotion_delivery_tracking");
  }
  if (promotion && /\b(?:audience|target|demographic|ad\s+copy|creative|keyword|location|choose)\w*\b/i.test(text)) {
    families.push("promotion_targeting");
  }
  if (promotion && /\b(?:how\s+long|timeline|duration|weeks?|months?)\w*\b/i.test(text)) {
    families.push("promotion_timeline");
  }
  return [...new Set(families)];
}

const POLICY_ID_BY_FAMILY: Record<V512DecisionFamily, string> = {
  amazon_duration_contract_negotiation: "v512src-amazon-duration-contract-negotiation",
  nurse_doctors_subcategory: "v512src-nurse-doctors-subcategory",
  missed_payment_cohort_six_month_wait: "v512src-missed-payment-cohort-six-month-wait",
  prison_intake_rejection: "v512src-prison-intake-rejection-procedure",
  standard_contract_no_custom_amendments: "v512src-standard-contract-no-custom-amendments",
  company_crm_hubspot_keap: "v512src-company-crm-hubspot-keap",
  dj_seo_social_swag_definitions: "v512src-dj-seo-social-swag-definitions",
  oncehub_no_answer_text_email: "v512src-oncehub-no-answer-text-email",
  dj_six_month_filming_reaudition: "v512src-dj-six-month-filming-and-reaudition",
  wire_close_finance_confirmation: "v512src-wire-close-finance-confirmation",
  current_package_upgrade_form: "v512src-current-package-upgrade-form",
  studio_visit: "v512src-studio-visit-virtual-walkthrough",
  call1_no_audition_reschedule: "v512src-call1-no-audition-no-wait",
  physical_therapist_three_practices: "v512src-physical-therapist-three-practices",
  cross_offer_owner: "v512src-cross-offer-first-call-owner",
  americas_authors_paid_collaboration: "v512src-americas-authors-paid-collaboration-fit",
  attorney_contract_review: "v512src-attorney-contract-review-sequence",
  payment_link_debit_card: "v512src-payment-link-debit-card",
  franchise_brand_approval: "v512src-franchise-brand-approval",
  passoff_recording_owner: "v512src-passoff-recording-owner",
  missing_show_disposition: "v512src-missing-show-disposition-sales-tech",
  promotion_delivery_tracking: "v512src-promotion-delivery-tracking",
  background_review_description: "v512src-background-review-description",
  promotion_targeting: "v512src-promotion-targeting",
  promotion_timeline: "v512src-promotion-timeline-fulfillment",
};

function policyForFamily(family: V512DecisionFamily) {
  return V512_SOURCE_REVIEWED_POLICIES.find((policy) => policy.id === POLICY_ID_BY_FAMILY[family])!;
}

function reviewedCandidate(policy: V4SystemicPolicy, need: V4SystemicNeed): V4SystemicCandidate {
  const score = 1000 + policy.specificity_priority;
  const matchedDecisionId = `${policy.id}::v512-reviewed-decision`;
  return {
    policy,
    rank: 0.01,
    score,
    matchedQueries: [need.originalRequestText || need.authorityText || need.text],
    matchedTerms: [policy.title, ...policy.question_families],
    lexicalScore: score,
    familyScore: score,
    characterScore: 0,
    structuredScore: 30,
    authorityScore: 3,
    relationScore: 30,
    semanticVectorScore: 0,
    matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: {
      [need.id]: {
        score,
        rank: 0.01,
        lexicalScore: score,
        familyScore: score,
        characterScore: 0,
        structuredScore: 30,
        semanticVectorScore: 0,
        relationScore: 30,
        matchedDecisionId,
        matchedDecisionText: policy.decision,
      },
    },
  };
}

export function retrieveV512Policies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
): V4SystemicRetrieval {
  const base = retrieveV511Policies(turn, plan);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  const selectedByNeed = new Map<string, string[]>();

  for (const need of plan.needs) {
    const selectedIds = v512DecisionFamiliesForNeed(need).map((family) => policyForFamily(family).id);
    if (!selectedIds.length) continue;
    selectedByNeed.set(need.id, selectedIds);
    for (const id of selectedIds) {
      const policy = V512_SOURCE_REVIEWED_POLICIES.find((candidate) => candidate.id === id)!;
      const injected = reviewedCandidate(policy, need);
      const existing = byId.get(id);
      byId.set(id, existing ? {
        ...existing,
        rank: Math.min(existing.rank, injected.rank),
        score: Math.max(existing.score, injected.score),
        matchedQueries: [...new Set([...existing.matchedQueries, ...injected.matchedQueries])],
        needScores: { ...(existing.needScores || {}), ...injected.needScores },
      } : injected);
    }
  }

  let exclusions = 0;
  const candidates = [...byId.values()].flatMap((candidate) => {
    const needScores = { ...(candidate.needScores || {}) };
    for (const [needId, winnerIds] of selectedByNeed) {
      if (!needScores[needId] || winnerIds.includes(candidate.policy.id)) continue;
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
      snapshotVersion: `${base.diagnostics.snapshotVersion}+v512-answer-fidelity-reviewed-slack-delta-r2`,
      needs: base.diagnostics.needs.map((diagnostic) => ({
        ...diagnostic,
        selectedPolicyIds: candidates
          .filter((candidate) => candidate.needScores?.[diagnostic.needId])
          .map((candidate) => candidate.policy.id),
      })),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v512ReviewedDecisionMatches: [...selectedByNeed.values()].reduce((sum, ids) => sum + ids.length, 0),
      v512ReviewedDecisionExclusions: exclusions,
    },
  };
}

export function v512ReviewedPoliciesForNeed(need: V4SystemicNeed, retrieval: V4SystemicRetrieval) {
  const ids = new Set(v512DecisionFamiliesForNeed(need).map((family) => POLICY_ID_BY_FAMILY[family]));
  return retrieval.candidates.filter((candidate) => ids.has(candidate.policy.id) && candidate.needScores?.[need.id]);
}
