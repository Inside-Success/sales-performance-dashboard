import { createHash } from "node:crypto";

import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV510KnowledgeVersion, getV510OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-10/knowledge";

/**
 * Source-reviewed syntheses reconcile records that are compatible once their
 * scope is made explicit. They are isolated to V5.11 and do not mutate the
 * production knowledge snapshot.
 */
export const V511_SOURCE_REVIEWED_POLICIES: readonly V4SystemicPolicy[] = Object.freeze([
  {
    id: "v511src-standard-payment-before-contract",
    decision_key: "standard-payment-before-contract-sequence",
    policy_key: "v511src-standard-payment-before-contract",
    title: "Standard payment-before-contract sequence",
    question_families: [
      "Can a client sign the contract before paying?",
      "What is the standard payment and contract sequence?",
    ],
    decision: "No. In the standard company process, collect payment first and then have the client sign the contract. Do not have a client sign tonight when payment will arrive tomorrow. A separately approved same-call wire workflow is a narrower exception and must not be inferred unless the question explicitly says it is a wire close.",
    product_scopes: ["unknown"],
    domains: ["payment", "contract", "closing process"],
    actions: ["collect payment", "sign contract"],
    entities: ["payment", "contract", "client"],
    risk_level: "high",
    answerability: "answer_evidence",
    quality_tier: "trusted_evidence",
    quality_flags: ["source_reviewed_correction", "isolated_v511", "complete_conditional_rule"],
    route_key: null,
    route_channel: null,
    route_reason: "",
    authority: 9.7,
    effective_at: "2026-05-25T20:40:27+05:00",
    last_reviewed: "2026-07-27",
    source: {
      kind: "authoritative_slack_operational_qna",
      article_id: null,
      ids: [
        "slack:C0AUQKNR8CF:1779582833.269479",
        "source-review:2026-07-27:standard-payment-before-contract",
      ],
      approved_by: ["Madeline"],
    },
    search_text: "standard payment first then contract signing pay tomorrow sign tonight sequence order ordinary close excludes explicit wire workflow",
    specificity_priority: 120,
    blocked_for_decision_keys: [],
    systemic: {
      temporalRisk: "stable",
      scopeRisk: "scoped",
      sourceClass: "authoritative_operational_qna",
      ownerReviewRequired: false,
      sourceIds: [
        "slack:C0AUQKNR8CF:1779582833.269479",
        "source-review:2026-07-27:standard-payment-before-contract",
      ],
    },
  },
  {
    id: "v511src-vip-platform-submission-boundary",
    decision_key: "vip-platform-submission-and-placement-boundary",
    policy_key: "v511src-vip-platform-submission-boundary",
    title: "VIP platform submission and placement boundary",
    question_families: [
      "Does VIP include several additional platforms?",
      "Can Apple TV submission be purchased separately?",
    ],
    decision: "VIP does not include placement on several extra platforms. It primarily adds one extra-platform submission opportunity, Amazon Prime, and placement is not guaranteed. Apple TV submission may be purchased separately, but paying for a submission never guarantees Apple TV placement.",
    product_scopes: ["main_istv"],
    domains: ["VIP license", "platform distribution", "submission"],
    actions: ["submit episode", "purchase Apple TV submission"],
    entities: ["VIP", "Amazon Prime", "Apple TV", "placement"],
    risk_level: "high",
    answerability: "answer_evidence",
    quality_tier: "trusted_evidence",
    quality_flags: ["source_reviewed_correction", "isolated_v511", "complete_conditional_rule"],
    route_key: null,
    route_channel: null,
    route_reason: "",
    authority: 9.8,
    effective_at: "2026-06-30T00:00:00+05:00",
    last_reviewed: "2026-07-27",
    source: {
      kind: "authoritative_slack_operational_qna",
      article_id: null,
      ids: [
        "slack:C0AUQKNR8CF:1782191013.038519",
        "kb:knowledge-base/compliance-proof/platform-proof-and-claims-boundaries.md",
        "source-review:2026-07-27:vip-platform-submission-boundary",
      ],
      approved_by: ["Madeline", "Syed Moonis Haider"],
    },
    search_text: "VIP license extra platform Amazon Prime one submission not guaranteed Apple TV paid separately submission does not guarantee placement multiple several",
    specificity_priority: 125,
    blocked_for_decision_keys: [],
    systemic: {
      temporalRisk: "stable",
      scopeRisk: "scoped",
      sourceClass: "authoritative_operational_qna",
      ownerReviewRequired: false,
      sourceIds: [
        "slack:C0AUQKNR8CF:1782191013.038519",
        "kb:knowledge-base/compliance-proof/platform-proof-and-claims-boundaries.md",
        "source-review:2026-07-27:vip-platform-submission-boundary",
      ],
    },
  },
  {
    id: "v511src-scheduled-keap-email-optout-call",
    decision_key: "scheduled-call-keap-email-optout-exception",
    policy_key: "v511src-scheduled-keap-email-optout-call",
    title: "Already-scheduled call when Keap shows an email opt-out",
    question_families: [
      "Should I cancel an already-scheduled Call 1 because Keap shows opted out?",
      "How do I handle an already-booked audition when email is opted out?",
    ],
    decision: "If a person is already scheduled for the call and Keap merely shows an email opt-out, do not cancel solely because of that status. Join and run the audition normally. If they do not appear, wait five minutes, follow up by phone or text, and mark a no-show only if there is still no response. This narrow exception does not authorize contact after an explicit STOP, do-not-contact request, or explicit cancellation.",
    product_scopes: ["unknown"],
    domains: ["Keap", "Call 1", "opt-out", "no-show"],
    actions: ["run audition", "cancel call", "follow up"],
    entities: ["scheduled applicant", "Keap email opt-out", "Call 1"],
    risk_level: "high",
    answerability: "answer_evidence",
    quality_tier: "trusted_evidence",
    quality_flags: ["source_reviewed_correction", "isolated_v511", "complete_conditional_rule"],
    route_key: null,
    route_channel: null,
    route_reason: "",
    authority: 9.7,
    effective_at: "2026-06-22T21:41:53+05:00",
    last_reviewed: "2026-07-27",
    source: {
      kind: "authoritative_slack_operational_qna",
      article_id: null,
      ids: [
        "slack:C0AUQKNR8CF:1782134400.768999",
        "kb:knowledge-base/sales-tech-support/opt-out-dnc-and-security-escalation.md",
        "source-review:2026-07-27:scheduled-keap-email-optout-call",
      ],
      approved_by: ["Madeline", "Rich Allen", "Mike Wisner"],
    },
    search_text: "already scheduled Call 1 today Keap marked opted out email do not cancel run audition five minutes phone text no show explicit STOP DNC exception",
    specificity_priority: 130,
    blocked_for_decision_keys: [],
    systemic: {
      temporalRisk: "stable",
      scopeRisk: "scoped",
      sourceClass: "authoritative_operational_qna",
      ownerReviewRequired: false,
      sourceIds: [
        "slack:C0AUQKNR8CF:1782134400.768999",
        "kb:knowledge-base/sales-tech-support/opt-out-dnc-and-security-escalation.md",
        "source-review:2026-07-27:scheduled-keap-email-optout-call",
      ],
    },
  },
  {
    id: "v511src-license-pdf-email-last-resort",
    decision_key: "license-pdf-email-last-resort-and-slide-prohibition",
    policy_key: "v511src-license-pdf-email-last-resort",
    title: "License PDF email exception and slide-deck prohibition",
    question_families: [
      "What can I email if the prospect insists on showing license options to their team?",
      "Can I email the approved license PDF instead of the sales slide deck?",
    ],
    decision: "Do not email the sales slide deck. Prefer to screen-share the approved license-options PDF and cover the options live. If the prospect still insists on something they can show their team, the approved PDF may be emailed as a last resort; the slide deck remains prohibited.",
    product_scopes: ["main_istv"],
    domains: ["license options", "sales materials", "email"],
    actions: ["screen share PDF", "email approved PDF", "withhold slide deck"],
    entities: ["approved license-options PDF", "sales slide deck", "prospect team"],
    risk_level: "high",
    answerability: "answer_evidence",
    quality_tier: "trusted_evidence",
    quality_flags: ["source_reviewed_correction", "isolated_v511", "complete_conditional_rule"],
    route_key: null,
    route_channel: null,
    route_reason: "",
    authority: 9.7,
    effective_at: "2026-04-28T02:00:45+05:00",
    last_reviewed: "2026-07-27",
    source: {
      kind: "authoritative_slack_operational_qna",
      article_id: null,
      ids: [
        "slack:C0AUQKNR8CF:1777322925.376889",
        "source-review:2026-07-27:license-pdf-email-last-resort",
      ],
      approved_by: ["Madeline"],
    },
    search_text: "prospect insists email something show team approved license options PDF last resort screen share sales slide deck prohibited",
    specificity_priority: 130,
    blocked_for_decision_keys: [],
    systemic: {
      temporalRisk: "stable",
      scopeRisk: "scoped",
      sourceClass: "authoritative_operational_qna",
      ownerReviewRequired: false,
      sourceIds: [
        "slack:C0AUQKNR8CF:1777322925.376889",
        "source-review:2026-07-27:license-pdf-email-last-resort",
      ],
    },
  },
]);

export function getV511KnowledgeVersion() {
  const input = `${getV510KnowledgeVersion()}+v511_source_reconciled_decisions_r1`;
  return `ask-sales-v511-${createHash("sha256").update(input).digest("hex").slice(0, 24)}`;
}

export function getV511OperationalPolicyCount() {
  return getV510OperationalPolicyCount() + V511_SOURCE_REVIEWED_POLICIES.length;
}
