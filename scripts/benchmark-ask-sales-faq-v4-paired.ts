import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AskSalesFaqChatMessage } from "../src/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "../src/lib/ask-sales-faq/v3/runtime";
import { parseV3Json } from "../src/lib/ask-sales-faq/v3/provider";
import { getMaterializedV3Registry } from "../src/lib/ask-sales-faq/v3/admin-approved-releases";
import {
  evaluateV4PromotionGate,
  inferV4ComparisonMode,
  parseV4HumanScoreBundle,
  parseV4SystemJudgeScore,
  summarizeV4PairedEvaluation,
  summarizeV4Runs,
  type V4HumanScoreBundle,
  type V4HumanScoreRecord,
  type V4PairedEvaluationItem,
  type V4SystemJudgeScore,
} from "../src/lib/ask-sales-faq/v4/evaluation";
import {
  parseV4AdjudicationProvenance,
  parseV4GoldNeeds,
  type V4AdjudicationProvenance,
  type V4GoldNeed,
  type V4GoldReferenceCatalog,
} from "../src/lib/ask-sales-faq/v4/adjudication";
import { runAskSalesFaqV4 } from "../src/lib/ask-sales-faq/v4/runtime";
import { generateV4Json } from "../src/lib/ask-sales-faq/v4/provider";

type StoredProductionAnswer = {
  answer: string;
  outcome: string;
  needsRoute: boolean;
  latencyMs: number;
  runtimeMetadata: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  knowledgeVersion: string | null;
};
type Prompt = {
  question: string;
  production: StoredProductionAnswer | null;
  independent: boolean;
  context: AskSalesFaqChatMessage[];
  v3Context: AskSalesFaqChatMessage[];
  v4Context: AskSalesFaqChatMessage[];
  goldPolicyIds: string[];
  blockedTopicIds: string[];
  goldContext: string[];
  blockedContext: string[];
  goldAdjudicated: boolean;
  goldNeeds: V4GoldNeed[];
};
type Conversation = { id: string; title: string; prompts: Prompt[] };
type Dataset = { name: string; conversations: Conversation[]; adjudication: V4AdjudicationProvenance | null };
type ExecutionOrder = "alternating" | "v3-first" | "v4-first" | "parallel";

type JudgeOutput = {
  A: V4SystemJudgeScore;
  B: V4SystemJudgeScore;
  preferred: "A" | "B" | "tie";
  comparisonReason: string;
};

type PairedItem = V4PairedEvaluationItem & {
  id: string;
  run: number;
  conversationId: string;
  promptIndex: number;
  question: string;
  evaluationContext: {
    independent: boolean;
    explicitSharedMessageCount: number;
    explicitV3MessageCount: number;
    explicitV4MessageCount: number;
    goldPolicyIds: string[];
    blockedTopicIds: string[];
    goldContext: string[];
    blockedContext: string[];
    goldAdjudicated: boolean;
    goldAdjudicationValid: boolean;
    goldNeedCount: number;
    goldNeedIds: string[];
    goldResolutionErrors: string[];
    sameKnowledgeSnapshot: boolean;
    executionOrder: ExecutionOrder;
  };
  independentJudge: boolean;
  v3: V4PairedEvaluationItem["v3"] & { answer: string; answerSha256: string; outcome: string; needsRoute: boolean; selectedPolicyIds: string[]; source: "stored_production" | "fresh_runtime"; provider: string | null; model: string | null; knowledgeVersion: string | null };
  v4: V4PairedEvaluationItem["v4"] & { answer: string; answerSha256: string; needsRoute: boolean; selectedPolicyIds: string[]; removedSentences: string[]; provider: string | null; model: string | null; executionMode: Record<string, string>; providerAttempts: Array<{ purpose?: string; status?: string; provider?: string; model?: string; latencyMs?: number; error?: string }>; planningReason: string; validationReason: string };
  comparisonReason: string | null;
};

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function truthy(value: string | null, fallback: boolean) {
  if (value === null) return fallback;
  const normalized = value.toLowerCase();
  if (["true", "1", "yes"].includes(normalized)) return true;
  if (["false", "0", "no"].includes(normalized)) return false;
  throw new Error(`Invalid boolean argument: ${value}`);
}

function exactBoolean(value: unknown, label: string, fallback: boolean) {
  if (value === undefined || value === null) return fallback;
  if (typeof value !== "boolean") throw new Error(`${label} must be a JSON boolean.`);
  return value;
}

function stringList(value: unknown, label: string, maximum = 40) {
  if (value === undefined || value === null) return [];
  const list = typeof value === "string" ? [value] : value;
  if (!Array.isArray(list) || list.some((item) => typeof item !== "string")) throw new Error(`${label} must be a string or string array.`);
  return [...new Set(list.map((item) => item.trim()).filter(Boolean))].slice(0, maximum);
}

