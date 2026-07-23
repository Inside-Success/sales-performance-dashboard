import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

type ExpectedDecision = {
  decisionKey: string;
  decision: string;
  conditions: string[];
  exclusions: string[];
  answerability: "answer" | "partial" | "route" | "live_lookup" | "artifact" | "clarify" | "unusable";
  temporalRisk: "stable" | "time_sensitive" | "live_only";
  scopeRisk: "general" | "scoped" | "case_specific";
  routeKey: string | null;
  confidence: number;
};
type HoldoutItem = {
  sourceId: string;
  question: string;
  rootTimestamp: string;
  authorities: string[];
  threadClassification: string;
  expectedDecisions: ExpectedDecision[];
};
type Holdout = { source_sha256: string; classification_sha256: string; items: HoldoutItem[] };

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "need";
}

function category(item: HoldoutItem) {
  const decisions = item.expectedDecisions;
  if (decisions.some((decision) => decision.answerability === "answer" && decision.temporalRisk === "stable" && decision.scopeRisk !== "case_specific" && decision.confidence >= 0.88)) return "answer";
  if (decisions.some((decision) => ["route", "live_lookup", "artifact"].includes(decision.answerability) || decision.temporalRisk !== "stable")) return "route";
  return "clarify";
}

function disposition(decision: ExpectedDecision) {
  if (decision.answerability === "answer" && decision.temporalRisk === "stable" && decision.scopeRisk !== "case_specific" && decision.confidence >= 0.88) return "answer";
  if (decision.answerability === "artifact") return "artifact";
  if (decision.answerability === "live_lookup" || decision.temporalRisk !== "stable") return "live_lookup";
  if (decision.answerability === "route") return "route";
  return "clarify";
}

function goldNeed(decision: ExpectedDecision, index: number) {
  const expectedDisposition = disposition(decision);
  const context = [
    decision.decision,
    ...(decision.conditions.length ? [`Conditions: ${decision.conditions.join("; ")}.`] : []),
    ...(decision.exclusions.length ? [`Boundaries: ${decision.exclusions.join("; ")}.`] : []),
  ];
  return {
    id: `${safeId(decision.decisionKey)}-${index + 1}`,
    text: decision.decisionKey.replace(/-/g, " "),
    atomic: true,
    expectedDisposition,
    expectedRouteKey: ["route", "live_lookup", "artifact"].includes(expectedDisposition) ? decision.routeKey : null,
    policyIds: [],
    blockedTopicIds: [],
    goldContext: expectedDisposition === "answer" ? context : [],
    blockedContext: expectedDisposition === "answer" ? [] : [
      ...context,
      `This need is ${decision.answerability}, temporal risk is ${decision.temporalRisk}, and scope risk is ${decision.scopeRisk}.`,
    ],
  };
}

const inputPath = resolve(process.argv[2] || "artifacts/ask-sales-faq-v4-systemic/sealed-source-holdout.json");
const outputPath = resolve(process.argv[3] || "artifacts/ask-sales-faq-v4-systemic/sealed-holdout-evaluation-60.json");
const inputRaw = readFileSync(inputPath, "utf8");
const holdout = JSON.parse(inputRaw) as Holdout;
const quotas = { answer: 30, route: 20, clarify: 10 };
const selected = Object.entries(quotas).flatMap(([name, quota]) => holdout.items
  .filter((item) => category(item) === name)
  .sort((left, right) => hash(`holdout-evaluation-v1:${left.sourceId}`).localeCompare(hash(`holdout-evaluation-v1:${right.sourceId}`)))
  .slice(0, quota));
if (selected.length !== Object.values(quotas).reduce((total, value) => total + value, 0)) {
  throw new Error(`holdout does not satisfy the fixed stratified quotas: selected ${selected.length}`);
}
const dataset = {
  schemaVersion: 1,
  name: "Ask Sales V4 systemic sealed source holdout",
  purpose: "One-time diagnostic three-way evaluation after systemic runtime freeze; questions and gold remained sealed while all approved knowledge sources stayed available to retrieval.",
  generatedAt: new Date().toISOString(),
  sourceHoldoutSha256: hash(inputRaw),
  sourceCorpusSha256: holdout.source_sha256,
  sourceClassificationSha256: holdout.classification_sha256,
  promptCount: selected.length,
  conversationCount: selected.length,
  strata: quotas,
  conversations: selected.map((item) => {
    const decisions = item.expectedDecisions.length ? item.expectedDecisions : [{
      decisionKey: "source-does-not-establish-answer",
      decision: "The authoritative thread does not establish a reusable answer.",
      conditions: [],
      exclusions: [],
      answerability: "clarify" as const,
      temporalRisk: "stable" as const,
      scopeRisk: "case_specific" as const,
      routeKey: null,
      confidence: 1,
    }];
    return {
      id: `holdout-${hash(item.sourceId).slice(0, 16)}`,
      title: `Sealed ${category(item)} case`,
      prompts: [{
        question: item.question,
        independent: true,
        evaluationStrata: [`sealed_${category(item)}`, item.threadClassification],
        goldNeeds: decisions.slice(0, 4).map(goldNeed),
      }],
    };
  }),
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(dataset, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
chmodSync(outputPath, 0o600);
process.stdout.write(`${JSON.stringify({ outputPath, promptCount: dataset.promptCount, strata: dataset.strata, sha256: hash(`${JSON.stringify(dataset, null, 2)}\n`) })}\n`);
