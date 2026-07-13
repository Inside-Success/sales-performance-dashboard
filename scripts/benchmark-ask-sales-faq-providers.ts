import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "../src/lib/ask-sales-faq/types";
import { getV3Registry } from "../src/lib/ask-sales-faq/v3/retrieval";
import { runAskSalesFaqV3 } from "../src/lib/ask-sales-faq/v3/runtime";
import type {
  V3Provider,
  V3ProviderAttempt,
  V3ProviderInput,
  V3ProviderResult,
} from "../src/lib/ask-sales-faq/v3/types";

type CandidateId = "deepseek" | "grok" | "sonnet46" | "sonnet5";

type DatasetConversation = {
  id: string;
  title: string;
  prompts: string[];
};

type Dataset = {
  name: string;
  promptCount: number;
  conversations: DatasetConversation[];
};

type DetailedUsage = {
  inputTokens: number;
  cachedInputTokens: number;
  cacheCreationInputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  totalTokens: number;
};

type ProviderCallRecord = {
  exchangeId: string;
  candidate: CandidateId;
  model: string;
  purpose: string;
  attempt: number;
  status: "success" | "failed";
  latencyMs: number;
  httpStatus: number | null;
  usage: DetailedUsage;
  estimatedCostUsd: number;
  error: string | null;
  zeroDataRetention: boolean | null;
  rateLimitRemaining: string | null;
};

type BenchmarkItem = {
  exchangeId: string;
  candidate: CandidateId;
  model: string;
  conversationId: string;
  conversationTitle: string;
  promptIndex: number;
  question: string;
  answer: string;
  outcome: string;
  needsRoute: boolean;
  routeReason: string | null;
  latencyMs: number;
  stageTimings: Record<string, number>;
  turn: Record<string, unknown> | null;
  selectedPolicyIds: string[];
  rejectedPolicyIds: string[];
  candidatePolicyIds: string[];
  validationVerdict: string | null;
  validationReason: string | null;
  errorClass: string | null;
  internalLeakage: boolean;
};

type CandidateDefinition = {
  id: CandidateId;
  model: string;
  api: "deepseek" | "xai" | "anthropic";
  keyEnv: "DEEPSEEK_API_KEY" | "XAI_API_KEY" | "ANTHROPIC_API_KEY";
  reasoningMode: string;
  pricing: {
    inputPerMillion: number;
    cachedInputPerMillion: number;
    cacheCreationInputPerMillion: number;
    outputPerMillion: number;
  };
};

const CANDIDATES: Record<CandidateId, CandidateDefinition> = {
  deepseek: {
    id: "deepseek",
    model: "deepseek-v4-pro",
    api: "deepseek",
    keyEnv: "DEEPSEEK_API_KEY",
    reasoningMode: "disabled (production V3 configuration)",
    pricing: {
      inputPerMillion: 0.435,
      cachedInputPerMillion: 0.003625,
      cacheCreationInputPerMillion: 0.435,
      outputPerMillion: 0.87,
    },
  },
  grok: {
    id: "grok",
    model: "grok-4.5",
    api: "xai",
    keyEnv: "XAI_API_KEY",
    reasoningMode: "low (reasoning cannot be disabled)",
    pricing: {
      inputPerMillion: 2,
      cachedInputPerMillion: 0.5,
      cacheCreationInputPerMillion: 2,
      outputPerMillion: 6,
    },
  },
  sonnet46: {
    id: "sonnet46",
    model: "claude-sonnet-4-6",
    api: "anthropic",
    keyEnv: "ANTHROPIC_API_KEY",
    reasoningMode: "disabled (no thinking field)",
    pricing: {
      inputPerMillion: 3,
      cachedInputPerMillion: 0.3,
      cacheCreationInputPerMillion: 3.75,
      outputPerMillion: 15,
    },
  },
  sonnet5: {
    id: "sonnet5",
    model: "claude-sonnet-5",
    api: "anthropic",
    keyEnv: "ANTHROPIC_API_KEY",
    reasoningMode: "disabled explicitly for parity",
    pricing: {
      inputPerMillion: 2,
      cachedInputPerMillion: 0.2,
      cacheCreationInputPerMillion: 2.5,
      outputPerMillion: 10,
    },
  },
};

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function parseCandidateIds(): CandidateId[] {
  const value = argument("candidates") || "deepseek,grok,sonnet46,sonnet5";
  const ids = value.split(",").map((item) => item.trim()).filter(Boolean) as CandidateId[];
  for (const id of ids) {
    if (!CANDIDATES[id]) throw new Error(`Unknown candidate: ${id}`);
  }
  return Array.from(new Set(ids));
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|x-api-key)["'\s:=]+[^\s"']+/gi, "api-key=[redacted]")
    .slice(0, 600);
}