function messageList(value: unknown, label: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of chat messages.`);
  return value.map((message, index) => {
    if (!message || typeof message !== "object" || Array.isArray(message)) throw new Error(`${label}[${index}] must be an object.`);
    const raw = message as Record<string, unknown>;
    if (raw.role !== "user" && raw.role !== "assistant") throw new Error(`${label}[${index}].role must be user or assistant.`);
    if (typeof raw.content !== "string" || !raw.content.trim()) throw new Error(`${label}[${index}].content must be a non-empty string.`);
    return { role: raw.role, content: raw.content.trim() } satisfies AskSalesFaqChatMessage;
  }).slice(-10);
}

function storedProduction(raw: Record<string, unknown>): StoredProductionAnswer | null {
  if (raw.productionAnswer === undefined || raw.productionAnswer === null || raw.productionAnswer === "") return null;
  if (typeof raw.productionAnswer !== "string") throw new Error("productionAnswer must be a string.");
  const latency = raw.productionLatencyMs === undefined || raw.productionLatencyMs === null ? 0 : raw.productionLatencyMs;
  if (typeof latency !== "number" || !Number.isFinite(latency) || latency < 0) throw new Error("productionLatencyMs must be a non-negative number.");
  const runtimeMetadata = raw.productionRuntimeMetadata && typeof raw.productionRuntimeMetadata === "object" && !Array.isArray(raw.productionRuntimeMetadata)
    ? raw.productionRuntimeMetadata as Record<string, unknown>
    : null;
  return {
    answer: raw.productionAnswer,
    outcome: typeof raw.productionOutcome === "string" ? raw.productionOutcome : "unknown",
    needsRoute: exactBoolean(raw.productionNeedsRoute, "productionNeedsRoute", false),
    latencyMs: latency,
    runtimeMetadata,
    provider: typeof raw.productionProvider === "string" ? raw.productionProvider : null,
    model: typeof raw.productionModel === "string" ? raw.productionModel : null,
    knowledgeVersion: typeof runtimeMetadata?.knowledgeVersion === "string" ? runtimeMetadata.knowledgeVersion : null,
  };
}

function parsedPrompt(
  value: unknown,
  label: string,
  catalog: V4GoldReferenceCatalog,
  adjudication: V4AdjudicationProvenance | null,
): Prompt {
  const raw = typeof value === "string" ? { question: value } : value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${label} must be a question string or object.`);
  const entry = raw as Record<string, unknown>;
  const question = typeof entry.question === "string" ? entry.question.trim() : "";
  if (!question) throw new Error(`${label}.question must be a non-empty string.`);
  const context = messageList(entry.context ?? entry.messages, `${label}.context`);
  const gold = entry.gold && typeof entry.gold === "object" && !Array.isArray(entry.gold) ? entry.gold as Record<string, unknown> : {};
  const blocked = entry.blocked && typeof entry.blocked === "object" && !Array.isArray(entry.blocked) ? entry.blocked as Record<string, unknown> : {};
  const goldNeeds = parseV4GoldNeeds(entry.goldNeeds ?? entry.gold_needs ?? gold.needs, catalog, `${label}.goldNeeds`);
  if (goldNeeds.length && !adjudication) throw new Error(`${label}.goldNeeds requires valid dataset-level adjudication provenance.`);
  const adjudicatedPolicyIds = [...new Set(goldNeeds.flatMap((need) => need.policyIds))];
  const adjudicatedBlockedTopicIds = [...new Set(goldNeeds.flatMap((need) => need.blockedTopicIds))];
  const adjudicatedGoldContext = [...new Set(goldNeeds.flatMap((need) => need.goldContext))];
  const adjudicatedBlockedContext = [...new Set(goldNeeds.flatMap((need) => need.blockedContext))];
  return {
    question,
    production: storedProduction(entry),
    independent: exactBoolean(entry.independent, `${label}.independent`, false),
    context,
    v3Context: messageList(entry.v3Context ?? entry.v3_context, `${label}.v3Context`),
    v4Context: messageList(entry.v4Context ?? entry.v4_context, `${label}.v4Context`),
    goldPolicyIds: goldNeeds.length ? adjudicatedPolicyIds : stringList(entry.goldPolicyIds ?? entry.gold_policy_ids ?? gold.policyIds ?? gold.policy_ids, `${label}.goldPolicyIds`),
    blockedTopicIds: goldNeeds.length ? adjudicatedBlockedTopicIds : stringList(entry.blockedTopicIds ?? entry.blocked_topic_ids ?? blocked.topicIds ?? blocked.topic_ids, `${label}.blockedTopicIds`),
    goldContext: goldNeeds.length ? adjudicatedGoldContext : stringList(entry.goldContext ?? entry.gold_context ?? gold.context, `${label}.goldContext`, 20),
    blockedContext: goldNeeds.length ? adjudicatedBlockedContext : stringList(entry.blockedContext ?? entry.blocked_context ?? blocked.context, `${label}.blockedContext`, 20),
    goldAdjudicated: Boolean(adjudication && goldNeeds.length),
    goldNeeds,
  };
}

function assertedDatasetCounts(raw: Record<string, unknown>, dataset: Dataset, filePath: string) {
  const count = (key: "promptCount" | "conversationCount") => {
    const value = raw[key];
    if (value === undefined || value === null) return null;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 0) throw new Error(`${key} in ${filePath} must be a non-negative integer.`);
    return value;
  };
  const declaredPrompts = count("promptCount");
  const declaredConversations = count("conversationCount");
  const actualPrompts = dataset.conversations.reduce((total, conversation) => total + conversation.prompts.length, 0);
  if (declaredPrompts !== null && declaredPrompts !== actualPrompts) {
    throw new Error(`promptCount in ${filePath} is ${declaredPrompts}, but ${actualPrompts} prompts were parsed.`);
  }
  if (declaredConversations !== null && declaredConversations !== dataset.conversations.length) {
    throw new Error(`conversationCount in ${filePath} is ${declaredConversations}, but ${dataset.conversations.length} conversations were parsed.`);
  }
  return dataset;
}

