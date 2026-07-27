import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";

type GoldItem = {
  id: string;
  question: string;
  expectedDisposition: "answer" | "route";
  expectedRouteKey?: string;
  goldAnswer: string;
  requiredConcepts: string[];
  forbiddenConcepts: string[];
  evaluationStrata: string[];
  sourceIds: string[];
  approvedBy: string[];
  knowledgePresence: "present_exact" | "present_route";
};

type Dataset = {
  name: string;
  status: string;
  runtimeFreezeCommit: string;
  preregistrationCommit: string;
  counts: { standaloneCases: number; conversations: number; conversationPrompts: number; totalPrompts: number; distinctSlackParentThreads: number };
  governance: { priorSourceIdOverlapAllowed: boolean; goldSealedBeforeRuntimeOutputs: boolean; candidateTuningAfterOutputInspection: boolean };
  repeatability: { caseIds: string[]; conversationIds: string[]; runs: number };
  cases: GoldItem[];
  conversations: Array<{ id: string; prompts: GoldItem[] }>;
};

const root = process.cwd();
const datasetPath = path.join(root, "tests/ask-sales-faq/v5-11-final-promotion-gold-2026-07-27.json");
const raw = readFileSync(datasetPath, "utf8");
const dataset = JSON.parse(raw) as Dataset;
const assert: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};
const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(absolute) : [absolute];
});

assert(dataset.status === "sealed_before_runtime_evaluation", "Gold set must be sealed before runtime evaluation");
assert(dataset.runtimeFreezeCommit === "9cf9419", "Unexpected V5.11 runtime freeze commit");
assert(dataset.preregistrationCommit === "9259707", "Unexpected V5.11 preregistration commit");
assert(dataset.governance.priorSourceIdOverlapAllowed === false, "Prior source overlap must be forbidden");
assert(dataset.governance.goldSealedBeforeRuntimeOutputs === true, "Gold must precede runtime outputs");
assert(dataset.governance.candidateTuningAfterOutputInspection === false, "Post-output tuning must be forbidden");
assert(dataset.cases.length === 18, "Expected 18 standalone cases");
assert(dataset.conversations.length === 3, "Expected three conversations");
const conversationPrompts = dataset.conversations.flatMap((conversation) => conversation.prompts);
const items = [...dataset.cases, ...conversationPrompts];
assert(conversationPrompts.length === 6 && items.length === 24, "Expected 24 total prompts including six conversation prompts");
assert(dataset.counts.standaloneCases === 18 && dataset.counts.conversations === 3 && dataset.counts.conversationPrompts === 6 && dataset.counts.totalPrompts === 24, "Declared counts do not match");
assert(new Set(items.map((item) => item.id)).size === items.length, "Prompt IDs must be unique");
assert(items.every((item) => item.question && item.goldAnswer && item.requiredConcepts.length && item.forbiddenConcepts.length && item.evaluationStrata.length && item.sourceIds.length && item.approvedBy.length), "Gold metadata is incomplete");
assert(items.filter((item) => item.expectedDisposition === "route").length >= 3, "At least three correct route controls are required");

const required: Record<string, number> = {
  liveActionAndOwnerRouting: 3,
  paymentsContractsAndOffers: 4,
  qualificationAndEligibility: 4,
  callBookingAndLeadHandling: 4,
  contentRightsPlatformsAndClaims: 4,
  postSaleAndFulfillment: 2,
  naturalFollowups: 2,
  correctAbstentionOrClarification: 1,
};
for (const [stratum, minimum] of Object.entries(required)) {
  assert(items.filter((item) => item.evaluationStrata.includes(stratum)).length >= minimum, `Stratum ${stratum} is below ${minimum}`);
}

const repeatPromptCount = dataset.repeatability.caseIds.length + dataset.repeatability.conversationIds.reduce((count, id) => {
  const conversation = dataset.conversations.find((item) => item.id === id);
  assert(conversation, `Unknown repeatability conversation ${id}`);
  return count + conversation.prompts.length;
}, 0);
assert(dataset.repeatability.runs === 3 && repeatPromptCount === 12, "Repeatability must be three runs over exactly 12 prompts");
assert(dataset.repeatability.caseIds.every((id) => dataset.cases.some((item) => item.id === id)), "Invalid repeatability case ID");

const selectedSources = [...new Set(items.flatMap((item) => item.sourceIds))].sort();
assert(selectedSources.length === 21 && dataset.counts.distinctSlackParentThreads === 21, "Expected 21 distinct parent Slack threads");
assert(selectedSources.every((id) => /^slack:C0AUQKNR8CF:\d+\.\d+$/.test(id)), "Only the approved Slack channel may supply final-gate sources");

const priorFiles = walk(path.join(root, "tests/ask-sales-faq")).filter((file) =>
  file.endsWith(".json") && path.resolve(file) !== path.resolve(datasetPath));
const priorText = priorFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const overlaps = selectedSources.filter((sourceId) => priorText.includes(sourceId));
assert(overlaps.length === 0, `Selected sources overlap prior gold or evaluation sets: ${overlaps.join(", ")}`);

const snapshotText = [
  "src/lib/ask-sales-faq/v4/systemic/generated-operational-qna.json",
  "src/lib/ask-sales-faq/v4/systemic/authority-resolutions.json",
  "src/lib/ask-sales-faq/generated/v3-policy-registry.json",
  "src/lib/ask-sales-faq/generated/policy-aware-rag-index.json",
].map((file) => readFileSync(path.join(root, file), "utf8")).join("\n");
const missingSources = selectedSources.filter((sourceId) => !snapshotText.includes(sourceId));
assert(missingSources.length === 0, `Frozen knowledge snapshot is missing sources: ${missingSources.join(", ")}`);

console.log(JSON.stringify({
  dataset: dataset.name,
  datasetSha256: createHash("sha256").update(raw).digest("hex"),
  prompts: items.length,
  distinctSlackParentThreads: selectedSources.length,
  priorSourceOverlaps: overlaps.length,
  repeatabilityPrompts: repeatPromptCount,
  routeControls: items.filter((item) => item.expectedDisposition === "route").length,
  strata: Object.fromEntries(Object.keys(required).map((key) => [key, items.filter((item) => item.evaluationStrata.includes(key)).length])),
}, null, 2));
