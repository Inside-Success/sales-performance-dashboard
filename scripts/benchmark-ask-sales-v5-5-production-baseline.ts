import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV5 } from "@/lib/ask-sales-faq/v5/runtime";
import { runAskSalesFaqV55 } from "@/lib/ask-sales-faq/v5-5/runtime";

type SystemName = "v54" | "v55";
type RuntimeResult = Awaited<ReturnType<typeof runAskSalesFaqV5>>;

type Item = {
  id: string;
  conversationKey: string;
  conversationTurn: number;
  question: string;
  productionAnswer: string;
  productionOutcome: string | null;
  productionNeedsRoute: boolean;
  productionRouteReason: string | null;
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

function lane(result: RuntimeResult) {
  return result.lane;
}

function run(system: SystemName, question: string, history: AskSalesFaqChatMessage[]) {
  return system === "v55" ? runAskSalesFaqV55(question, history) : runAskSalesFaqV5(question, history);
}

async function main() {
  const inputPath = path.resolve(argument("input"));
  if (!argument("input")) throw new Error("--input is required");
  const system = argument("system", "v54") as SystemName;
  if (!new Set<SystemName>(["v54", "v55"]).has(system)) throw new Error("--system must be v54 or v55");
  const outputPath = path.resolve(argument("output", `artifacts/ask-sales-faq-v5-5/production-distribution/${system}-runtime.json`));
  const concurrency = Math.max(1, Math.min(3, Number.parseInt(argument("concurrency", "2"), 10) || 2));
  const limit = Math.max(0, Number.parseInt(argument("limit", "0"), 10) || 0);
  const requestedIds = new Set(argument("ids").split(",").map((value) => value.trim()).filter(Boolean));
  const raw = await readFile(inputPath, "utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  if (snapshot.schemaVersion !== 2 || snapshot.containsViewerIdentity || snapshot.containsFreeTextFeedback) {
    throw new Error("Expected a privacy-reduced V5.5 production snapshot");
  }

  const selectedItems = requestedIds.size
    ? snapshot.items.filter((item) => requestedIds.has(item.id))
    : limit ? snapshot.items.slice(0, limit) : snapshot.items;
  if (requestedIds.size && selectedItems.length !== requestedIds.size) {
    throw new Error(`Unknown --ids value; requested ${requestedIds.size}, found ${selectedItems.length}`);
  }
  const selectedIds = new Set(selectedItems.map((item) => item.id));
  const selectedConversationTurns = selectedItems.reduce<Map<string, number>>((turns, item) => {
    turns.set(item.conversationKey, Math.max(turns.get(item.conversationKey) || 0, item.conversationTurn));
    return turns;
  }, new Map());
  const conversations = [...snapshot.items.reduce<Map<string, Item[]>>((groups, item) => {
    const maximumTurn = selectedConversationTurns.get(item.conversationKey);
    if (!maximumTurn || item.conversationTurn > maximumTurn) return groups;
    groups.set(item.conversationKey, [...(groups.get(item.conversationKey) || []), item]);
    return groups;
  }, new Map()).entries()].map(([conversationKey, items]) => ({
    conversationKey,
    items: items.sort((left, right) => left.conversationTurn - right.conversationTurn),
  }));

  const report = {
    schemaVersion: `ask-sales-v5-5-production-${system}-runtime-v1`,
    status: "running",
    promotionEvidence: false,
    diagnosticOnly: true,
    sourcePath: inputPath,
    sourceSha256: sha256(raw),
    sourcePopulationCount: snapshot.itemCount,
    evaluatedCount: selectedItems.length,
    system,
    concurrency,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    results: [] as Array<Item & { candidate: RuntimeResult }>,
    summary: {} as Record<string, unknown>,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  let cursor = 0;
  let writeChain = Promise.resolve();
  const persist = () => {
    writeChain = writeChain.then(() => writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8"));
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
        const candidate = await run(system, item.question, history);
        history.push({ role: "assistant", content: candidate.answer });
        if (selectedIds.has(item.id)) {
          report.results.push({ ...item, candidate });
          report.summary = summarize(report.results);
          await persist();
          process.stdout.write(`${JSON.stringify({ id: item.id, conversationTurn: item.conversationTurn, system, lane: lane(candidate), latencyMs: candidate.latencyMs })}\n`);
        }
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  report.results.sort((left, right) => left.id.localeCompare(right.id));
  report.summary = summarize(report.results);
  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await persist();
  await writeChain;
  console.log(JSON.stringify({ outputPath, status: report.status, summary: report.summary }, null, 2));
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

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