async function loadDataset(filePath: string): Promise<Dataset> {
  const raw = JSON.parse(await readFile(filePath, "utf8")) as Record<string, unknown>;
  const registry = getMaterializedV3Registry();
  const catalog: V4GoldReferenceCatalog = {
    policies: registry.policies.map((policy) => ({ id: policy.id, decisionKey: policy.decision_key, policyKey: policy.policy_key })),
    blockedTopics: registry.blocked_topics.map((topic) => ({ id: topic.id })),
  };
  const adjudication = parseV4AdjudicationProvenance(raw.adjudication, registry.knowledge_version);
  if (Array.isArray(raw.conversations)) {
    const dataset = {
      name: String(raw.name || path.basename(filePath)),
      adjudication,
      conversations: raw.conversations.map((value, index) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`conversations[${index}] must be an object.`);
        const conversation = value as Record<string, unknown>;
        if (!Array.isArray(conversation.prompts) || !conversation.prompts.length) throw new Error(`conversations[${index}].prompts must be a non-empty array.`);
        return {
          id: String(conversation.id || `conversation-${index + 1}`),
          title: String(conversation.title || `Conversation ${index + 1}`),
          prompts: conversation.prompts.map((prompt, promptIndex) => parsedPrompt(prompt, `conversations[${index}].prompts[${promptIndex}]`, catalog, adjudication)),
        };
      }),
    };
    return assertedDatasetCounts(raw, dataset, filePath);
  }
  if (Array.isArray(raw.items)) {
    const groups = new Map<string, Conversation>();
    for (const [itemIndex, value] of raw.items.entries()) {
      if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`items[${itemIndex}] must be an object.`);
      const item = value as Record<string, unknown>;
      const key = String(item.conversationKey || item.conversationId || item.id || `independent-${itemIndex + 1}`);
      const current = groups.get(key) || { id: key, title: `Launch conversation ${groups.size + 1}`, prompts: [] };
      current.prompts.push(parsedPrompt(item, `items[${itemIndex}]`, catalog, adjudication));
      groups.set(key, current);
    }
    const dataset = { name: String(raw.name || path.basename(filePath)), adjudication, conversations: [...groups.values()].filter((conversation) => conversation.prompts.some((prompt) => Boolean(prompt.question))) };
    return assertedDatasetCounts(raw, dataset, filePath);
  }
  throw new Error(`Unsupported benchmark dataset shape: ${filePath}`);
}

function boundedInteger(value: string | null, fallback: number, min: number, max: number) {
  if (value === null) return fallback;
  if (!/^\d+$/.test(value)) throw new Error(`Expected an integer from ${min} to ${max}, received: ${value}`);
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < min || parsed > max) throw new Error(`Expected an integer from ${min} to ${max}, received: ${value}`);
  return parsed;
}

function executionOrder(value: string | null): ExecutionOrder {
  const selected = value || "alternating";
  if (!["alternating", "v3-first", "v4-first", "parallel"].includes(selected)) {
    throw new Error(`Invalid execution order: ${selected}`);
  }
  return selected as ExecutionOrder;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

async function codeFingerprint() {
  const files = [
    "scripts/benchmark-ask-sales-faq-v4-paired.ts",
    "src/lib/ask-sales-faq/v4/adjudication.ts",
    "src/lib/ask-sales-faq/v4/evaluation.ts",
    "src/lib/ask-sales-faq/v4/runtime.ts",
    "src/lib/ask-sales-faq/v4/provider.ts",
    "src/lib/ask-sales-faq/v4/retrieval.ts",
    "src/lib/ask-sales-faq/v4/boundaries.ts",
    "src/lib/ask-sales-faq/v4/facts.ts",
    "src/lib/ask-sales-faq/v4/corpus.ts",
    "src/lib/ask-sales-faq/v3/runtime.ts",
    "src/lib/ask-sales-faq/v3/provider.ts",
    "src/lib/ask-sales-faq/v3/admin-approved-releases.ts",
  ];
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file).update("\0").update(await readFile(path.resolve(file), "utf8")).update("\0");
  }
  return hash.digest("hex");
}

function answerSha256(answer: string) {
  return sha256(answer);
}

function applyHumanScore(item: PairedItem, score: V4HumanScoreRecord | undefined) {
  if (!score) return item;
  if (score.v3AnswerSha256 !== answerSha256(item.v3.answer) || score.v4AnswerSha256 !== answerSha256(item.v4.answer)) {
    throw new Error(`Human score ${item.id} is not bound to the exact V3/V4 answers in this run.`);
  }
  const expectedNeeds = item.evaluationContext.goldNeedCount;
  if (score.v3Score.totalNeeds !== expectedNeeds || score.v4Score.totalNeeds !== expectedNeeds) {
    throw new Error(`Human score ${item.id} must score exactly ${expectedNeeds} adjudicated atomic need(s).`);
  }
  const expectedNeedIds = [...item.evaluationContext.goldNeedIds].sort();
  const scoredNeedIds = score.needOutcomes.map((outcome) => outcome.needId).sort();
  if (JSON.stringify(expectedNeedIds) !== JSON.stringify(scoredNeedIds)) {
    throw new Error(`Human score ${item.id} does not cover the exact adjudicated atomic need IDs.`);
  }
  return {
    ...item,
    independentJudge: true,
    preferred: score.preferred,
    comparisonReason: score.comparisonReason,
    v3: { ...item.v3, score: score.v3Score },
    v4: { ...item.v4, score: score.v4Score },
  } satisfies PairedItem;
}

