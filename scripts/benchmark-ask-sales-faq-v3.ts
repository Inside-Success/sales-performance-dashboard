import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import dataset from "../tests/ask-sales-faq/v3-regression-78.json";
import type { AskSalesFaqChatMessage } from "../src/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "../src/lib/ask-sales-faq/v3/runtime";

type BenchmarkItem = {
  conversationId: string;
  conversationTitle: string;
  promptIndex: number;
  question: string;
  answer: string;
  outcome: string;
  needsRoute: boolean;
  routeReason: string | null;
  provider: string | null;
  model: string | null;
  latencyMs: number;
  selectedPolicyIds: string[];
  rejectedPolicyIds: string[];
  validationVerdict: string | null;
  candidateIds: string[];
  errorClass: string | null;
};

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function percentile(values: number[], fraction: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function summarize(items: BenchmarkItem[]) {
  const outcomes = Object.fromEntries(
    Array.from(new Set(items.map((item) => item.outcome))).sort().map((outcome) => [outcome, items.filter((item) => item.outcome === outcome).length]),
  );
  const validations = Object.fromEntries(
    Array.from(new Set(items.map((item) => item.validationVerdict || "none"))).sort().map((verdict) => [verdict, items.filter((item) => (item.validationVerdict || "none") === verdict).length]),
  );
  const normalizedAnswers = items.map((item) => item.answer.toLowerCase().replace(/\s+/g, " ").trim());
  const repeatedAnswers = Array.from(new Set(normalizedAnswers))
    .map((answer) => ({ answer, count: normalizedAnswers.filter((candidate) => candidate === answer).length }))
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const latencies = items.map((item) => item.latencyMs);
  const usefulAnswerCount = items.filter((item) => item.outcome === "answer_from_evidence" || item.outcome === "conversation_reply").length;
  return {
    total: items.length,
    usefulAnswerCount,
    usefulAnswerRate: items.length ? Math.round((usefulAnswerCount / items.length) * 1000) / 10 : 0,
    routeOrUnansweredCount: items.length - usefulAnswerCount,
    outcomes,
    validations,
    providerOrRuntimeErrors: items.filter((item) => Boolean(item.errorClass)).length,
    latencyMs: {
      average: latencies.length ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length) : 0,
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: latencies.length ? Math.max(...latencies) : 0,
    },
    repeatedAnswers,
  };
}

async function main() {
  const limit = Math.max(0, Number.parseInt(argument("limit") || "0", 10) || 0);
  const onlyConversation = argument("conversation");
  const outputRoot = path.resolve(argument("output-dir") || "artifacts/ask-sales-faq-v3");
  const runId = `v3-${new Date().toISOString().replace(/[:.]/g, "-")}`;
  const outputPath = path.join(outputRoot, `${runId}.json`);
  const conversations = dataset.conversations.filter((conversation) => !onlyConversation || conversation.id === onlyConversation);
  const items: BenchmarkItem[] = [];
  let attempted = 0;

  await mkdir(outputRoot, { recursive: true });
  for (const conversation of conversations) {
    const messages: AskSalesFaqChatMessage[] = [];
    for (let promptIndex = 0; promptIndex < conversation.prompts.length; promptIndex += 1) {
      if (limit && attempted >= limit) break;
      const question = conversation.prompts[promptIndex];
      attempted += 1;
      process.stdout.write(`[${attempted}/${limit || dataset.promptCount}] ${conversation.id} Q${promptIndex + 1} ... `);
      const result = await runAskSalesFaqV3(question, [...messages, { role: "user", content: question }]);
      const item: BenchmarkItem = {
        conversationId: conversation.id,
        conversationTitle: conversation.title,
        promptIndex: promptIndex + 1,
        question,
        answer: result.answer,
        outcome: result.outcome,
        needsRoute: result.needsRoute,
        routeReason: result.routeReason,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        selectedPolicyIds: result.runtimeMetadata.v3?.selection.selectedPolicyIds || [],
        rejectedPolicyIds: result.runtimeMetadata.v3?.selection.rejectedPolicyIds || [],
        validationVerdict: result.runtimeMetadata.v3?.validation.verdict || null,
        candidateIds: result.runtimeMetadata.v3?.retrieval.candidates.map((candidate) => candidate.id) || [],
        errorClass: result.errorClass,
      };
      items.push(item);
      messages.push({ role: "user", content: question }, { role: "assistant", content: result.answer });
      if (messages.length > 10) messages.splice(0, messages.length - 10);
      await writeFile(
        outputPath,
        JSON.stringify({ schemaVersion: 1, runId, dataset: dataset.name, status: "running", summary: summarize(items), items }, null, 2) + "\n",
        "utf8",
      );
      process.stdout.write(`${result.outcome} ${result.latencyMs}ms\n`);
    }
    if (limit && attempted >= limit) break;
  }

  const report = { schemaVersion: 1, runId, dataset: dataset.name, status: "complete", summary: summarize(items), items };
  await writeFile(outputPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ outputPath, summary: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
