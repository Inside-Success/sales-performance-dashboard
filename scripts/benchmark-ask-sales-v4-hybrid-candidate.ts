import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV4Systemic } from "@/lib/ask-sales-faq/v4/systemic/runtime";

type ReferenceItem = {
  id: string;
  conversationId: string;
  promptIndex: number;
  question: string;
  independent: boolean;
  inputContext: AskSalesFaqChatMessage[];
  evaluationStrata: string[];
  goldNeeds: unknown[];
  reference: { v3: unknown; currentV4: unknown };
  systemic: unknown;
};

type ReferenceReport = {
  datasetSha256: string;
  expectedCases: number;
  items: ReferenceItem[];
};

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function laneCounts(items: Array<{ v44?: { lane?: string } }>) {
  return items.reduce<Record<string, number>>((counts, item) => {
    const lane = item.v44?.lane || "missing";
    counts[lane] = (counts[lane] || 0) + 1;
    return counts;
  }, {});
}

async function main() {
  const datasetPath = path.resolve(argument("dataset"));
  const referencePath = path.resolve(argument("reference"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v4-4/frozen-comparison.json"));
  if (!argument("dataset") || !argument("reference")) throw new Error("--dataset and --reference are required");

  const [datasetRaw, referenceRaw] = await Promise.all([
    readFile(datasetPath, "utf8"),
    readFile(referencePath, "utf8"),
  ]);
  const reference = JSON.parse(referenceRaw) as ReferenceReport;
  if (sha256(datasetRaw) !== reference.datasetSha256) throw new Error("Reference report does not match the selected dataset");
  if (reference.items.length !== reference.expectedCases) throw new Error("Reference report is incomplete");
  const requestedIds = new Set(argument("ids").split(",").map((value) => value.trim()).filter(Boolean));
  const selectedItems = requestedIds.size
    ? reference.items.filter((item) => requestedIds.has(item.id))
    : reference.items;
  if (requestedIds.size && selectedItems.length !== requestedIds.size) throw new Error("One or more --ids values were not found in the reference report");

  const report = {
    schemaVersion: 1,
    status: "running",
    runtime: "v4.4-hybrid",
    skipChampionComparison: true,
    runtimeFreezeCommit: argument("freeze-commit"),
    datasetPath,
    datasetSha256: sha256(datasetRaw),
    referencePath,
    referenceSha256: sha256(referenceRaw),
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    items: [] as Array<ReferenceItem & { v44: Awaited<ReturnType<typeof runAskSalesFaqV4Systemic>> }>,
    summary: {} as Record<string, unknown>,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });

  for (const item of selectedItems) {
    const priorContext = item.inputContext.slice(0, -1);
    const v44 = await runAskSalesFaqV4Systemic(item.question, priorContext, { skipChampionComparison: true });
    report.items.push({ ...item, v44 });
    report.summary = {
      cases: report.items.length,
      lanes: laneCounts(report.items),
      operationalEvidenceSelections: report.items.filter((entry) => entry.v44.citations.some((citation) => citation.sourceKind === "authoritative_slack_operational_qna")).length,
      providerAttempts: report.items.reduce((counts, entry) => {
        for (const attempt of entry.v44.runtimeMetadata.providerAttempts) {
          const key = attempt.status === "success" ? "successful" : "failed";
          counts[key] = (counts[key] || 0) + 1;
        }
        return counts;
      }, {} as Record<string, number>),
    };
    await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
    console.log(JSON.stringify({ completed: report.items.length, total: selectedItems.length, id: item.id, lane: v44.lane }));
  }

  report.status = "complete";
  report.completedAt = new Date().toISOString();
  report.summary = { ...report.summary, cases: report.items.length, lanes: laneCounts(report.items) };
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ outputPath, summary: report.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