function parseJudge(content: string): JudgeOutput {
  const raw = parseV3Json<Record<string, unknown>>(content);
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error("Judge output must be an object.");
  if (!raw.A || !raw.B) throw new Error("Judge output must include A and B scores.");
  if (!(["A", "B", "tie"] as unknown[]).includes(raw.preferred)) throw new Error("Judge preferred must be A, B, or tie.");
  if (typeof raw.comparison_reason !== "string") throw new Error("Judge comparison_reason must be a string.");
  return {
    A: parseV4SystemJudgeScore(raw.A),
    B: parseV4SystemJudgeScore(raw.B),
    preferred: raw.preferred as "A" | "B" | "tie",
    comparisonReason: raw.comparison_reason.slice(0, 1200),
  };
}

function judgePrompt(input: {
  question: string;
  answerA: string;
  answerB: string;
  goldEvidence: Array<{ id: string; title: string; decision: string; scopes: string[]; answerability: string }>;
  goldNeeds: Array<{ id: string; text: string; expectedDisposition: string; expectedRouteKey: string | null }>;
  goldContext: string[];
  blockedTopics: Array<{ id: string; resolution: string | null; scopes: string[]; questionFamilies: string[] }>;
  blockedContext: string[];
  contextA: AskSalesFaqChatMessage[];
  contextB: AskSalesFaqChatMessage[];
}) {
  return {
    system: [
      "You are a strict, blind evaluator of two internal sales FAQ answers. Return JSON only.",
      "Use only the supplied governed evidence. Evaluate each requested need independently, including separate parts of a compound question.",
      "A route is not automatically a failure. Give full need credit when a genuinely unresolved need is routed precisely, and give useful-partial credit when the answer provides material grounded help while clearly bounding the rest.",
      "False abstention means the system routed or declined a need that the supplied evidence directly answers. Unsupported means the answer adds a material claim not entailed by evidence. Critical unsupported includes wrong money, guarantees, eligibility, refund/legal terms, rights, payment permission, or a wrong operational instruction.",
      "Independent gold evidence is reference evidence supplied by the dataset, not evidence selected by either answer. Independent blocked context identifies explicitly unresolved decisions: routing that exact decision can be appropriate, but do not apply a blocker to merely related wording.",
      "Counts for fully resolved, useful partial, appropriately routed, and false abstained needs must refer to needs, not sentences. Do not double count a need across those four outcome counts.",
      "Every count must be an integer JSON number. Every boolean must be a JSON boolean, never a quoted string. critical_unsupported_claim_count cannot exceed unsupported_claim_count.",
      "Return {A:{total_needs,fully_resolved_needs,useful_partial_needs,appropriately_routed_needs,false_abstained_needs,unsupported_claim_count,critical_unsupported_claim_count,route_was_used,route_was_appropriate,technical_failure,assessment},B:{same},preferred:A|B|tie,comparison_reason}.",
    ].join("\n"),
    user: JSON.stringify({
      question: input.question,
      independentAtomicGoldNeeds: input.goldNeeds,
      independentGoldEvidence: input.goldEvidence,
      independentGoldContext: input.goldContext,
      independentBlockedTopics: input.blockedTopics,
      independentBlockedContext: input.blockedContext,
      systemA: { context: input.contextA, answer: input.answerA },
      systemB: { context: input.contextB, answer: input.answerB },
    }),
  };
}

function evidenceCards(ids: string[]) {
  const policies = getMaterializedV3Registry().policies;
  const selected = [...new Set(ids)].slice(0, 18).flatMap((reference) => policies.filter((policy) =>
    policy.id === reference ||
    policy.decision_key === reference ||
    policy.policy_key === reference ||
    policy.id.startsWith(`${reference}__`),
  ));
  return [...new Map(selected.map((policy) => [policy.id, policy])).values()].slice(0, 36).map((policy) => ({
    id: policy.id,
    title: policy.title,
    decision: policy.decision,
    scopes: policy.product_scopes,
    answerability: policy.answerability,
  }));
}

function blockedTopicCards(ids: string[]) {
  const byId = new Map(getMaterializedV3Registry().blocked_topics.map((topic) => [topic.id, topic]));
  return [...new Set(ids)].slice(0, 18).flatMap((id) => {
    const topic = byId.get(id);
    return topic ? [{
      id: topic.id,
      resolution: topic.resolution || null,
      scopes: topic.product_scopes || [],
      questionFamilies: topic.question_families || [],
    }] : [];
  });
}

function contextForPrompt(prompt: Prompt, system: "v3" | "v4", history: AskSalesFaqChatMessage[]) {
  const systemContext = system === "v3" ? prompt.v3Context : prompt.v4Context;
  const selected = systemContext.length ? systemContext : prompt.context.length ? prompt.context : prompt.independent ? [] : history;
  const withoutCurrentDuplicate = selected.at(-1)?.role === "user" && selected.at(-1)?.content.trim() === prompt.question
    ? selected.slice(0, -1)
    : selected;
  return [...withoutCurrentDuplicate, { role: "user" as const, content: prompt.question }].slice(-10);
}

