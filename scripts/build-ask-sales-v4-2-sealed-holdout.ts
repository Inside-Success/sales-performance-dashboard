import { createHash } from "node:crypto";
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

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
  threadClassification: string;
  expectedDecisions: ExpectedDecision[];
};

type SourceHoldout = {
  source_sha256: string;
  classification_sha256: string;
  items: HoldoutItem[];
};

type PriorEvaluation = { conversations: Array<{ id: string }> };

const SALT = "ask-sales-v4.2-sealed-evaluation-v1";
const QUOTAS = { answer: 30, route: 20 } as const;

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function safeId(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 52) || "need";
}

function caseId(sourceId: string) {
  return `holdout-${hash(sourceId).slice(0, 16)}`;
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

const sourcePath = resolve(process.argv[2]);
const outputPath = resolve(process.argv[3]);
const excludedEvaluationPaths = process.argv.slice(4).map((path) => resolve(path));
if (!process.argv[2] || !process.argv[3] || excludedEvaluationPaths.length < 4) {
  throw new Error("usage: build-ask-sales-v4-2-sealed-holdout <source> <output> <original-60> <invalidated-80> <invalidated-67> <v4.1-50> [additional-development-evaluation ...]");
}
if (existsSync(outputPath)) {
  throw new Error("V4.2 sealed output already exists; the one-time selection is immutable");
}
for (const path of [sourcePath, ...excludedEvaluationPaths]) {
  if (!existsSync(path)) throw new Error(`required sealed input is missing: ${path}`);
}

const sourceRaw = readFileSync(sourcePath, "utf8");
const source = JSON.parse(sourceRaw) as SourceHoldout;
const excludedEvaluations = excludedEvaluationPaths.map((path) => {
  const raw = readFileSync(path, "utf8");
  const evaluation = JSON.parse(raw) as PriorEvaluation;
  if (!Array.isArray(evaluation.conversations)) throw new Error(`excluded evaluation is malformed: ${path}`);
  return { path, raw, evaluation };
});
const excludedIds = new Set(excludedEvaluations.flatMap(({ evaluation }) => evaluation.conversations.map((conversation) => conversation.id)));

const remainingByStratum = Object.fromEntries(Object.keys(QUOTAS).map((name) => [
  name,
  source.items.filter((item) => category(item) === name && !excludedIds.has(caseId(item.sourceId))).length,
]));
const selected = Object.entries(QUOTAS).flatMap(([name, quota]) => source.items
  .filter((item) => category(item) === name && !excludedIds.has(caseId(item.sourceId)))
  .sort((left, right) => hash(`${SALT}:${left.sourceId}`).localeCompare(hash(`${SALT}:${right.sourceId}`)))
  .slice(0, quota));
const expectedCount = Object.values(QUOTAS).reduce((total, value) => total + value, 0);
if (selected.length !== expectedCount) {
  throw new Error(`source holdout does not satisfy the preregistered V4.2 quotas after all exclusions: ${selected.length}/${expectedCount}; remaining=${JSON.stringify(remainingByStratum)}`);
}

const defaultDecision: ExpectedDecision = {
  decisionKey: "source-does-not-establish-answer",
  decision: "The authoritative thread does not establish a reusable answer.",
  conditions: [],
  exclusions: [],
  answerability: "clarify",
  temporalRisk: "stable",
  scopeRisk: "case_specific",
  routeKey: null,
  confidence: 1,
};

const dataset = {
  schemaVersion: 1,
  name: "Ask Sales V4.2 sealed source holdout",
  purpose: "One-time post-freeze comparison of V3, frozen V4.1, and frozen V4.2. Source-derived gold is diagnostic and every result requires manual review.",
  generatedAt: new Date().toISOString(),
  protocol: {
    salt: SALT,
    excludedEvaluationFiles: excludedEvaluations.map(({ path }) => basename(path)),
    excludedEvaluationSha256: excludedEvaluations.map(({ raw }) => hash(raw)),
    excludedDistinctCaseCount: excludedIds.size,
    remainingByStratum,
    selection: "fixed-hash stratified selection after excluding every original, invalidated, valid V4.1, and supplied development-evaluation case",
    postOpenMutationRule: "No V4.2 runtime change is permitted after this file is generated or inspected.",
  },
  sourceHoldoutSha256: hash(sourceRaw),
  sourceCorpusSha256: source.source_sha256,
  sourceClassificationSha256: source.classification_sha256,
  promptCount: selected.length,
  conversationCount: selected.length,
  strata: QUOTAS,
  conversations: selected.map((item) => {
    const decisions = item.expectedDecisions.length ? item.expectedDecisions : [defaultDecision];
    return {
      id: caseId(item.sourceId),
      title: `Sealed V4.2 ${category(item)} case`,
      prompts: [{
        question: item.question,
        independent: true,
        evaluationStrata: [`sealed_v4_2_${category(item)}`, item.threadClassification],
        goldNeeds: decisions.slice(0, 4).map(goldNeed),
      }],
    };
  }),
};

const serialized = `${JSON.stringify(dataset, null, 2)}\n`;
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, serialized, { encoding: "utf8", mode: 0o600 });
chmodSync(outputPath, 0o600);
process.stdout.write(`${JSON.stringify({
  outputPath,
  promptCount: dataset.promptCount,
  strata: dataset.strata,
  excludedDistinctCaseCount: dataset.protocol.excludedDistinctCaseCount,
  remainingByStratum,
  sha256: hash(serialized),
})}\n`);
