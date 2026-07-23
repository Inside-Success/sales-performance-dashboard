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

// v3 replaces both earlier V4.1 selections. The v1 selection was exposed by a
// broad source search, and metadata from the v2/67 selection was inspected
// before the candidate freeze. Neither is valid promotion evidence. The new
// salt and exclusion union make the replacement selection disjoint from the
// prior sealed-60 and every invalidated V4.1 selection.
const SALT = "ask-sales-v4.1-sealed-evaluation-v3";
// The two genuinely unseen clarify cases were consumed by the invalidated v2
// selection, so v3 preregisters answer and route strata only. Never backfill a
// quota with a previously selected prompt.
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

const sourcePath = resolve(process.argv[2] || "artifacts/ask-sales-faq-v4-systemic/sealed-source-holdout.json");
const priorEvaluationPath = resolve(process.argv[3] || "artifacts/ask-sales-faq-v4-systemic/sealed-holdout-evaluation-60-final.json");
const outputPath = resolve(process.argv[4] || "artifacts/ask-sales-faq-v4-1/sealed-holdout-50-final.json");
const invalidatedSelectionPaths = [
  resolve(process.argv[5] || "artifacts/ask-sales-faq-v4-1/sealed-holdout-80.json"),
  resolve(process.argv[6] || "artifacts/ask-sales-faq-v4-1/sealed-holdout-67-final.json"),
];
const sourceRaw = readFileSync(sourcePath, "utf8");
const priorRaw = readFileSync(priorEvaluationPath, "utf8");
const invalidatedSelections = invalidatedSelectionPaths.flatMap((path) =>
  existsSync(path) ? [{ path, raw: readFileSync(path, "utf8") }] : [],
);
const source = JSON.parse(sourceRaw) as SourceHoldout;
const prior = JSON.parse(priorRaw) as PriorEvaluation;
const priorIds = new Set(prior.conversations.map((conversation) => conversation.id));
const invalidatedIds = new Set(
  invalidatedSelections.flatMap(({ raw }) => (JSON.parse(raw) as PriorEvaluation).conversations.map((conversation) => conversation.id)),
);

const selected = Object.entries(QUOTAS).flatMap(([name, quota]) => source.items
  .filter((item) => {
    const id = caseId(item.sourceId);
    return category(item) === name && !priorIds.has(id) && !invalidatedIds.has(id);
  })
  .sort((left, right) => hash(`${SALT}:${left.sourceId}`).localeCompare(hash(`${SALT}:${right.sourceId}`)))
  .slice(0, quota));
const expectedCount = Object.values(QUOTAS).reduce((total, value) => total + value, 0);
if (selected.length !== expectedCount) {
  throw new Error(`source holdout does not satisfy V4.1 fixed quotas after excluding the prior evaluation: ${selected.length}/${expectedCount}`);
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
  name: "Ask Sales V4.1 sealed source holdout",
  purpose: "One-time diagnostic comparison of V3, Frozen V4, and V4.1 after the V4.1 candidate is frozen. Source-derived gold remains diagnostic and requires human review.",
  generatedAt: new Date().toISOString(),
  protocol: {
    salt: SALT,
    priorEvaluationSha256: hash(priorRaw),
    excludedPriorCaseCount: priorIds.size,
    invalidatedSelectionSha256: invalidatedSelections.map(({ raw }) => hash(raw)),
    invalidatedSelectionFiles: invalidatedSelections.map(({ path }) => basename(path)),
    excludedInvalidatedCaseCount: invalidatedIds.size,
    selection: "fixed-hash stratified selection after excluding every prior sealed-60 case and every pre-freeze invalidated V4.1 case",
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
      title: `Sealed V4.1 ${category(item)} case`,
      prompts: [{
        question: item.question,
        independent: true,
        evaluationStrata: [`sealed_v4_1_${category(item)}`, item.threadClassification],
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
  excludedPriorCaseCount: dataset.protocol.excludedPriorCaseCount,
  excludedInvalidatedCaseCount: dataset.protocol.excludedInvalidatedCaseCount,
  sha256: hash(serialized),
})}\n`);
