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

function prompts(report: JsonRecord) {
  return (Array.isArray(report.conversations) ? report.conversations.map(object) : []).flatMap((conversation) =>
    (Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []).map((prompt) => ({
      id: text(conversation.id),
      question: text(prompt.question),
      goldNeeds: Array.isArray(prompt.goldNeeds) ? prompt.goldNeeds.map(object) : [],
      candidate: object(prompt.candidate),
    })),
  );
}

function lane(result: JsonRecord) {
  return text(result.lane) || text(result.outcome);
}

async function main() {
  const baselinePath = path.resolve(argument("baseline", "artifacts/ask-sales-faq-v5-5/prior-50-runtime-final-r5.json"));
  const candidatePath = path.resolve(argument("candidate", "artifacts/ask-sales-faq-v5-6-causal/retained-50-runtime.json"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-6-causal/retained-50-lane-comparison.json"));
  const [baselineRaw, candidateRaw] = await Promise.all([readFile(baselinePath, "utf8"), readFile(candidatePath, "utf8")]);
  const baseline = object(JSON.parse(baselineRaw));
  const candidate = object(JSON.parse(candidateRaw));
  if (text(baseline.status) !== "complete" || text(candidate.status) !== "complete") throw new Error("Both retained diagnostics must be complete");
  const baselineById = new Map(prompts(baseline).map((item) => [item.id, item]));
  const candidateItems = prompts(candidate);
  if (candidateItems.length !== 50 || baselineById.size !== 50 || candidateItems.some((item) => !baselineById.has(item.id))) {
    throw new Error("The V5.5 and V5.6 retained reports must contain the exact same 50 conversation IDs");
  }
  const items = candidateItems.map((current) => {
    const prior = baselineById.get(current.id)!;
    const priorLane = lane(prior.candidate);
    const currentLane = lane(current.candidate);
    const expectedDisposition = text(current.goldNeeds[0]?.expectedDisposition);
    return {
      id: current.id,
      question: current.question,
      expectedDisposition,
      expectedRouteKey: text(current.goldNeeds[0]?.expectedRouteKey) || null,
      goldContext: current.goldNeeds.flatMap((need) => Array.isArray(need.goldContext) ? need.goldContext : []),
      v55: { lane: priorLane, answer: text(prior.candidate.answer), selectedPolicyIds: prior.candidate.selectedPolicyIds || [] },
      v56: { lane: currentLane, answer: text(current.candidate.answer), selectedPolicyIds: current.candidate.selectedPolicyIds || [] },
      transition: `${priorLane}->${currentLane}`,
      expectedLaneRecovered: priorLane !== expectedDisposition && currentLane === expectedDisposition,
      expectedLaneRegressed: priorLane === expectedDisposition && currentLane !== expectedDisposition,
    };
  });
  const transitions = items.reduce<Record<string, number>>((counts, item) => {
    counts[item.transition] = (counts[item.transition] || 0) + 1;
    return counts;
  }, {});
  const result = {
    schemaVersion: "ask-sales-v5-6-retained-50-lane-comparison-v1",
    status: "complete",
    diagnosticOnly: true,
    promotionEvidence: false,
    warning: "Lane agreement is not answer correctness. Every changed answer must be compared with its verified source context before drawing a quality conclusion.",
    summary: {
      prompts: items.length,
      transitions,
      expectedLaneRecoveries: items.filter((item) => item.expectedLaneRecovered).length,
      expectedLaneRegressions: items.filter((item) => item.expectedLaneRegressed).length,
      changedLaneCases: items.filter((item) => item.transition.split("->")[0] !== item.transition.split("->")[1]).length,
    },
    changedItems: items.filter((item) => item.transition.split("->")[0] !== item.transition.split("->")[1]),
    items,
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, summary: result.summary }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
