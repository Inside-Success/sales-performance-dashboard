import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";
import { generateV4Json } from "@/lib/ask-sales-faq/v4/provider";
import { runAskSalesFaqV4 } from "@/lib/ask-sales-faq/v4/runtime";
import { runAskSalesFaqV4Systemic } from "@/lib/ask-sales-faq/v4/systemic/runtime";

type RawPrompt = string | {
  question: string;
  independent?: boolean;
  context?: AskSalesFaqChatMessage[];
  messages?: AskSalesFaqChatMessage[];
  v4Context?: AskSalesFaqChatMessage[];
  goldNeeds?: unknown[];
  evaluationStrata?: string[];
  [key: string]: unknown;
};
type RawDataset = {
  name?: string;
  conversations: Array<{ id: string; title?: string; prompts: RawPrompt[] }>;
};
type ReferenceItem = {
  caseId?: string;
  id?: string;
  run?: number;
  question?: string;
  v3?: Record<string, unknown>;
  v4?: Record<string, unknown>;
  reference?: { v3?: Record<string, unknown> | null; currentV4?: Record<string, unknown> | null };
};
type ReferenceArtifact = { runId?: string; manifest?: Record<string, unknown>; items?: ReferenceItem[] };
type CandidateItem = {
  id: string;
  conversationId: string;
  promptIndex: number;
  question: string;
  independent: boolean;
  inputContext: AskSalesFaqChatMessage[];
  goldNeeds: unknown[];
  evaluationStrata: string[];
  reference: { v3: Record<string, unknown> | null; currentV4: Record<string, unknown> | null };
  systemic: Awaited<ReturnType<typeof runAskSalesFaqV4Systemic>>;
};
type Report = {
  schemaVersion: 1;
  status: "running" | "complete";
  datasetPath: string;
  datasetSha256: string;
  referencePath: string | null;
  referenceSha256: string | null;
  referenceRun: number;
  liveReferences: boolean;
  skipChampionComparison: boolean;
  expectedCases: number;
  items: CandidateItem[];
  summary: Record<string, unknown>;
};

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function messages(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.flatMap((message) => {
    if (!message || typeof message !== "object") return [];
    const item = message as Record<string, unknown>;
    if ((item.role !== "user" && item.role !== "assistant") || typeof item.content !== "string") return [];
    return [{ role: item.role, content: item.content.trim() } satisfies AskSalesFaqChatMessage];
  }).filter((message) => message.content).slice(-10);
}

function prompt(value: RawPrompt) {
  if (typeof value === "string") return {
    question: value.trim(), independent: false, context: [] as AskSalesFaqChatMessage[], goldNeeds: [] as unknown[], evaluationStrata: [] as string[],
  };
  return {
    question: String(value.question || "").trim(),
    independent: value.independent === true,
    context: messages(value.v4Context || value.context || value.messages),
    goldNeeds: Array.isArray(value.goldNeeds) ? value.goldNeeds : [],
    evaluationStrata: Array.isArray(value.evaluationStrata) ? value.evaluationStrata.map(String) : [],
  };
}

function percentile(values: number[], ratio: number) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * ratio) - 1))];
}

function countBy(values: string[]) {
  return Object.fromEntries([...new Set(values)].sort().map((value) => [value, values.filter((candidate) => candidate === value).length]));
}

function lane(value: Record<string, unknown> | null) {
  return String(value?.lane || value?.outcome || "unknown");
}

function hasHelp(value: string) {
  return value === "answer" || value === "partial" || value.startsWith("answer_from_");
}

