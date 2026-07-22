import { createHash } from "node:crypto";
import { execFile as execFileCallback } from "node:child_process";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import type { AskSalesFaqChatMessage } from "../src/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "../src/lib/ask-sales-faq/v3/runtime";
import { parseV3Json } from "../src/lib/ask-sales-faq/v3/provider";
import { getMaterializedV3Registry } from "../src/lib/ask-sales-faq/v3/admin-approved-releases";
import {
  evaluateV4PromotionGate,
  inferV4ComparisonMode,
  parseV4ApprovedPromotionSuiteManifest,
  parseV4HoldoutConsumptionLedger,
  parseV4HumanScoreBundle,
  parseV4SystemJudgeScore,
  summarizeV4PairedEvaluation,
  summarizeV4Runs,
  V4_CANONICAL_PROMOTION_THRESHOLDS,
  V4_CANONICAL_REQUIRED_STRATA,
  type V4ApprovedPromotionSuiteEvidence,
  type V4HumanScoreBundle,
  type V4HumanScoreRecord,
  type V4HoldoutConsumptionLedgerEvidence,
  type V4PairedEvaluationItem,
  type V4PromotionStratum,
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
import { generateV4Json, getV4ProviderReadiness } from "../src/lib/ask-sales-faq/v4/provider";
import {
  getV3EffectiveCorpusSnapshot,
  getV4EffectiveCorpusSnapshot,
  getV4RouteCatalog,
} from "../src/lib/ask-sales-faq/v4/corpus";
import type { V4RuntimeMetadata } from "../src/lib/ask-sales-faq/v4/types";

type StoredProductionAnswer = {
  answer: string;
  outcome: string;
  needsRoute: boolean;
  latencyMs: number;
  runtimeMetadata: Record<string, unknown> | null;
  provider: string | null;
  model: string | null;
  knowledgeVersion: string | null;
  errorClass: string | null;
  routeReason: string | null;
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
  evaluationStrata: V4PromotionStratum[];
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
  caseId: string;
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
    goldNeeds: V4GoldNeed[];
    goldResolutionErrors: string[];
    sameKnowledgeSnapshot: boolean;
    comparisonMode: ReturnType<typeof inferV4ComparisonMode>;
    executionOrder: ExecutionOrder;
    suiteRole?: "retained" | "holdout";
    suiteId?: string;
    suiteManifestSha256?: string;
    suiteStrata?: V4PromotionStratum[];
    v3EffectiveCorpusSha256: string;
    v4EffectiveCorpusSha256: string;
    sameEffectiveCorpus: boolean;
  };
  independentJudge: boolean;
  v3: V4PairedEvaluationItem["v3"] & { answer: string; answerSha256: string; outcome: string; needsRoute: boolean; routeReason: string | null; routeKeys: string[]; selectedPolicyIds: string[]; source: "stored_production" | "fresh_runtime"; provider: string | null; model: string | null; knowledgeVersion: string | null; errorClass: string | null; providerAttempts: Array<{ purpose?: string; status?: string; provider?: string; model?: string; latencyMs?: number; error?: string }>; runtimeMetadata: unknown };
  v4: V4PairedEvaluationItem["v4"] & {
    answer: string;
    answerSha256: string;
    needsRoute: boolean;
    routeReason: string | null;
    routeChannels: string[];
    routeKeys: string[];
    selectedPolicyIds: string[];
    removedSentences: string[];
    provider: string | null;
    model: string | null;
    turn: {
      kind: string;
      standaloneQuestion: string;
      productScope: string;
      excludedScopes: string[];
      usedImmediateContext: boolean;
      explicitCorrection: boolean;
      explicitScopeSwitch: boolean;
      intentResolutionMode: string | null;
      intentResolutionReason: string | null;
    };
    retrieval: V4RuntimeMetadata["retrieval"];
    plan: V4RuntimeMetadata["plan"];
    executionMode: V4RuntimeMetadata["executionMode"];
    validation: V4RuntimeMetadata["validation"];
    stageTimings: Record<string, number>;
    providerAttempts: Array<{
      purpose?: string;
      status?: string;
      provider?: string;
      model?: string;
      latencyMs?: number;
      error?: string;
      promptChars?: number;
      completionTokens?: number;
      totalTokens?: number;
      reasoningMode?: string;
      temperature?: number;
    }>;
    planningReason: string;
    validationReason: string;
  };
  comparisonReason: string | null;
};

const execFile = promisify(execFileCallback);

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
    errorClass: typeof raw.productionErrorClass === "string" ? raw.productionErrorClass : null,
    routeReason: typeof raw.productionRouteReason === "string" ? raw.productionRouteReason : null,
  };
}

