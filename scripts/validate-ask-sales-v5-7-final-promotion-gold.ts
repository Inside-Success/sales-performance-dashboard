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
  knowledgePresence: "present_exact" | "present_compatible" | "missing_from_snapshot" | "governance_conflict";
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
const datasetPath = path.join(root, "tests/ask-sales-faq/v5-7-final-promotion-gold-2026-07-27.json");
const dataset = JSON.parse(readFileSync(datasetPath, "utf8")) as Dataset;
const assert: (value: unknown, message: string) => asserts value = (value, message) => {
  if (!value) throw new Error(message);
};
const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
const walk = (directory: string): string[] => readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
  const absolute = path.join(directory, entry.name);
  return entry.isDirectory() ? walk(absolute) : [absolute];
});

assert(dataset.status === "sealed_before_runtime_evaluation", "Gold set must be sealed before runtime evaluation");
assert(dataset.runtimeFreezeCommit === "5f7bf48b776734cd414daf948d0d109831069ea9", "Unexpected runtime freeze commit");
assert(dataset.preregistrationCommit === "2e18921bd1becb3abead83761e318caf616082e3", "Unexpected preregistration commit");
assert(dataset.governance.priorSourceIdOverlapAllowed === false, "Prior source overlap must be forbidden");
assert(dataset.governance.goldSealedBeforeRuntimeOutputs === true, "Gold must precede runtime outputs");
assert(dataset.governance.candidateTuningAfterOutputInspection === false, "Post-output tuning must be forbidden");
assert(dataset.cases.length === 18, "Expected exactly 18 standalone cases");
assert(dataset.conversations.length === 3, "Expected exactly three conversations");
const prompts = dataset.conversations.flatMap((conversation) => conversation.prompts);
assert(prompts.length === 6, "Expected exactly six conversation prompts");
const items = [...dataset.cases, ...prompts];
assert(items.length === 24, "Expected exactly 24 total prompts");
assert(dataset.counts.standaloneCases === 18 && dataset.counts.conversations === 3 && dataset.counts.conversationPrompts === 6 && dataset.counts.totalPrompts === 24, "Declared counts do not match the dataset");
assert(new Set(items.map((item) => item.id)).size === items.length, "Prompt IDs must be unique");
assert(new Set(dataset.conversations.map((item) => item.id)).size === dataset.conversations.length, "Conversation IDs must be unique");
assert(items.every((item) => item.question && item.goldAnswer && item.requiredConcepts.length && item.forbiddenConcepts.length && item.evaluationStrata.length && item.approvedBy.length), "Every item requires complete gold metadata");
assert(items.every((item) => item.sourceIds.length >= 2), "Every item must contain a parent and authoritative reply source ID");
assert(items.every((item) => item.knowledgePresence === "present_exact" && item.controllingPolicyIds.length), "Every primary item must have exact frozen knowledge and a controlling policy ID");
assert(items.filter((item) => item.expectedDisposition === "route").length >= 4, "At least four passive action controls are required");
assert(items.filter((item) => item.evaluationStrata.includes("relationship") || item.evaluationStrata.includes("conditional") || item.evaluationStrata.includes("referent") || item.evaluationStrata.includes("scope")).length >= 6, "At least six relationship, qualifier, referent, or scope challenges are required");
assert(items.filter((item) => item.evaluationStrata.includes("high-impact") || item.evaluationStrata.includes("wrong-owner-risk")).length >= 6, "At least six high-impact decisions are required");
assert(dataset.repeatability.runs === 3, "Repeatability must use three runs");
assert(dataset.repeatability.caseIds.length === 7 && dataset.repeatability.caseIds.every((id) => dataset.cases.some((item) => item.id === id)), "Repeatability case IDs are invalid");
assert(dataset.repeatability.conversationIds.length === 3 && dataset.repeatability.conversationIds.every((id) => dataset.conversations.some((item) => item.id === id)), "Repeatability conversation IDs are invalid");

const selectedSources = [...new Set(items.flatMap((item) => item.sourceIds))].sort();
const selectedSourceSet = new Set(selectedSources);
const priorFiles = [
  ...walk(path.join(root, "tests/ask-sales-faq")),
  ...readdirSync(path.join(root, "artifacts"), { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && entry.name.startsWith("ask-sales-faq") && entry.name !== "ask-sales-faq-v5-7-final-gate")
    .flatMap((entry) => walk(path.join(root, "artifacts", entry.name))),
].filter((file) => /\.(?:json|md|ts)$/.test(file) && path.resolve(file) !== path.resolve(datasetPath));
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
const parentSources = [...selectedSourceSet].filter((sourceId) => items.some((item) => item.sourceIds[0] === sourceId));
const missingParents = parentSources.filter((sourceId) => !snapshotText.includes(sourceId));
assert(missingParents.length === 0, `Parent sources are absent from the frozen snapshot: ${missingParents.join(", ")}`);

console.log(JSON.stringify({
  dataset: dataset.name,
  datasetSha256: sha256(readFileSync(datasetPath, "utf8")),
  cases: dataset.cases.length,
  conversations: dataset.conversations.length,
  prompts: items.length,
  actionControls: items.filter((item) => item.expectedDisposition === "route").length,
  highImpact: items.filter((item) => item.evaluationStrata.includes("high-impact") || item.evaluationStrata.includes("wrong-owner-risk")).length,
  selectedSourceIds: selectedSources.length,
  priorSourceOverlaps: overlaps.length,
  knowledgePresence: { present_exact: items.length },
}, null, 2));
