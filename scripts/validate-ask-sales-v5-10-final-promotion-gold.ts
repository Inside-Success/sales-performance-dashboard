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
  controllingPolicyIds: string[];
};

type Dataset = {
  name: string;
  status: string;
  runtimeFreezeCommit: string;
  preregistrationCommit: string;
  counts: { standaloneCases: number; conversations: number; conversationPrompts: number; totalPrompts: number };
  governance: { priorSourceIdOverlapAllowed: boolean; goldSealedBeforeRuntimeOutputs: boolean; candidateTuningAfterOutputInspection: boolean };
  repeatability: { caseIds: string[]; conversationIds: string[]; runs: number };
  cases: GoldItem[];
  conversations: Array<{ id: string; prompts: GoldItem[] }>;
};

const root = process.cwd();
const datasetPath = path.join(root, "tests/ask-sales-faq/v5-10-final-promotion-gold-2026-07-27.json");
const datasetRaw = readFileSync(datasetPath, "utf8");
const dataset = JSON.parse(datasetRaw) as Dataset;
const assert: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(absolute) : [absolute];
});

assert(dataset.status === "sealed_before_runtime_evaluation", "Gold set must be sealed before runtime evaluation");
assert(dataset.runtimeFreezeCommit === "ba7d2987f13aeffc6f754e91c9e476ec6d0a9b9e", "Unexpected V5.10 runtime freeze commit");
assert(dataset.preregistrationCommit === "f9752c5", "Unexpected V5.10 preregistration commit");
assert(dataset.governance.priorSourceIdOverlapAllowed === false, "Prior source overlap must be forbidden");
assert(dataset.governance.goldSealedBeforeRuntimeOutputs === true, "Gold must precede runtime outputs");
assert(dataset.governance.candidateTuningAfterOutputInspection === false, "Post-output tuning must be forbidden");
assert(dataset.cases.length === 14, "Expected exactly 14 standalone cases");
assert(dataset.conversations.length === 3, "Expected exactly three conversations");
const conversationPrompts = dataset.conversations.flatMap((conversation) => conversation.prompts);
assert(conversationPrompts.length === 6, "Expected exactly six conversation prompts");
const items = [...dataset.cases, ...conversationPrompts];
assert(items.length === 20, "Expected exactly 20 total prompts");
assert(dataset.counts.standaloneCases === 14 && dataset.counts.conversations === 3 && dataset.counts.conversationPrompts === 6 && dataset.counts.totalPrompts === 20, "Declared counts do not match the dataset");
assert(new Set(items.map((item) => item.id)).size === items.length, "Prompt IDs must be unique");
assert(new Set(dataset.conversations.map((item) => item.id)).size === dataset.conversations.length, "Conversation IDs must be unique");
assert(items.every((item) => item.question && item.goldAnswer && item.requiredConcepts.length && item.forbiddenConcepts.length && item.evaluationStrata.length && item.sourceIds.length && item.approvedBy.length && item.controllingPolicyIds.length), "Every item requires complete gold metadata");
assert(items.every((item) => item.knowledgePresence === "present_exact" || item.knowledgePresence === "present_route"), "Every primary item must map to exact answer or route knowledge");
assert(items.filter((item) => item.expectedDisposition === "route").length >= 3, "At least three passive action controls are required");
assert(items.filter((item) => item.evaluationStrata.some((stratum) => ["relationship", "qualifier", "referent", "scope", "exception"].includes(stratum))).length >= 6, "At least six relationship, qualifier, referent, scope, or exception challenges are required");
assert(items.filter((item) => item.evaluationStrata.includes("high-impact")).length >= 6, "At least six high-impact decisions are required");
assert(items.filter((item) => item.approvedBy.includes("Rich")).length >= 5, "At least five prompts must include Rich authority");
assert(dataset.repeatability.runs === 3, "Repeatability must use three runs");
assert(dataset.repeatability.caseIds.length === 7 && dataset.repeatability.caseIds.every((id) => dataset.cases.some((item) => item.id === id)), "Repeatability case IDs are invalid");
assert(dataset.repeatability.conversationIds.length === 3 && dataset.repeatability.conversationIds.every((id) => dataset.conversations.some((item) => item.id === id)), "Repeatability conversation IDs are invalid");

const selectedSources = [...new Set(items.flatMap((item) => item.sourceIds))].sort();
assert(selectedSources.length === 17, "Expected 17 unique parent source threads");
const priorFiles = [
  ...walk(path.join(root, "tests/ask-sales-faq")),
  ...readdirSync(path.join(root, "artifacts"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ask-sales-faq") && entry.name !== "ask-sales-faq-v5-10-final-gate")
    .flatMap((entry) => walk(path.join(root, "artifacts", entry.name))),
].filter((file) => /\.(?:json|md|ts)$/.test(file) &&
  path.resolve(file) !== path.resolve(datasetPath) &&
  path.resolve(file) !== path.resolve(root, "scripts/validate-ask-sales-v5-10-final-promotion-gold.ts"));
const priorText = priorFiles.map((file) => readFileSync(file, "utf8")).join("\n");
const overlaps = selectedSources.filter((sourceId) => priorText.includes(sourceId));
assert(overlaps.length === 0, `Selected source IDs overlap prior evaluations: ${overlaps.join(", ")}`);

const snapshotText = [
  "src/lib/ask-sales-faq/v4/systemic/generated-operational-qna.json",
  "src/lib/ask-sales-faq/v4/systemic/authority-resolutions.json",
  "src/lib/ask-sales-faq/generated/v3-policy-registry.json",
  "src/lib/ask-sales-faq/generated/policy-aware-rag-index.json",
].map((file) => readFileSync(path.join(root, file), "utf8")).join("\n");
const missingPolicies = [...new Set(items.flatMap((item) => item.controllingPolicyIds))].filter((policyId) => !snapshotText.includes(policyId));
assert(missingPolicies.length === 0, `Controlling policies are absent from the frozen snapshot: ${missingPolicies.join(", ")}`);
const missingParents = selectedSources.filter((sourceId) => !snapshotText.includes(sourceId));
assert(missingParents.length === 0, `Parent sources are absent from the frozen snapshot: ${missingParents.join(", ")}`);

console.log(JSON.stringify({
  dataset: dataset.name,
  datasetSha256: sha256(datasetRaw),
  cases: dataset.cases.length,
  conversations: dataset.conversations.length,
  prompts: items.length,
  actionControls: items.filter((item) => item.expectedDisposition === "route").length,
  richAuthorityPrompts: items.filter((item) => item.approvedBy.includes("Rich")).length,
  highImpact: items.filter((item) => item.evaluationStrata.includes("high-impact")).length,
  selectedSourceIds: selectedSources.length,
  priorSourceOverlaps: overlaps.length,
  knowledgePresence: {
    presentExact: items.filter((item) => item.knowledgePresence === "present_exact").length,
    presentRoute: items.filter((item) => item.knowledgePresence === "present_route").length,
  },
}, null, 2));
