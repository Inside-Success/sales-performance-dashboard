import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
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

function normalizedAnswer(value: unknown) {
  return text(value).toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
}

function materialBoundary(answer: string) {
  const normalized = normalizedAnswer(answer);
  const numbers = [...normalized.matchAll(/(?:\$\s*)?\d[\d,.]*(?:\s*(?:%|percent|hours?|days?|weeks?|months?|years?))?/g)]
    .map((match) => match[0].replace(/\s+/g, ""))
    .sort();
  const modalities = [
    /\b(?:do not|don't|must not|cannot|can't|not allowed|never)\b/g,
    /\b(?:must|required|have to|only)\b/g,
    /\b(?:may|can|allowed|permitted)\b/g,
    /\b(?:no|none|without)\b/g,
  ].flatMap((pattern) => [...normalized.matchAll(pattern)].map((match) => match[0])).sort();
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

async function main() {
  const inputs = [1, 2, 3].map((run) => path.resolve(`artifacts/ask-sales-faq-v5-10-final-gate/repeatability-run-${run}.json`));
  const outputPath = path.resolve("artifacts/ask-sales-faq-v5-10-final-gate/repeatability-analysis.json");
  const markdownPath = path.resolve("artifacts/ask-sales-faq-v5-10-final-gate/REPEATABILITY-REPORT.md");
  const raws = await Promise.all(inputs.map((input) => readFile(input, "utf8")));
  const reports = raws.map((raw) => object(JSON.parse(raw)));
  for (const [index, report] of reports.entries()) {
    if (text(report.status) !== "complete") throw new Error(`Run ${index + 1} is not complete`);
    if (!Array.isArray(report.systems) || !report.systems.includes("v510")) throw new Error(`Run ${index + 1} does not contain V5.10`);
  }
  const runMaps = reports.map((report) => new Map(flatten(report).map((item) => [text(item.id), item])));
  const ids = [...runMaps[0].keys()];
  if (ids.length !== 13 || runMaps.some((map) => map.size !== 13 || ids.some((id) => !map.has(id)))) {
    throw new Error("All three reports must contain the exact same 13 prompt IDs");
  }

  let laneFlipComparisons = 0;
  let decisionBoundaryFlipComparisons = 0;
  let exactAnswerFlipComparisons = 0;
  let sourceFlipComparisons = 0;
  const caseVariants = ids.map((id) => {
    const results = runMaps.map((map) => object(object(map.get(id)!.systems).v510));
    const lanes = results.map((result) => text(result.lane) || text(result.outcome));
    const decisions = results.map(decisionSignature);
    const sources = results.map((result) => JSON.stringify(strings(result.selectedPolicyIds).sort()));
    const answers = results.map((result) => normalizedAnswer(result.answer));
    for (let run = 1; run < results.length; run += 1) {
      if (lanes[run] !== lanes[0]) laneFlipComparisons += 1;
      if (decisions[run] !== decisions[0]) decisionBoundaryFlipComparisons += 1;
      if (sources[run] !== sources[0]) sourceFlipComparisons += 1;
      if (answers[run] !== answers[0]) exactAnswerFlipComparisons += 1;
    }
    const laneVariants = new Set(lanes).size;
    const decisionBoundaryVariants = new Set(decisions).size;
    const sourceVariants = new Set(sources).size;
    const exactAnswerVariants = new Set(answers).size;
    return {
      id,
      expectedDisposition: text(runMaps[0].get(id)!.expectedDisposition),
      laneVariants,
      decisionBoundaryVariants,
      sourceVariants,
      exactAnswerVariants,
      manualReviewRequired: decisionBoundaryVariants > 1 || sourceVariants > 1 || exactAnswerVariants > 1,
      lanes: [...new Set(lanes)],
      decisionBoundaries: [...new Set(decisions)].map((value) => JSON.parse(value)),
      sourceSets: [...new Set(sources)].map((value) => JSON.parse(value)),
      exactAnswers: [...new Set(results.map((result) => text(result.answer)))],
    };
  });
  const opportunities = (reports.length - 1) * ids.length;
  const aggregate = {
    runs: reports.length,
    prompts: ids.length,
    executions: reports.length * ids.length,
    comparisonOpportunities: opportunities,
    laneFlipComparisons,
    laneFlipRate: laneFlipComparisons / opportunities,
    decisionBoundaryFlipComparisons,
    decisionBoundaryFlipRate: decisionBoundaryFlipComparisons / opportunities,
    sourceFlipComparisons,
    sourceFlipRate: sourceFlipComparisons / opportunities,
    exactAnswerFlipComparisons,
    exactAnswerFlipRate: exactAnswerFlipComparisons / opportunities,
    casesRequiringManualReview: caseVariants.filter((item) => item.manualReviewRequired).length,
    preregisteredMaximumMaterialFlipRate: 0.05,
    passesAutomatedLaneFlipGate: laneFlipComparisons / opportunities <= 0.05,
    passesAutomatedDecisionBoundaryFlipGate: decisionBoundaryFlipComparisons / opportunities <= 0.05,
  };
  const result = {
    schemaVersion: "ask-sales-v5-10-repeatability-analysis-v1",
    status: "complete",
    generatedAt: new Date().toISOString(),
    inputs: inputs.map((input, index) => ({ path: path.relative(process.cwd(), input), sha256: sha256(raws[index]) })),
    methodology: {
      baseline: "Runs 2 and 3 are compared with run 1 on the exact same prompt ID.",
      potentialMaterialBoundary: "Lane, routing, numeric tokens, and permission/prohibition modality.",
      caution: "Exact-answer and source variation is surfaced for human inspection; it is not automatically labeled material.",
      promotionEvidence: true,
    },
    aggregate,
    caseVariants,
  };
  const rows = caseVariants.map((item) =>
    `| ${item.id} | ${item.laneVariants} | ${item.decisionBoundaryVariants} | ${item.sourceVariants} | ${item.exactAnswerVariants} | ${item.manualReviewRequired ? "yes" : "no"} |`,
  ).join("\n");
  const markdown = `# Ask Sales V5.10 repeatability report\n\nThree frozen V5.10 executions were compared on the preregistered 13-prompt repeatability subset. Lane/routing changes and changes to numeric or permission/prohibition language are treated as potential material flips.\n\n## Aggregate\n\n- Executions: ${aggregate.executions}\n- Comparison opportunities: ${aggregate.comparisonOpportunities}\n- Lane flips: ${aggregate.laneFlipComparisons} (${(aggregate.laneFlipRate * 100).toFixed(2)}%)\n- Decision-boundary flips: ${aggregate.decisionBoundaryFlipComparisons} (${(aggregate.decisionBoundaryFlipRate * 100).toFixed(2)}%)\n- Source flips: ${aggregate.sourceFlipComparisons} (${(aggregate.sourceFlipRate * 100).toFixed(2)}%)\n- Preregistered maximum: 5%\n- Automated lane gate: ${aggregate.passesAutomatedLaneFlipGate ? "pass" : "fail"}\n- Automated boundary gate: ${aggregate.passesAutomatedDecisionBoundaryFlipGate ? "pass" : "fail"}\n\n| Prompt | Lane variants | Boundary variants | Source variants | Answer variants | Manual review |\n| --- | ---: | ---: | ---: | ---: | --- |\n${rows}\n\nThis report does not override the manual source-only correctness audit.\n`;
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  await writeFile(markdownPath, markdown, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, markdownPath, aggregate }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
