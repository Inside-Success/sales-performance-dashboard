import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type RecordValue = Record<string, unknown>;
const object = (value: unknown): RecordValue => value && typeof value === "object" ? value as RecordValue : {};
const text = (value: unknown) => typeof value === "string" ? value : "";
const strings = (value: unknown) => Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
const flatten = (report: RecordValue) => [
  ...(Array.isArray(report.cases) ? report.cases.map(object) : []),
  ...(Array.isArray(report.conversations) ? report.conversations.map(object).flatMap((conversation) =>
    Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
];
const normalize = (value: unknown) => text(value).toLowerCase().replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
const boundary = (result: RecordValue) => {
  const answer = normalize(result.answer);
  const numbers = [...answer.matchAll(/(?:\$\s*)?\d[\d,.]*(?:\s*(?:%|percent|hours?|days?|weeks?|months?|years?))?/g)].map((match) => match[0].replace(/\s+/g, "")).sort();
  const modalities = [
    /\b(?:do not|don't|must not|cannot|can't|not allowed|never)\b/g,
    /\b(?:must|required|have to|only)\b/g,
    /\b(?:may|can|allowed|permitted)\b/g,
  ].flatMap((pattern) => [...answer.matchAll(pattern)].map((match) => match[0])).sort();
  return JSON.stringify({ lane: text(result.lane) || text(result.outcome), needsRoute: result.needsRoute === true, routeChannels: strings(result.routeChannels).sort(), numbers, modalities });
};

async function main() {
  const inputs = [1, 2, 3].map((run) => path.resolve(`artifacts/ask-sales-faq-v5-11-final-gate/repeatability-run-${run}.json`));
  const raws = await Promise.all(inputs.map((input) => readFile(input, "utf8")));
  const reports = raws.map((raw) => object(JSON.parse(raw)));
  const maps = reports.map((report) => new Map(flatten(report).map((item) => [text(item.id), item])));
  const ids = [...maps[0].keys()];
  if (ids.length !== 12 || maps.some((map) => map.size !== 12 || ids.some((id) => !map.has(id)))) throw new Error("Repeatability reports must contain the same 12 prompts");
  let laneFlips = 0;
  let boundaryFlips = 0;
  let sourceFlips = 0;
  let answerFlips = 0;
  const cases = ids.map((id) => {
    const results = maps.map((map) => object(object(map.get(id)!.systems).v511));
    const lanes = results.map((result) => text(result.lane) || text(result.outcome));
    const boundaries = results.map(boundary);
    const sources = results.map((result) => JSON.stringify(strings(result.selectedPolicyIds).sort()));
    const answers = results.map((result) => normalize(result.answer));
    for (let index = 1; index < results.length; index += 1) {
      if (lanes[index] !== lanes[0]) laneFlips += 1;
      if (boundaries[index] !== boundaries[0]) boundaryFlips += 1;
      if (sources[index] !== sources[0]) sourceFlips += 1;
      if (answers[index] !== answers[0]) answerFlips += 1;
    }
    return { id, laneVariants: new Set(lanes).size, boundaryVariants: new Set(boundaries).size, sourceVariants: new Set(sources).size, answerVariants: new Set(answers).size };
  });
  const opportunities = ids.length * 2;
  const aggregate = {
    runs: 3,
    prompts: ids.length,
    executions: ids.length * 3,
    comparisonOpportunities: opportunities,
    laneFlipComparisons: laneFlips,
    laneFlipRate: laneFlips / opportunities,
    decisionBoundaryFlipComparisons: boundaryFlips,
    decisionBoundaryFlipRate: boundaryFlips / opportunities,
    sourceFlipComparisons: sourceFlips,
    sourceFlipRate: sourceFlips / opportunities,
    exactAnswerFlipComparisons: answerFlips,
    exactAnswerFlipRate: answerFlips / opportunities,
    passesLaneGate: laneFlips / opportunities <= 0.05,
    passesBoundaryGate: boundaryFlips / opportunities <= 0.05,
  };
  const result = {
    schemaVersion: "ask-sales-v5-11-repeatability-v1",
    status: "complete",
    generatedAt: new Date().toISOString(),
    inputs: inputs.map((input, index) => ({ path: path.relative(process.cwd(), input), sha256: createHash("sha256").update(raws[index]).digest("hex") })),
    aggregate,
    cases,
  };
  await writeFile(path.resolve("artifacts/ask-sales-faq-v5-11-final-gate/repeatability-analysis.json"), `${JSON.stringify(result, null, 2)}\n`, "utf8");
  console.log(JSON.stringify(aggregate, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
