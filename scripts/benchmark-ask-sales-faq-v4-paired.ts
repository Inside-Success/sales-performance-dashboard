import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AskSalesFaqChatMessage } from "../src/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "../src/lib/ask-sales-faq/v3/runtime";
import { parseV3Json } from "../src/lib/ask-sales-faq/v3/provider";
import { getMaterializedV3Registry } from "../src/lib/ask-sales-faq/v3/admin-approved-releases";
import {
  evaluateV4PromotionGate,
  parseV4SystemJudgeScore,
  summarizeV4PairedEvaluation,
  type V4PairedEvaluationItem,
  type V4SystemJudgeScore,
} from "../src/lib/ask-sales-faq/v4/evaluation";
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
};
type Conversation = { id: string; title: string; prompts: Prompt[] };
type Dataset = { name: string; conversations: Conversation[] };

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
    sameKnowledgeSnapshot: boolean;
  };
  independentJudge: boolean;
  v3: V4PairedEvaluationItem["v3"] & { answer: string; outcome: string; needsRoute: boolean; selectedPolicyIds: string[]; source: "stored_production" | "fresh_runtime"; provider: string | null; model: string | null; knowledgeVersion: string | null };
  v4: V4PairedEvaluationItem["v4"] & { answer: string; needsRoute: boolean; selectedPolicyIds: string[]; removedSentences: string[]; provider: string | null; model: string | null; executionMode: Record<string, string>; planningReason: string; validationReason: string };
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

