import { createHash } from "node:crypto";

import { getV513KnowledgeVersion, getV513OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-13/knowledge";
import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

const roiBoundaryPolicy: V4SystemicPolicy = {
  id: "v514src-roi-claims-boundary",
  decision_key: "roi-claims-and-capital-raise-boundary",
  policy_key: "v514src-roi-claims-boundary",
  title: "ROI claims and capital-raise boundary",
  question_families: ["What may reps say about ROI?", "Can a rep promise or compare return on investment?"],
  decision: "Reps cannot discuss or make ROI claims, promises, comparisons, or numerical projections. Do not use capital-raise examples or numbers because of FTC compliance; keep to approved platform and fit language.",
  product_scopes: ["product_agnostic"],
  domains: ["ROI", "compliance", "sales claims"],
  actions: ["decline ROI discussion", "avoid numerical promises"],
  entities: ["sales rep", "prospect", "ROI", "capital-raise examples"],
  risk_level: "high",
  answerability: "answer_evidence",
  quality_tier: "trusted_evidence",
  quality_flags: ["source_reviewed_correction", "isolated_v514", "complete_conditional_rule"],
  route_key: null,
  route_channel: null,
  route_reason: "",
  authority: 10,
  effective_at: "2026-07-28T00:00:00+05:00",
  last_reviewed: "2026-07-28",
  source: {
    kind: "source_reviewed_governed_synthesis",
    article_id: null,
    ids: ["slack:#sales-questions-requests:1778369603.541469", "slack:#sales-questions-requests:roi-capital-raise-and-viewer-number-claims"],
    approved_by: ["Rudy Mawer", "Rich Allen", "Madeline Cary"],
  },
  search_text: "ROI return on investment claims promise compare numerical projections capital raise examples FTC compliance approved platform fit language",
  specificity_priority: 220,
  blocked_for_decision_keys: [],
  systemic: {
    temporalRisk: "stable",
    scopeRisk: "general",
    sourceClass: "governed_policy",
    ownerReviewRequired: false,
    sourceIds: ["slack:#sales-questions-requests:1778369603.541469", "slack:#sales-questions-requests:roi-capital-raise-and-viewer-number-claims"],
  },
};

export const V514_ROI_BOUNDARY_POLICY: V4SystemicPolicy = Object.freeze(roiBoundaryPolicy);

export const V514_WEEKLY_SUPPORT_DISCONTINUED_POLICY: V4SystemicPolicy = Object.freeze<V4SystemicPolicy>({
  ...roiBoundaryPolicy,
  id: "v514src-weekly-support-discontinued",
  decision_key: "six-month-weekly-support-discontinued",
  policy_key: "v514src-weekly-support-discontinued",
  title: "Former six-month weekly support program is discontinued",
  question_families: ["Do cast members still receive six months of weekly support?", "When do the weekly social-media support calls start?"],
  decision: "The former six-month weekly training or social-media support-call program has been discontinued, so there is no current start date or call schedule to promise. Reps may instead explain approved episode-usage guidance from Rudy's call videos and highlight the current Media Kit assets before ending the Zoom call.",
  domains: ["onboarding", "weekly support", "social media support", "training"],
  actions: ["explain discontinued program", "offer approved current alternatives"],
  entities: ["cast member", "six-month program", "weekly calls", "Media Kit"],
  risk_level: "medium",
  quality_tier: "canonical",
  authority: 11,
  source: {
    kind: "source_reviewed_governed_synthesis",
    article_id: null,
    ids: ["slack:C0AUQKNR8CF:1783606666.740729"],
    approved_by: ["Madeline Cary"],
  },
  search_text: "six month weekly training social media support calls discontinued no current start date schedule promise Rudy call videos Media Kit approved alternatives",
  specificity_priority: 225,
  systemic: {
    temporalRisk: "stable",
    scopeRisk: "general",
    sourceClass: "governed_policy",
    ownerReviewRequired: false,
    sourceIds: ["slack:C0AUQKNR8CF:1783606666.740729"],
  },
});

export const V514_DOCTOR_NURSE_ELIGIBILITY_POLICY: V4SystemicPolicy = Object.freeze<V4SystemicPolicy>({
  ...roiBoundaryPolicy,
  id: "v514src-doctor-nurse-eligibility-boundary",
  decision_key: "americas-best-doctors-doctor-nurse-eligibility-boundary",
  policy_key: "v514src-doctor-nurse-eligibility-boundary",
  title: "America's Best Doctors doctor and nurse eligibility boundary",
  question_families: [
    "Can an employed or retired doctor qualify without owning a practice?",
    "Can a nurse or RN qualify as a doctor for America's Best Doctors?",
  ],
  decision: "A medical doctor is not disqualified merely because they are employed, retired, work at a hospital, or do not own a practice. A nurse or RN does not qualify as a doctor for America's Best Doctors. Continue the normal fit and greenlight process for an otherwise eligible doctor; route only a genuinely different profession or edge case for confirmation.",
  domains: ["eligibility", "America's Best Doctors", "profession boundary"],
  actions: ["assess doctor eligibility", "exclude nurse from doctor category"],
  entities: ["medical doctor", "MD", "nurse", "RN", "America's Best Doctors"],
  risk_level: "high",
  quality_tier: "canonical",
  authority: 11,
  source: {
    kind: "source_reviewed_governed_synthesis",
    article_id: null,
    ids: [
      "transcript:FAQ Chatbot/transcription:mike-rich-doctor-qualification",
      "approved-claim:claim_54e4d8f4163f0486__a3",
      "owner-confirmation:2026-07-27:doctor-nurse-boundary",
    ],
    approved_by: ["Mike Wisner", "Rich Allen", "Syed Moonis Haider"],
  },
  search_text: "America's Best Doctors medical doctor MD employed retired hospital no own practice qualify nurse RN not doctor does not qualify profession boundary",
  specificity_priority: 230,
  systemic: {
    temporalRisk: "stable",
    scopeRisk: "scoped",
    sourceClass: "governed_policy",
    ownerReviewRequired: false,
    sourceIds: [
      "transcript:FAQ Chatbot/transcription:mike-rich-doctor-qualification",
      "approved-claim:claim_54e4d8f4163f0486__a3",
      "owner-confirmation:2026-07-27:doctor-nurse-boundary",
    ],
  },
});

export const V514_CALL2_QUOTE_SEQUENCE_POLICY: V4SystemicPolicy = Object.freeze<V4SystemicPolicy>({
  ...roiBoundaryPolicy,
  id: "v514src-call2-baseline-quote-sequence",
  decision_key: "main-istv-call2-baseline-objection-and-package-sequence",
  policy_key: "v514src-call2-baseline-quote-sequence",
  title: "Main ISTV Call 2 quote and price-objection sequence",
  question_families: [
    "Should a rep start with the $20,000 package and then down-sell after a price objection?",
    "What package sequence should a rep use on Call 2?",
  ],
  decision: "Start main ISTV Call 2 with the $20,000 Standard package. If the prospect objects to the price, ask what they expected it to cost, work and isolate the objection, and then down-sell to the approved Lite package or up-sell to VIP when appropriate for the prospect's needs and financial position. Use only approved package prices and listed installment plans; do not show all three prices at once or invent a custom split.",
  product_scopes: ["main_istv"],
  domains: ["pricing", "packages", "price objections", "Call 2"],
  actions: ["quote Standard", "isolate price objection", "down-sell", "up-sell"],
  entities: ["Standard package", "Lite package", "VIP package", "prospect"],
  risk_level: "high",
  quality_tier: "canonical",
  authority: 11,
  source: {
    kind: "owner_confirmed_governed_synthesis",
    article_id: "istv-nlceo-pricing-and-same-day-discount",
    ids: [
      "active-video:1FMWLYoZXQdBxu0Y0RLNl4mamepeOSaBx:04:00-08:00",
      "approved-kb:istv-nlceo-pricing-and-same-day-discount",
      "owner-confirmation:2026-07-26-call2-baseline-quote-sequence",
    ],
    approved_by: ["Syed Moonis Haider"],
  },
  search_text: "Call 2 start 20k $20,000 Standard license price objection expected cost work isolate objection downsell Lite upsell VIP approved prices installment plans",
  specificity_priority: 235,
  systemic: {
    temporalRisk: "stable",
    scopeRisk: "scoped",
    sourceClass: "governed_policy",
    ownerReviewRequired: false,
    sourceIds: [
      "active-video:1FMWLYoZXQdBxu0Y0RLNl4mamepeOSaBx:04:00-08:00",
      "approved-kb:istv-nlceo-pricing-and-same-day-discount",
      "owner-confirmation:2026-07-26-call2-baseline-quote-sequence",
    ],
  },
});

export const V514_CURRENT_PRICES_AND_PLANS_POLICY: V4SystemicPolicy = Object.freeze<V4SystemicPolicy>({
  ...roiBoundaryPolicy,
  id: "v514src-current-istv-prices-and-plans",
  decision_key: "main-istv-current-package-prices-and-listed-plans",
  policy_key: "v514src-current-istv-prices-and-plans",
  title: "Current main ISTV package prices and listed payment plans",
  question_families: [
    "What are the current main ISTV prices and payment plans?",
    "List the approved price and installment options for Lite, Standard, and VIP.",
  ],
  decision: "Main ISTV Lite is $12,000, Standard is $20,000, and VIP/Premium is $30,000. Use only the listed installment plans: Lite is 4 x $3,000, 3 x $4,000, or 2 x $6,000; Standard is 4 x $5,000 or 2 x $10,000; VIP/Premium is 4 x $7,500, 3 x $10,000, or 2 x $15,000. Do not invent a custom payment split.",
  product_scopes: ["main_istv"],
  domains: ["pricing", "packages", "payment plans"],
  actions: ["quote approved prices", "offer listed installment plans"],
  entities: ["Lite", "Standard", "VIP", "payment plans"],
  risk_level: "high",
  quality_tier: "canonical",
  authority: 11,
  source: {
    kind: "approved_article",
    article_id: "istv-nlceo-pricing-and-same-day-discount",
    ids: ["approved-kb:istv-nlceo-pricing-and-same-day-discount"],
    approved_by: ["Rich Allen", "Mike Wisner", "Syed Moonis Haider"],
  },
  search_text: "current main ISTV prices payment plans installments Lite 12000 Standard 20000 VIP 30000 approved splits",
  specificity_priority: 240,
  systemic: {
    temporalRisk: "stable",
    scopeRisk: "scoped",
    sourceClass: "governed_policy",
    ownerReviewRequired: false,
    sourceIds: ["approved-kb:istv-nlceo-pricing-and-same-day-discount"],
  },
});

export function getV514KnowledgeVersion() {
  const input = `${getV513KnowledgeVersion()}+v514_governed_v3_source_preservation+quote_verified_projection+roi_boundary_r2+weekly_support_discontinued_r1+doctor_nurse_boundary_r1+call2_quote_sequence_r1+current_prices_and_plans_r1+bounded_direct_projection_r1`;
  return `ask-sales-v514-${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

export function getV514OperationalPolicyCount() {
  return getV513OperationalPolicyCount() + 5;
}
