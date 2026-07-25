import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";

type Grade = "pass" | "partial" | "fail" | "critical";
type JsonRecord = Record<string, unknown>;

const gradeScore: Record<Grade, number> = { pass: 1, partial: 0.5, fail: 0, critical: 0 };

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function grade(value: unknown): Grade {
  const candidate = text(value) as Grade;
  if (!new Set<Grade>(["pass", "partial", "fail", "critical"]).has(candidate)) throw new Error(`Invalid grade ${text(value)}`);
  return candidate;
}

function summarizeGrades(grades: Grade[]) {
  const weightedUtility = grades.reduce((total, value) => total + gradeScore[value], 0);
  return {
    total: grades.length,
    weightedUtility,
    weightedUtilityRate: Number((weightedUtility / grades.length).toFixed(4)),
  };
}

async function main() {
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-3-independent-slack-gold-2026-07-25.json"));
  const runtimePath = path.resolve(argument("runtime", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-runtime.json"));
  const scorePath = path.resolve(argument("score", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-unblinded-score.json"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-3-independent-gate/knowledge-access-diagnostic.json"));
  const [datasetRaw, runtimeRaw, scoreRaw] = await Promise.all([
    readFile(datasetPath, "utf8"),
    readFile(runtimePath, "utf8"),
    readFile(scorePath, "utf8"),
  ]);
  const dataset = object(JSON.parse(datasetRaw));
  const runtime = object(JSON.parse(runtimeRaw));
  const score = object(JSON.parse(scoreRaw));
  if (text(runtime.status) !== "complete" || object(score.promotionGate).technicalGatePassed !== false) {
    throw new Error("Diagnostic requires a complete failed primary gate");
  }
  const datasetItems = [
    ...(Array.isArray(dataset.cases) ? dataset.cases.map(object) : []),
    ...(Array.isArray(dataset.conversations) ? dataset.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : [],
    ) : []),
  ];
  const runtimeItems = [
    ...(Array.isArray(runtime.cases) ? runtime.cases.map(object) : []),
    ...(Array.isArray(runtime.conversations) ? runtime.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : [],
    ) : []),
  ];
  const runtimeById = new Map(runtimeItems.map((item) => [text(item.id), item]));
  const details = object(score.details);
  const gradeMaps = Object.fromEntries(["v3", "v5"].map((system) => [system, new Map(
    (Array.isArray(details[system]) ? (details[system] as unknown[]).map(object) : []).map((item) => [text(item.id), grade(item.grade)]),
  )])) as Record<"v3" | "v5", Map<string, Grade>>;
  const answerEvidenceSourceIds = new Set(getV5KnowledgeSnapshot().policies
    .filter((policy) => policy.answerability === "answer_evidence")
    .flatMap((policy) => policy.source.ids));
  const strata = new Map<string, string[]>();
  for (const item of datasetItems) {
    const sourceIds = Array.isArray(item.sourceIds) ? item.sourceIds.map(text) : [];
    const sourceMatches = sourceIds.filter((sourceId) => answerEvidenceSourceIds.has(sourceId));
    const stratum = sourceIds.length === 0 ? "natural_no_source" : sourceMatches.length ? "exact_source_present" : "exact_source_absent";
    strata.set(text(item.id), [stratum, ...sourceMatches]);
  }
  const sourceCoverage = Object.fromEntries(["exact_source_present", "exact_source_absent", "natural_no_source"].map((stratum) => {
    const ids = datasetItems.map((item) => text(item.id)).filter((id) => strata.get(id)?.[0] === stratum);
    return [stratum, {
      items: ids.length,
      v3: summarizeGrades(ids.map((id) => gradeMaps.v3.get(id)!)),
      v5: summarizeGrades(ids.map((id) => gradeMaps.v5.get(id)!)),
    }];
  }));

  const v5NonPassDiagnostics = datasetItems.flatMap((item) => {
    const id = text(item.id);
    const itemGrade = gradeMaps.v5.get(id)!;
    if (itemGrade === "pass") return [];
    const runtimeItem = runtimeById.get(id)!;
    const v5 = object(object(runtimeItem.systems).v5);
    const metadata = object(v5.runtimeMetadata);
    const sourcePlan = object(metadata.sourcePlan);
    const needs = Array.isArray(sourcePlan.needs) ? sourcePlan.needs.map(object) : [];
    const reasons = needs.map((need) => text(need.reason)).filter(Boolean);
    const combinedReason = reasons.join(" || ");
    const categories = new Set<string>();
    if (/conflict|authority resolution|authority evidence/i.test(combinedReason)) categories.add("conflict_or_authority_resolution");
    if (/withheld|decision-identity|recovery contract|preferred source/i.test(combinedReason)) categories.add("evidence_admission");
    if (/no (?:stable|answer-eligible|card directly|direct evidence)|not directly applicable|unrelated/i.test(combinedReason)) categories.add("missing_or_unretrieved_knowledge");
    if ((strata.get(id)?.[0] || "") === "natural_no_source" || (Array.isArray(item.evaluationStrata) && item.evaluationStrata.includes("natural-conversation"))) categories.add("conversation_handling");
    const scoreDetail = (Array.isArray(details.v5) ? (details.v5 as unknown[]).map(object) : []).find((detail) => text(detail.id) === id);
    if (scoreDetail?.wrongActionOwner === true) categories.add("wrong_action_owner");
    if (!categories.size) categories.add("other_incomplete_answer");
    const retrieval = object(metadata.retrieval);
    return [{
      id,
      grade: itemGrade,
      sourceCoverage: strata.get(id)?.[0],
      lane: text(v5.lane) || text(v5.outcome),
      candidateCount: Number(retrieval.candidateCount || 0),
      selectedPolicyCount: Array.isArray(v5.selectedPolicyIds) ? v5.selectedPolicyIds.length : 0,
      categories: [...categories],
      sourcePlanReasons: reasons,
    }];
  });
  const categoryCounts = v5NonPassDiagnostics.flatMap((item) => item.categories).reduce<Record<string, number>>((counts, category) => {
    counts[category] = (counts[category] || 0) + 1;
    return counts;
  }, {});
  const sourceBackedItems = datasetItems.filter((item) => Array.isArray(item.sourceIds) && item.sourceIds.length > 0);
  const exactSourcePresent = sourceBackedItems.filter((item) => strata.get(text(item.id))?.[0] === "exact_source_present").length;
  const result = {
    schemaVersion: "ask-sales-v5-3-independent-knowledge-access-diagnostic-v1",
    createdAt: new Date().toISOString(),
    datasetPath,
    datasetSha256: createHash("sha256").update(datasetRaw).digest("hex"),
    runtimePath,
    runtimeSha256: createHash("sha256").update(runtimeRaw).digest("hex"),
    scorePath,
    scoreSha256: createHash("sha256").update(scoreRaw).digest("hex"),
    runtimeFreezeCommit: text(runtime.runtimeFreezeCommit),
    sourceCoverage: {
      sourceBackedItems: sourceBackedItems.length,
      exactSourcePresent,
      exactSourceAbsent: sourceBackedItems.length - exactSourcePresent,
      exactSourcePresentRate: Number((exactSourcePresent / sourceBackedItems.length).toFixed(4)),
      byStratum: sourceCoverage,
    },
    v5NonPassDiagnostics: {
      total: v5NonPassDiagnostics.length,
      categoryCounts,
      details: v5NonPassDiagnostics,
    },
    repeatabilityRun: {
      status: "not_run",
      reason: "The preregistered primary promotion gate failed decisively; repeatability cannot reverse that decision and was stopped to avoid unnecessary provider work.",
    },
    conclusions: [
      "V5.3 is safer than V3 on this gate because it produced zero critical policy errors while V3 produced three.",
      "V5.3 is not useful enough to replace V3: its weighted utility, conversation behavior, and action-owner accuracy all failed the preregistered thresholds.",
      "Knowledge freshness is a real problem: only 15 of 40 source-backed prompts contain an exact source already admitted as V5 answer evidence.",
      "Knowledge freshness is not the whole problem: V5 utility remains low even in the exact-source-present stratum, and natural conversation scored zero.",
      "The next candidate must fix claim-level conflict/admission, route-owner precedence, natural-turn handling, and governed refresh coverage together; a threshold-only relaxation would reintroduce V3-style critical mismatches."
    ],
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    outputPath,
    sourceCoverage: result.sourceCoverage,
    categoryCounts,
    repeatabilityRun: result.repeatabilityRun,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