function extractJsonObject(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const text = (fenced || value).trim();
  const start = text.indexOf("{");
  if (start < 0) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return text;
}

function zeroUsage(): DetailedUsage {
  return {
    inputTokens: 0,
    cachedInputTokens: 0,
    cacheCreationInputTokens: 0,
    outputTokens: 0,
    reasoningTokens: 0,
    totalTokens: 0,
  };
}

function number(value: unknown) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function estimateCost(candidate: CandidateDefinition, usage: DetailedUsage) {
  const uncachedInput = Math.max(0, usage.inputTokens - usage.cachedInputTokens - usage.cacheCreationInputTokens);
  const billedOutput = usage.outputTokens + (candidate.api === "xai" ? usage.reasoningTokens : 0);
  return (
    uncachedInput * candidate.pricing.inputPerMillion +
    usage.cachedInputTokens * candidate.pricing.cachedInputPerMillion +
    usage.cacheCreationInputTokens * candidate.pricing.cacheCreationInputPerMillion +
    billedOutput * candidate.pricing.outputPerMillion
  ) / 1_000_000;
}

function parseUsage(candidate: CandidateDefinition, data: Record<string, unknown> | null): DetailedUsage {
  const raw = (data?.usage || {}) as Record<string, unknown>;
  if (candidate.api === "anthropic") {
    const input = number(raw.input_tokens);
    const cached = number(raw.cache_read_input_tokens);
    const created = number(raw.cache_creation_input_tokens);
    const output = number(raw.output_tokens);
    const outputDetails = (raw.output_tokens_details || {}) as Record<string, unknown>;
    return {
      inputTokens: input + cached + created,
      cachedInputTokens: cached,
      cacheCreationInputTokens: created,
      outputTokens: output,
      reasoningTokens: number(outputDetails.thinking_tokens),
      totalTokens: input + cached + created + output,
    };
  }
  const prompt = number(raw.prompt_tokens);
  const completion = number(raw.completion_tokens);
  const promptDetails = (raw.prompt_tokens_details || {}) as Record<string, unknown>;
  const completionDetails = (raw.completion_tokens_details || {}) as Record<string, unknown>;
  const providerCached = number(raw.prompt_cache_hit_tokens);
  const cached = Math.max(providerCached, number(promptDetails.cached_tokens));
  return {
    inputTokens: prompt,
    cachedInputTokens: cached,
    cacheCreationInputTokens: 0,
    outputTokens: completion,
    reasoningTokens: number(completionDetails.reasoning_tokens),
    totalTokens: number(raw.total_tokens) || prompt + completion,
  };
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 110_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function responseJson(response: Response) {
  try {
    return (await response.json()) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function providerName(candidate: CandidateDefinition): "deepseek" | "anthropic" {
  return candidate.api === "anthropic" ? "anthropic" : "deepseek";
}

function temperatureForPurpose(purpose: string) {
  return /(?:turn_intent|semantic_recall|evidence_selection|grounding_validation)/.test(purpose) ? 0 : 0.2;
}

function createProvider(candidate: CandidateDefinition, records: ProviderCallRecord[]) {
  const key = process.env[candidate.keyEnv];
  if (!key) throw new Error(`${candidate.keyEnv} is not configured.`);
  let exchangeId = "unassigned";

  const provider: V3Provider = async <T>(input: V3ProviderInput<T>): Promise<V3ProviderResult<T>> => {
    const attempts: V3ProviderAttempt[] = [];
    let lastError: unknown = null;
    for (let attemptNumber = 1; attemptNumber <= 2; attemptNumber += 1) {
      const startedAt = Date.now();
      let httpStatus: number | null = null;
      try {
        let response: Response;
        if (candidate.api === "anthropic") {
          response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "x-api-key": key,
              "anthropic-version": "2023-06-01",
              "content-type": "application/json",
            },
            body: JSON.stringify({
              model: candidate.model,
              max_tokens: input.maxTokens,
              ...(candidate.id === "sonnet46" ? { temperature: 0.1 } : {}),
              ...(candidate.id === "sonnet5" ? { thinking: { type: "disabled" } } : {}),
              system: input.system,
              messages: [{ role: "user", content: input.user }],
            }),
          });
        } else {
          const endpoint = candidate.api === "xai"
            ? "https://api.x.ai/v1/chat/completions"
            : "https://api.deepseek.com/chat/completions";
          response = await fetchWithTimeout(endpoint, {
            method: "POST",
            headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
            body: JSON.stringify({
              model: candidate.model,
              max_tokens: input.maxTokens,
              ...(candidate.api === "deepseek" ? {
                temperature: temperatureForPurpose(input.purpose),
                thinking: { type: "disabled" },
              } : {
                reasoning_effort: "low",
              }),
              response_format: { type: "json_object" },
              messages: [
                { role: "system", content: input.system },
                { role: "user", content: input.user },
              ],
            }),
          });
        }
        httpStatus = response.status;
        const data = await responseJson(response);
        const usage = parseUsage(candidate, data);
        const latencyMs = Date.now() - startedAt;
        if (!response.ok) {
          const rawError = (data?.error || {}) as Record<string, unknown>;
          throw new Error(String(rawError.message || `${candidate.model} request failed with HTTP ${response.status}`));
        }
        let content = "";
        if (candidate.api === "anthropic") {
          const parts = Array.isArray(data?.content) ? data?.content as Array<Record<string, unknown>> : [];
          content = String(parts.find((part) => part.type === "text")?.text || "");
        } else {
          const choices = Array.isArray(data?.choices) ? data?.choices as Array<Record<string, unknown>> : [];
          const message = (choices[0]?.message || {}) as Record<string, unknown>;
          content = String(message.content || "");
        }
        const output = input.parse(extractJsonObject(content));
        const cost = estimateCost(candidate, usage);
        records.push({
          exchangeId,
          candidate: candidate.id,
          model: candidate.model,
          purpose: input.purpose,
          attempt: attemptNumber,
          status: "success",
          latencyMs,
          httpStatus,
          usage,
          estimatedCostUsd: cost,
          error: null,
          zeroDataRetention: candidate.api === "xai" ? response.headers.get("x-zero-data-retention") === "true" : null,
          rateLimitRemaining: response.headers.get("x-ratelimit-remaining-requests") || response.headers.get("anthropic-ratelimit-requests-remaining"),
        });
        attempts.push({
          provider: providerName(candidate),
          model: candidate.model,
          purpose: input.purpose,
          status: "success",
          latencyMs,
          promptChars: input.system.length + input.user.length,
          completionTokens: usage.outputTokens,
          totalTokens: usage.totalTokens,
          reasoningMode: candidate.api === "anthropic" ? undefined : candidate.api === "deepseek" ? "disabled" : "enabled",
          temperature: candidate.api === "deepseek" ? temperatureForPurpose(input.purpose) : candidate.id === "sonnet46" ? 0.1 : undefined,
        });
        return { output, provider: providerName(candidate), model: candidate.model, attempts };
      } catch (error) {
        lastError = error;
        const latencyMs = Date.now() - startedAt;
        const message = sanitizeError(error);
        records.push({
          exchangeId,
          candidate: candidate.id,
          model: candidate.model,
          purpose: input.purpose,
          attempt: attemptNumber,
          status: "failed",
          latencyMs,
          httpStatus,
          usage: zeroUsage(),
          estimatedCostUsd: 0,
          error: message,
          zeroDataRetention: null,
          rateLimitRemaining: null,
        });
        attempts.push({
          provider: providerName(candidate),
          model: candidate.model,
          purpose: input.purpose,
          status: "failed",
          latencyMs,
          error: message,
        });
        if (httpStatus && [400, 401, 403, 404].includes(httpStatus)) break;
      }
    }
    throw lastError instanceof Error ? lastError : new Error(`${candidate.model} failed.`);
  };

  return {
    provider,
    setExchangeId(value: string) {
      exchangeId = value;
    },
  };
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function round(value: number, digits = 4) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function internalLeakage(answer: string) {
  return /\b(?:knowledge[_ ]version|policy[_ ]id|selected[_ ]policy|evidence[_ ]contract|runtimeMetadata|decision[_ ]key|claim_[a-f0-9]+|canonical_[a-f0-9]+|supporting_[a-f0-9]+|\bE\d+\b|\bV\d+\b)\b/i.test(answer);
}

function summarizeCandidate(candidate: CandidateDefinition, items: BenchmarkItem[], calls: ProviderCallRecord[]) {
  const latency = items.map((item) => item.latencyMs);
  const costs = calls.reduce((total, call) => total + call.estimatedCostUsd, 0);
  const successfulCalls = calls.filter((call) => call.status === "success");
  const failedCalls = calls.filter((call) => call.status === "failed");
  const usage = successfulCalls.reduce((acc, call) => ({
    inputTokens: acc.inputTokens + call.usage.inputTokens,
    cachedInputTokens: acc.cachedInputTokens + call.usage.cachedInputTokens,
    cacheCreationInputTokens: acc.cacheCreationInputTokens + call.usage.cacheCreationInputTokens,
    outputTokens: acc.outputTokens + call.usage.outputTokens,
    reasoningTokens: acc.reasoningTokens + call.usage.reasoningTokens,
    totalTokens: acc.totalTokens + call.usage.totalTokens,
  }), zeroUsage());
  const stages = Array.from(new Set(items.flatMap((item) => Object.keys(item.stageTimings)))).sort();
  const stageLatencyMs = Object.fromEntries(stages.map((stage) => {
    const values = items.map((item) => number(item.stageTimings[stage])).filter((value) => value > 0);
    return [stage, { p50: percentile(values, 0.5), p95: percentile(values, 0.95), average: values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : 0 }];
  }));
  const useful = items.filter((item) => item.outcome === "answer_from_evidence" || item.outcome === "conversation_reply").length;
  return {
    candidate: candidate.id,
    model: candidate.model,
    reasoningMode: candidate.reasoningMode,
    turns: items.length,
    outcomes: Object.fromEntries(Array.from(new Set(items.map((item) => item.outcome))).sort().map((outcome) => [outcome, items.filter((item) => item.outcome === outcome).length])),
    validations: Object.fromEntries(Array.from(new Set(items.map((item) => item.validationVerdict || "none"))).sort().map((verdict) => [verdict, items.filter((item) => (item.validationVerdict || "none") === verdict).length])),
    usefulOrConversationRate: round(useful / Math.max(1, items.length), 3),
    runtimeErrorCount: items.filter((item) => Boolean(item.errorClass)).length,
    providerCallCount: calls.length,
    providerCallFailureCount: failedCalls.length,
    retryCount: calls.filter((call) => call.attempt > 1).length,
    latencyMs: {
      average: latency.length ? Math.round(latency.reduce((a, b) => a + b, 0) / latency.length) : 0,
      p50: percentile(latency, 0.5),
      p90: percentile(latency, 0.9),
      p95: percentile(latency, 0.95),
      max: latency.length ? Math.max(...latency) : 0,
    },
    stageLatencyMs,
    usage,
    estimatedCostUsd: round(costs, 6),
    estimatedCostPerTurnUsd: round(costs / Math.max(1, items.length), 6),
    estimatedCostPer1000TurnsUsd: round((costs / Math.max(1, items.length)) * 1000, 2),
    internalLeakageCount: items.filter((item) => item.internalLeakage).length,
    zeroDataRetentionObserved: candidate.api === "xai"
      ? calls.some((call) => call.zeroDataRetention === true)
      : null,
  };
}

async function readDataset(file: string): Promise<Dataset> {
  return JSON.parse(await readFile(file, "utf8")) as Dataset;
}

async function loadDataset(mode: string) {
  const frozen = await readDataset(path.resolve("tests/ask-sales-faq/v3-frozen-unseen-40.json"));
  const fresh = await readDataset(path.resolve("tests/ask-sales-faq/v3-fresh-slack-spot-check-2026-07-12.json"));
  const full: Dataset = {
    name: "Ask Sales V3 provider comparison - frozen 40 plus fresh 12",
    promptCount: frozen.promptCount + fresh.promptCount,
    conversations: [...frozen.conversations, ...fresh.conversations],
  };
  if (mode === "calibration") {
    return {
      name: `${full.name} - calibration`,
      promptCount: 3,
      conversations: [
        { ...frozen.conversations[0], prompts: frozen.conversations[0].prompts.slice(0, 2) },
        { ...fresh.conversations[0], id: `${fresh.conversations[0].id}-calibration`, prompts: fresh.conversations[0].prompts.slice(0, 1) },
      ],
    } satisfies Dataset;
  }
  if (mode === "repeat") {
    return {
      name: `${full.name} - focused repeatability subset`,
      promptCount: 12,
      conversations: [
        frozen.conversations[1],
        frozen.conversations[7],
        { ...fresh.conversations[0], id: `${fresh.conversations[0].id}-repeat`, prompts: fresh.conversations[0].prompts.slice(0, 2) },
      ],
    } satisfies Dataset;
  }
  if (mode === "burst10" || mode === "burst20") {
    const selected = [
      ...frozen.conversations[0].prompts.slice(1, 5),
      ...frozen.conversations[2].prompts.slice(0, 4),
      ...frozen.conversations[4].prompts.slice(1, 5),
      ...fresh.conversations[0].prompts,
      ...fresh.conversations[1].prompts.slice(0, 3),
      frozen.conversations[6].prompts[0],
    ];
    const count = mode === "burst10" ? 10 : 20;
    return {
      name: `${full.name} - ${count}-request independent burst`,
      promptCount: count,
      conversations: selected.slice(0, count).map((question, index) => ({
        id: `${mode}-${index + 1}`,
        title: `${mode} independent request ${index + 1}`,
        prompts: [question],
      })),
    } satisfies Dataset;
  }
  return full;
}

function benchmarkItem(candidate: CandidateDefinition, conversation: DatasetConversation, promptIndex: number, question: string, result: Awaited<ReturnType<typeof runAskSalesFaqV3>>) {
  const v3 = result.runtimeMetadata.v3;
  return {
    exchangeId: `${conversation.id}:${promptIndex + 1}`,
    candidate: candidate.id,
    model: candidate.model,
    conversationId: conversation.id,
    conversationTitle: conversation.title,
    promptIndex: promptIndex + 1,
    question,
    answer: result.answer,
    outcome: result.outcome,
    needsRoute: result.needsRoute,
    routeReason: result.routeReason,
    latencyMs: result.latencyMs,
    stageTimings: v3?.stageTimings || {},
    turn: v3?.turn ? { ...v3.turn } : null,
    selectedPolicyIds: v3?.selection.selectedPolicyIds || [],
    rejectedPolicyIds: v3?.selection.rejectedPolicyIds || [],
    candidatePolicyIds: v3?.retrieval.candidates.map((entry) => entry.id) || [],
    validationVerdict: v3?.validation.verdict || null,
    validationReason: v3?.validation.reason || null,
    errorClass: result.errorClass,
    internalLeakage: internalLeakage(result.answer),
  } satisfies BenchmarkItem;
}

async function runCandidate(candidate: CandidateDefinition, dataset: Dataset, outputPath: string) {
  const calls: ProviderCallRecord[] = [];
  const items: BenchmarkItem[] = [];
  const adapter = createProvider(candidate, calls);
  let completed = 0;
  for (const conversation of dataset.conversations) {
    const messages: AskSalesFaqChatMessage[] = [];
    for (let promptIndex = 0; promptIndex < conversation.prompts.length; promptIndex += 1) {
      const question = conversation.prompts[promptIndex];
      const exchangeId = `${conversation.id}:${promptIndex + 1}`;
      adapter.setExchangeId(exchangeId);
      const result = await runAskSalesFaqV3(question, [...messages, { role: "user", content: question }], {
        provider: adapter.provider,
        validatorProvider: adapter.provider,
      });
      items.push(benchmarkItem(candidate, conversation, promptIndex, question, result));
      messages.push({ role: "user", content: question }, { role: "assistant", content: result.answer });
      if (messages.length > 10) messages.splice(0, messages.length - 10);
      completed += 1;
      process.stdout.write(`[${candidate.id}] ${completed}/${dataset.promptCount} ${exchangeId} ${result.outcome} ${result.latencyMs}ms\n`);
      await writeFile(outputPath, JSON.stringify({ status: "running", candidate: candidate.id, items, calls }, null, 2) + "\n", "utf8");
    }
  }
  return { candidate, items, calls, summary: summarizeCandidate(candidate, items, calls) };
}

async function runCandidateConcurrent(candidate: CandidateDefinition, dataset: Dataset, concurrency: number) {
  const calls: ProviderCallRecord[] = [];
  const items: BenchmarkItem[] = [];
  const requests = dataset.conversations.flatMap((conversation) => conversation.prompts.map((question, promptIndex) => ({ conversation, question, promptIndex })));
  let next = 0;
  let completed = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= requests.length) return;
      const { conversation, question, promptIndex } = requests[index];
      const exchangeId = `${conversation.id}:${promptIndex + 1}`;
      const adapter = createProvider(candidate, calls);
      adapter.setExchangeId(exchangeId);
      const result = await runAskSalesFaqV3(question, [{ role: "user", content: question }], {
        provider: adapter.provider,
        validatorProvider: adapter.provider,
      });
      items.push(benchmarkItem(candidate, conversation, promptIndex, question, result));
      completed += 1;
      process.stdout.write(`[${candidate.id}] burst ${completed}/${dataset.promptCount} ${exchangeId} ${result.outcome} ${result.latencyMs}ms\n`);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, requests.length) }, () => worker()));
  items.sort((a, b) => a.exchangeId.localeCompare(b.exchangeId));
  return { candidate, items, calls, summary: summarizeCandidate(candidate, items, calls) };
}

