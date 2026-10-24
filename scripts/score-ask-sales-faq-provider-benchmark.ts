import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getV3Registry } from "../src/lib/ask-sales-faq/v3/retrieval";

type CandidateId = "deepseek" | "grok" | "sonnet46" | "sonnet5";
type JudgeId = "deepseek-judge" | "sonnet5-judge";

type BenchmarkItem = {
  exchangeId: string;
  candidate: CandidateId;
  conversationId: string;
  promptIndex: number;
  question: string;
  answer: string;
  outcome: string;
  needsRoute: boolean;
  selectedPolicyIds: string[];
  rejectedPolicyIds: string[];
  candidatePolicyIds: string[];
};

type BenchmarkReport = {
  runId: string;
  items: BenchmarkItem[];
};

type Classification =
  | "fully_useful"
  | "useful_partial"
  | "safe_route"
  | "answerable_miss"
  | "wrong_or_unsafe"
  | "conversation_pass"
  | "conversation_fail";

type JudgeEvaluation = {
  answer_id: string;
  classification: Classification;
  grounded: boolean;
  complete: boolean;
  safe: boolean;
  follows_context: boolean;
  route_appropriate: boolean;
  reason: string;
};

type JudgeResult = {
  exchangeId: string;
  judge: JudgeId;
  evaluations: JudgeEvaluation[];
  latencyMs: number;
  inputTokens: number;
  outputTokens: number;
  estimatedCostUsd: number;
};

const CANDIDATE_IDS: CandidateId[] = ["deepseek", "grok", "sonnet46", "sonnet5"];
const CLASSIFICATIONS = new Set<Classification>([
  "fully_useful",
  "useful_partial",
  "safe_route",
  "answerable_miss",
  "wrong_or_unsafe",
  "conversation_pass",
  "conversation_fail",
]);

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function sanitizeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "unknown error"))
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

function blindOrder(exchangeId: string) {
  return [...CANDIDATE_IDS].sort((left, right) => {
    const a = createHash("sha256").update(`${exchangeId}:${left}`).digest("hex");
    const b = createHash("sha256").update(`${exchangeId}:${right}`).digest("hex");
    return a.localeCompare(b);
  });
}

function answerIdMap(exchangeId: string) {
  return new Map(blindOrder(exchangeId).map((candidate, index) => [candidate, `A${index + 1}`]));
}

function scoreFor(classification: Classification) {
  if (classification === "fully_useful" || classification === "conversation_pass") return 4;
  if (classification === "useful_partial") return 3;
  if (classification === "safe_route") return 2;
  if (classification === "answerable_miss" || classification === "conversation_fail") return 1;
  return 0;
}

function buildPrompt(items: BenchmarkItem[], history: BenchmarkItem[], evidence: Array<{ id: string; decision: string; route: string | null }>) {
  const idMap = answerIdMap(items[0].exchangeId);
  const answers = blindOrder(items[0].exchangeId).map((candidate) => {
    const item = items.find((entry) => entry.candidate === candidate);
    if (!item) throw new Error(`Missing ${candidate} for ${items[0].exchangeId}`);
    return {
      answer_id: idMap.get(candidate),
      answer: item.answer,
      displayed_as_route: item.needsRoute,
    };
  });
  return {
    system: [
      "You are a strict independent evaluator for an internal sales-policy FAQ chatbot.",
      "The provider identities are hidden. Never guess or discuss which model wrote an answer.",
      "Use only the CURRENT QUESTION, CHAT CONTEXT, and COMMON GOVERNED EVIDENCE below. External knowledge is not authority.",
      "Evaluate each answer independently. Style alone must not affect the score unless it makes the answer unusable.",
      "A safe route is correct only when the common evidence cannot reliably answer the requested part. Routing despite sufficient evidence is an answerable_miss.",
      "An answer is fully_useful only if every material answerable part is correct, grounded, relevant, and handles unresolved parts safely.",
      "Use useful_partial when supported help is provided but an answerable part is missing, or an unnecessary route is appended.",
      "Use wrong_or_unsafe for contradiction, unsupported certainty, wrong product/topic/route, privacy or admin leakage, or invented policy.",
      "Use conversation_pass/conversation_fail only for greetings, acknowledgments, topic transitions, memory, clarification, and rewrite turns.",
      "Return JSON only with an evaluations array. Include every answer_id exactly once.",
    ].join("\n"),
    user: JSON.stringify({
      current_question: items[0].question,
      prior_chat: history.map((entry) => ({ question: entry.question, answer: entry.answer })),
      common_governed_evidence: evidence,
      answers,
      classifications: Array.from(CLASSIFICATIONS),
      required_shape: {
        evaluations: [{
          answer_id: "A1",
          classification: "fully_useful",
          grounded: true,
          complete: true,
          safe: true,
          follows_context: true,
          route_appropriate: true,
          reason: "one concise evidence-based reason",
        }],
      },
    }),
  };
}