function promotionStrata(value: unknown, label: string) {
  if (value === undefined || value === null) return [];
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  const allowed = new Set<string>(V4_CANONICAL_REQUIRED_STRATA);
  const strata = value.map((entry) => {
    if (typeof entry !== "string" || !allowed.has(entry)) throw new Error(`${label} contains an unsupported stratum: ${String(entry)}`);
    return entry as V4PromotionStratum;
  });
  if (new Set(strata).size !== strata.length) throw new Error(`${label} must not contain duplicates.`);
  return strata;
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
    evaluationStrata: promotionStrata(entry.evaluationStrata ?? entry.strata, `${label}.evaluationStrata`),
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
    routeKeys: Object.keys(getV4RouteCatalog()),
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

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value && typeof value === "object") {
    const object = value as Record<string, unknown>;
    return `{${Object.keys(object).filter((key) => object[key] !== undefined).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(object[key])}`).join(",")}}`;
  }
  return value === undefined ? "null" : JSON.stringify(value);
}

function effectiveCorpusHashes() {
  return {
    v3EffectiveCorpusSha256: sha256(canonicalJson(getV3EffectiveCorpusSnapshot())),
    v4EffectiveCorpusSha256: sha256(canonicalJson(getV4EffectiveCorpusSnapshot())),
  };
}

function observedRouteKeys(input: { needsRoute: boolean; routeChannels?: string[]; answer?: string; routeReason?: string | null }) {
  if (!input.needsRoute) return [];
  const routeCatalog = getV4RouteCatalog();
  const exactChannels = new Set(input.routeChannels || []);
  const text = `${input.answer || ""}\n${input.routeReason || ""}`.toLowerCase();
  return Object.entries(routeCatalog).flatMap(([key, route]) =>
    exactChannels.has(route.channel) || text.includes(route.channel.toLowerCase()) ? [key] : [],
  ).sort();
}

async function runtimeEnvironment(startedAt: string, codeSha256: string) {
  const command = process.argv.slice(2);
  let gitCommitSha = "";
  let gitTreeClean = false;
  let npmVersion = "";
  try {
    gitCommitSha = (await execFile("git", ["rev-parse", "HEAD"], { cwd: process.cwd() })).stdout.trim().toLowerCase();
    gitTreeClean = !(await execFile("git", ["status", "--porcelain", "--untracked-files=normal"], { cwd: process.cwd() })).stdout.trim();
    npmVersion = (await execFile("npm", ["--version"], { cwd: process.cwd() })).stdout.trim();
  } catch {
    // Canonical enforcement fails closed on incomplete runtime provenance.
  }
  return {
    gitCommitSha,
    gitTreeClean,
    codeSha256,
    nodeVersion: process.version,
    npmVersion,
    platform: process.platform,
    architecture: process.arch,
    startedAt,
    completedAt: null as string | null,
    command,
  };
}

async function filesUnder(root: string): Promise<string[]> {
  const entries = await readdir(path.resolve(root), { withFileTypes: true });
  const files = await Promise.all(entries.map((entry) => {
    const relative = path.join(root, entry.name);
    return entry.isDirectory() ? filesUnder(relative) : [relative];
  }));
  return files.flat().sort();
}

async function codeFingerprint() {
  const files = [
    "package.json",
    "package-lock.json",
    "tsconfig.json",
    "vitest.config.ts",
    "scripts/benchmark-ask-sales-faq-v4-paired.ts",
    "src/lib/ask-sales-faq/types.ts",
    "src/lib/ask-sales-faq/generated/v3-admin-approved-releases.json",
    "src/lib/ask-sales-faq/generated/v3-policy-registry.json",
    ...await filesUnder("src/lib/ask-sales-faq/v3"),
    ...await filesUnder("src/lib/ask-sales-faq/v4"),
  ].sort();
  const hash = createHash("sha256");
  for (const file of files) {
    hash.update(file).update("\0").update(await readFile(path.resolve(file), "utf8")).update("\0");
  }
  return hash.digest("hex");
}

function normalizedIntegerEnv(name: string, fallback: number, minimum: number, maximum: number) {
  const parsed = Number.parseInt(process.env[name] || "", 10);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(parsed, maximum)) : fallback;
}

function normalizedModelId(value: string | null) {
  return (value || "").trim().toLowerCase().replace(/^[a-z0-9_-]+\//, "");
}

function providerConfiguration() {
  const v4 = getV4ProviderReadiness();
  const v3DeepSeekConfigured = Boolean(process.env.DEEPSEEK_API_KEY);
  const v3ClaudeFallbackEnabled = process.env.FAQ_ALLOW_CLAUDE_FALLBACK === "true";
  const v3ClaudeConfigured = Boolean(process.env.ANTHROPIC_API_KEY);
  const v3Model = process.env.FAQ_V3_DEEPSEEK_MODEL || process.env.FAQ_DEEPSEEK_MODEL || "deepseek-v4-pro";
  const v3ReasoningMode = process.env.FAQ_DEEPSEEK_DISABLE_THINKING === "false" ? "enabled" : "disabled";
  const v3 = {
    modelConfigured: v3DeepSeekConfigured,
    deepSeekCredentialConfigured: v3DeepSeekConfigured,
    anthropicCredentialConfigured: v3ClaudeConfigured,
    provider: v3DeepSeekConfigured ? "deepseek" as const : null,
    model: v3DeepSeekConfigured ? v3Model : null,
    transport: v3DeepSeekConfigured ? "direct" as const : null,
    maxModelCallSeconds: normalizedIntegerEnv("FAQ_MODEL_TIMEOUT_SECONDS", 75, 15, 110),
    deepSeekRetries: 1 as const,
    reasoningMode: v3ReasoningMode,
    claudeFallbackEnabled: v3ClaudeFallbackEnabled,
    claudeFallbackReady: v3ClaudeFallbackEnabled && v3ClaudeConfigured,
  };
  return {
    v3,
    v4: {
      modelConfigured: v4.modelConfigured,
      provider: v4.provider,
      model: v4.model,
      transport: v4.transport,
      maxModelCallSeconds: v4.maxModelCallSeconds,
      maxRequestSeconds: v4.maxRequestSeconds,
      deepSeekRetries: v4.deepSeekRetries,
    },
    parity: {
      providerMatches: Boolean(v3.provider && v4.provider && v3.provider === v4.provider),
      modelMatches: Boolean(v3.model && v4.model && normalizedModelId(v3.model) === normalizedModelId(v4.model)),
      reasoningModeMatches: v3.reasoningMode === "disabled",
      fallbackDisabled: !v3.claudeFallbackEnabled,
    },
  };
}

function answerSha256(answer: string) {
  return sha256(answer);
}

function clearJudgment(item: PairedItem): PairedItem {
  return {
    ...item,
    independentJudge: false,
    preferred: "not_judged",
    comparisonReason: null,
    scoreProvenance: undefined,
    humanNeedOutcomes: undefined,
    v3: { ...item.v3, score: null },
    v4: { ...item.v4, score: null },
  };
}

function applyHumanScore(
  item: PairedItem,
  score: V4HumanScoreRecord | undefined,
  bundle: V4HumanScoreBundle | null,
  humanScoreBundleSha256: string | null,
) {
  if (!score) return item;
  if (!bundle) throw new Error(`Human score ${item.id} is missing its source bundle.`);
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
  const goldById = new Map(item.evaluationContext.goldNeeds.map((need) => [need.id, need]));
  const governedRouteKeys = new Set(Object.keys(getV4RouteCatalog()));
  for (const outcome of score.needOutcomes) {
    const gold = goldById.get(outcome.needId);
    if (!gold || outcome.expectedDisposition !== gold.expectedDisposition || outcome.expectedRouteKey !== gold.expectedRouteKey) {
      throw new Error(`Human score ${item.id}/${outcome.needId} is not bound to the exact gold disposition and route key.`);
    }
    for (const routeKey of [outcome.v3RouteKey, outcome.v4RouteKey]) {
      if (routeKey && !governedRouteKeys.has(routeKey)) throw new Error(`Human score ${item.id}/${outcome.needId} uses an ungoverned route key.`);
    }
  }
  const actualV3Runtime = { lane: item.v3.outcome, needsRoute: item.v3.needsRoute, routeKeys: [...item.v3.routeKeys].sort() };
  const actualV4Runtime = { lane: item.v4.lane, needsRoute: item.v4.needsRoute, routeKeys: [...item.v4.routeKeys].sort() };
  const scoredV3Runtime = { ...score.v3Runtime, routeKeys: [...score.v3Runtime.routeKeys].sort() };
  const scoredV4Runtime = { ...score.v4Runtime, routeKeys: [...score.v4Runtime.routeKeys].sort() };
  if (JSON.stringify(actualV3Runtime) !== JSON.stringify(scoredV3Runtime) || JSON.stringify(actualV4Runtime) !== JSON.stringify(scoredV4Runtime)) {
    throw new Error(`Human score ${item.id} is not bound to the actual runtime lane, needsRoute value, and route keys.`);
  }
  if (!humanScoreBundleSha256) throw new Error(`Human score ${item.id} is missing its bundle SHA-256.`);
  return {
    ...item,
    independentJudge: true,
    preferred: score.preferred,
    comparisonReason: score.comparisonReason,
    scoreProvenance: {
      kind: "human",
      scorerId: score.scorer.id,
      scoredAt: score.scorer.adjudicatedAt,
      methodology: score.scorer.methodology,
      sourceRunId: bundle.sourceRunId,
      sourceDatasetSha256: bundle.sourceDatasetSha256,
      sourceCodeSha256: bundle.sourceCodeSha256,
      sourceKnowledgeVersion: bundle.sourceKnowledgeVersion,
      sourceApprovedSuiteManifestSha256: bundle.sourceApprovedSuiteManifestSha256,
      sourceV3EffectiveCorpusSha256: bundle.sourceV3EffectiveCorpusSha256,
      sourceV4EffectiveCorpusSha256: bundle.sourceV4EffectiveCorpusSha256,
      sourceArtifactSha256: bundle.sourceArtifactSha256,
      humanScoreBundleSha256,
    },
    humanNeedOutcomes: score.needOutcomes,
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
      "routed_need_count is the number of atomic needs for which a route or escalation was used. correctly_routed_need_count is the subset sent to the correct approved destination for a genuinely unresolved need. route_was_used must equal routed_need_count > 0. route_was_appropriate must be null when no route was used, true only when every routed need was correctly routed, and false otherwise.",
      "Return {A:{total_needs,fully_resolved_needs,useful_partial_needs,appropriately_routed_needs,false_abstained_needs,routed_need_count,correctly_routed_need_count,unsupported_claim_count,critical_unsupported_claim_count,route_was_used,route_was_appropriate,technical_failure,assessment},B:{same},preferred:A|B|tie,comparison_reason}.",
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

function providerAttemptsFromMetadata(metadata: Record<string, unknown> | null) {
  return nestedArray(metadata, ["providerAttempts"]).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const attempt = value as Record<string, unknown>;
    return [{
      purpose: typeof attempt.purpose === "string" ? attempt.purpose : undefined,
      status: attempt.status === "success" || attempt.status === "failed" ? attempt.status : undefined,
      provider: typeof attempt.provider === "string" ? attempt.provider : undefined,
      model: typeof attempt.model === "string" ? attempt.model : undefined,
      latencyMs: typeof attempt.latencyMs === "number" ? attempt.latencyMs : undefined,
      error: typeof attempt.error === "string" ? attempt.error.slice(0, 500) : undefined,
    }];
  });
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

function plannedCaseIds(dataset: Dataset, perRunLimit: number) {
  const ids: string[] = [];
  for (const conversation of dataset.conversations) {
    for (let promptIndex = 0; promptIndex < conversation.prompts.length && ids.length < perRunLimit; promptIndex += 1) {
      ids.push(`${conversation.id}-${promptIndex + 1}`);
    }
    if (ids.length >= perRunLimit) break;
  }
  if (new Set(ids).size !== ids.length) throw new Error("Dataset produces duplicate stable case IDs; conversation IDs must be unique.");
  return ids;
}

function plannedCaseStrata(dataset: Dataset, perRunLimit: number) {
  const result = new Map<string, V4PromotionStratum[]>();
  let count = 0;
  for (const conversation of dataset.conversations) {
    for (let promptIndex = 0; promptIndex < conversation.prompts.length && count < perRunLimit; promptIndex += 1) {
      result.set(`${conversation.id}-${promptIndex + 1}`, conversation.prompts[promptIndex].evaluationStrata);
      count += 1;
    }
    if (count >= perRunLimit) break;
  }
  return result;
}

function expectedItemIds(caseIds: string[], runs: number) {
  return Array.from({ length: runs }, (_, index) => index + 1)
    .flatMap((run) => caseIds.map((caseId) => `${caseId}-run-${run}`));
}

function exactSetMismatch(expected: string[], actual: string[]) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  return {
    missing: expected.filter((id) => !actualSet.has(id)),
    extra: actual.filter((id) => !expectedSet.has(id)),
    duplicateCount: actual.length - actualSet.size,
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
  items: PairedItem[];
}) {
  const { summary } = report;
  const cell = (value: unknown) => value === null ? "n/a" : String(value);
  const perNeedLines = report.items.flatMap((item) => (item.humanNeedOutcomes || []).map((outcome) =>
    `| ${item.id} | ${outcome.needId} | ${outcome.expectedDisposition}${outcome.expectedRouteKey ? ` / ${outcome.expectedRouteKey}` : ""} | ${outcome.v3AnswerCompleteness} / ${outcome.v3RouteKey || "no route"} | ${outcome.v4AnswerCompleteness} / ${outcome.v4RouteKey || "no route"} |`,
  ));
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
        : report.comparisonMode === "different_effective_corpora_fresh_v3_vs_v4_end_to_end"
          ? `Both systems ran fresh, but their recorded effective-corpus hashes differ. This is an end-to-end V3-versus-V4 comparison, never an architecture-only claim.`
          : report.comparisonMode === "same_effective_corpus_fresh_v3_vs_v4_architecture_only"
            ? `Both systems ran fresh against the exact same effective-corpus hash; architecture attribution still requires canonical independent adjudication.`
            : `The effective corpus could not be fingerprinted, so this comparison is diagnostic only.`,
    ...(report.promotionGate.failures.length ? [``, `Promotion gate findings:`, ...report.promotionGate.failures.map((failure) => `- ${failure}`)] : []),
    ...(perNeedLines.length ? [
      ``,
      `## Human per-need outcomes`,
      ``,
      `Answer completeness and routing are reported independently.`,
      ``,
      `| Item | Need | Gold | V3 answer / route | V4 answer / route |`,
      `| --- | --- | --- | --- | --- |`,
      ...perNeedLines,
    ] : []),
    ``,
  ].join("\n");
}

