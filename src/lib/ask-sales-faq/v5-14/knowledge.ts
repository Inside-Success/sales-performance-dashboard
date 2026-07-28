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

export function getV514KnowledgeVersion() {
  const input = `${getV513KnowledgeVersion()}+v514_governed_v3_source_preservation+quote_verified_projection+roi_boundary_r2+weekly_support_discontinued_r1`;
  return `ask-sales-v514-${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

export function getV514OperationalPolicyCount() {
  return getV513OperationalPolicyCount() + 2;
}
