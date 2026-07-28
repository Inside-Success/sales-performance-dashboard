import { getV56KnowledgeVersion, getV56OperationalPolicyCount } from "@/lib/ask-sales-faq/v5-6/knowledge";
import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

export const V57_SOURCE_REVIEWED_POLICIES: readonly V4SystemicPolicy[] = Object.freeze([{
  id: "v57src-minor-call-with-guardian",
  decision_key: "minor-call-participation-with-guardian",
  policy_key: "v57src-minor-call-with-guardian",
  title: "Minor audition participation with a consenting guardian",
  question_families: [
    "Can a minor continue with an audition when a parent is present?",
    "May children participate in the call with parental consent?",
  ],
  decision: "A minor may continue with the audition or call when a parent or legal guardian is present, consents, and remains involved. This permits participation in the call; normal business, show-fit, and qualification checks still apply.",
  product_scopes: ["unknown"],
  domains: ["qualification", "call participation", "parental consent"],
  actions: ["continue audition", "participate in call"],
  entities: ["minor", "parent", "guardian", "audition"],
  risk_level: "high",
  answerability: "answer_evidence",
  quality_tier: "trusted_evidence",
  quality_flags: ["source_reviewed_correction", "isolated_v57", "complete_conditional_rule"],
  route_key: null,
  route_channel: null,
  route_reason: "",
  authority: 9.5,
  effective_at: "2026-07-08T18:11:10.534Z",
  last_reviewed: "2026-07-27",
  source: {
    kind: "authoritative_slack_operational_qna",
    article_id: null,
    ids: [
      "slack:C0AUQKNR8CF:1783534270.534319",
      "source-review:2026-07-27:minor-audition-parental-consent",
    ],
    approved_by: ["Madeline"],
  },
  search_text: "minor child children eleven 11 year old twins registered business audition call continue mother parent guardian present consent normal qualification fit",
  specificity_priority: 100,
  blocked_for_decision_keys: [],
  systemic: {
    temporalRisk: "stable",
    scopeRisk: "general",
    sourceClass: "authoritative_operational_qna",
    ownerReviewRequired: false,
    sourceIds: [
      "slack:C0AUQKNR8CF:1783534270.534319",
      "source-review:2026-07-27:minor-audition-parental-consent",
    ],
  },
}]);

export function getV57KnowledgeVersion() {
  return `${getV56KnowledgeVersion()}+v57_source_resolution_r2`;
}

export function getV57OperationalPolicyCount() {
  return getV56OperationalPolicyCount() + V57_SOURCE_REVIEWED_POLICIES.length;
}