function summary(items: CandidateItem[]) {
  const systemicLanes = items.map((item) => item.systemic.lane);
  const baselineLanes = items.map((item) => lane(item.reference.currentV4));
  const providerAttempts = items.flatMap((item) => item.systemic.runtimeMetadata.providerAttempts);
  return {
    cases: items.length,
    systemicLanes: countBy(systemicLanes),
    currentV4ReferenceLanes: countBy(baselineLanes),
    systemicFallbacks: items.filter((item) => item.systemic.runtimeMetadata.executionMode.planning === "systemic_fallback").length,
    operationalEvidenceSelections: items.filter((item) => item.systemic.citations.some((citation) => citation.sourceKind === "authoritative_slack_operational_qna")).length,
    curatedAuthoritySelections: items.filter((item) => item.systemic.citations.some((citation) =>
      citation.sourceKind === "authoritative_meeting_decision" ||
      citation.sourceKind === "authoritative_slack_screenshot" ||
      citation.sourceKind === "authoritative_answer_approval_screenshot"
    )).length,
    providerAttempts: {
      successful: providerAttempts.filter((attempt) => attempt.status === "success").length,
      failed: providerAttempts.filter((attempt) => attempt.status === "failed").length,
    },
    latencyMs: {
      p50: percentile(items.map((item) => item.systemic.latencyMs), 0.5),
      p95: percentile(items.map((item) => item.systemic.latencyMs), 0.95),
    },
    laneOnlyComparison: {
      moreHelpfulThanCurrentV4Route: items.filter((item) => hasHelp(item.systemic.lane) && !hasHelp(lane(item.reference.currentV4))).length,
      lessHelpfulThanCurrentV4Answer: items.filter((item) => !hasHelp(item.systemic.lane) && hasHelp(lane(item.reference.currentV4))).length,
      note: "Lane movement is not correctness; source-backed judging is required.",
    },
  };
}

const datasetPath = resolve(argument("dataset", "tests/ask-sales-faq/v3-regression-78.json"));
const referencePath = argument("reference") ? resolve(argument("reference")) : null;
const referenceRun = Math.max(1, Number.parseInt(argument("reference-run", "1"), 10) || 1);
const liveReferences = argument("live-references", "false") === "true";
const skipChampionComparison = argument("skip-champion-comparison", "false") === "true";
if (liveReferences && referencePath) throw new Error("use either --reference or --live-references=true, not both");
const outputPath = resolve(argument("output", "artifacts/ask-sales-faq-v4-systemic/candidate-benchmark.json"));
const concurrency = Math.max(1, Math.min(8, Number.parseInt(argument("concurrency", "4"), 10) || 4));
const datasetRaw = readFileSync(datasetPath, "utf8");
const dataset = JSON.parse(datasetRaw) as RawDataset;
if (!Array.isArray(dataset.conversations)) throw new Error("dataset conversations are missing");
const referenceRaw = referencePath ? readFileSync(referencePath, "utf8") : null;
const reference = referenceRaw ? JSON.parse(referenceRaw) as ReferenceArtifact : null;
const referenceByCase = new Map((reference?.items || []).flatMap((item) => {
  if (item.id && item.reference) return [[item.id, {
    v3: item.reference.v3 || undefined,
    v4: item.reference.currentV4 || undefined,
  } satisfies Pick<ReferenceItem, "v3" | "v4">] as const];
  if (item.caseId && item.run === referenceRun) return [[item.caseId, item] as const];
  return [];
}));
const expectedCases = dataset.conversations.reduce((total, conversation) => total + conversation.prompts.length, 0);
const datasetSha256 = sha(datasetRaw);
const referenceSha256 = referenceRaw ? sha(referenceRaw) : null;
let items: CandidateItem[] = [];
if (existsSync(outputPath)) {
  const existing = JSON.parse(readFileSync(outputPath, "utf8")) as Report;
  if (
    existing.datasetSha256 !== datasetSha256 ||
    existing.referenceSha256 !== referenceSha256 ||
    existing.referenceRun !== referenceRun ||
    existing.liveReferences !== liveReferences ||
    (existing.skipChampionComparison || false) !== skipChampionComparison
  ) {
    throw new Error("existing candidate benchmark does not match the requested dataset and reference");
  }
  if (existing.status === "complete") throw new Error("complete candidate benchmark is immutable");
  items = existing.items;
}
const byId = new Map(items.map((item) => [item.id, item]));
mkdirSync(dirname(outputPath), { recursive: true });