function parseEvaluation(content: string, expectedIds: string[]) {
  const raw = JSON.parse(extractJsonObject(content)) as { evaluations?: Array<Record<string, unknown>> };
  if (!Array.isArray(raw.evaluations)) throw new Error("Judge response omitted evaluations.");
  const evaluations = raw.evaluations.map((entry) => {
    const classification = String(entry.classification) as Classification;
    return {
      answer_id: String(entry.answer_id || ""),
      classification: CLASSIFICATIONS.has(classification) ? classification : "wrong_or_unsafe",
      grounded: Boolean(entry.grounded),
      complete: Boolean(entry.complete),
      safe: Boolean(entry.safe),
      follows_context: Boolean(entry.follows_context),
      route_appropriate: Boolean(entry.route_appropriate),
      reason: String(entry.reason || "").replace(/\s+/g, " ").trim().slice(0, 600),
    } satisfies JudgeEvaluation;
  });
  const seen = new Set(evaluations.map((entry) => entry.answer_id));
  if (expectedIds.some((id) => !seen.has(id)) || evaluations.length !== expectedIds.length) {
    throw new Error("Judge response did not evaluate every blinded answer exactly once.");
  }
  return evaluations;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function callJudge(judge: JudgeId, exchangeId: string, prompt: { system: string; user: string }, expectedIds: string[]): Promise<JudgeResult> {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const startedAt = Date.now();
    try {
      if (judge === "deepseek-judge") {
        if (!process.env.DEEPSEEK_API_KEY) throw new Error("DEEPSEEK_API_KEY is required.");
        const response = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
          method: "POST",
          headers: { authorization: `Bearer ${process.env.DEEPSEEK_API_KEY}`, "content-type": "application/json" },
          body: JSON.stringify({
            model: "deepseek-v4-pro",
            max_tokens: 2200,
            temperature: 0,
            thinking: { type: "disabled" },
            response_format: { type: "json_object" },
            messages: [{ role: "system", content: prompt.system }, { role: "user", content: prompt.user }],
          }),
        });
        const data = await response.json() as Record<string, unknown>;
        if (!response.ok) throw new Error(String((data.error as Record<string, unknown> | undefined)?.message || `HTTP ${response.status}`));
        const choices = data.choices as Array<Record<string, unknown>>;
        const content = String((choices[0].message as Record<string, unknown>).content || "");
        const usage = data.usage as Record<string, unknown>;
        const inputTokens = Number(usage.prompt_tokens || 0);
        const cachedTokens = Number(usage.prompt_cache_hit_tokens || 0);
        const outputTokens = Number(usage.completion_tokens || 0);
        return {
          exchangeId,
          judge,
          evaluations: parseEvaluation(content, expectedIds),
          latencyMs: Date.now() - startedAt,
          inputTokens,
          outputTokens,
          estimatedCostUsd: ((inputTokens - cachedTokens) * 0.435 + cachedTokens * 0.003625 + outputTokens * 0.87) / 1_000_000,
        };
      }
      if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is required.");
      const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01", "content-type": "application/json" },
        body: JSON.stringify({
          model: "claude-sonnet-5",
          max_tokens: 2200,
          thinking: { type: "disabled" },
          system: prompt.system,
          messages: [{ role: "user", content: prompt.user }],
        }),
      });
      const data = await response.json() as Record<string, unknown>;
      if (!response.ok) throw new Error(String((data.error as Record<string, unknown> | undefined)?.message || `HTTP ${response.status}`));
      const parts = data.content as Array<Record<string, unknown>>;
      const content = String(parts.find((part) => part.type === "text")?.text || "");
      const usage = data.usage as Record<string, unknown>;
      const inputTokens = Number(usage.input_tokens || 0) + Number(usage.cache_creation_input_tokens || 0) + Number(usage.cache_read_input_tokens || 0);
      const outputTokens = Number(usage.output_tokens || 0);
      return {
        exchangeId,
        judge,
        evaluations: parseEvaluation(content, expectedIds),
        latencyMs: Date.now() - startedAt,
        inputTokens,
        outputTokens,
        estimatedCostUsd: (inputTokens * 2 + outputTokens * 10) / 1_000_000,
      };
    } catch (error) {
      lastError = error;
      if (attempt === 2) break;
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${judge} failed.`);
}

async function mapWithConcurrency<T, R>(values: T[], concurrency: number, fn: (value: T, index: number) => Promise<R>) {
  const results = new Array<R>(values.length);
  let next = 0;
  async function worker() {
    while (true) {
      const index = next;
      next += 1;
      if (index >= values.length) return;
      results[index] = await fn(values[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, () => worker()));
  return results;
}

async function main() {
  const inputPath = path.resolve(argument("input") || "");
  if (!inputPath) throw new Error("Pass --input=<full benchmark artifact>.");
  const outputPath = path.resolve(argument("output") || "/private/tmp/ask-sales-provider-quality-scores.json");
  const report = JSON.parse(await readFile(inputPath, "utf8")) as BenchmarkReport;
  const registry = getV3Registry();
  const policies = new Map(registry.policies.map((policy) => [policy.id, policy]));
  const exchangeIds = Array.from(new Set(report.items.map((item) => item.exchangeId)));
  const completed: JudgeResult[] = [];

  const tasks = exchangeIds.flatMap((exchangeId) => (["deepseek-judge", "sonnet5-judge"] as JudgeId[]).map((judge) => ({ exchangeId, judge })));
  const results = await mapWithConcurrency(tasks, 4, async ({ exchangeId, judge }, index) => {
    const items = report.items.filter((item) => item.exchangeId === exchangeId);
    const idMap = answerIdMap(exchangeId);
    const commonIds = Array.from(new Set([
      ...items.flatMap((item) => item.selectedPolicyIds),
      ...items.flatMap((item) => item.rejectedPolicyIds),
      ...items.flatMap((item) => item.candidatePolicyIds.slice(0, 8)),
    ])).slice(0, 24);
    const evidence = commonIds.flatMap((id) => {
      const policy = policies.get(id);
      return policy ? [{ id, decision: policy.decision.slice(0, 1800), route: policy.route_channel }] : [];
    });
    const current = items[0];
    const candidateHistory = report.items
      .filter((item) => item.candidate === current.candidate && item.conversationId === current.conversationId && item.promptIndex < current.promptIndex)
      .sort((a, b) => a.promptIndex - b.promptIndex)
      .slice(-3);
    const prompt = buildPrompt(items, candidateHistory, evidence);
    const result = await callJudge(judge, exchangeId, prompt, Array.from(idMap.values()));
    completed.push(result);
    process.stdout.write(`[judge] ${index + 1}/${tasks.length} ${judge} ${exchangeId} ${result.latencyMs}ms\n`);
    await writeFile(outputPath, JSON.stringify({ status: "running", benchmarkRunId: report.runId, results: completed }, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
    return result;
  });

  const scored = report.items.map((item) => {
    const blindId = answerIdMap(item.exchangeId).get(item.candidate);
    const evaluations = results.flatMap((result) => result.exchangeId === item.exchangeId
      ? result.evaluations.filter((entry) => entry.answer_id === blindId).map((entry) => ({ judge: result.judge, ...entry }))
      : []);
    return {
      exchangeId: item.exchangeId,
      candidate: item.candidate,
      evaluations,
      averageScore: evaluations.reduce((total, entry) => total + scoreFor(entry.classification), 0) / Math.max(1, evaluations.length),
      agreement: evaluations.length === 2 && evaluations[0].classification === evaluations[1].classification,
    };
  });
  const summaries = CANDIDATE_IDS.map((candidate) => {
    const entries = scored.filter((entry) => entry.candidate === candidate);
    const evaluations = entries.flatMap((entry) => entry.evaluations);
    const counts = Object.fromEntries(Array.from(CLASSIFICATIONS).map((classification) => [classification, evaluations.filter((entry) => entry.classification === classification).length]));
    const averageScore = entries.reduce((total, entry) => total + entry.averageScore, 0) / Math.max(1, entries.length);
    return {
      candidate,
      turns: entries.length,
      averageScore: Math.round(averageScore * 1000) / 1000,
      fullyUsefulOrConversationPassRate: Math.round((evaluations.filter((entry) => entry.classification === "fully_useful" || entry.classification === "conversation_pass").length / Math.max(1, evaluations.length)) * 1000) / 1000,
      safeRate: Math.round((evaluations.filter((entry) => entry.safe).length / Math.max(1, evaluations.length)) * 1000) / 1000,
      judgeAgreementRate: Math.round((entries.filter((entry) => entry.agreement).length / Math.max(1, entries.length)) * 1000) / 1000,
      classificationCountsAcrossTwoJudges: counts,
    };
  });
  const finalReport = {
    schemaVersion: 1,
    status: "complete",
    generatedAt: new Date().toISOString(),
    benchmarkRunId: report.runId,
    judges: ["deepseek-v4-pro", "claude-sonnet-5"],
    providerIdentityHidden: true,
    summaries,
    judgeCostUsd: Math.round(results.reduce((total, result) => total + result.estimatedCostUsd, 0) * 1_000_000) / 1_000_000,
    scored,
    rawJudgeResults: results,
  };
  await writeFile(outputPath, JSON.stringify(finalReport, null, 2) + "\n", { encoding: "utf8", mode: 0o600 });
  console.log(JSON.stringify({ outputPath, summaries, judgeCostUsd: finalReport.judgeCostUsd }, null, 2));
}

main().catch((error) => {
  console.error(sanitizeError(error));
  process.exitCode = 1;
});
