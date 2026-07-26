import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

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

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function flatten(report: JsonRecord) {
  return [
    ...(Array.isArray(report.cases) ? report.cases.map(object) : []),
    ...(Array.isArray(report.conversations) ? report.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
  ];
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function normalizedAnswer(value: unknown) {
  return text(value).toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
}

function materialBoundary(answer: string) {
  const normalized = normalizedAnswer(answer);
  const numbers = [...normalized.matchAll(/(?:\$\s*)?\d[\d,.]*(?:\s*(?:%|percent|hours?|days?|weeks?|months?|years?))?/g)]
    .map((match) => match[0].replace(/\s+/g, ""))
    .sort();
  const modalityPatterns = [
    /\b(?:do not|don't|must not|cannot|can't|not allowed|never)\b/g,
    /\b(?:must|required|have to|only)\b/g,
    /\b(?:may|can|allowed|permitted)\b/g,
    /\b(?:no|none|without)\b/g,
  ];
  const modalities = modalityPatterns.flatMap((pattern) => [...normalized.matchAll(pattern)].map((match) => match[0])).sort();
  return { numbers, modalities };
}

function decisionSignature(result: JsonRecord) {
  const boundary = materialBoundary(text(result.answer));
  return JSON.stringify({
    lane: text(result.lane) || text(result.outcome),
    needsRoute: result.needsRoute === true,
    routeChannels: strings(result.routeChannels).sort(),
    numbers: boundary.numbers,
    modalities: boundary.modalities,
  });
}

function sourceSignature(result: JsonRecord) {
  return JSON.stringify(strings(result.selectedPolicyIds).sort());
}

function markdown(report: JsonRecord) {
  const aggregate = object(report.aggregate);
  const variants = Array.isArray(report.caseVariants) ? report.caseVariants.map(object) : [];
  const rows = variants.map((item) =>
    `| ${text(item.id)} | ${item.laneVariants} | ${item.decisionBoundaryVariants} | ${item.sourceVariants} | ${item.exactAnswerVariants} | ${item.manualReviewRequired === true ? "yes" : "no"} |`,
  );
  return `# Ask Sales V5.6 repeatability report

Five frozen V5.6 executions were compared on the same 20 reviewed prompts. This report treats lane/routing changes and changes to numbers or permission/prohibition language as potential material flips. Exact wording or source changes are reported separately and require human inspection before being called material.

## Aggregate

- Executions: ${aggregate.executions}
- Comparison opportunities against run 1: ${aggregate.comparisonOpportunities}
- Lane flip comparisons: ${aggregate.laneFlipComparisons}
- Decision-boundary flip comparisons: ${aggregate.decisionBoundaryFlipComparisons}
- Exact-answer flip comparisons: ${aggregate.exactAnswerFlipComparisons}
- Cases requiring manual variation review: ${aggregate.casesRequiringManualReview}

## Per prompt

| Prompt | Lane variants | Boundary variants | Source variants | Answer variants | Manual review |
| --- | ---: | ---: | ---: | ---: | --- |
${rows.join("\n")}

This is a repeatability diagnostic, not production-promotion evidence. The 20 questions and their verified rules were already reviewed during development.
`;
}

async function main() {
  const inputs = argument("inputs", [1, 2, 3, 4, 5]
    .map((run) => `artifacts/ask-sales-faq-v5-6-causal/release-candidate-${run}.json`).join(","))
    .split(",").map((value) => path.resolve(value.trim())).filter(Boolean);
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-6-causal/repeatability-analysis.json"));
  const markdownPath = path.resolve(argument("markdown", "artifacts/ask-sales-faq-v5-6-causal/REPEATABILITY-REPORT.md"));
  if (inputs.length !== 5) throw new Error(`Expected exactly five input reports, received ${inputs.length}`);
  const raws = await Promise.all(inputs.map((input) => readFile(input, "utf8")));
  const reports = raws.map((raw) => object(JSON.parse(raw)));
  for (const [index, report] of reports.entries()) {
    if (text(report.status) !== "complete") throw new Error(`Run ${index + 1} is not complete`);
    if (!Array.isArray(report.systems) || !report.systems.includes("v56")) throw new Error(`Run ${index + 1} does not contain V5.6`);
  }
  const runMaps = reports.map((report) => new Map(flatten(report).map((item) => [text(item.id), item])));
  const ids = [...runMaps[0].keys()];
  if (ids.length !== 20 || runMaps.some((map) => map.size !== 20 || ids.some((id) => !map.has(id)))) {
    throw new Error("All five reports must contain the exact same 20 prompt IDs");
  }

  let laneFlipComparisons = 0;
  let decisionBoundaryFlipComparisons = 0;
  let exactAnswerFlipComparisons = 0;
  let sourceFlipComparisons = 0;
  const caseVariants = ids.map((id) => {
    const results = runMaps.map((map) => object(object(map.get(id)!.systems).v56));
    const lanes = results.map((result) => text(result.lane) || text(result.outcome));
    const decisions = results.map(decisionSignature);
    const sources = results.map(sourceSignature);
    const answers = results.map((result) => normalizedAnswer(result.answer));
    for (let run = 1; run < results.length; run += 1) {
      if (lanes[run] !== lanes[0]) laneFlipComparisons += 1;
      if (decisions[run] !== decisions[0]) decisionBoundaryFlipComparisons += 1;
      if (sources[run] !== sources[0]) sourceFlipComparisons += 1;
      if (answers[run] !== answers[0]) exactAnswerFlipComparisons += 1;
    }
    const exactAnswers = [...new Set(results.map((result) => text(result.answer)))];
    const sourceSets = [...new Set(sources)].map((value) => JSON.parse(value));
    const decisionBoundaries = [...new Set(decisions)].map((value) => JSON.parse(value));
    return {
      id,
      expectedDisposition: text(runMaps[0].get(id)!.expectedDisposition),
      laneVariants: new Set(lanes).size,
      decisionBoundaryVariants: decisionBoundaries.length,
      sourceVariants: sourceSets.length,
      exactAnswerVariants: exactAnswers.length,
      manualReviewRequired: decisionBoundaries.length > 1 || sourceSets.length > 1 || exactAnswers.length > 1,
      lanes: [...new Set(lanes)],
      decisionBoundaries,
      sourceSets,
      exactAnswers,
    };
  });
  const aggregate = {
    runs: reports.length,
    prompts: ids.length,
    executions: reports.length * ids.length,
    comparisonOpportunities: (reports.length - 1) * ids.length,
    laneFlipComparisons,
    laneFlipRate: laneFlipComparisons / ((reports.length - 1) * ids.length),
    decisionBoundaryFlipComparisons,
    decisionBoundaryFlipRate: decisionBoundaryFlipComparisons / ((reports.length - 1) * ids.length),
    sourceFlipComparisons,
    sourceFlipRate: sourceFlipComparisons / ((reports.length - 1) * ids.length),
    exactAnswerFlipComparisons,
    exactAnswerFlipRate: exactAnswerFlipComparisons / ((reports.length - 1) * ids.length),
    casesRequiringManualReview: caseVariants.filter((item) => item.manualReviewRequired).length,
  };
  const result = {
    schemaVersion: "ask-sales-v5-6-repeatability-analysis-v1",
    status: "complete",
    generatedAt: new Date().toISOString(),
    inputs: inputs.map((input, index) => ({ path: input, sha256: sha256(raws[index]) })),
    methodology: {
      baseline: "Every run is compared with run 1 on the exact same prompt ID.",
      potentialMaterialBoundary: "Lane, routing, numeric tokens, and permission/prohibition modality.",
      caution: "Exact-answer and source variation is surfaced for human inspection; it is not automatically labeled material.",
      promotionEvidence: false,
    },
    aggregate,
    caseVariants,
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdown(result), "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, markdownPath, aggregate }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
