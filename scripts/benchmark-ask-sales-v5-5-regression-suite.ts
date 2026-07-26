import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV55 } from "@/lib/ask-sales-faq/v5-5/runtime";

type GoldPrompt = Record<string, unknown> & { id?: string; question: string };
type GoldConversation = Record<string, unknown> & { id: string; title?: string; prompts: GoldPrompt[] };
type Dataset = Record<string, unknown> & {
  name?: string;
  cases?: GoldPrompt[];
  conversations?: GoldConversation[];
};
type EvaluatedPrompt = GoldPrompt & { candidate: Awaited<ReturnType<typeof runAskSalesFaqV55>> };

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function percentile(values: number[], quantile: number) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * quantile) - 1))];
}

function summarize(items: EvaluatedPrompt[]) {
  const latencies = items.map((item) => item.candidate.latencyMs);
  const attempts = items.flatMap((item) => item.candidate.runtimeMetadata.providerAttempts);
  return {
    completed: items.length,
    lanes: items.reduce<Record<string, number>>((counts, item) => {
      counts[item.candidate.lane] = (counts[item.candidate.lane] || 0) + 1;
      return counts;
    }, {}),
    answeredOrPartial: items.filter((item) => ["answer", "partial"].includes(item.candidate.lane)).length,
    routes: items.filter((item) => item.candidate.needsRoute).length,
    providerAttempts: attempts.length,
    unsuccessfulProviderAttempts: attempts.filter((attempt) => attempt.status !== "success").length,
    latencyMs: {
      mean: latencies.length ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length) : 0,
      p50: percentile(latencies, 0.5),
      p90: percentile(latencies, 0.9),
      max: Math.max(0, ...latencies),
    },
  };
}

async function main() {
  const inputPath = path.resolve(argument("input"));
  if (!argument("input")) throw new Error("--input is required");
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-5/regression-suite-runtime.json"));
  const concurrency = Math.max(1, Math.min(3, Number.parseInt(argument("concurrency", "3"), 10) || 3));
  const raw = await readFile(inputPath, "utf8");
  const dataset = JSON.parse(raw) as Dataset;
  const standalone = (dataset.cases || []).map((item, index): GoldConversation => ({
    id: String(item.id || `case-${String(index + 1).padStart(3, "0")}`),
    title: String(item.id || `Case ${index + 1}`),
    prompts: [item],
  }));
  const requestedIds = new Set(argument("ids").split(",").map((value) => value.trim()).filter(Boolean));
  const allConversations = [...standalone, ...(dataset.conversations || [])];
  const conversations = requestedIds.size
    ? allConversations.filter((conversation) => requestedIds.has(conversation.id) || conversation.prompts.some((prompt) => prompt.id && requestedIds.has(prompt.id)))
    : allConversations;
  if (!conversations.length || conversations.some((conversation) => !conversation.prompts?.length)) {
    throw new Error("Expected matching cases and/or conversations with at least one question");
  }
  const expectedPrompts = conversations.reduce((total, conversation) => total + conversation.prompts.length, 0);
  const report = {
    schemaVersion: "ask-sales-v5-5-regression-runtime-v1",
    status: "running",
    diagnosticOnly: true,
    promotionEvidence: false,
    datasetName: dataset.name || path.basename(inputPath),
    datasetPath: inputPath,
    datasetSha256: sha256(raw),
    expectedPrompts,
    concurrency,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    conversations: [] as Array<Omit<GoldConversation, "prompts"> & { prompts: EvaluatedPrompt[] }>,
    summary: {} as Record<string, unknown>,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  let cursor = 0;
  let writeChain = Promise.resolve();
  const completedItems = () => report.conversations.flatMap((conversation) => conversation.prompts);
  const persist = () => {
    writeChain = writeChain.then(() => writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"));
    return writeChain;
  };

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      const source = conversations[index];
      if (!source) return;
      const evaluated = { ...source, prompts: [] as EvaluatedPrompt[] };
      const history: AskSalesFaqChatMessage[] = [];
      for (let promptIndex = 0; promptIndex < source.prompts.length; promptIndex += 1) {
        const prompt = source.prompts[promptIndex];
        history.push({ role: "user", content: prompt.question });
        const candidate = await runAskSalesFaqV55(prompt.question, history);
        history.push({ role: "assistant", content: candidate.answer });
        evaluated.prompts.push({ ...prompt, id: prompt.id || `${source.id}-p${promptIndex + 1}`, candidate });
        report.conversations = [...report.conversations.filter((item) => item.id !== source.id), evaluated];
        report.summary = summarize(completedItems());
        await persist();
        process.stdout.write(`${JSON.stringify({ conversation: source.id, id: prompt.id || promptIndex + 1, lane: candidate.lane, latencyMs: candidate.latencyMs })}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  report.conversations.sort((left, right) => String(left.id).localeCompare(String(right.id)));
  report.summary = summarize(completedItems());
  if (completedItems().length !== expectedPrompts) throw new Error(`Completed ${completedItems().length} of ${expectedPrompts} prompts`);
  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await persist();
  await writeChain;
  process.stdout.write(`${JSON.stringify({ outputPath, status: report.status, summary: report.summary }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
