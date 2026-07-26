import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

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

function normalizeQuestion(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9$%]+/g, " ").replace(/\s+/g, " ").trim();
}

function routeKey(item: Item) {
  const value = `${item.productionRouteReason || ""} ${item.productionAnswer}`.toLowerCase();
  if (value.includes("#sales-finance-requests")) return "finance";
  if (value.includes("#greenlight-requests")) return "greenlight";
  if (value.includes("#sales-tech-requests")) return "sales_tech";
  if (value.includes("#fulfillment") || value.includes("#fulfilment")) return "fulfillment";
  if (value.includes("#sales-questions-requests")) return "sales_policy";
  return item.productionNeedsRoute ? "unknown" : null;
}

function percentile(values: number[], quantile: number) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * quantile) - 1))];
}

function counts(values: Array<string | null>) {
  return Object.entries(values.reduce<Record<string, number>>((summary, value) => {
    const key = value || "none";
    summary[key] = (summary[key] || 0) + 1;
    return summary;
  }, {})).sort((left, right) => right[1] - left[1]).map(([value, count]) => ({ value, count }));
}

async function main() {
  const inputPath = path.resolve(argument("input"));
  if (!argument("input")) throw new Error("--input is required");
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-5/production-distribution/analysis.json"));
  const raw = await readFile(inputPath, "utf8");
  const snapshot = JSON.parse(raw) as Snapshot;
  if (snapshot.schemaVersion !== 2 || snapshot.containsViewerIdentity || snapshot.containsFreeTextFeedback) {
    throw new Error("Expected a privacy-reduced V5.5 production snapshot");
  }
  if (snapshot.itemCount !== snapshot.items.length) throw new Error("Snapshot item count does not match its payload");

  const duplicateGroups = new Map<string, Item[]>();
  for (const item of snapshot.items) {
    const key = normalizeQuestion(item.question);
    duplicateGroups.set(key, [...(duplicateGroups.get(key) || []), item]);
  }
  const repeatedQuestionGroups = [...duplicateGroups.entries()]
    .filter(([, items]) => items.length > 1)
    .sort((left, right) => right[1].length - left[1].length || left[0].localeCompare(right[0]));
  const latency = snapshot.items.map((item) => item.productionLatencyMs).filter((value) => value > 0);
  const conversationLengths = [...snapshot.items.reduce<Map<string, number>>((summary, item) => {
    summary.set(item.conversationKey, (summary.get(item.conversationKey) || 0) + 1);
    return summary;
  }, new Map()).values()];
  const curationQueue = [...duplicateGroups.values()]
    .map((items) => ({
      representativeId: items[0].id,
      question: items[0].question,
      frequency: items.length,
      productionOutcomes: counts(items.map((item) => item.productionOutcome)),
      productionRoutes: counts(items.map(routeKey)),
      feedback: counts(items.map((item) => item.feedback?.rating || null)),
      latestCapturedAt: items.map((item) => item.capturedAt).sort().at(-1),
    }))
    .sort((left, right) => right.frequency - left.frequency || String(right.latestCapturedAt).localeCompare(String(left.latestCapturedAt)));

  const report = {
    schemaVersion: "ask-sales-v5-5-production-distribution-analysis-v1",
    createdAt: new Date().toISOString(),
    sourcePath: inputPath,
    sourceSha256: sha256(raw),
    period: { from: snapshot.from, to: snapshot.to },
    population: {
      responses: snapshot.itemCount,
      conversations: snapshot.conversationCount,
      uniqueNormalizedQuestions: duplicateGroups.size,
      repeatedQuestionGroups: repeatedQuestionGroups.length,
      multiTurnConversations: conversationLengths.filter((length) => length > 1).length,
      maximumConversationTurns: Math.max(0, ...conversationLengths),
    },
    productionV3: {
      outcomes: counts(snapshot.items.map((item) => item.productionOutcome)),
      routes: counts(snapshot.items.map(routeKey)),
      feedback: counts(snapshot.items.map((item) => item.feedback?.rating || null)),
      errorClasses: counts(snapshot.items.map((item) => item.productionErrorClass)),
      latencyMs: {
        measured: latency.length,
        mean: latency.length ? Math.round(latency.reduce((total, value) => total + value, 0) / latency.length) : 0,
        p50: percentile(latency, 0.5),
        p90: percentile(latency, 0.9),
        max: Math.max(0, ...latency),
      },
    },
    evaluationProtocol: {
      selection: "complete privacy-reduced non-admin production population available in the requested launch window",
      paddedWithCuratedCases: false,
      promotionEvidence: false,
      reason: "The available population is below 150 and lacks independent SME gold; it is a shadow diagnostic and curation queue, not a promotion gate.",
    },
    curationQueue,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath,
    sourceSha256: report.sourceSha256,
    population: report.population,
    productionV3: report.productionV3,
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
