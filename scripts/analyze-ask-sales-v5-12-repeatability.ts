import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Json = Record<string, unknown>;
const object = (value: unknown): Json => value && typeof value === "object" ? value as Json : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const normalize = (value: unknown) => text(value).toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
const flatten = (report: Json) => [
  ...(Array.isArray(report.cases) ? report.cases.map(object) : []),
  ...(Array.isArray(report.conversations) ? report.conversations.map(object).flatMap((conversation) =>
    Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
];

function boundary(result: Json) {
  const answer = normalize(result.answer);
  const numbers = [...answer.matchAll(/(?:\$\s*)?\d[\d,.]*(?:\s*(?:%|percent|hours?|days?|weeks?|months?|years?))?/g)]
    .map((match) => match[0].replace(/\s+/g, "")).sort();
  const modalities = [
    /\b(?:do not|don't|must not|cannot|can't|not allowed|never)\b/g,
    /\b(?:must|required|have to|only)\b/g,
    /\b(?:may|can|allowed|permitted)\b/g,
  ].flatMap((pattern) => [...answer.matchAll(pattern)].map((match) => match[0])).sort();
  return JSON.stringify({
    lane: text(result.lane) || text(result.outcome),
    needsRoute: result.needsRoute === true,
    routeChannels: strings(result.routeChannels).sort(),
    numbers,
    modalities,
  });
}

async function main() {
  const directory = path.resolve("artifacts/ask-sales-faq-v5-12-regression");
  const inputs = [1, 2, 3].map((run) => path.join(directory, `repeatability-run-${run}.json`));
  const raws = await Promise.all(inputs.map((input) => readFile(input, "utf8")));
  const maps = raws.map((raw) => new Map(flatten(object(JSON.parse(raw))).map((item) => [text(item.id), item])));
  const ids = [...maps[0].keys()];
  if (!ids.length || maps.some((map) => map.size !== ids.length || ids.some((id) => !map.has(id)))) {
    throw new Error("Repeatability reports must contain the same non-empty prompt set");
  }
  const totals = { lane: 0, boundary: 0, source: 0, answer: 0 };
  const cases = ids.map((id) => {
    const results = maps.map((map) => object(object(map.get(id)!.systems).v512));
    const variants = {
      lane: results.map((result) => text(result.lane) || text(result.outcome)),
      boundary: results.map(boundary),
      source: results.map((result) => JSON.stringify(strings(result.selectedPolicyIds).sort())),
      answer: results.map((result) => normalize(result.answer)),
    };
    for (let index = 1; index < results.length; index += 1) {
      if (variants.lane[index] !== variants.lane[0]) totals.lane += 1;
      if (variants.boundary[index] !== variants.boundary[0]) totals.boundary += 1;
      if (variants.source[index] !== variants.source[0]) totals.source += 1;
      if (variants.answer[index] !== variants.answer[0]) totals.answer += 1;
    }
    return { id, laneVariants: new Set(variants.lane).size, boundaryVariants: new Set(variants.boundary).size, sourceVariants: new Set(variants.source).size, answerVariants: new Set(variants.answer).size };
  });
  const opportunities = ids.length * (maps.length - 1);
  const aggregate = {
    runs: maps.length,
    prompts: ids.length,
    executions: ids.length * maps.length,
    comparisonOpportunities: opportunities,
    laneFlipComparisons: totals.lane,
    laneFlipRate: totals.lane / opportunities,
    decisionBoundaryFlipComparisons: totals.boundary,
    decisionBoundaryFlipRate: totals.boundary / opportunities,
    sourceFlipComparisons: totals.source,
    sourceFlipRate: totals.source / opportunities,
    exactAnswerFlipComparisons: totals.answer,
    exactAnswerFlipRate: totals.answer / opportunities,
    passesLaneGate: totals.lane / opportunities <= 0.05,
    passesBoundaryGate: totals.boundary / opportunities <= 0.05,
  };
  const result = {
    schemaVersion: "ask-sales-v5-12-repeatability-v1",
    status: "complete",
    generatedAt: new Date().toISOString(),
    inputs: inputs.map((input, index) => ({ path: path.relative(process.cwd(), input), sha256: createHash("sha256").update(raws[index]).digest("hex") })),
    aggregate,
    cases,
  };
  await writeFile(path.join(directory, "repeatability-analysis.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(aggregate, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
