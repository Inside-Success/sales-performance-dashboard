import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type GoldItem = {
  id: string;
  sourceIds?: string[];
};

type Conversation = {
  id: string;
  prompts: GoldItem[];
};

type Dataset = {
  schemaVersion: number;
  status: string;
  runtimeFreezeCommit: string;
  priorEvaluationSourceIdsSha256: string;
  promotionGate?: Record<string, unknown>;
  repeatability?: {
    independentCaseIds?: string[];
    conversationIds?: string[];
  };
  cases: GoldItem[];
  conversations: Conversation[];
};

const defaultDataset = "tests/ask-sales-faq/v5-3-independent-slack-gold-2026-07-25.json";
const newArtifactDirectory = path.resolve("artifacts/ask-sales-faq-v5-3-independent-gate");
const slackSourcePattern = /slack:C0AUQKNR8CF:\d{10}\.\d+/g;

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function filesBelow(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return filesBelow(fullPath);
    return entry.isFile() ? [fullPath] : [];
  }));
  return nested.flat();
}

async function priorEvaluationSourceIds(datasetPath: string) {
  const roots = [path.resolve("tests/ask-sales-faq"), path.resolve("artifacts")];
  const files = (await Promise.all(roots.map(filesBelow))).flat().filter((file) =>
    file !== datasetPath && !file.startsWith(`${newArtifactDirectory}${path.sep}`),
  );
  const sources = new Set<string>();
  for (const file of files) {
    const contents = await readFile(file, "utf8");
    for (const sourceId of contents.match(slackSourcePattern) || []) sources.add(sourceId);
  }
  return [...sources].sort();
}

async function main() {
  const datasetPath = path.resolve(argument("dataset", defaultDataset));
  const datasetRaw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(datasetRaw) as Dataset;
  assert(dataset.schemaVersion === 2, "Independent gate dataset must use schemaVersion 2");
  assert(dataset.status === "sealed_before_runtime_evaluation", "Independent gate dataset must be sealed before runtime evaluation");
  assert(/^[0-9a-f]{40}$/.test(dataset.runtimeFreezeCommit), "Runtime freeze commit must be a full Git commit");
  assert(Array.isArray(dataset.cases) && dataset.cases.length === 30, "Independent gate must contain exactly 30 standalone cases");
  assert(Array.isArray(dataset.conversations) && dataset.conversations.length === 6, "Independent gate must contain exactly 6 conversations");
  const prompts = dataset.conversations.flatMap((conversation) => conversation.prompts || []);
  assert(prompts.length === 13, "Independent gate must contain exactly 13 conversation prompts");
  const items = [...dataset.cases, ...prompts];
  const ids = items.map((item) => item.id);
  assert(ids.every(Boolean) && new Set(ids).size === 43, "All 43 evaluation prompt IDs must be present and unique");
  assert(dataset.cases.every((item) => (item.sourceIds || []).length >= 2), "Every standalone case must contain the Slack question and reliable threaded reply source IDs");
  assert(dataset.promotionGate?.minimumWeightedUtilityLeadOverV3 === 0.1, "The preregistered V5 lead over V3 must remain 10 percentage points");
  assert(dataset.promotionGate?.maximumV5CriticalErrors === 0, "The preregistered V5 critical-error ceiling must remain zero");
  assert(dataset.promotionGate?.maximumV5WrongActionOwners === 0, "The preregistered V5 wrong-owner ceiling must remain zero");

  const repeatabilityCaseIds = dataset.repeatability?.independentCaseIds || [];
  const repeatabilityConversationIds = dataset.repeatability?.conversationIds || [];
  const caseIds = new Set(dataset.cases.map((item) => item.id));
  const conversationIds = new Set(dataset.conversations.map((item) => item.id));
  assert(repeatabilityCaseIds.length === 7 && repeatabilityCaseIds.every((id) => caseIds.has(id)), "Repeatability must contain the preregistered seven standalone cases");
  assert(repeatabilityConversationIds.length === 6 && repeatabilityConversationIds.every((id) => conversationIds.has(id)), "Repeatability must contain all six preregistered conversations");

  const priorSourceIds = await priorEvaluationSourceIds(datasetPath);
  const priorSourceText = `${priorSourceIds.map((sourceId) => sourceId.split(":").at(-1)).join("\n")}\n`;
  const priorSourceHash = sha256(priorSourceText);
  assert(priorSourceIds.length === 147, `Expected 147 prior evaluation source IDs, found ${priorSourceIds.length}`);
  assert(priorSourceHash === dataset.priorEvaluationSourceIdsSha256, "Prior evaluation source manifest hash no longer matches the sealed dataset");
  const selectedSourceIds = [...new Set(items.flatMap((item) => item.sourceIds || []))].sort();
  const priorSourceSet = new Set(priorSourceIds);
  const overlap = selectedSourceIds.filter((sourceId) => priorSourceSet.has(sourceId));
  assert(overlap.length === 0, `Independent gate source IDs overlap prior evaluation material: ${overlap.join(", ")}`);

  process.stdout.write(`${JSON.stringify({
    status: "valid",
    datasetPath,
    datasetSha256: sha256(datasetRaw),
    runtimeFreezeCommit: dataset.runtimeFreezeCommit,
    independentCases: dataset.cases.length,
    conversations: dataset.conversations.length,
    conversationPrompts: prompts.length,
    totalPrompts: items.length,
    selectedUniqueSlackSourceIds: selectedSourceIds.length,
    priorEvaluationSourceIds: priorSourceIds.length,
    priorEvaluationSourceIdsSha256: priorSourceHash,
    priorSourceOverlap: overlap.length,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