function parsedPrompt(value: unknown, label: string): Prompt {
  const raw = typeof value === "string" ? { question: value } : value;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new Error(`${label} must be a question string or object.`);
  const entry = raw as Record<string, unknown>;
  const question = typeof entry.question === "string" ? entry.question.trim() : "";
  if (!question) throw new Error(`${label}.question must be a non-empty string.`);
  const context = messageList(entry.context ?? entry.messages, `${label}.context`);
  const gold = entry.gold && typeof entry.gold === "object" && !Array.isArray(entry.gold) ? entry.gold as Record<string, unknown> : {};
  const blocked = entry.blocked && typeof entry.blocked === "object" && !Array.isArray(entry.blocked) ? entry.blocked as Record<string, unknown> : {};
  return {
    question,
    production: storedProduction(entry),
    independent: exactBoolean(entry.independent, `${label}.independent`, false),
    context,
    v3Context: messageList(entry.v3Context ?? entry.v3_context, `${label}.v3Context`),
    v4Context: messageList(entry.v4Context ?? entry.v4_context, `${label}.v4Context`),
    goldPolicyIds: stringList(entry.goldPolicyIds ?? entry.gold_policy_ids ?? gold.policyIds ?? gold.policy_ids, `${label}.goldPolicyIds`),
    blockedTopicIds: stringList(entry.blockedTopicIds ?? entry.blocked_topic_ids ?? blocked.topicIds ?? blocked.topic_ids, `${label}.blockedTopicIds`),
    goldContext: stringList(entry.goldContext ?? entry.gold_context ?? gold.context, `${label}.goldContext`, 20),
    blockedContext: stringList(entry.blockedContext ?? entry.blocked_context ?? blocked.context, `${label}.blockedContext`, 20),
    goldAdjudicated: exactBoolean(entry.goldAdjudicated ?? entry.gold_adjudicated ?? gold.adjudicated, `${label}.goldAdjudicated`, false),
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
  if (Array.isArray(raw.conversations)) {
    const dataset = {
      name: String(raw.name || path.basename(filePath)),
      conversations: raw.conversations.map((value, index) => {
        if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`conversations[${index}] must be an object.`);
        const conversation = value as Record<string, unknown>;
        if (!Array.isArray(conversation.prompts) || !conversation.prompts.length) throw new Error(`conversations[${index}].prompts must be a non-empty array.`);
        return {
          id: String(conversation.id || `conversation-${index + 1}`),
          title: String(conversation.title || `Conversation ${index + 1}`),
          prompts: conversation.prompts.map((prompt, promptIndex) => parsedPrompt(prompt, `conversations[${index}].prompts[${promptIndex}]`)),
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
      current.prompts.push(parsedPrompt(item, `items[${itemIndex}]`));
      groups.set(key, current);
    }
    const dataset = { name: String(raw.name || path.basename(filePath)), conversations: [...groups.values()].filter((conversation) => conversation.prompts.some((prompt) => Boolean(prompt.question))) };
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
  candidateEvidence: Array<{ id: string; title: string; decision: string; scopes: string[]; answerability: string }>;
  goldEvidence: Array<{ id: string; title: string; decision: string; scopes: string[]; answerability: string }>;
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
      candidateEvidenceSelectedOrRetrievedBySystems: input.candidateEvidence,
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

function storedCandidatePolicyIds(metadata: Record<string, unknown> | null) {
  return nestedArray(metadata, ["v3", "retrieval", "candidates"]).flatMap((candidate) =>
    candidate && typeof candidate === "object" && (candidate as Record<string, unknown>).id
      ? [String((candidate as Record<string, unknown>).id)]
      : [],
  );
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
      : `Both systems ran against the current materialized snapshot; architecture comparison is still gated on adjudicated gold and an independent judge.`,
    ...(report.promotionGate.failures.length ? [``, `Promotion gate findings:`, ...report.promotionGate.failures.map((failure) => `- ${failure}`)] : []),
    ``,
  ].join("\n");
}

async function main() {
  const datasetPath = path.resolve(argument("dataset") || "tests/ask-sales-faq/v3-regression-78.json");
  const dataset = await loadDataset(datasetPath);
  const limit = boundedInteger(argument("limit"), Number.MAX_SAFE_INTEGER, 1, 1000);
  const runs = boundedInteger(argument("runs"), 1, 1, 3);
  const judge = truthy(argument("judge"), true);
  const enforceGate = truthy(argument("enforce-gate"), judge);
  const forceFreshV3 = argument("v3-source") === "fresh";
  const comparisonMode = forceFreshV3 ? "same_current_snapshot_fresh_v3_vs_v4" : "historical_user_experience_replay";
  const outputDir = path.resolve(argument("output-dir") || "artifacts/ask-sales-faq-v4");
  const runId = `paired-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outputPath = path.join(outputDir, `${runId}.json`);
  const markdownPath = path.join(outputDir, `${runId}.md`);
  const items: PairedItem[] = [];
  let attempted = 0;
  await mkdir(outputDir, { recursive: true });

  for (let run = 1; run <= runs; run += 1) {
    for (const conversation of dataset.conversations) {
      const v3Messages: AskSalesFaqChatMessage[] = [];
      const v4Messages: AskSalesFaqChatMessage[] = [];
      for (let promptIndex = 0; promptIndex < conversation.prompts.length; promptIndex += 1) {
        if (attempted >= limit) break;
        const promptEntry = conversation.prompts[promptIndex];
        const question = promptEntry.question;
        const v3InputMessages = contextForPrompt(promptEntry, "v3", v3Messages);
        const v4InputMessages = contextForPrompt(promptEntry, "v4", v4Messages);
        attempted += 1;
        process.stdout.write(`[${attempted}/${Math.min(limit, dataset.conversations.reduce((total, item) => total + item.prompts.length, 0) * runs)}] run ${run} ${conversation.id} Q${promptIndex + 1} ... `);
        const [v3, v4] = await Promise.all([
          !forceFreshV3 && promptEntry.production
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
            : runAskSalesFaqV3(question, v3InputMessages).then((result) => ({ ...result, knowledgeVersion: result.runtimeMetadata.knowledgeVersion, source: "fresh_runtime" as const })),
          runAskSalesFaqV4(question, v4InputMessages),
        ]);
        const v3Selected = v3.source === "stored_production"
          ? storedSelectedPolicyIds(v3.runtimeMetadata)
          : v3.runtimeMetadata.v3?.selection.selectedPolicyIds || [];
        const v3Candidates = v3.source === "stored_production"
          ? storedCandidatePolicyIds(v3.runtimeMetadata).slice(0, 12)
          : v3.runtimeMetadata.v3?.retrieval.candidates.map((candidate) => candidate.id).slice(0, 12) || [];
        const v4Selected = v4.selectedPolicyIds;
        const v4Candidates = v4.runtimeMetadata.retrieval.candidates.map((candidate) => candidate.id).slice(0, 12);
        let v3Score: V4SystemJudgeScore | null = null;
        let v4Score: V4SystemJudgeScore | null = null;
        let preferred: PairedItem["preferred"] = "not_judged";
        let comparisonReason: string | null = null;
        let independentJudge = false;
        if (judge) {
          const v4IsA = Number.parseInt(createHash("sha256").update(`${run}:${conversation.id}:${promptIndex}:${question}`).digest("hex").slice(0, 2), 16) % 2 === 0;
          const prompt = judgePrompt({
            question,
            answerA: v4IsA ? v4.answer : v3.answer,
            answerB: v4IsA ? v3.answer : v4.answer,
            candidateEvidence: evidenceCards([...v3Selected, ...v4Selected, ...v3Candidates, ...v4Candidates]),
            goldEvidence: evidenceCards(promptEntry.goldPolicyIds),
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
            preferred = judged.output.preferred === "tie" ? "tie" : (judged.output.preferred === "A") === v4IsA ? "v4" : "v3";
            comparisonReason = judged.output.comparisonReason;
            const generationModels = [v3.model, v4.model].filter((value): value is string => Boolean(value));
            independentJudge = generationModels.length > 0 && generationModels.every((generationModel) => generationModel !== judged.model);
          } catch (error) {
            comparisonReason = `Judge failed: ${error instanceof Error ? error.message : String(error)}`;
          }
        }
        items.push({
          id: `${conversation.id}-${promptIndex + 1}-run-${run}`,
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
            sameKnowledgeSnapshot: v3.knowledgeVersion === v4.runtimeMetadata.knowledgeVersion,
          },
          independentJudge,
          preferred,
          comparisonReason,
          v3: { answer: v3.answer, outcome: v3.outcome, needsRoute: v3.needsRoute, latencyMs: v3.latencyMs, selectedPolicyIds: v3Selected, score: v3Score, source: v3.source, provider: v3.provider || null, model: v3.model || null, knowledgeVersion: v3.knowledgeVersion || null },
          v4: { answer: v4.answer, lane: v4.lane, needsRoute: v4.needsRoute, latencyMs: v4.latencyMs, selectedPolicyIds: v4Selected, removedSentences: v4.runtimeMetadata.validation.removedSentences, score: v4Score, provider: v4.provider, model: v4.model, executionMode: v4.runtimeMetadata.executionMode, planningReason: v4.runtimeMetadata.plan.reasoning_summary, validationReason: v4.runtimeMetadata.validation.reason },
        });
        if (!promptEntry.independent) {
          v3Messages.splice(0, v3Messages.length, ...nextHistory(v3InputMessages, question, v3.answer));
          v4Messages.splice(0, v4Messages.length, ...nextHistory(v4InputMessages, question, v4.answer));
        }
        const partialReport = {
          schemaVersion: 2,
          runId,
          dataset: dataset.name,
          datasetPath,
          knowledgeVersion: v4.runtimeMetadata.knowledgeVersion,
          status: "running",
          judgeEnabled: judge,
          promotionGateEnforced: enforceGate,
          comparisonMode,
          strata: replayStrata(items),
          summary: summarizeV4PairedEvaluation(items),
          promotionGate: evaluateV4PromotionGate(items),
          items,
        };
        await writeFile(outputPath, `${JSON.stringify(partialReport, null, 2)}\n`, "utf8");
        process.stdout.write(`V3:${v3.outcome} V4:${v4.lane}${preferred === "not_judged" ? "" : ` preferred:${preferred}`}\n`);
      }
      if (attempted >= limit) break;
    }
    if (attempted >= limit) break;
  }

  const report = {
    schemaVersion: 2,
    runId,
    dataset: dataset.name,
    datasetPath,
    status: "complete",
    judgeEnabled: judge,
    promotionGateEnforced: enforceGate,
    comparisonMode,
    strata: replayStrata(items),
    summary: summarizeV4PairedEvaluation(items),
    promotionGate: evaluateV4PromotionGate(items),
    items,
  };
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
