import { createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { getV4ProviderReadiness } from "@/lib/ask-sales-faq/v4/provider";
import { runAskSalesFaqV512 } from "@/lib/ask-sales-faq/v5-12/runtime";

type RuntimeResult = Awaited<ReturnType<typeof runAskSalesFaqV512>>;

type Item = {
  id: string;
  conversationKey: string;
  conversationTurn: number;
  question: string;
  productionAnswer: string;
  productionOutcome: string | null;
  productionNeedsRoute: boolean;
  productionRouteReason: string | null;
  productionProvider: string | null;
  productionModel: string | null;
  productionLatencyMs: number;
  productionErrorClass: string | null;
  feedback: { rating: "up" | "down" } | null;
  capturedAt: string;
};

type Snapshot = {
  schemaVersion: number;
  generatedAt: string;
  from: string;
  to: string;
  itemCount: number;
  conversationCount: number;
  readOnlyExport: boolean;
  queryCount: number;
  containsViewerIdentity: boolean;
  containsFreeTextFeedback: boolean;
  items: Item[];
};

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

function summarize(results: Array<Item & { candidate: RuntimeResult }>) {
  const latencies = results.map((item) => item.candidate.latencyMs);
  const lanes = results.reduce<Record<string, number>>((counts, item) => {
    counts[item.candidate.lane] = (counts[item.candidate.lane] || 0) + 1;
    return counts;
  }, {});
  const attempts = results.flatMap((item) => item.candidate.runtimeMetadata.providerAttempts);
  return {
    completed: results.length,
    lanes,
    answeredOrPartial: results.filter((item) => ["answer", "partial"].includes(item.candidate.lane)).length,
    routes: results.filter((item) => item.candidate.needsRoute).length,
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
  const provider = getV4ProviderReadiness();
  if (!provider.modelConfigured) {
    throw new Error("V5.12 provider preflight failed; no runtime output was generated");
  }
  const inputArgument = argument("input");
  if (!inputArgument) throw new Error("--input is required");
  const inputPath = path.resolve(inputArgument);
  const outputPath = path.resolve(argument(
    "output",
    "artifacts/ask-sales-faq-v5-12-production-head-to-head/v5-12-runtime.json",
  ));
  const concurrency = Math.max(1, Math.min(3, Number.parseInt(argument("concurrency", "2"), 10) || 2));
  const raw = await readFile(inputPath, "utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  if (
    snapshot.schemaVersion !== 2
    || snapshot.readOnlyExport !== true
    || snapshot.queryCount !== 1
    || snapshot.containsViewerIdentity
    || snapshot.containsFreeTextFeedback
    || snapshot.itemCount !== snapshot.items.length
  ) {
    throw new Error("Expected a complete privacy-reduced, SELECT-only production snapshot");
  }

  const conversations = [...snapshot.items.reduce<Map<string, Item[]>>((groups, item) => {
    groups.set(item.conversationKey, [...(groups.get(item.conversationKey) || []), item]);
    return groups;
  }, new Map()).entries()].map(([conversationKey, items]) => ({
    conversationKey,
    items: items.sort((left, right) => left.conversationTurn - right.conversationTurn),
  }));

  const report = {
    schemaVersion: "ask-sales-v5-12-production-head-to-head-runtime-v1",
    status: "running",
    productionMutation: false,
    productionPromotion: false,
    sourcePath: inputPath,
    sourceSha256: sha256(raw),
    sourcePopulationCount: snapshot.itemCount,
    evaluatedCount: snapshot.itemCount,
    conversationCount: snapshot.conversationCount,
    concurrency,
    provider,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    results: [] as Array<Item & { candidate: RuntimeResult }>,
    summary: {} as Record<string, unknown>,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  let cursor = 0;
  let writeChain = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(async () => {
      const temporaryPath = `${outputPath}.tmp`;
      await writeFile(temporaryPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      await rename(temporaryPath, outputPath);
    });
    return writeChain;
  };

  async function worker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      const conversation = conversations[index];
      if (!conversation) return;
      const history: AskSalesFaqChatMessage[] = [];
      for (const item of conversation.items) {
        history.push({ role: "user", content: item.question });
        const candidate = await runAskSalesFaqV512(item.question, history);
        history.push({ role: "assistant", content: candidate.answer });
        report.results.push({ ...item, candidate });
        report.summary = summarize(report.results);
        await persist();
        process.stdout.write(`${JSON.stringify({ id: item.id, turn: item.conversationTurn, lane: candidate.lane, latencyMs: candidate.latencyMs })}\n`);
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  report.results.sort((left, right) => left.id.localeCompare(right.id));
  report.summary = summarize(report.results);
  const providerFailures = report.results.filter((item) => {
    const attempts = item.candidate.runtimeMetadata.providerAttempts;
    return attempts.length > 0 && attempts.every((attempt) => attempt.status !== "success");
  });
  if (providerFailures.length) {
    throw new Error(`Provider-backed evaluation failed for ${providerFailures.length} response(s); run was not marked complete`);
  }
  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await persist();
  await writeChain;
  console.log(JSON.stringify({ outputPath, status: report.status, summary: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
