import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;
type SystemJudgment = {
  acceptable: boolean;
  materialError: boolean;
  wrongOwner: boolean;
  falseRoute: boolean;
  label: string;
};
type Judgment = {
  winner: "v3" | "v510" | "tie";
  v3: SystemJudgment;
  v510: SystemJudgment;
  note: string;
};

const pass: SystemJudgment = { acceptable: true, materialError: false, wrongOwner: false, falseRoute: false, label: "acceptable" };
const judgments: Record<string, Judgment> = {
  "v510final-01": { winner: "tie", v3: pass, v510: pass, note: "Both correctly keep a DJ-only closer inside the DJ offer boundary." },
  "v510final-02": { winner: "tie", v3: pass, v510: pass, note: "Both correctly count booked leads and leads who showed." },
  "v510final-03": {
    winner: "tie",
    v3: { acceptable: false, materialError: true, wrongOwner: true, falseRoute: false, label: "wrong_action_owner" },
    v510: { acceptable: false, materialError: true, wrongOwner: true, falseRoute: false, label: "wrong_action_owner" },
    note: "Both route a live Zoom-link request to Sales Questions instead of Sales Tech.",
  },
  "v510final-04": {
    winner: "v510",
    v3: { acceptable: false, materialError: false, wrongOwner: true, falseRoute: true, label: "false_route_wrong_owner" },
    v510: pass,
    note: "V5.10 answers the exact Keap ownership rule; V3 withholds it and sends the rep to Sales Tech.",
  },
  "v510final-05": {
    winner: "v510",
    v3: { acceptable: false, materialError: true, wrongOwner: false, falseRoute: false, label: "materially_incorrect" },
    v510: { acceptable: false, materialError: false, wrongOwner: false, falseRoute: true, label: "safe_false_route" },
    note: "V3 incorrectly permits signing before payment and introduces an unrelated discount; V5.10 is safer but fails to answer the exact payment-first rule.",
  },
  "v510final-06": { winner: "tie", v3: pass, v510: pass, note: "Both correctly allow filming before PIF when the payment plan is not delinquent." },
  "v510final-07": {
    winner: "tie",
    v3: { acceptable: false, materialError: true, wrongOwner: false, falseRoute: false, label: "materially_incorrect" },
    v510: { acceptable: false, materialError: true, wrongOwner: false, falseRoute: false, label: "materially_incorrect" },
    note: "Both prefer an older governed platform boundary and miss the newer exact rule that VIP primarily adds non-guaranteed Amazon Prime while Apple TV submission can be purchased separately.",
  },
  "v510final-08": { winner: "tie", v3: pass, v510: pass, note: "Both correctly prohibit in-person pre-signing studio tours and point to virtual proof." },
  "v510final-09": { winner: "tie", v3: pass, v510: pass, note: "Both correctly state day-before delivery before 9 PM ET, not exactly 24 hours." },
  "v510final-10": {
    winner: "v510",
    v3: { acceptable: false, materialError: true, wrongOwner: false, falseRoute: false, label: "materially_incorrect" },
    v510: { acceptable: false, materialError: false, wrongOwner: false, falseRoute: true, label: "safe_conflict_route" },
    note: "V3 applies a broad older opt-out cancellation rule and says to cancel. V5.10 detects the conflict and routes safely, but it should resolve the newer, narrower already-scheduled exception and answer.",
  },
  "v510final-11": {
    winner: "v510",
    v3: { acceptable: false, materialError: false, wrongOwner: false, falseRoute: true, label: "false_route" },
    v510: pass,
    note: "V5.10 correctly applies the seven-minute pass-off ownership window; V3 withholds the answer.",
  },
  "v510final-12": { winner: "tie", v3: pass, v510: pass, note: "Both correctly route receipt and tax-detail verification to Sales Finance." },
  "v510final-13": {
    winner: "v510",
    v3: { acceptable: true, materialError: false, wrongOwner: false, falseRoute: false, label: "acceptable_boundary_weak" },
    v510: pass,
    note: "Both identify Greenlight Requests, but V5.10 clearly states that the passive chatbot cannot create or send the letter itself.",
  },
  "v510final-14": {
    winner: "v510",
    v3: { acceptable: true, materialError: false, wrongOwner: false, falseRoute: false, label: "acceptable_incomplete" },
    v510: pass,
    note: "V5.10 gives the complete website, mobile-app, and Roku/Apple/Fire-device answer; V3 omits website and mobile-app options.",
  },
  "v510final-conv-01-turn-1": {
    winner: "v510",
    v3: { acceptable: false, materialError: false, wrongOwner: false, falseRoute: true, label: "does_not_answer" },
    v510: pass,
    note: "V5.10 directly allows sharing a relevant platform episode; V3 gives navigation advice and leaves the permission unresolved.",
  },
  "v510final-conv-01-turn-2": {
    winner: "v510",
    v3: { acceptable: false, materialError: false, wrongOwner: false, falseRoute: true, label: "false_route" },
    v510: { acceptable: true, materialError: false, wrongOwner: false, falseRoute: false, label: "acceptable_overlong" },
    note: "V5.10 preserves the no-metrics/no-ROI boundary, although it adds unnecessary detail. V3 withholds the follow-up answer.",
  },
  "v510final-conv-02-turn-1": { winner: "tie", v3: pass, v510: pass, note: "Both correctly prohibit emailing the slide deck and prefer the approved PDF." },
  "v510final-conv-02-turn-2": {
    winner: "v3",
    v3: pass,
    v510: { acceptable: false, materialError: false, wrongOwner: false, falseRoute: true, label: "followup_false_route" },
    note: "V3 carries the PDF referent and answers the last-resort exception; V5.10 loses the referent and routes.",
  },
  "v510final-conv-03-turn-1": { winner: "tie", v3: pass, v510: pass, note: "Both correctly keep the standard onboarding process for a self-generated lead." },
  "v510final-conv-03-turn-2": { winner: "tie", v3: pass, v510: pass, note: "Both correctly preserve onboarding while telling TEC to record the 20% self-generated commission." },
};

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function flatten(report: JsonRecord) {
  return [
    ...(Array.isArray(report.cases) ? report.cases.map(object) : []),
    ...(Array.isArray(report.conversations) ? report.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
  ];
}

function compactResult(value: unknown, system: "v3" | "v510") {
  const result = object(value);
  return {
    lane: text(result.lane) || text(result.outcome),
    needsRoute: result.needsRoute === true,
    routeChannels: system === "v510" ? strings(result.routeChannels) : [],
    routeReason: text(result.routeReason),
    answer: text(result.answer),
    selectedPolicyIds: system === "v510" ? strings(result.selectedPolicyIds) : [],
    matchedArticleId: system === "v3" ? text(result.matchedArticleId) : "",
    provider: text(result.provider),
    model: text(result.model),
    providerBacked: Array.isArray(object(result.runtimeMetadata).providerAttempts) &&
      (object(result.runtimeMetadata).providerAttempts as unknown[]).some((attempt) => object(attempt).status === "success"),
  };
}

async function main() {
  const primaryPath = path.resolve("artifacts/ask-sales-faq-v5-10-final-gate/primary-runtime.json");
  const repeatabilityPath = path.resolve("artifacts/ask-sales-faq-v5-10-final-gate/repeatability-analysis.json");
  const outputPath = path.resolve("artifacts/ask-sales-faq-v5-10-final-gate/primary-manual-audit.json");
  const markdownPath = path.resolve("artifacts/ask-sales-faq-v5-10-final-gate/V5-10-FINAL-GATE-REPORT.md");
  const [primaryRaw, repeatabilityRaw] = await Promise.all([readFile(primaryPath, "utf8"), readFile(repeatabilityPath, "utf8")]);
  const primary = object(JSON.parse(primaryRaw));
  const repeatability = object(JSON.parse(repeatabilityRaw));
  const items = flatten(primary);
  if (items.length !== 20 || items.some((item) => !judgments[text(item.id)])) throw new Error("Manual judgment map must cover all 20 sealed prompts exactly");
  const auditedItems = items.map((item) => {
    const id = text(item.id);
    const systems = object(item.systems);
    return {
      id,
      question: text(item.question),
      expectedDisposition: text(item.expectedDisposition),
      expectedRouteKey: text(item.expectedRouteKey) || null,
      goldAnswer: text(item.goldAnswer),
      sourceIds: strings(item.sourceIds),
      approvedBy: strings(item.approvedBy),
      judgment: judgments[id],
      v3: compactResult(systems.v3, "v3"),
      v510: compactResult(systems.v510, "v510"),
    };
  });
  const count = (system: "v3" | "v510", key: keyof SystemJudgment) =>
    auditedItems.filter((item) => item.judgment[system][key] === true).length;
  const pairwise = {
    v510Wins: auditedItems.filter((item) => item.judgment.winner === "v510").length,
    v3Wins: auditedItems.filter((item) => item.judgment.winner === "v3").length,
    ties: auditedItems.filter((item) => item.judgment.winner === "tie").length,
  };
  const repeatAggregate = object(repeatability.aggregate);
  const summary = {
    prompts: auditedItems.length,
    v3: {
      acceptable: count("v3", "acceptable"),
      acceptableRate: count("v3", "acceptable") / auditedItems.length,
      materialErrors: count("v3", "materialError"),
      wrongOwners: count("v3", "wrongOwner"),
      falseRoutes: count("v3", "falseRoute"),
    },
    v510: {
      acceptable: count("v510", "acceptable"),
      acceptableRate: count("v510", "acceptable") / auditedItems.length,
      materialErrors: count("v510", "materialError"),
      wrongOwners: count("v510", "wrongOwner"),
      falseRoutes: count("v510", "falseRoute"),
    },
    pairwise: { ...pairwise, netWinsOverV3: pairwise.v510Wins - pairwise.v3Wins },
    repeatability: repeatAggregate,
  };
  const gates = {
    completeProviderBackedOutputs: auditedItems.every((item) => item.v3.providerBacked && item.v510.providerBacked),
    zeroV510MaterialErrors: summary.v510.materialErrors === 0,
    zeroV510WrongActionOwners: summary.v510.wrongOwners === 0,
    minimumV510AcceptableRate85Percent: summary.v510.acceptableRate >= 0.85,
    minimumPairwiseNetWinsPlus3: summary.pairwise.netWinsOverV3 >= 3,
    positiveLeadAcrossMultipleStrata: true,
    noMaterialStratumRegression: false,
    maximumMaterialLaneOrContentFlipRate5Percent: Number(repeatAggregate.laneFlipRate) <= 0.05 && Number(repeatAggregate.decisionBoundaryFlipRate) <= 0.05,
    manualSourceAuditComplete: true,
    blindHumanReviewComplete: false,
    explicitOwnerApproval: false,
  };
  const rootCauses = [
    {
      code: "specificity_recency_conflict_unresolved",
      examples: ["v510final-07", "v510final-10"],
      finding: "The runtime still lets an older broad governed rule defeat or deadlock a newer, narrower authoritative Slack decision.",
    },
    {
      code: "action_owner_intent_not_forced",
      examples: ["v510final-03"],
      finding: "An explicit live Zoom-link request is recognized as a knowledge permission question, so the forced Sales Tech owner is never set and the generic Sales Questions fallback wins.",
    },
    {
      code: "exact_record_admission_unstable",
      examples: ["v510final-05"],
      finding: "The exact payment-first record is present, but model admission alternates between withholding it and returning it as a partial answer.",
    },
    {
      code: "followup_referent_lost",
      examples: ["v510final-conv-02-turn-2"],
      finding: "The follow-up resolver does not carry the approved PDF referent into retrieval, producing an unnecessary route even though turn one selected the controlling record.",
    },
  ];
  const report = {
    schemaVersion: "ask-sales-v5-10-final-gate-manual-audit-v1",
    status: "complete_promotion_gate_failed",
    generatedAt: new Date().toISOString(),
    primaryRuntimeSha256: sha256(primaryRaw),
    repeatabilityAnalysisSha256: sha256(repeatabilityRaw),
    methodology: {
      sourceOnlyGold: true,
      manualReview: true,
      aiJudgePromotionAuthority: false,
      postOutputRuntimeTuning: false,
      productionChanged: false,
    },
    summary,
    gates,
    promotionDecision: "do_not_promote_v5_10",
    blindReviewDecision: "not_run_because_prerequisite_correctness_and_repeatability_gates_failed",
    rootCauses,
    items: auditedItems,
  };
  const rows = auditedItems.map((item) =>
    `| ${item.id} | ${item.judgment.winner === "v510" ? "V5.10" : item.judgment.winner === "v3" ? "V3" : "Tie"} | ${item.judgment.v3.label} | ${item.judgment.v510.label} | ${item.judgment.note} |`,
  ).join("\n");
  const markdown = `# Ask Sales V5.10 final unseen gate\n\n## Decision\n\n**Do not promote V5.10 to production.** It is meaningfully better than V3 on this fresh set, but it fails the preregistered correctness and repeatability thresholds. Production V3 remains unchanged.\n\n## What the fresh data says\n\n- V5.10 acceptable: ${summary.v510.acceptable}/20 (${(summary.v510.acceptableRate * 100).toFixed(0)}%)\n- V3 acceptable: ${summary.v3.acceptable}/20 (${(summary.v3.acceptableRate * 100).toFixed(0)}%)\n- Pairwise: V5.10 won ${pairwise.v510Wins}, V3 won ${pairwise.v3Wins}, ${pairwise.ties} tied; net V5.10 lead +${summary.pairwise.netWinsOverV3}\n- V5.10 material errors: ${summary.v510.materialErrors}; wrong action owners: ${summary.v510.wrongOwners}; false routes: ${summary.v510.falseRoutes}\n- Repeatability lane and decision-boundary flip rate: ${(Number(repeatAggregate.laneFlipRate) * 100).toFixed(2)}% (preregistered maximum 5%)\n- Provider coverage: complete for all 40 paired outputs; no terminal provider failure\n\nThis is a genuine improvement, not a production pass. V5.10 answers several fresh questions that V3 routes, and it safely avoids V3's incorrect payment-order and opt-out answers. It still fails because one wrong action owner and one materially outdated package answer are unacceptable for live sales decisions.\n\n## Systemic remaining work\n\n1. Make conflict resolution compare exact decision scope, recency, and authority together so a newer narrow exception can supersede an older broad rule without globally demoting either source.\n2. Force deterministic owner routing only for explicit live actions such as generating a Zoom link; keep the answer content model-backed.\n3. Stabilize exact-record admission so the same complete controlling record cannot alternate between route and answer.\n4. Carry explicit conversation referents such as \"the PDF\" into follow-up retrieval before entailment.\n5. Freeze a successor and require a new source-disjoint gate; do not tune V5.10 on these revealed prompts.\n\n## Why no blind packet was sent\n\nThe candidate failed correctness and repeatability prerequisites before human preference could authorize promotion. Preparing another 20-question review would burden the reviewer without changing the decision. A blind packet should be generated only for the next frozen candidate that passes those system gates.\n\n## Prompt-level audit\n\n| Prompt | Better | V3 | V5.10 | Manual source-only finding |\n| --- | --- | --- | --- | --- |\n${rows}\n`;
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdown, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, markdownPath, summary, gates, promotionDecision: report.promotionDecision }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
