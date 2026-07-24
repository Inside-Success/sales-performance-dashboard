import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import { v4SystemicPolicyBoundaryErrors } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import { v4SystemicNeedPolicyRelationErrors } from "@/lib/ask-sales-faq/v4/systemic/relations";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { diagnoseV5PolicyForNeed, retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";

type Probe = {
  id: string;
  question: string;
  expectedPolicyId: string;
  need: Partial<V4SystemicNeed>;
};

const probes: Probe[] = [
  {
    id: "script-selection",
    question: "Should Built for More reps use the Next Level CEO script with the show name changed, or use a separate approved script?",
    expectedPolicyId: "operational_909930f8fcb963cf",
    need: { relation: "requirement", productScope: "dj_nlceo", domains: ["scripting", "compliance"], actions: ["use", "modify"], entities: ["Built for More", "Next Level CEO script", "show name", "separate approved script"] },
  },
  {
    id: "platform-submission-count",
    question: "Does the applicable package submit an episode to one Tier 1 platform or to all three listed platforms?",
    expectedPolicyId: "operational_3cfb0025a6454374",
    need: { relation: "other", domains: ["content distribution"], actions: ["submit"], entities: ["episode", "Tier 1 platform"] },
  },
  {
    id: "sag-eligibility",
    question: "Does appearing on the show provide SAG eligibility or acting credits?",
    expectedPolicyId: "operational_4d32bf76e113569c",
    need: { relation: "eligibility", domains: ["talent eligibility"], actions: ["provide"], entities: ["SAG eligibility", "acting credits"] },
  },
  {
    id: "phone-onboarding",
    question: "May a rep take payment and complete post-sale onboarding by telephone when Zoom is unavailable?",
    expectedPolicyId: "curated_v43_phone_onboarding_zoom_recording",
    need: { relation: "permission", domains: ["payment", "onboarding"], actions: ["take payment", "complete onboarding"], entities: ["telephone", "Zoom"] },
  },
  {
    id: "cross-product-movement",
    question: "May an ISTV applicant be moved to Next Level CEO during the audition process?",
    expectedPolicyId: "operational_f32e012fa97b5b52",
    need: { relation: "permission", productScope: "comparison", domains: ["sales"], actions: ["move", "transfer"], entities: ["ISTV", "Next Level CEO"] },
  },
  {
    id: "promotional-clause",
    question: "What does the contract requirement to cooperate with promotional activities and share trailers mean?",
    expectedPolicyId: "operational_70c95085c7e192fb",
    need: { relation: "definition", domains: ["contracts", "promotions"], actions: ["share"], entities: ["promotional activities", "trailers"] },
  },
  {
    id: "stable-back-to-back",
    question: "How should a rep keep the first of two back-to-back Call 1 appointments from overrunning?",
    expectedPolicyId: "operational_df5148bacd51d4c2",
    need: { relation: "procedure", domains: ["scheduling", "call management"], actions: ["prevent overrun"], entities: ["Call 1 appointment", "back-to-back appointments"] },
  },
  {
    id: "swag-definition",
    question: "What is the swag package in the Next Level CEO offer?",
    expectedPolicyId: "curated_v43_swag_definition",
    need: { relation: "definition", productScope: "dj_nlceo", domains: ["product", "offer"], actions: ["describe"], entities: ["swag package"] },
  },
  {
    id: "rich-reapplication-minimum",
    question: "A prospect was passed last week and is booked again. How long is the normal reapplication wait?",
    expectedPolicyId: "curated_v43_rich_main_reapply_three_months",
    need: { relation: "duration", domains: ["reapplication"], actions: ["waiting period"], entities: ["prospect"] },
  },
  {
    id: "bank-closure-deadline-exception",
    question: "If a prospect cannot complete payment because the bank is closed and misses the deadline, can we make an exception for Monday?",
    expectedPolicyId: "curated_v43_bank_closed_deadline_no_exception",
    need: { relation: "deadline", domains: ["payment"], actions: ["make exception"], entities: ["payment deadline", "bank closure", "Monday"] },
  },
];

function fullNeed(probe: Probe): V4SystemicNeed {
  return {
    id: "N1",
    text: probe.question,
    authorityText: probe.question,
    originalRequestText: probe.question,
    retrievalQueries: [probe.question],
    productScope: "unknown",
    domains: [],
    actions: [],
    entities: [],
    relation: "other",
    requestKind: "knowledge",
    ambiguity: "none",
    clarificationQuestion: "",
    ...probe.need,
  };
}

async function main() {
  const snapshot = getV5KnowledgeSnapshot();
  const results = probes.map((probe) => {
    const need = fullNeed(probe);
    const plan: V4SystemicQueryPlan = { needs: [need], conversationIntent: "answer", reasoningSummary: "Consumed diagnostic probe." };
    const retrieval = retrieveV5Policies(resolveV4SystemicTurn(probe.question, []), plan);
    const candidate = retrieval.candidates.find((item) => item.policy.id === probe.expectedPolicyId);
    const expectedPolicy = snapshot.policies.find((policy) => policy.id === probe.expectedPolicyId);
    const turn = resolveV4SystemicTurn(probe.question, []);
    return {
      id: probe.id,
      question: probe.question,
      expectedPolicyId: probe.expectedPolicyId,
      retrieved: Boolean(candidate),
      rank: candidate?.needScores?.N1?.rank || candidate?.rank || null,
      answerability: candidate?.policy.answerability || null,
      admissionTier: candidate?.policy.quality_flags.includes("v53_active_scoped_rule_compiled")
        ? "active_scoped_answer"
        : candidate?.policy.answerability === "answer_evidence"
          ? "stable_answer"
          : null,
      evidenceState: retrieval.diagnostics?.needs[0]?.evidenceState || null,
      topPolicyIds: retrieval.candidates.slice(0, 16).map((item) => item.policy.id),
      expectedPolicyGate: diagnoseV5PolicyForNeed(probe.expectedPolicyId, need, resolveV4SystemicTurn(probe.question, [])),
      sourceAdmissionGate: expectedPolicy ? {
        boundaryErrors: v4SystemicPolicyBoundaryErrors(expectedPolicy, turn),
        relationErrors: v4SystemicNeedPolicyRelationErrors(need, expectedPolicy),
      } : null,
    };
  });
  const report = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    status: "consumed_regression_diagnostic_only",
    promotionEvidence: false,
    snapshot: {
      knowledgeVersion: snapshot.knowledgeVersion,
      hash: snapshot.snapshotHash,
      policies: snapshot.policies.length,
      stablePromotions: snapshot.stableOperationalPromotionCount,
      activeScopedPromotions: snapshot.activeScopedOperationalPromotionCount,
      activeScopedCollisions: snapshot.activeScopedCollisionReport.length,
      referenceReviewDate: snapshot.referenceReviewDate,
    },
    summary: {
      probes: results.length,
      retrieved: results.filter((item) => item.retrieved).length,
    },
    results,
    activeScopedPolicies: snapshot.policies
      .filter((policy) => policy.quality_flags.includes("v53_active_scoped_rule_compiled"))
      .map((policy) => ({
        id: policy.id,
        decisionKey: policy.decision_key,
        title: policy.title,
        decision: policy.decision,
        productScopes: policy.product_scopes,
        scopeRisk: policy.systemic.scopeRisk,
        riskLevel: policy.risk_level,
        approvedBy: policy.source.approved_by,
        effectiveAt: policy.effective_at,
        lastReviewed: policy.last_reviewed,
        sourceIds: policy.source.ids,
      })),
    collisionReport: snapshot.activeScopedCollisionReport,
  };
  const outputDir = path.join(process.cwd(), "artifacts/ask-sales-faq-v5-3");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "admission-retrieval-audit.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "admission-retrieval-audit.md"), [
    "# Ask Sales V5.3 admission and retrieval audit",
    "",
    `Generated: ${report.generatedAt}`,
    "",
    "Consumed regression diagnostic only; not promotion evidence.",
    "",
    `- Stable operational promotions: ${report.snapshot.stablePromotions}`,
    `- Active scoped promotions: ${report.snapshot.activeScopedPromotions}`,
    `- Publish-time collision records: ${report.snapshot.activeScopedCollisions}`,
    `- Retrieval probes recovered: ${report.summary.retrieved}/${report.summary.probes}`,
    "",
    "| Probe | Expected policy | Retrieved | Rank | Tier |",
    "|---|---|---:|---:|---|",
    ...results.map((item) => `| ${item.id} | ${item.expectedPolicyId} | ${item.retrieved ? "yes" : "no"} | ${item.rank || "-"} | ${item.admissionTier || "-"} |`),
    "",
  ].join("\n"), "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.summary.retrieved !== report.summary.probes) process.exitCode = 1;
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