function save(status: Report["status"]) {
  const ordered = [...byId.values()].sort((left, right) => left.conversationId.localeCompare(right.conversationId) || left.promptIndex - right.promptIndex);
  const report: Report = {
    schemaVersion: 1,
    status,
    datasetPath,
    datasetSha256,
    referencePath,
    referenceSha256,
    referenceRun,
    liveReferences,
    skipChampionComparison,
    expectedCases,
    items: ordered,
    summary: summary(ordered),
  };
  writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
}

let conversationCursor = 0;
async function worker() {
  while (conversationCursor < dataset.conversations.length) {
    const conversation = dataset.conversations[conversationCursor];
    conversationCursor += 1;
    let history: AskSalesFaqChatMessage[] = [];
    for (let index = 0; index < conversation.prompts.length; index += 1) {
      const entry = prompt(conversation.prompts[index]);
      if (!entry.question) throw new Error(`empty question at ${conversation.id}/${index + 1}`);
      const id = `${conversation.id}-${index + 1}`;
      const existing = byId.get(id);
      if (existing) {
        if (!entry.independent) history = [...existing.inputContext.filter((message) => !(message.role === "user" && message.content === entry.question)), { role: "user" as const, content: entry.question }, { role: "assistant" as const, content: existing.systemic.answer }].slice(-10);
        continue;
      }
      const baseContext = entry.context.length ? entry.context : entry.independent ? [] : history;
      const inputContext = [...baseContext.filter((message) => !(message.role === "user" && message.content === entry.question)), { role: "user" as const, content: entry.question }].slice(-10);
      const referenceItem = referenceByCase.get(id);
      if (liveReferences && !entry.independent) throw new Error("live three-way references are restricted to independent prompts so system histories cannot be mixed");
      const [systemic, liveCurrentV4, liveV3] = liveReferences
        ? await Promise.all([
          runAskSalesFaqV4Systemic(entry.question, inputContext, { skipChampionComparison }),
          runAskSalesFaqV4(entry.question, inputContext),
          runAskSalesFaqV3(entry.question, inputContext, { provider: generateV4Json, validatorProvider: generateV4Json }),
        ])
        : [await runAskSalesFaqV4Systemic(entry.question, inputContext, { skipChampionComparison }), null, null];
      byId.set(id, {
        id,
        conversationId: conversation.id,
        promptIndex: index + 1,
        question: entry.question,
        independent: entry.independent,
        inputContext,
        goldNeeds: entry.goldNeeds,
        evaluationStrata: entry.evaluationStrata,
        reference: {
          v3: liveV3 ? JSON.parse(JSON.stringify(liveV3)) as Record<string, unknown> : referenceItem?.v3 || null,
          currentV4: liveCurrentV4 ? JSON.parse(JSON.stringify(liveCurrentV4)) as Record<string, unknown> : referenceItem?.v4 || null,
        },
        systemic,
      });
      save("running");
      process.stdout.write(`${JSON.stringify({ completed: byId.size, expectedCases, id, lane: systemic.lane, planning: systemic.runtimeMetadata.executionMode.planning })}\n`);
      if (!entry.independent) history = [...inputContext, { role: "assistant" as const, content: systemic.answer }].slice(-10);
    }
  }
}

await Promise.all(Array.from({ length: Math.min(concurrency, dataset.conversations.length) }, () => worker()));
if (byId.size !== expectedCases) throw new Error(`candidate benchmark incomplete: ${byId.size}/${expectedCases}`);
save("complete");
process.stdout.write(`${JSON.stringify({ outputPath, ...summary([...byId.values()]) })}\n`);