function nextHistory(context: AskSalesFaqChatMessage[], question: string, answer: string) {
  const withoutCurrent = context.at(-1)?.role === "user" && context.at(-1)?.content.trim() === question
    ? context.slice(0, -1)
    : context;
  return [...withoutCurrent, { role: "user" as const, content: question }, { role: "assistant" as const, content: answer }].slice(-10);
}

function nestedArray(metadata: Record<string, unknown> | null, pathParts: string[]) {
  let value: unknown = metadata;
  for (const part of pathParts) {
    if (!value || typeof value !== "object") return [];
    value = (value as Record<string, unknown>)[part];
  }
  return Array.isArray(value) ? value : [];
}

function storedSelectedPolicyIds(metadata: Record<string, unknown> | null) {
  return nestedArray(metadata, ["v3", "selection", "selectedPolicyIds"]).map(String);
}

function countBy(values: Array<string | null>) {
  return Object.fromEntries([...new Set(values.map((value) => value || "unknown"))].sort().map((value) => [value, values.filter((candidate) => (candidate || "unknown") === value).length]));
}

function replayStrata(items: PairedItem[]) {
  return {
    v3Sources: countBy(items.map((item) => item.v3.source)),
    v3KnowledgeVersions: countBy(items.map((item) => item.v3.knowledgeVersion)),
    v3ProviderModels: countBy(items.map((item) => [item.v3.provider, item.v3.model].filter(Boolean).join(":") || null)),
    v4ProviderModels: countBy(items.map((item) => [item.v4.provider, item.v4.model].filter(Boolean).join(":") || null)),
    v4PlanningModes: countBy(items.map((item) => item.v4.executionMode.planning || null)),
  };
}

function markdownReport(report: {
  runId: string;
  dataset: string;
  status: string;
  summary: ReturnType<typeof summarizeV4PairedEvaluation>;
  promotionGate: ReturnType<typeof evaluateV4PromotionGate>;
  comparisonMode: string;
  strata: ReturnType<typeof replayStrata>;
}) {
  const { summary } = report;
  const cell = (value: unknown) => value === null ? "n/a" : String(value);
  return [
    `# Ask Sales V3 vs isolated V4 paired evaluation`,
    ``,
    `- Run: \`${report.runId}\``,
    `- Dataset: ${report.dataset}`,
    `- Status: ${report.status}`,
    `- Promotion gate: ${report.promotionGate.status}`,
    `- Comparison mode: ${report.comparisonMode}`,
    `- Cases: ${summary.cases} (${summary.judgedCases} judged)`,
    ``,
    `| Metric | V3 | V4 isolated |`,
    `| --- | ---: | ---: |`,
    `| Weighted need utility | ${cell(summary.v3.weightedNeedUtility)}% | ${cell(summary.v4.weightedNeedUtility)}% |`,
    `| False-abstention rate | ${cell(summary.v3.falseAbstentionRate)}% | ${cell(summary.v4.falseAbstentionRate)}% |`,
    `| Appropriate routed needs | ${summary.v3.appropriatelyRoutedNeeds} | ${summary.v4.appropriatelyRoutedNeeds} |`,
    `| Useful partial needs | ${summary.v3.usefulPartialNeeds} | ${summary.v4.usefulPartialNeeds} |`,
    `| Unsupported claims | ${summary.v3.unsupportedClaimCount} | ${summary.v4.unsupportedClaimCount} |`,
    `| Critical unsupported claims | ${summary.v3.criticalUnsupportedClaimCount} | ${summary.v4.criticalUnsupportedClaimCount} |`,
    `| Route precision | ${cell(summary.v3.routePrecision)}% | ${cell(summary.v4.routePrecision)}% |`,
    `| p50 latency | ${summary.v3.latencyMs.p50}ms | ${summary.v4.latencyMs.p50}ms |`,
    `| p95 latency | ${summary.v3.latencyMs.p95}ms | ${summary.v4.latencyMs.p95}ms |`,
    ``,
    `Preference: V4 ${summary.preference.v4}; V3 ${summary.preference.v3}; tie ${summary.preference.tie}; not judged ${summary.preference.notJudged}.`,
    ``,
    `Routes are scored by need-level correctness; a grounded useful partial is not automatically counted as a failure.`,
    report.comparisonMode === "historical_user_experience_replay"
      ? `Historical replay mixes captured knowledge versions and measures the user experience, not architecture alone. See the JSON strata for exact counts.`
      : report.comparisonMode === "mixed_stored_and_fresh_v3_diagnostic"
        ? `This diagnostic mixes stored and fresh V3 answers; it cannot isolate architecture quality.`
        : `Both systems ran against the current materialized snapshot; architecture comparison is still gated on adjudicated gold and an independent judge.`,
    ...(report.promotionGate.failures.length ? [``, `Promotion gate findings:`, ...report.promotionGate.failures.map((failure) => `- ${failure}`)] : []),
    ``,
  ].join("\n");
}