async function main() {
  const mode = argument("mode") || "calibration";
  if (!new Set(["calibration", "full", "repeat", "burst10", "burst20"]).has(mode)) throw new Error(`Unsupported mode: ${mode}`);
  const candidateIds = parseCandidateIds();
  for (const id of candidateIds) {
    if (!process.env[CANDIDATES[id].keyEnv]) throw new Error(`${CANDIDATES[id].keyEnv} is required.`);
  }
  const dataset = await loadDataset(mode);
  const outputDir = path.resolve(argument("output-dir") || "/private/tmp/ask-sales-provider-benchmark-results-2026-07-13");
  await mkdir(outputDir, { recursive: true, mode: 0o700 });
  const runId = `${mode}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const startedAt = new Date().toISOString();
  const concurrency = Math.max(1, Number.parseInt(argument("concurrency") || (mode === "burst20" ? "20" : mode === "burst10" ? "10" : "1"), 10) || 1);
  const runs = await Promise.all(candidateIds.map((id) => concurrency > 1
    ? runCandidateConcurrent(CANDIDATES[id], dataset, concurrency)
    : runCandidate(CANDIDATES[id], dataset, path.join(outputDir, `${runId}-${id}-checkpoint.json`))));
  const registry = getV3Registry();
  const report = {
    schemaVersion: 1,
    runId,
    mode,
    status: "complete",
    startedAt,
    completedAt: new Date().toISOString(),
    isolation: {
      databaseWrites: false,
      productionConfigurationChanges: false,
      productionAliasChanges: false,
      slackWrites: false,
      googleWrites: false,
      n8nWrites: false,
    },
    dataset: { name: dataset.name, promptCount: dataset.promptCount, conversationCount: dataset.conversations.length },
    knowledge: { version: registry.knowledge_version, generatedAt: registry.generated_at, policyCount: registry.policies.length },
    candidates: runs.map((run) => run.summary),
    items: runs.flatMap((run) => run.items),
    providerCalls: runs.flatMap((run) => run.calls),
  };
  const outputPath = path.join(outputDir, `${runId}.json`);
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify({ outputPath, candidates: report.candidates }, null, 2));
}

main().catch((error) => {
  console.error(sanitizeError(error));
  process.exitCode = 1;
});
