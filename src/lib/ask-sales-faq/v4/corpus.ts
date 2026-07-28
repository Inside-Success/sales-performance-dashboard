import "server-only";

import { getMaterializedV3Registry } from "@/lib/ask-sales-faq/v3/admin-approved-releases";
import type { V3Policy } from "@/lib/ask-sales-faq/v3/types";

const registry = getMaterializedV3Registry();
export const V4_VIP_REPEAT_EPISODE_DISCOUNT_CLAIM =
  "A VIP ISTV client buying another VIP ISTV episode is eligible for 50% off the second VIP episode.";
export const V4_LITE_REPEAT_EPISODE_BOUNDARY_CLAIM =
  "A Lite license does not qualify for the 50% repeat-episode discount unless the client completes the qualifying VIP upgrade path.";
export const V4_MAIN_STANDARD_PROMO_VIEWS_CLAIM =
  "The $20,000 main ISTV Standard package includes 100,000 pre-promo views.";

const v4PolicyScopeOverrides = new Map<string, V3Policy["product_scopes"]>([
  ["claim_c9e50172a4cd057b", ["main_istv"]],
  ["claim_28235f97538aac88", ["main_istv"]],
]);
const v4PolicyDecisionOverrides = new Map<string, string>([
  [
    "claim_313aa422c956e5c1",
    `Policy context: VIP-to-VIP repeat-episode discount eligibility and the Lite-license boundary. Decision evidence: ${V4_VIP_REPEAT_EPISODE_DISCOUNT_CLAIM} ${V4_LITE_REPEAT_EPISODE_BOUNDARY_CLAIM}`,
  ],
  [
    "claim_606e9d59e3cd964f",
    "Policy context: Existing ISTV client purchasing another show and rep assignment. Decision evidence: An existing ISTV client may purchase another show; do not automatically skip the new application or call. Check Keap scheduled appointments for the original assignment. If the original rep is inactive, the current rep may take the opportunity.",
  ],
  [
    "claim_4d14d445a904a4af",
    "Policy context: Studio tours before signing or filming and the filming guest limit. Decision evidence: Prospects and their friends should not receive an in-person studio tour before signing or filming; use the approved virtual studio walkthrough instead. A client may bring up to three guests into the studio for filming.",
  ],
  [
    "claim_74f78173844719e2",
    "The company reuse license exists to cover reuse of company-produced content plus the time, energy, and deliverables promised in the license. A prospect still needs that license even if they already own another TV production license.",
  ],
  [
    "claim_49827b5abfa86d45",
    "Recorded offer videos are confidential and must not be emailed to clients. Reps may view internal slide-deck numbers, but the deck must not be shared with clients.",
  ],
  [
    "claim_51695e7c59d2608a",
    "A business owner or partner may pay for the episode when the payment is clearly tied to the correct client.",
  ],
  [
    "claim_59be9c344b9359a4",
    "Freelancing by itself should not be treated as entrepreneurship for qualification. Evaluate whether the person has a genuine business, offer, ownership, and broader fit rather than qualifying them solely because they take freelance jobs.",
  ],
  [
    "claim_d93982445e426907",
    "Use Google Calendar when OnceHub cannot provide the needed outbound-call time.",
  ],
  [
    "claim_a5945bc4fd156d47",
    "A recently disqualified applicant cannot reapply for 90 days.",
  ],
  [
    "claim_754c01ed0089dc82",
    "Client invoices are automated, and recurring payments should appear in the ledger. Reps should keep their own tracking record and invoice ISTV for their commission through the approved commission process; they should not manually invoice the client for the recurring installment.",
  ],
  [
    "claim_c9e50172a4cd057b",
    `${V4_MAIN_STANDARD_PROMO_VIEWS_CLAIM} ${registry.policies.find((policy) => policy.id === "claim_c9e50172a4cd057b")?.decision || ""}`.trim(),
  ],
]);

const v4RouteCatalog: Record<string, { channel: string; description: string }> = {
  ...registry.route_catalog,
  fulfillment: {
    channel: "the fulfillment hotline",
    description: "The exact current scriptwriter-scheduling escalation when the governed policy directs reps to fulfillment.",
  },
};

export function getV4KnowledgeVersion() {
  return registry.knowledge_version;
}

export function getV4RouteCatalog() {
  return v4RouteCatalog;
}

export function getV4MainShowNames() {
  const catalog = registry.policies.find((policy) => policy.decision_key === "current-show-source-latest-approved-show-list-1");
  if (!catalog) return [];
  const approvedSection = catalog.decision.split(/\n\s*The following accepted source updates are inactive\b/i)[0] || "";
  return approvedSection
    .split(/\r?\n/)
    .flatMap((line) => line.match(/^\s*-\s+(.+?)\s*$/)?.[1] || [])
    .map((name) => name.replace(/^["'`\s]+|["'`.\s]+$/g, "").trim())
    .filter((name) => name.length >= 4);
}

export function getV4BlockedTopics() {
  return registry.blocked_topics;
}

function effectiveV3Policies() {
  return registry.policies
    .filter((policy) => policy.quality_tier !== "discovery_only")
    .filter((policy) => policy.answerability !== "discovery_only")
    .sort((left, right) =>
      right.authority - left.authority ||
      right.specificity_priority - left.specificity_priority ||
      left.decision_key.localeCompare(right.decision_key) ||
      left.id.localeCompare(right.id),
    );
}

/**
 * Complete, serialization-safe inputs to the effective-corpus fingerprints used
 * by the paired evaluator. These deliberately include the full effective policy
 * objects (including decisions, scopes, and quality flags), blockers, and route
 * catalog so a shared source registry version cannot hide a V4-only overlay.
 */
export function getV3EffectiveCorpusSnapshot() {
  return {
    sourceKnowledgeVersion: registry.knowledge_version,
    policies: effectiveV3Policies(),
    blockedTopics: registry.blocked_topics,
    routeCatalog: registry.route_catalog,
  };
}

export function getV4EffectiveCorpusSnapshot() {
  return {
    sourceKnowledgeVersion: registry.knowledge_version,
    policies: getV4Corpus(),
    blockedTopics: getV4BlockedTopics(),
    routeCatalog: getV4RouteCatalog(),
  };
}

export function getV4Corpus(): V3Policy[] {
  return effectiveV3Policies()
    .map((policy) => {
      const productScopes = v4PolicyScopeOverrides.get(policy.id);
      const decision = v4PolicyDecisionOverrides.get(policy.id);
      if (!productScopes && !decision) return policy;
      return {
        ...policy,
        ...(productScopes ? { product_scopes: [...productScopes] } : {}),
        ...(decision ? {
          decision,
          quality_flags: policy.quality_flags.filter((flag) => flag !== "context_dependent_opening"),
        } : {}),
      };
    })
    .sort((left, right) =>
      right.authority - left.authority ||
      right.specificity_priority - left.specificity_priority ||
      left.decision_key.localeCompare(right.decision_key) ||
      left.id.localeCompare(right.id),
    );
}

export function policyEvidenceText(policy: V3Policy) {
  return [
    policy.title,
    ...policy.question_families,
    policy.decision,
    ...policy.product_scopes,
    ...policy.domains,
    ...policy.actions,
    ...policy.entities,
  ].filter(Boolean).join(" ");
}
