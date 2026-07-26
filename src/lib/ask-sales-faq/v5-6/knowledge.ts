import "server-only";

import { createHash } from "node:crypto";

import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5OperationalPolicyCount } from "@/lib/ask-sales-faq/v5/knowledge";
import { getV55KnowledgeVersion } from "@/lib/ask-sales-faq/v5-5/runtime";

/**
 * This policy is deliberately isolated from the governed publisher. It closes
 * one verified source-coverage gap without changing Neon, Slack, Google Drive,
 * n8n, V3, or the reusable V5 knowledge snapshot.
 */
export const V56_OWNER_CONFIRMED_POLICIES: readonly V4SystemicPolicy[] = Object.freeze([{
  id: "owner-call2-baseline-package-sequence",
  decision_key: "main-istv-call2-baseline-package-sequence",
  policy_key: "owner-call2-baseline-package-sequence",
  title: "Main ISTV Call 2 package presentation sequence",
  question_families: [
    "Which main ISTV package should a rep present first on Call 2?",
    "Should a rep show all three main ISTV package prices at once?",
    "How should a rep upsell or downsell main ISTV packages on Call 2?",
    "May a rep invent a custom payment split for a main ISTV package?",
  ],
  decision: "On main ISTV Call 2, start with the $20,000 Standard package price. Based on the prospect's needs and financial position, move only to the approved $30,000 VIP option or down to the approved $12,000 Lite option, using only the listed installment plans. Do not present all three package price options at once, and do not invent a custom payment split.",
  product_scopes: ["main_istv"],
  domains: ["pricing", "packages", "payment plans", "Call 2"],
  actions: ["present package", "upsell", "downsell", "quote approved pricing"],
  entities: ["Standard package", "VIP package", "Lite package", "installment plans", "Call 2"],
  risk_level: "high",
  answerability: "answer_evidence",
  quality_tier: "canonical",
  quality_flags: ["owner_confirmed", "isolated_overlay", "publisher_pending"],
  route_key: null,
  route_channel: null,
  route_reason: "",
  authority: 10,
  effective_at: "2026-07-26T00:00:00+05:00",
  last_reviewed: "2026-07-26",
  source: {
    kind: "owner_confirmed_isolated_overlay",
    article_id: "istv-nlceo-pricing-and-same-day-discount",
    ids: [
      "active-video:1FMWLYoZXQdBxu0Y0RLNl4mamepeOSaBx:04:00-08:00",
      "approved-kb:istv-nlceo-pricing-and-same-day-discount",
      "owner-confirmation:2026-07-26-call2-baseline-quote-sequence",
    ],
    approved_by: ["Rudy (Project owner)"],
  },
  search_text: "main ISTV Call 2 present quote start baseline Standard $20,000 20K then upsell VIP $30,000 30K or downsell Lite $12,000 12K according to needs finances approved installment plans do not show all three prices do not invent custom split",
  specificity_priority: 100,
  blocked_for_decision_keys: [],
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
}, {
  id: "owner-call1-pricing-complete-boundary",
  decision_key: "main-istv-call1-pricing-complete-boundary",
  policy_key: "owner-call1-pricing-complete-boundary",
  title: "Complete Call 1 pricing boundary and response",
  question_families: [
    "Should a rep quote a price or minimum on Call 1?",
    "What should a rep say when a prospect asks about cost on Call 1?",
    "When may price be mentioned on Call 1 only to disqualify a prospect?",
  ],
  decision: "Normally, do not discuss fees or quote a minimum on Call 1. Explain that pricing is covered on Call 2 after greenlight. The narrow exception is when the rep is sure both that the prospect has no business and is not financially qualified; price may then be mentioned only to disqualify the prospect, not to pitch or sell an offer.",
  product_scopes: ["main_istv"],
  domains: ["pricing", "Call 1", "qualification", "Call 2"],
  actions: ["defer pricing", "explain Call 2", "disqualify"],
  entities: ["price", "minimum", "prospect", "business", "financial qualification", "greenlight"],
  risk_level: "high",
  answerability: "answer_evidence",
  quality_tier: "canonical",
  quality_flags: ["owner_confirmed", "isolated_overlay", "publisher_pending", "complete_conditional_rule"],
  route_key: null,
  route_channel: null,
  route_reason: "",
  authority: 10,
  effective_at: "2026-07-03T00:31:00.000Z",
  last_reviewed: "2026-07-26",
  source: {
    kind: "owner_confirmed_isolated_overlay",
    article_id: "call-1-flow",
    ids: [
      "kb:knowledge-base/call-process/call-1-flow.md",
      "slack:C0AUQKNR8CF:1779825414.828269",
      "slack:C0AUQKNR8CF:1779828046.082489",
      "slack:C0AUQKNR8CF:1779828681.237599",
      "owner-confirmation:rich-call1-pricing-disqualification-exception-2026-07-03",
    ],
    approved_by: ["Rich", "Madeline", "Rudy (Project owner)"],
  },
  search_text: "Call 1 cost price pricing minimum do not quote defer to Call 2 after greenlight exception only no business and not financially qualified disqualify not pitch not sell",
  specificity_priority: 100,
  blocked_for_decision_keys: [],
  systemic: {
    temporalRisk: "stable",
    scopeRisk: "scoped",
    sourceClass: "governed_policy",
    ownerReviewRequired: false,
    sourceIds: [
      "kb:knowledge-base/call-process/call-1-flow.md",
      "slack:C0AUQKNR8CF:1779825414.828269",
      "slack:C0AUQKNR8CF:1779828046.082489",
      "slack:C0AUQKNR8CF:1779828681.237599",
      "owner-confirmation:rich-call1-pricing-disqualification-exception-2026-07-03",
    ],
  },
}]);

const overlayHash = createHash("sha256")
  .update(JSON.stringify(V56_OWNER_CONFIRMED_POLICIES))
  .digest("hex")
  .slice(0, 16);

export function getV56KnowledgeVersion() {
  return `${getV55KnowledgeVersion()}+v56_owner_overlay_${overlayHash}`;
}

export function getV56OperationalPolicyCount() {
  return getV5OperationalPolicyCount() + V56_OWNER_CONFIRMED_POLICIES.length;
}