async function main() {
  const datasetPath = path.resolve(argument("dataset") || "tests/ask-sales-faq/v3-regression-78.json");
  const datasetContents = await readFile(datasetPath, "utf8");
  const datasetSha256 = sha256(datasetContents);
  const dataset = await loadDataset(datasetPath);
  const totalPrompts = dataset.conversations.reduce((total, conversation) => total + conversation.prompts.length, 0);
  const perRunLimit = Math.min(totalPrompts, boundedInteger(argument("limit"), totalPrompts, 1, 1000));
  const runs = boundedInteger(argument("runs"), 1, 1, 3);
  const judge = truthy(argument("judge"), false);
  const humanScoresPath = argument("human-scores") ? path.resolve(argument("human-scores") as string) : null;
  if (judge && humanScoresPath) throw new Error("Use either the diagnostic model judge or independently adjudicated human scores, not both.");
  const enforceGate = truthy(argument("enforce-gate"), Boolean(humanScoresPath));
  if (judge && enforceGate) throw new Error("The built-in model judge is diagnostic-only. Use --human-scores with exact answer hashes for promotion enforcement.");
  const forceFreshV3 = argument("v3-source") === "fresh";
  const promptsWithStoredProduction = dataset.conversations.reduce(
    (total, conversation) => total + conversation.prompts.filter((prompt) => Boolean(prompt.production)).length,
    0,
  );
  const comparisonMode = inferV4ComparisonMode({ forceFreshV3, promptsWithStoredProduction, totalPrompts });
  const requestedExecutionOrder = executionOrder(argument("execution-order"));
  const minimumRuns = boundedInteger(argument("minimum-runs"), enforceGate ? 3 : 1, 1, 3);
  const promotionGateOptions = {
    minimumRuns,
    maximumUtilitySpread: boundedInteger(argument("maximum-utility-spread"), 5, 0, 100),
    maximumFalseAbstentionSpread: boundedInteger(argument("maximum-false-abstention-spread"), 5, 0, 100),
    requireModelBacked: truthy(argument("require-model-backed"), true),
  };
  const outputDir = path.resolve(argument("output-dir") || "artifacts/ask-sales-faq-v4");
  const resumePath = argument("resume") ? path.resolve(argument("resume") as string) : null;
  if (resumePath && !/\.json$/i.test(resumePath)) throw new Error("--resume must point to a JSON checkpoint.");
  const requestedRunId = argument("run-id");
  const knowledgeVersion = getMaterializedV3Registry().knowledge_version;
  const codeSha256 = await codeFingerprint();
  let runId = requestedRunId || `paired-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  let outputPath = resumePath || path.join(outputDir, `${runId}.json`);
  let markdownPath = outputPath.replace(/\.json$/i, ".md");
  let items: PairedItem[] = [];
  const manifest = {
    datasetSha256,
    codeSha256,
    knowledgeVersion,
    totalPrompts,
    perRunLimit,
    runs,
    expectedCases: perRunLimit * runs,
    comparisonMode,
    forceFreshV3,
    requestedExecutionOrder,
  };

  if (resumePath) {
    const checkpoint = JSON.parse(await readFile(resumePath, "utf8")) as Record<string, unknown>;
    if (checkpoint.schemaVersion !== 3) throw new Error("Only schemaVersion 3 benchmark checkpoints can be resumed.");
    const checkpointManifest = checkpoint.manifest as Record<string, unknown> | undefined;
    if (!checkpointManifest || JSON.stringify(checkpointManifest) !== JSON.stringify(manifest)) {
      throw new Error("Checkpoint manifest does not match the requested dataset, code, knowledge, or run configuration.");
    }
    if (typeof checkpoint.runId !== "string" || !checkpoint.runId) throw new Error("Checkpoint runId is missing.");
    if (requestedRunId && requestedRunId !== checkpoint.runId) throw new Error("--run-id does not match the checkpoint runId.");
    if (!Array.isArray(checkpoint.items)) throw new Error("Checkpoint items are missing.");
    runId = checkpoint.runId;
    outputPath = resumePath;
    markdownPath = outputPath.replace(/\.json$/i, ".md");
    items = checkpoint.items as PairedItem[];
    if (new Set(items.map((item) => item.id)).size !== items.length) throw new Error("Checkpoint contains duplicate item IDs.");
  }

  let humanScores: V4HumanScoreBundle | null = null;
  if (humanScoresPath) {
    humanScores = parseV4HumanScoreBundle(JSON.parse(await readFile(humanScoresPath, "utf8")));
    if (humanScores.sourceRunId !== runId) throw new Error("Human score bundle sourceRunId does not match this benchmark run.");
    if (humanScores.sourceDatasetSha256 !== datasetSha256) throw new Error("Human score bundle dataset hash does not match.");
    if (humanScores.sourceCodeSha256 !== codeSha256) throw new Error("Human score bundle code hash does not match.");
    if (humanScores.sourceKnowledgeVersion !== knowledgeVersion) throw new Error("Human score bundle knowledge version does not match.");
  }
  const humanScoreById = new Map((humanScores?.scores || []).map((score) => [score.id, score]));
  const usedHumanScoreIds = new Set<string>();
  if ((judge || humanScores) && !dataset.adjudication) {
    throw new Error("Judging requires dataset-level adjudication provenance and resolvable atomic gold needs.");
  }

  await mkdir(path.dirname(outputPath), { recursive: true });

  const itemIndexById = new Map(items.map((item, index) => [item.id, index]));
  const setItem = (item: PairedItem) => {
    const index = itemIndexById.get(item.id);
    if (index === undefined) {
      itemIndexById.set(item.id, items.length);
      items.push(item);
    } else {
      items[index] = item;
    }
  };
  const reportFor = (status: "running" | "complete") => ({
    schemaVersion: 3,
    runId,
    dataset: dataset.name,
    datasetPath,
    status,
    judgeEnabled: judge,
    humanScoresEnabled: Boolean(humanScores),
    promotionGateEnforced: enforceGate,
    comparisonMode,
    manifest,
    adjudication: dataset.adjudication,
    humanScorer: humanScores?.scorer || null,
    strata: replayStrata(items),
    summary: summarizeV4PairedEvaluation(items),
    perRun: summarizeV4Runs(items),
    promotionGateOptions,
    promotionGate: evaluateV4PromotionGate(items, promotionGateOptions),
    items,
  });

  for (let run = 1; run <= runs; run += 1) {
    let attemptedThisRun = 0;
    for (const conversation of dataset.conversations) {
      const v3Messages: AskSalesFaqChatMessage[] = [];
      const v4Messages: AskSalesFaqChatMessage[] = [];
      for (let promptIndex = 0; promptIndex < conversation.prompts.length; promptIndex += 1) {
        if (attemptedThisRun >= perRunLimit) break;
        const promptEntry = conversation.prompts[promptIndex];
        const question = promptEntry.question;
        const v3InputMessages = contextForPrompt(promptEntry, "v3", v3Messages);
        const v4InputMessages = contextForPrompt(promptEntry, "v4", v4Messages);
        attemptedThisRun += 1;
        const itemId = `${conversation.id}-${promptIndex + 1}-run-${run}`;
        const resumed = itemIndexById.has(itemId) ? items[itemIndexById.get(itemId) as number] : null;
        if (resumed) {
          if (resumed.question !== question || resumed.run !== run || resumed.conversationId !== conversation.id || resumed.promptIndex !== promptIndex + 1) {
            throw new Error(`Checkpoint item ${itemId} no longer matches the dataset.`);
          }
          const rescored = applyHumanScore(resumed, humanScoreById.get(itemId));
          if (humanScoreById.has(itemId)) usedHumanScoreIds.add(itemId);
          setItem(rescored);
          if (!promptEntry.independent) {
            v3Messages.splice(0, v3Messages.length, ...nextHistory(v3InputMessages, question, rescored.v3.answer));
            v4Messages.splice(0, v4Messages.length, ...nextHistory(v4InputMessages, question, rescored.v4.answer));
          }
          continue;
        }

        process.stdout.write(`[${items.length + 1}/${manifest.expectedCases}] run ${run} ${conversation.id} Q${promptIndex + 1} ... `);
        const runV3 = () => !forceFreshV3 && promptEntry.production
          ? Promise.resolve({
                answer: promptEntry.production.answer,
                outcome: promptEntry.production.outcome,
                needsRoute: promptEntry.production.needsRoute,
                latencyMs: promptEntry.production.latencyMs,
                runtimeMetadata: promptEntry.production.runtimeMetadata,
                provider: promptEntry.production.provider,
                model: promptEntry.production.model,
                knowledgeVersion: promptEntry.production.knowledgeVersion,
                source: "stored_production" as const,
              })
          : runAskSalesFaqV3(question, v3InputMessages).then((result) => ({ ...result, knowledgeVersion: result.runtimeMetadata.knowledgeVersion, source: "fresh_runtime" as const }));
        const runV4 = () => runAskSalesFaqV4(question, v4InputMessages);
        const alternatingV3First = Number.parseInt(sha256(`${run}:${conversation.id}:${promptIndex}`).slice(0, 2), 16) % 2 === 0;
        const actualExecutionOrder: Exclude<ExecutionOrder, "alternating"> = requestedExecutionOrder === "alternating"
          ? alternatingV3First ? "v3-first" : "v4-first"
          : requestedExecutionOrder;
        let v3: Awaited<ReturnType<typeof runV3>>;
        let v4: Awaited<ReturnType<typeof runV4>>;
        if (actualExecutionOrder === "parallel") {
          [v3, v4] = await Promise.all([runV3(), runV4()]);
        } else if (actualExecutionOrder === "v3-first") {
          v3 = await runV3();
          v4 = await runV4();
        } else {
          v4 = await runV4();
          v3 = await runV3();
        }
        const v3Selected = v3.source === "stored_production"
          ? storedSelectedPolicyIds(v3.runtimeMetadata)
          : v3.runtimeMetadata.v3?.selection.selectedPolicyIds || [];
        const v4Selected = v4.selectedPolicyIds;
        let v3Score: V4SystemJudgeScore | null = null;
        let v4Score: V4SystemJudgeScore | null = null;
        let preferred: PairedItem["preferred"] = "not_judged";
        let comparisonReason: string | null = null;
        let independentJudge = false;
        if (judge) {
          if (!promptEntry.goldNeeds.length) throw new Error(`${itemId} lacks adjudicated atomic gold needs.`);
          const v4IsA = Number.parseInt(createHash("sha256").update(`${run}:${conversation.id}:${promptIndex}:${question}`).digest("hex").slice(0, 2), 16) % 2 === 0;
          const prompt = judgePrompt({
            question,
            answerA: v4IsA ? v4.answer : v3.answer,
            answerB: v4IsA ? v3.answer : v4.answer,
            goldEvidence: evidenceCards(promptEntry.goldPolicyIds),
            goldNeeds: promptEntry.goldNeeds.map((need) => ({ id: need.id, text: need.text, expectedDisposition: need.expectedDisposition, expectedRouteKey: need.expectedRouteKey })),
            goldContext: promptEntry.goldContext,
            blockedTopics: blockedTopicCards(promptEntry.blockedTopicIds),
            blockedContext: promptEntry.blockedContext,
            contextA: v4IsA ? v4InputMessages : v3InputMessages,
            contextB: v4IsA ? v3InputMessages : v4InputMessages,
          });
          try {
            const judged = await generateV4Json({ purpose: "v4_benchmark_blind_judge", system: prompt.system, user: prompt.user, maxTokens: 1800, parse: parseJudge });
            v4Score = v4IsA ? judged.output.A : judged.output.B;
            v3Score = v4IsA ? judged.output.B : judged.output.A;
            if (v3Score.totalNeeds !== promptEntry.goldNeeds.length || v4Score.totalNeeds !== promptEntry.goldNeeds.length) {
              throw new Error(`Judge must score exactly ${promptEntry.goldNeeds.length} adjudicated need(s).`);
            }
            preferred = judged.output.preferred === "tie" ? "tie" : (judged.output.preferred === "A") === v4IsA ? "v4" : "v3";
            comparisonReason = judged.output.comparisonReason;
            independentJudge = false;
            comparisonReason = `${comparisonReason} [Diagnostic model judge: ${judged.model}; not promotion-independent.]`;
          } catch (error) {
            v3Score = null;
            v4Score = null;
            preferred = "not_judged";
            comparisonReason = `Judge failed: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
        let item: PairedItem = {
          id: itemId,
          run,
          conversationId: conversation.id,
          promptIndex: promptIndex + 1,
          question,
          evaluationContext: {
            independent: promptEntry.independent,
            explicitSharedMessageCount: promptEntry.context.length,
            explicitV3MessageCount: promptEntry.v3Context.length,
            explicitV4MessageCount: promptEntry.v4Context.length,
            goldPolicyIds: promptEntry.goldPolicyIds,
            blockedTopicIds: promptEntry.blockedTopicIds,
            goldContext: promptEntry.goldContext,
            blockedContext: promptEntry.blockedContext,
            goldAdjudicated: promptEntry.goldAdjudicated,
            goldAdjudicationValid: Boolean(dataset.adjudication && promptEntry.goldNeeds.length),
            goldNeedCount: promptEntry.goldNeeds.length,
            goldNeedIds: promptEntry.goldNeeds.map((need) => need.id),
            goldResolutionErrors: [],
            sameKnowledgeSnapshot: v3.knowledgeVersion === v4.runtimeMetadata.knowledgeVersion,
            executionOrder: actualExecutionOrder,
          },
          independentJudge,
          preferred,
          comparisonReason,
          v3: { answer: v3.answer, answerSha256: answerSha256(v3.answer), outcome: v3.outcome, needsRoute: v3.needsRoute, latencyMs: v3.latencyMs, selectedPolicyIds: v3Selected, score: v3Score, source: v3.source, provider: v3.provider || null, model: v3.model || null, knowledgeVersion: v3.knowledgeVersion || null },
          v4: {
            answer: v4.answer,
            answerSha256: answerSha256(v4.answer),
            lane: v4.lane,
            needsRoute: v4.needsRoute,
            latencyMs: v4.latencyMs,
            selectedPolicyIds: v4Selected,
            removedSentences: v4.runtimeMetadata.validation.removedSentences,
            score: v4Score,
            provider: v4.provider,
            model: v4.model,
            executionMode: v4.runtimeMetadata.executionMode,
            providerAttempts: v4.runtimeMetadata.providerAttempts.map((attempt) => ({
              purpose: attempt.purpose,
              status: attempt.status,
              provider: attempt.provider,
              model: attempt.model,
              latencyMs: attempt.latencyMs,
              ...(attempt.error ? { error: attempt.error } : {}),
            })),
            planningReason: v4.runtimeMetadata.plan.reasoning_summary,
            validationReason: v4.runtimeMetadata.validation.reason,
          },
        };
        item = applyHumanScore(item, humanScoreById.get(itemId));
        if (humanScoreById.has(itemId)) usedHumanScoreIds.add(itemId);
        setItem(item);
        if (!promptEntry.independent) {
          v3Messages.splice(0, v3Messages.length, ...nextHistory(v3InputMessages, question, v3.answer));
          v4Messages.splice(0, v4Messages.length, ...nextHistory(v4InputMessages, question, v4.answer));
        }
        const partialReport = reportFor("running");
        await writeFile(outputPath, `${JSON.stringify(partialReport, null, 2)}\n`, "utf8");
        process.stdout.write(`V3:${v3.outcome} V4:${v4.lane}${preferred === "not_judged" ? "" : ` preferred:${preferred}`}\n`);
      }
      if (attemptedThisRun >= perRunLimit) break;
    }
  }

  const unusedHumanScores = [...humanScoreById.keys()].filter((id) => !usedHumanScoreIds.has(id));
  if (unusedHumanScores.length) throw new Error(`Human score bundle contains ${unusedHumanScores.length} unused item ID(s), beginning with ${unusedHumanScores[0]}.`);
  const report = reportFor("complete");
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdownReport(report), "utf8");
  console.log(JSON.stringify({ outputPath, markdownPath, summary: report.summary }, null, 2));
  if (enforceGate && !report.promotionGate.passed) {
    console.error(`Promotion gate ${report.promotionGate.status}: ${report.promotionGate.failures.join(" ")}`);
    process.exitCode = 2;
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
