import { createHash } from "node:crypto";

import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV512KnowledgeVersion, getV512OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-12/knowledge";

/**
 * Current studio address supplied by the project owner on 2026-07-28. It is
 * intentionally narrow: this answers only the current general ISTV studio
 * address and carries no production-personnel or visit-permission claims.
 */
const currentStudioAddressPolicy: V4SystemicPolicy = {
  id: "v513-owner-current-istv-studio-address",
  decision_key: "current-inside-success-studio-address",
  policy_key: "v513-owner-current-istv-studio-address",
  title: "Current Inside Success studio address",
  question_families: [
    "What is the current Inside Success studio address?",
    "Where is the Miami studio located?",
  ],
  decision: "The current Inside Success studio is at 751 Collins Avenue, Miami Beach, FL 33139.",
  product_scopes: ["main_istv"],
  domains: ["studio location", "current address"],
  actions: ["provide current studio address"],
  entities: ["Inside Success studio", "Miami Beach", "751 Collins Avenue"],
  risk_level: "high",
  answerability: "answer_evidence",
  quality_tier: "trusted_evidence",
  quality_flags: ["owner_confirmed", "isolated_v513", "current_location_only"],
  route_key: null,
  route_channel: null,
  route_reason: "",
  authority: 10,
  effective_at: "2026-07-28T00:00:00+05:00",
  last_reviewed: "2026-07-28",
  source: {
    kind: "owner_confirmed_isolated_overlay",
    article_id: null,
    ids: ["owner-confirmation:2026-07-28:current-inside-success-studio-address"],
    approved_by: ["Syed Moonis Haider"],
  },
  search_text: "current Inside Success ISTV Miami Miami Beach studio address location 751 Collins Avenue FL 33139",
  specificity_priority: 200,
  blocked_for_decision_keys: [],
  systemic: {
    temporalRisk: "time_sensitive",
    scopeRisk: "scoped",
    sourceClass: "authoritative_operational_qna",
    ownerReviewRequired: false,
    sourceIds: ["owner-confirmation:2026-07-28:current-inside-success-studio-address"],
  },
};

export const V513_CURRENT_STUDIO_ADDRESS_POLICY: V4SystemicPolicy = Object.freeze(currentStudioAddressPolicy);

function sourceReviewedPolicy(input: {
  id: string;
  decisionKey: string;
  title: string;
  questions: string[];
  decision: string;
  domains: string[];
  actions: string[];
  entities: string[];
  sourceIds: string[];
  approvedBy: string[];
  searchText: string;
}): V4SystemicPolicy {
  return {
    ...currentStudioAddressPolicy,
    id: input.id,
    decision_key: input.decisionKey,
    policy_key: input.id,
    title: input.title,
    question_families: input.questions,
    decision: input.decision,
    product_scopes: ["unknown"],
    domains: input.domains,
    actions: input.actions,
    entities: input.entities,
    quality_flags: ["source_reviewed_correction", "isolated_v513", "complete_conditional_rule"],
    effective_at: "2026-07-27T00:00:00+05:00",
    source: {
      kind: "authoritative_slack_operational_qna",
      article_id: null,
      ids: input.sourceIds,
      approved_by: input.approvedBy,
    },
    search_text: input.searchText,
    specificity_priority: 180,
    systemic: {
      temporalRisk: "stable",
      scopeRisk: "scoped",
      sourceClass: "authoritative_operational_qna",
      ownerReviewRequired: false,
      sourceIds: input.sourceIds,
    },
  };
}

export const V513_SOURCE_REVIEWED_POLICIES: readonly V4SystemicPolicy[] = Object.freeze([
  sourceReviewedPolicy({
    id: "v513src-prior-applicant-previous-rep-handoff",
    decisionKey: "prior-applicant-previous-rep-handoff",
    title: "Prior applicant may be returned to the previous rep",
    questions: ["May an outbound lead who applied before be passed back to the previous rep?"],
    decision: "Yes. An outbound lead who previously applied and dealt with another rep may be passed back to that previous rep. Coordinate the handoff and let the receiving rep update the assignment record.",
    domains: ["lead ownership", "outbound list", "handoff"],
    actions: ["pass lead to previous rep", "coordinate assignment update"],
    entities: ["outbound lead", "previous rep", "receiving rep"],
    sourceIds: ["slack:C0AUQKNR8CF:1785166102.386839", "slack:C0AUQKNR8CF:1785166143.270379", "slack:C0AUQKNR8CF:1785173142.186759"],
    approvedBy: ["Madeline"],
    searchText: "outbound list lead previously applied dealt with previous rep pass back handoff assignment receiving rep update sheet",
  }),
  sourceReviewedPolicy({
    id: "v513src-same-day-discount-date-boundary",
    decisionKey: "same-day-discount-recording-date-boundary",
    title: "Same-day discount cannot be carried into the next day",
    questions: ["Can yesterday's same-day reduction be honored on a next-day closing call?"],
    decision: "No. A same-day reduction must be completed on the same day; the recording date and discount date must match. Do not carry yesterday's same-day reduction into a next-day call.",
    domains: ["discount", "closing call", "deadline"],
    actions: ["apply same-day reduction", "decline next-day carryover"],
    entities: ["client", "sales rep", "recording date", "discount date"],
    sourceIds: ["slack:C0AUQKNR8CF:1784953946.433359", "slack:C0AUQKNR8CF:1784988271.937069", "slack:C0AUQKNR8CF:1785161487.192649"],
    approvedBy: ["Madeline"],
    searchText: "same day 2000 reduction discount next day attorney contract call recording date discount date match cannot honor carry over",
  }),
]);

export function getV513KnowledgeVersion() {
  const input = `${getV512KnowledgeVersion()}+v513_final_decision_contract+current_studio_address_2026_07_28+reviewed_slack_handoff_discount_r1`;
  return `ask-sales-v513-${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

export function getV513OperationalPolicyCount() {
  return getV512OperationalPolicyCount() + 1 + V513_SOURCE_REVIEWED_POLICIES.length;
}