async function main() {
  const benchmarkStartedAt = new Date().toISOString();
  const datasetPath = path.resolve(argument("dataset") || "tests/ask-sales-faq/v3-regression-78.json");
  const datasetContents = await readFile(datasetPath, "utf8");
  const datasetSha256 = sha256(datasetContents);
  const dataset = await loadDataset(datasetPath);
  const knowledgeVersion = getMaterializedV3Registry().knowledge_version;
  const totalPrompts = dataset.conversations.reduce((total, conversation) => total + conversation.prompts.length, 0);
  const perRunLimit = Math.min(totalPrompts, boundedInteger(argument("limit"), totalPrompts, 1, 1000));
  const runs = boundedInteger(argument("runs"), 1, 1, 3);
  const caseIds = plannedCaseIds(dataset, perRunLimit);
  const caseStrata = plannedCaseStrata(dataset, perRunLimit);
  const allExpectedItemIds = expectedItemIds(caseIds, runs);
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
  const corpusHashes = effectiveCorpusHashes();
  const comparisonMode = inferV4ComparisonMode({
    forceFreshV3,
    promptsWithStoredProduction,
    totalPrompts,
    ...corpusHashes,
  });
  const codeSha256 = await codeFingerprint();
  const runtime = await runtimeEnvironment(benchmarkStartedAt, codeSha256);
  const requestedExecutionOrder = executionOrder(argument("execution-order"));
  const minimumRuns = boundedInteger(argument("minimum-runs"), enforceGate ? 3 : 1, 1, 3);
  const requireModelBacked = truthy(argument("require-model-backed"), true);
  const requestedPromotionGateOptions = {
    minimumRuns,
    maximumUtilitySpread: boundedInteger(argument("maximum-utility-spread"), V4_CANONICAL_PROMOTION_THRESHOLDS.maximumUtilitySpread, 0, 100),
    maximumFalseAbstentionSpread: boundedInteger(argument("maximum-false-abstention-spread"), V4_CANONICAL_PROMOTION_THRESHOLDS.maximumFalseAbstentionSpread, 0, 100),
    maximumV4P95LatencyMs: boundedInteger(argument("maximum-v4-p95-latency-ms"), V4_CANONICAL_PROMOTION_THRESHOLDS.maximumV4P95LatencyMs, 1_000, 120_000),
    maximumRecoveredRetryRate: boundedInteger(argument("maximum-recovered-retry-rate"), V4_CANONICAL_PROMOTION_THRESHOLDS.maximumRecoveredRetryRate, 0, 100),
    requireModelBacked,
    requireFreshV3: true,
  };
  const approvedSuitePath = argument("approved-suite-manifest") ? path.resolve(argument("approved-suite-manifest") as string) : null;
  const approvedSuiteSha256 = argument("approved-suite-sha256")?.toLowerCase() || null;
  if (Boolean(approvedSuitePath) !== Boolean(approvedSuiteSha256)) {
    throw new Error("Use --approved-suite-manifest and --approved-suite-sha256 together.");
  }
  let approvedSuite: V4ApprovedPromotionSuiteEvidence | null = null;
  let holdoutLedger: V4HoldoutConsumptionLedgerEvidence | null = null;
  if (approvedSuitePath && approvedSuiteSha256) {
    if (!/^[a-f0-9]{64}$/.test(approvedSuiteSha256)) throw new Error("--approved-suite-sha256 must be a SHA-256 hex digest.");
    const contents = await readFile(approvedSuitePath, "utf8");
    const manifestSha256 = sha256(contents);
    if (manifestSha256 !== approvedSuiteSha256) throw new Error("Approved-suite manifest bytes do not match --approved-suite-sha256.");
    const suiteManifest = parseV4ApprovedPromotionSuiteManifest(JSON.parse(contents));
    if (suiteManifest.datasetSha256 !== datasetSha256) throw new Error("Approved-suite manifest dataset hash does not match --dataset.");
    if (suiteManifest.knowledgeVersion !== knowledgeVersion) throw new Error("Approved-suite manifest knowledge version does not match the current materialized snapshot.");
    if (suiteManifest.v3EffectiveCorpusSha256 !== corpusHashes.v3EffectiveCorpusSha256 || suiteManifest.v4EffectiveCorpusSha256 !== corpusHashes.v4EffectiveCorpusSha256) {
      throw new Error("Approved-suite manifest is not bound to both current effective-corpus hashes.");
    }
    if (suiteManifest.expectedCodeSha256 !== codeSha256) throw new Error("Approved-suite manifest code fingerprint does not match the frozen evaluator/runtime code.");
    const suiteCaseMismatch = exactSetMismatch(caseIds, suiteManifest.cases.map((item) => item.caseId));
    if (suiteCaseMismatch.missing.length || suiteCaseMismatch.extra.length || suiteCaseMismatch.duplicateCount) {
      throw new Error("Approved-suite manifest must name the exact stable case IDs in the full selected dataset.");
    }
    for (const suiteCase of suiteManifest.cases) {
      if (JSON.stringify([...suiteCase.strata].sort()) !== JSON.stringify([...(caseStrata.get(suiteCase.caseId) || [])].sort())) {
        throw new Error(`Approved-suite manifest strata do not match dataset case ${suiteCase.caseId}.`);
      }
    }
    const holdoutCaseSetSha256 = sha256(canonicalJson(suiteManifest.cases.filter((item) => item.role === "holdout").map((item) => item.caseId).sort()));
    if (holdoutCaseSetSha256 !== suiteManifest.protocol.holdout.caseSetSha256) {
      throw new Error("Approved-suite manifest holdout case-set hash does not match its exact holdout case IDs.");
    }
    approvedSuite = { manifest: suiteManifest, manifestSha256, approvedManifestSha256: approvedSuiteSha256 };
  }
  const holdoutLedgerPath = argument("holdout-consumption-ledger") ? path.resolve(argument("holdout-consumption-ledger") as string) : null;
  const holdoutLedgerSha256 = argument("holdout-consumption-ledger-sha256")?.toLowerCase() || null;
  if (Boolean(holdoutLedgerPath) !== Boolean(holdoutLedgerSha256)) {
    throw new Error("Use --holdout-consumption-ledger and --holdout-consumption-ledger-sha256 together.");
  }
  if (holdoutLedgerPath && holdoutLedgerSha256) {
    if (!/^[a-f0-9]{64}$/.test(holdoutLedgerSha256)) throw new Error("--holdout-consumption-ledger-sha256 must be a SHA-256 hex digest.");
    const contents = await readFile(holdoutLedgerPath, "utf8");
    if (sha256(contents) !== holdoutLedgerSha256) throw new Error("Holdout-consumption ledger bytes do not match the supplied SHA-256.");
    holdoutLedger = { ledger: parseV4HoldoutConsumptionLedger(JSON.parse(contents)), ledgerSha256: holdoutLedgerSha256 };
    if (approvedSuite && holdoutLedgerSha256 !== approvedSuite.manifest.protocol.holdout.consumptionLedgerSha256) {
      throw new Error("Holdout-consumption ledger hash does not match the preregistered suite protocol.");
    }
  }
  const providerConfig = providerConfiguration();
  if (enforceGate) {
    if (!humanScoresPath) throw new Error("Promotion enforcement requires an independently adjudicated --human-scores bundle.");
    if (!approvedSuite) throw new Error("Promotion enforcement requires a hashed --approved-suite-manifest containing both retained and holdout roles.");
    if (!holdoutLedger) throw new Error("Promotion enforcement requires the exact preregistered holdout-consumption ledger and hash.");
    if (!forceFreshV3 || !["same_effective_corpus_fresh_v3_vs_v4_architecture_only", "different_effective_corpora_fresh_v3_vs_v4_end_to_end"].includes(comparisonMode)) throw new Error("Promotion enforcement requires a fresh, effective-corpus-fingerprinted V3-versus-V4 comparison.");
    if (perRunLimit !== totalPrompts) throw new Error("Promotion enforcement requires the entire selected dataset; --limit cannot select a subset.");
    if (runs !== V4_CANONICAL_PROMOTION_THRESHOLDS.minimumRuns || minimumRuns !== V4_CANONICAL_PROMOTION_THRESHOLDS.minimumRuns) throw new Error("Promotion enforcement requires exactly three complete runs and --minimum-runs=3.");
    if (!requireModelBacked) throw new Error("Promotion enforcement cannot disable model-backed provenance.");
    if (requestedExecutionOrder !== "alternating") throw new Error("Promotion enforcement requires --execution-order=alternating.");
    if (
      requestedPromotionGateOptions.maximumUtilitySpread !== V4_CANONICAL_PROMOTION_THRESHOLDS.maximumUtilitySpread ||
      requestedPromotionGateOptions.maximumFalseAbstentionSpread !== V4_CANONICAL_PROMOTION_THRESHOLDS.maximumFalseAbstentionSpread ||
      requestedPromotionGateOptions.maximumV4P95LatencyMs !== V4_CANONICAL_PROMOTION_THRESHOLDS.maximumV4P95LatencyMs ||
      requestedPromotionGateOptions.maximumRecoveredRetryRate !== V4_CANONICAL_PROMOTION_THRESHOLDS.maximumRecoveredRetryRate
    ) {
      throw new Error("Canonical promotion thresholds cannot be relaxed or overridden during gate enforcement.");
    }
    if (!providerConfig.v3.modelConfigured || !providerConfig.v4.modelConfigured) throw new Error("Promotion enforcement requires both V3 and V4 model providers to be ready.");
    if (!runtime.gitTreeClean || runtime.gitCommitSha !== approvedSuite.manifest.protocol.preregistration.gitCommitSha) {
      throw new Error("Promotion enforcement requires the clean preregistered Git commit.");
    }
    if (!providerConfig.parity.providerMatches || !providerConfig.parity.modelMatches || !providerConfig.parity.reasoningModeMatches || !providerConfig.parity.fallbackDisabled) {
      throw new Error("Promotion enforcement requires healthy V3/V4 DeepSeek provider/model parity with reasoning and fallback disabled.");
    }
    if (
      approvedSuite.manifest.intendedProvider.provider !== providerConfig.v3.provider ||
      approvedSuite.manifest.intendedProvider.model !== normalizedModelId(providerConfig.v3.model)
    ) {
      throw new Error("Current provider/model readiness does not match the immutable approved-suite intent.");
    }
  }
  const promotionGateOptions = enforceGate
    ? { ...V4_CANONICAL_PROMOTION_THRESHOLDS, enforceCanonicalThresholds: true, approvedSuite }
    : { ...requestedPromotionGateOptions, enforceCanonicalThresholds: false, approvedSuite };
  const outputDir = path.resolve(argument("output-dir") || "artifacts/ask-sales-faq-v4");
  const resumePath = argument("resume") ? path.resolve(argument("resume") as string) : null;
  if (resumePath && !/\.json$/i.test(resumePath)) throw new Error("--resume must point to a JSON checkpoint.");
  if (humanScoresPath && !resumePath) throw new Error("Human scores must be applied to a complete --resume checkpoint so answer hashes cannot drift.");
  const requestedRunId = argument("run-id");
  let runId = requestedRunId || `paired-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  let outputPath = resumePath || path.join(outputDir, `${runId}.json`);
  let markdownPath = outputPath.replace(/\.json$/i, ".md");
  let items: PairedItem[] = [];
  let sourceArtifactSha256: string | null = null;
  let sourceRuntime = runtime;
  let holdoutConsumptionReceipt: {
    evaluationEpisodeId: string;
    holdoutCaseSetSha256: string;
    priorLedgerSha256: string;
    consumedAt: string;
  } | null = null;
  const manifest = {
    datasetSha256,
    codeSha256,
    knowledgeVersion,
    ...corpusHashes,
    effectiveCorporaDiffer: corpusHashes.v3EffectiveCorpusSha256 !== corpusHashes.v4EffectiveCorpusSha256,
    totalPrompts,
    perRunLimit,
    runs,
    expectedCases: perRunLimit * runs,
    comparisonMode,
    forceFreshV3,
    requestedExecutionOrder,
    diagnosticJudgeEnabled: judge,
    providerConfiguration: providerConfig,
    approvedSuite: approvedSuite ? {
      suiteId: approvedSuite.manifest.suiteId,
      manifestSha256: approvedSuite.manifestSha256,
      approvedManifestSha256: approvedSuite.approvedManifestSha256,
      roleCounts: countBy(approvedSuite.manifest.cases.map((item) => item.role)),
      evaluationEpisodeId: approvedSuite.manifest.evaluationEpisodeId,
      holdoutCaseSetSha256: approvedSuite.manifest.protocol.holdout.caseSetSha256,
      holdoutConsumptionLedgerSha256: approvedSuite.manifest.protocol.holdout.consumptionLedgerSha256,
    } : null,
  };

  if (resumePath) {
    const checkpointContents = await readFile(resumePath, "utf8");
    sourceArtifactSha256 = sha256(checkpointContents);
    const checkpoint = JSON.parse(checkpointContents) as Record<string, unknown>;
    if (checkpoint.schemaVersion !== 5) throw new Error("Only schemaVersion 5 raw benchmark checkpoints can be resumed.");
    if (checkpoint.scoredDerivative === true || checkpoint.humanScoresEnabled === true) throw new Error("A scored derivative cannot be used as a raw generation checkpoint.");
    const checkpointManifest = checkpoint.manifest as Record<string, unknown> | undefined;
    if (!checkpointManifest || JSON.stringify(checkpointManifest) !== JSON.stringify(manifest)) {
      throw new Error("Checkpoint manifest does not match the requested dataset, code, knowledge, or run configuration.");
    }
    if (typeof checkpoint.runId !== "string" || !checkpoint.runId) throw new Error("Checkpoint runId is missing.");
    if (requestedRunId && requestedRunId !== checkpoint.runId) throw new Error("--run-id does not match the checkpoint runId.");
    if (!Array.isArray(checkpoint.items)) throw new Error("Checkpoint items are missing.");
    if (humanScoresPath && checkpoint.status !== "complete") throw new Error("Human scores can only be applied to a complete answer-generation checkpoint.");
    if (!humanScoresPath && checkpoint.status === "complete") throw new Error("A complete raw generation artifact is immutable; resume is allowed only for an incomplete checkpoint or a separate human-scored derivative.");
    runId = checkpoint.runId;
    outputPath = resumePath;
    markdownPath = outputPath.replace(/\.json$/i, ".md");
    items = checkpoint.items as PairedItem[];
    if (checkpoint.runtime && typeof checkpoint.runtime === "object" && !Array.isArray(checkpoint.runtime)) {
      sourceRuntime = checkpoint.runtime as typeof runtime;
    }
    if (checkpoint.holdoutConsumptionReceipt && typeof checkpoint.holdoutConsumptionReceipt === "object" && !Array.isArray(checkpoint.holdoutConsumptionReceipt)) {
      holdoutConsumptionReceipt = checkpoint.holdoutConsumptionReceipt as {
        evaluationEpisodeId: string;
        holdoutCaseSetSha256: string;
        priorLedgerSha256: string;
        consumedAt: string;
      };
    }
    const resumeMismatch = exactSetMismatch(allExpectedItemIds, items.map((item) => item.id));
    if (resumeMismatch.extra.length || resumeMismatch.duplicateCount) throw new Error("Checkpoint contains duplicate or unexpected item IDs.");
    const malformedResumeItem = items.find((item) => !item.caseId || !Number.isInteger(item.run) || item.id !== `${item.caseId}-run-${item.run}`);
    if (malformedResumeItem) throw new Error(`Checkpoint item ${malformedResumeItem.id || "unknown"} has invalid stable run identity.`);
    if (humanScoresPath && resumeMismatch.missing.length) throw new Error("Human scores require a complete checkpoint with every expected repeated-run item ID.");
  }

  let humanScores: V4HumanScoreBundle | null = null;
  let humanScoreBundleSha256: string | null = null;
  if (humanScoresPath) {
    const humanScoreBundleContents = await readFile(humanScoresPath, "utf8");
    humanScoreBundleSha256 = sha256(humanScoreBundleContents);
    humanScores = parseV4HumanScoreBundle(JSON.parse(humanScoreBundleContents));
    if (humanScores.sourceRunId !== runId) throw new Error("Human score bundle sourceRunId does not match this benchmark run.");
    if (!sourceArtifactSha256 || humanScores.sourceArtifactSha256 !== sourceArtifactSha256) throw new Error("Human score bundle sourceArtifactSha256 does not match the immutable raw generation artifact.");
    if (humanScores.sourceDatasetSha256 !== datasetSha256) throw new Error("Human score bundle dataset hash does not match.");
    if (humanScores.sourceCodeSha256 !== codeSha256) throw new Error("Human score bundle code hash does not match.");
    if (humanScores.sourceKnowledgeVersion !== knowledgeVersion) throw new Error("Human score bundle knowledge version does not match.");
    if (humanScores.sourceV3EffectiveCorpusSha256 !== corpusHashes.v3EffectiveCorpusSha256 || humanScores.sourceV4EffectiveCorpusSha256 !== corpusHashes.v4EffectiveCorpusSha256) {
      throw new Error("Human score bundle is not bound to both current effective-corpus hashes.");
    }
    if (enforceGate && humanScores.sourceApprovedSuiteManifestSha256 !== approvedSuite?.manifestSha256) {
      throw new Error("Human score bundle is not bound to the exact approved-suite manifest hash.");
    }
    outputPath = resumePath!.replace(/\.json$/i, `.scored-${humanScoreBundleSha256.slice(0, 12)}.json`);
    markdownPath = outputPath.replace(/\.json$/i, ".md");
    try {
      await stat(outputPath);
      throw new Error(`Scored derivative already exists and will not be overwritten: ${outputPath}`);
    } catch (error) {
      if (error instanceof Error && !error.message.includes("ENOENT")) throw error;
    }
  }
  const humanScoreById = new Map((humanScores?.scores || []).map((score) => [score.id, score]));
  if (humanScores) {
    const scoreIdMismatch = exactSetMismatch(allExpectedItemIds, humanScores.scores.map((score) => score.id));
    if (scoreIdMismatch.missing.length || scoreIdMismatch.extra.length || scoreIdMismatch.duplicateCount) {
      throw new Error("Human score bundle must cover the exact current repeated-run item IDs, with no missing, extra, or duplicate scores.");
    }
    items = items.map(clearJudgment);
  }
  if (enforceGate && approvedSuite) {
    if (runId !== approvedSuite.manifest.evaluationEpisodeId) {
      throw new Error("Canonical runId must equal the preregistered evaluationEpisodeId.");
    }
    if (!sourceRuntime.completedAt) throw new Error("Canonical human scoring requires complete raw-generation start/end runtime metadata.");
    if (!holdoutConsumptionReceipt) throw new Error("Canonical human scoring requires the raw artifact's holdout-consumption receipt.");
    if (holdoutLedger?.ledger.consumptions.some((entry) => entry.holdoutCaseSetSha256 === approvedSuite.manifest.protocol.holdout.caseSetSha256)) {
      throw new Error("The approved holdout was already consumed before this preregistered evaluation episode.");
    }
  }
  const usedHumanScoreIds = new Set<string>();
  if ((judge || humanScores) && !dataset.adjudication) {
    throw new Error("Judging requires dataset-level adjudication provenance and resolvable atomic gold needs.");
  }

  await mkdir(path.dirname(outputPath), { recursive: true });
  if (!resumePath) {
    try {
      await stat(outputPath);
      throw new Error(`Raw generation artifact already exists and will not be overwritten: ${outputPath}`);
    } catch (error) {
      if (error instanceof Error && !error.message.includes("ENOENT")) throw error;
    }
  }

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
  const reportFor = (status: "running" | "complete") => {
    const reportRuntime = humanScores || resumePath ? sourceRuntime : runtime;
    const receipt = humanScores
      ? holdoutConsumptionReceipt
      : approvedSuite && status === "complete" && reportRuntime.completedAt
        ? {
            evaluationEpisodeId: approvedSuite.manifest.evaluationEpisodeId,
            holdoutCaseSetSha256: approvedSuite.manifest.protocol.holdout.caseSetSha256,
            priorLedgerSha256: approvedSuite.manifest.protocol.holdout.consumptionLedgerSha256,
            consumedAt: reportRuntime.completedAt,
          }
        : null;
    const effectiveGateOptions = {
      ...promotionGateOptions,
      canonicalRuntime: reportRuntime,
      holdoutLedger,
      holdoutConsumptionReceipt: receipt,
    };
    return {
      schemaVersion: 5,
      runId,
      dataset: dataset.name,
      datasetPath,
      status,
      scoredDerivative: Boolean(humanScores),
      sourceArtifactSha256,
      humanScoreBundleSha256,
      judgeEnabled: judge,
      humanScoresEnabled: Boolean(humanScores),
      promotionGateEnforced: enforceGate,
      comparisonMode,
      manifest,
      runtime: reportRuntime,
      holdoutConsumptionReceipt: receipt,
      adjudication: dataset.adjudication,
      humanScorers: humanScores ? [...new Map(humanScores.scores.map((score) => [score.scorer.id, score.scorer])).values()] : [],
      strata: replayStrata(items),
      summary: summarizeV4PairedEvaluation(items),
      perRun: summarizeV4Runs(items),
      promotionGateOptions: effectiveGateOptions,
      promotionGate: evaluateV4PromotionGate(items, effectiveGateOptions),
      items,
    };
  };

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
        const caseId = `${conversation.id}-${promptIndex + 1}`;
        const itemId = `${caseId}-run-${run}`;
        const resumed = itemIndexById.has(itemId) ? items[itemIndexById.get(itemId) as number] : null;
        if (resumed) {
          if (resumed.caseId !== caseId || resumed.question !== question || resumed.run !== run || resumed.conversationId !== conversation.id || resumed.promptIndex !== promptIndex + 1) {
            throw new Error(`Checkpoint item ${itemId} no longer matches the dataset.`);
          }
          if (resumed.v3.answerSha256 !== answerSha256(resumed.v3.answer) || resumed.v4.answerSha256 !== answerSha256(resumed.v4.answer)) {
            throw new Error(`Checkpoint item ${itemId} answer hashes do not match its stored answers.`);
          }
          const currentGoldNeedIds = promptEntry.goldNeeds.map((need) => need.id).sort();
          if (
            resumed.evaluationContext.goldNeedCount !== promptEntry.goldNeeds.length ||
            JSON.stringify([...resumed.evaluationContext.goldNeedIds].sort()) !== JSON.stringify(currentGoldNeedIds) ||
            JSON.stringify(resumed.evaluationContext.goldNeeds) !== JSON.stringify(promptEntry.goldNeeds)
          ) {
            throw new Error(`Checkpoint item ${itemId} is not bound to the current adjudicated atomic gold needs.`);
          }
          if (
            resumed.evaluationContext.v3EffectiveCorpusSha256 !== corpusHashes.v3EffectiveCorpusSha256 ||
            resumed.evaluationContext.v4EffectiveCorpusSha256 !== corpusHashes.v4EffectiveCorpusSha256
          ) {
            throw new Error(`Checkpoint item ${itemId} is not bound to both current effective-corpus hashes.`);
          }
          if (approvedSuite && (
            resumed.evaluationContext.suiteRole !== approvedSuite.manifest.cases.find((entry) => entry.caseId === caseId)?.role ||
            resumed.evaluationContext.suiteId !== approvedSuite.manifest.suiteId ||
            resumed.evaluationContext.suiteManifestSha256 !== approvedSuite.manifestSha256 ||
            JSON.stringify([...(resumed.evaluationContext.suiteStrata || [])].sort()) !== JSON.stringify([...(approvedSuite.manifest.cases.find((entry) => entry.caseId === caseId)?.strata || [])].sort())
          )) {
            throw new Error(`Checkpoint item ${itemId} is not bound to the current approved-suite role and hash.`);
          }
          const rescored = applyHumanScore(resumed, humanScoreById.get(itemId), humanScores, humanScoreBundleSha256);
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
                errorClass: promptEntry.production.errorClass,
                routeReason: promptEntry.production.routeReason,
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
        const v3RouteKeys = observedRouteKeys({ needsRoute: v3.needsRoute, answer: v3.answer, routeReason: v3.routeReason });
        const v4RouteKeys = observedRouteKeys({ needsRoute: v4.needsRoute, routeChannels: v4.routeChannels, answer: v4.answer, routeReason: v4.routeReason });
        let v3Score: V4SystemJudgeScore | null = null;
        let v4Score: V4SystemJudgeScore | null = null;
        let preferred: PairedItem["preferred"] = "not_judged";
        let comparisonReason: string | null = null;
        let independentJudge = false;
        let scoreProvenance: PairedItem["scoreProvenance"];
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
            scoreProvenance = {
              kind: "diagnostic_model",
              scorerId: `${judged.provider}:${judged.model}`,
              scoredAt: null,
              methodology: "Blind diagnostic model judge; not promotion-independent.",
            };
          } catch (error) {
            v3Score = null;
            v4Score = null;
            preferred = "not_judged";
            comparisonReason = `Judge failed: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
        let item: PairedItem = {
          id: itemId,
          caseId,
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
            goldNeeds: promptEntry.goldNeeds,
            goldResolutionErrors: [],
            sameKnowledgeSnapshot: v3.knowledgeVersion === v4.runtimeMetadata.knowledgeVersion,
            sameEffectiveCorpus: corpusHashes.v3EffectiveCorpusSha256 === corpusHashes.v4EffectiveCorpusSha256,
            ...corpusHashes,
            comparisonMode,
            executionOrder: actualExecutionOrder,
            ...(approvedSuite ? {
              suiteRole: approvedSuite.manifest.cases.find((entry) => entry.caseId === caseId)?.role,
              suiteId: approvedSuite.manifest.suiteId,
              suiteManifestSha256: approvedSuite.manifestSha256,
              suiteStrata: approvedSuite.manifest.cases.find((entry) => entry.caseId === caseId)?.strata,
            } : {}),
          },
          independentJudge,
          scoreProvenance,
          preferred,
          comparisonReason,
          v3: { answer: v3.answer, answerSha256: answerSha256(v3.answer), outcome: v3.outcome, needsRoute: v3.needsRoute, routeReason: v3.routeReason || null, routeKeys: v3RouteKeys, latencyMs: v3.latencyMs, selectedPolicyIds: v3Selected, score: v3Score, source: v3.source, provider: v3.provider || null, model: v3.model || null, knowledgeVersion: v3.knowledgeVersion || null, errorClass: v3.errorClass || null, providerAttempts: providerAttemptsFromMetadata(v3.runtimeMetadata), runtimeMetadata: v3.runtimeMetadata },
          v4: {
            answer: v4.answer,
            answerSha256: answerSha256(v4.answer),
            lane: v4.lane,
            needsRoute: v4.needsRoute,
            routeReason: v4.routeReason,
            routeChannels: v4.routeChannels,
            routeKeys: v4RouteKeys,
            latencyMs: v4.latencyMs,
            selectedPolicyIds: v4Selected,
            removedSentences: v4.runtimeMetadata.validation.removedSentences,
            score: v4Score,
            provider: v4.provider,
            model: v4.model,
            turn: {
              kind: v4.runtimeMetadata.turn.kind,
              standaloneQuestion: v4.runtimeMetadata.turn.standaloneQuestion,
              productScope: v4.runtimeMetadata.turn.productScope,
              excludedScopes: v4.runtimeMetadata.turn.excludedScopes,
              usedImmediateContext: v4.runtimeMetadata.turn.usedImmediateContext,
              explicitCorrection: v4.runtimeMetadata.turn.explicitCorrection,
              explicitScopeSwitch: v4.runtimeMetadata.turn.explicitScopeSwitch,
              intentResolutionMode: v4.runtimeMetadata.turn.intentResolutionMode || null,
              intentResolutionReason: v4.runtimeMetadata.turn.intentResolutionReason || null,
            },
            retrieval: v4.runtimeMetadata.retrieval,
            plan: v4.runtimeMetadata.plan,
            executionMode: v4.runtimeMetadata.executionMode,
            validation: v4.runtimeMetadata.validation,
            stageTimings: v4.runtimeMetadata.stageTimings,
            providerAttempts: v4.runtimeMetadata.providerAttempts.map((attempt) => ({
              purpose: attempt.purpose,
              status: attempt.status,
              provider: attempt.provider,
              model: attempt.model,
              latencyMs: attempt.latencyMs,
              ...(attempt.error ? { error: attempt.error } : {}),
              ...(attempt.promptChars === undefined ? {} : { promptChars: attempt.promptChars }),
              ...(attempt.completionTokens === undefined ? {} : { completionTokens: attempt.completionTokens }),
              ...(attempt.totalTokens === undefined ? {} : { totalTokens: attempt.totalTokens }),
              ...(attempt.reasoningMode === undefined ? {} : { reasoningMode: attempt.reasoningMode }),
              ...(attempt.temperature === undefined ? {} : { temperature: attempt.temperature }),
            })),
            planningReason: v4.runtimeMetadata.plan.reasoning_summary,
            validationReason: v4.runtimeMetadata.validation.reason,
          },
        };
        item = applyHumanScore(item, humanScoreById.get(itemId), humanScores, humanScoreBundleSha256);
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
  const completedIdMismatch = exactSetMismatch(allExpectedItemIds, items.map((item) => item.id));
  if (completedIdMismatch.missing.length || completedIdMismatch.extra.length || completedIdMismatch.duplicateCount) {
    throw new Error("Completed benchmark does not contain the exact expected item IDs for every repeated run.");
  }
  if (!humanScores) (resumePath ? sourceRuntime : runtime).completedAt = new Date().toISOString();
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
