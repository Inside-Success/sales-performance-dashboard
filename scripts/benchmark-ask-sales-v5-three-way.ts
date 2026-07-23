import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";
import { runAskSalesFaqV4Systemic } from "@/lib/ask-sales-faq/v4/systemic/runtime";
import { runAskSalesFaqV5 } from "@/lib/ask-sales-faq/v5/runtime";

type SystemName = "v3" | "v44" | "v5";
type HoldoutCase = {
  id: string;
  question: string;
  expectedDisposition: string;
  expectedRouteKey?: string;
  goldAnswer: string;
  requiredConcepts: string[];
  forbiddenConcepts: string[];
  sourceState: string;
  sourceIds: string[];
  approvedBy: string[];
};
type Holdout = {
  schemaVersion: number;
  name: string;
  status: string;
  sealedAt: string;
  cases: HoldoutCase[];
};
type RuntimeResult = Awaited<ReturnType<typeof runAskSalesFaqV3>> | Awaited<ReturnType<typeof runAskSalesFaqV4Systemic>>;
type EvaluatedCase = HoldoutCase & { systems: Partial<Record<SystemName, RuntimeResult>> };

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestedSystems() {
  const allowed = new Set<SystemName>(["v3", "v44", "v5"]);
  const systems = argument("systems", "v3,v44,v5").split(",").map((value) => value.trim()).filter(Boolean);
  if (!systems.length || systems.some((value) => !allowed.has(value as SystemName))) {
    throw new Error("--systems must be a comma-separated subset of v3,v44,v5");
  }
  return systems as SystemName[];
}

function resultLane(result: RuntimeResult) {
  return "lane" in result ? result.lane : result.outcome;
}

function resultCandidateCount(result: RuntimeResult) {
  if (!("runtimeMetadata" in result) || !result.runtimeMetadata) return null;
  const metadata = result.runtimeMetadata as unknown as { retrieval?: { candidateCount?: number } };
  return typeof metadata.retrieval?.candidateCount === "number" ? metadata.retrieval.candidateCount : null;
}

function summarize(items: EvaluatedCase[], systems: SystemName[]) {
  return Object.fromEntries(systems.map((system) => {
    const results = items.flatMap((item) => item.systems[system] ? [item.systems[system]!] : []);
    const candidateCounts = results.map(resultCandidateCount).filter((value): value is number => value !== null);
    return [system, {
      completed: results.length,
      lanes: results.reduce<Record<string, number>>((counts, result) => {
        const lane = resultLane(result);
        counts[lane] = (counts[lane] || 0) + 1;
        return counts;
      }, {}),
      answersWithSelectedEvidence: results.filter((result) =>
        "selectedPolicyIds" in result && Array.isArray(result.selectedPolicyIds) && result.selectedPolicyIds.length > 0,
      ).length,
      providerFailures: results.reduce((count, result) => {
        const attempts = "runtimeMetadata" in result && result.runtimeMetadata
          ? (result.runtimeMetadata as unknown as { providerAttempts?: Array<{ status?: string }> }).providerAttempts || []
          : [];
        return count + attempts.filter((attempt) => attempt.status !== "success").length;
      }, 0),
      averageCandidateCount: candidateCounts.length
        ? Math.round(candidateCounts.reduce((total, value) => total + value, 0) / candidateCounts.length * 100) / 100
        : null,
    }];
  }));
}

async function run(system: SystemName, item: HoldoutCase): Promise<RuntimeResult> {
  const history: AskSalesFaqChatMessage[] = [{ role: "user", content: item.question }];
  if (system === "v3") return runAskSalesFaqV3(item.question, history);
  if (system === "v44") return runAskSalesFaqV4Systemic(item.question, history, { skipChampionComparison: true });
  return runAskSalesFaqV5(item.question, history);
}

async function main() {
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-fresh-slack-holdout-2026-07-24.json"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5/fresh-slack-three-way.json"));
  const datasetRaw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(datasetRaw) as Holdout;
  if (dataset.schemaVersion !== 1 || dataset.status !== "sealed_before_runtime_evaluation" || !Array.isArray(dataset.cases)) {
    throw new Error("The selected V5 holdout is not a sealed schemaVersion 1 dataset");
  }
  if (new Set(dataset.cases.map((item) => item.id)).size !== dataset.cases.length) throw new Error("Holdout case IDs must be unique");
  const systems = requestedSystems();
  const requestedIds = new Set(argument("ids").split(",").map((value) => value.trim()).filter(Boolean));
  const selectedCases = requestedIds.size ? dataset.cases.filter((item) => requestedIds.has(item.id)) : dataset.cases;
  if (requestedIds.size && selectedCases.length !== requestedIds.size) throw new Error("One or more requested case IDs were not found");

  const report = {
    schemaVersion: 1,
    status: "running",
    datasetPath,
    datasetSha256: sha256(datasetRaw),
    datasetSealedAt: dataset.sealedAt,
    runtimeFreezeCommit: argument("freeze-commit") || null,
    systems,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    items: selectedCases.map((item): EvaluatedCase => ({ ...item, systems: {} })),
    summary: {} as Record<string, unknown>,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });

  for (const system of systems) {
    for (const item of report.items) {
      const result = await run(system, item);
      item.systems[system] = result;
      report.summary = summarize(report.items, systems);
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      process.stdout.write(`${JSON.stringify({ system, id: item.id, lane: resultLane(result), completed: report.summary })}\n`);
    }
  }

  report.status = "complete";
  report.completedAt = new Date().toISOString();
  report.summary = summarize(report.items, systems);
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, summary: report.summary }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
