import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

type GoldItem = { id: string; sourceIds?: string[]; goldAnswer?: string };
type Dataset = {
  schemaVersion: number;
  status: string;
  runtimeFreezeCommit: string;
  supersedesInvalidRun?: Record<string, unknown>;
  promotionGate: Record<string, unknown>;
  reviewDesign: Record<string, unknown>;
  repeatability: { caseIds: string[]; conversationIds: string[] };
  cases: GoldItem[];
  conversations: Array<{ id: string; prompts: GoldItem[] }>;
};

const defaultDataset = "tests/ask-sales-faq/v5-5-blind-human-gold-2026-07-26.json";
const gateArtifactDirectory = path.resolve("artifacts/ask-sales-faq-v5-5-blind-gate");
const slackSourcePattern = /slack:C0AUQKNR8CF:\d{10}\.\d+/g;
const exactSlackSourcePattern = /^slack:C0AUQKNR8CF:\d{10}\.\d+$/;

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

async function priorSlackSources(datasetPath: string) {
  const roots = [path.resolve("tests/ask-sales-faq"), path.resolve("artifacts")];
  const files = (await Promise.all(roots.map(filesBelow))).flat().filter((file) =>
    file !== datasetPath && !file.startsWith(`${gateArtifactDirectory}${path.sep}`),
  );
  const sources = new Set<string>();
  for (const file of files) {
    if (!/\.(?:json|md)$/.test(file)) continue;
    const contents = await readFile(file, "utf8");
    for (const sourceId of contents.match(slackSourcePattern) || []) sources.add(sourceId);
  }
  return [...sources].sort();
}

async function main() {
  const datasetPath = path.resolve(argument("dataset", defaultDataset));
  const raw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(raw) as Dataset;
  assert(dataset.schemaVersion === 4, "Blind gate must use provider-corrected schemaVersion 4");
  assert(dataset.status === "sealed_for_provider_corrected_evaluation", "Dataset must be sealed before any corrected provider output is generated");
  assert(Boolean(dataset.supersedesInvalidRun), "Corrected dataset must identify the invalid run it supersedes");
  assert(/^[0-9a-f]{40}$/.test(dataset.runtimeFreezeCommit), "Runtime freeze must be a full Git commit");
  assert(dataset.cases.length === 14, "Blind gate must contain exactly 14 standalone cases");
  assert(dataset.conversations.length === 3, "Blind gate must contain exactly three conversations");
  const conversationPrompts = dataset.conversations.flatMap((conversation) => conversation.prompts);
  assert(conversationPrompts.length === 6, "Blind gate must contain exactly six conversation prompts");
  const items = [...dataset.cases, ...conversationPrompts];
  assert(items.length === 20, "Blind gate must contain exactly 20 prompts");
  const itemIds = items.map((item) => item.id);
  assert(itemIds.every(Boolean) && new Set(itemIds).size === 20, "All prompt IDs must be present and unique");
  assert(new Set(dataset.conversations.map((item) => item.id)).size === 3, "Conversation IDs must be unique");
  assert(dataset.promotionGate.minimumPairwiseNetWinsOverV3 === 4, "Meaningful pairwise lead must remain four net wins");
  assert(dataset.promotionGate.maximumV55CriticalErrors === 0, "V5.5 critical-error ceiling must remain zero");
  assert(dataset.promotionGate.maximumV55WrongActionOwners === 0, "V5.5 wrong-owner ceiling must remain zero");
  assert(dataset.reviewDesign.itemsPerBatch === 5, "Human review batches must remain five items or fewer");
  assert(dataset.repeatability.caseIds.length === 5 && dataset.repeatability.conversationIds.length === 2, "Repeatability subset must remain preregistered");

  const sources = items.flatMap((item) => item.sourceIds || []);
  const slackParents = sources
    .filter((sourceId) => exactSlackSourcePattern.test(sourceId));
  assert(slackParents.length >= 30, "Slack-backed gold must retain substantial question and authoritative reply lineage");
  assert(sources.some((sourceId) => sourceId.startsWith("transcript:GMT20260707-135929:")), "Doctor gold must retain Mike/Rich transcript lineage");
  assert(sources.some((sourceId) => sourceId.startsWith("active-video:1FMWLYoZXQdBxu0Y0RLNl4mamepeOSaBx:")), "Pricing gold must retain active Call 2 video lineage");
  const doctor = items.find((item) => item.id === "best-doctors-own-practice");
  assert(/hospital-employed doctor can qualify|doctor can be considered/i.test(doctor?.goldAnswer || ""), "Doctor gold must not revive the superseded practice-ownership rule");
  assert(/nurse does not qualify as a doctor/i.test(doctor?.goldAnswer || ""), "Doctor gold must preserve the doctor/nurse boundary");
  const pricing = items.find((item) => item.id === "call2-baseline-quote-sequence");
  assert(/start with the main \$20,000 Standard package/i.test(pricing?.goldAnswer || ""), "Call 2 gold must preserve the $20K-first pitch sequence");
  assert(/Do not present all three prices at once/i.test(pricing?.goldAnswer || ""), "Call 2 gold must preserve the one-option-at-a-time boundary");
  const prior = new Set(await priorSlackSources(datasetPath));
  const overlaps = [...new Set(slackParents.filter((sourceId) => prior.has(sourceId)))];
  assert(overlaps.length === 0, `Blind gate leaked prior evaluation Slack sources: ${overlaps.join(", ")}`);

  process.stdout.write(`${JSON.stringify({
    datasetPath,
    datasetSha256: sha256(raw),
    runtimeFreezeCommit: dataset.runtimeFreezeCommit,
    standaloneCases: dataset.cases.length,
    conversations: dataset.conversations.length,
    totalPrompts: items.length,
    priorEvaluationSlackSourcesChecked: prior.size,
    overlapCount: overlaps.length,
    status: "valid_pre_runtime_seal",
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
