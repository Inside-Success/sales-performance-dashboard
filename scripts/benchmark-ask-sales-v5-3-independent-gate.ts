import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";
import { runAskSalesFaqV5 } from "@/lib/ask-sales-faq/v5/runtime";

type SystemName = "v3" | "v5";
type GoldItem = {
  id: string;
  question: string;
  expectedDisposition: string;
  expectedRouteKey?: string;
  goldAnswer: string;
  requiredConcepts: string[];
  forbiddenConcepts: string[];
  evaluationStrata: string[];
  sourceIds: string[];
  approvedBy: string[];
};
type Conversation = { id: string; title: string; prompts: GoldItem[] };
type Dataset = {
  schemaVersion: number;
  name: string;
  status: string;
  sealedAt: string;
  runtimeFreezeCommit: string;
  promotionGate: Record<string, unknown>;
  repeatability: { independentCaseIds: string[]; conversationIds: string[] };
  cases: GoldItem[];
  conversations: Conversation[];
};
type RuntimeResult = Awaited<ReturnType<typeof runAskSalesFaqV3>> | Awaited<ReturnType<typeof runAskSalesFaqV5>>;
type EvaluatedItem = GoldItem & { systems: Partial<Record<SystemName, RuntimeResult>> };
type EvaluatedConversation = Omit<Conversation, "prompts"> & { prompts: EvaluatedItem[] };

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function lane(result: RuntimeResult) {
  return "lane" in result ? result.lane : result.outcome;
}

function terminalProviderFailure(result: RuntimeResult) {
  return ["provider_error", "error"].includes(String(lane(result)));
}

function providerAttempts(result: RuntimeResult) {
  return result.runtimeMetadata?.providerAttempts || [];
}

async function run(system: SystemName, question: string, history: AskSalesFaqChatMessage[]) {
  if (system === "v3") return runAskSalesFaqV3(question, history);
  return runAskSalesFaqV5(question, history);
}

function systemOrder(key: string, reverse: boolean): SystemName[] {
  const parity = Number.parseInt(sha256(key).slice(-1), 16) % 2;
  const order: SystemName[] = parity === 0 ? ["v3", "v5"] : ["v5", "v3"];
  return reverse ? order.reverse() : order;
}

function summary(
  cases: EvaluatedItem[],
  conversations: EvaluatedConversation[],
  systems: SystemName[],
) {
  const items = [...cases, ...conversations.flatMap((conversation) => conversation.prompts)];
  return Object.fromEntries(systems.map((system) => {
    const results = items.flatMap((item) => item.systems[system] ? [item.systems[system]!] : []);
    return [system, {
      completed: results.length,
      lanes: results.reduce<Record<string, number>>((counts, result) => {
        const value = String(lane(result) || "unknown");
        counts[value] = (counts[value] || 0) + 1;
        return counts;
      }, {}),
      providerAttempts: results.reduce((total, result) => total + providerAttempts(result).length, 0),
      unsuccessfulProviderAttempts: results.reduce((total, result) =>
        total + providerAttempts(result).filter((attempt) => attempt.status !== "success").length, 0),
      terminalProviderFailures: results.filter(terminalProviderFailure).length,
    }];
  }));
}

async function main() {
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-3-independent-slack-gold-2026-07-25.json"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-runtime.json"));
  const mode = argument("mode", "primary");
  const diagnosticOnly = argument("diagnostic-only") === "true";
  if (!new Set(["primary", "repeatability"]).has(mode)) throw new Error("--mode must be primary or repeatability");
  const reverseOrder = argument("reverse-order", mode === "repeatability" ? "true" : "false") === "true";
  const datasetRaw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(datasetRaw) as Dataset;
  if (dataset.schemaVersion !== 2 || dataset.status !== "sealed_before_runtime_evaluation") {
    throw new Error("The independent V5.3 gate requires the sealed schemaVersion 2 dataset");
  }
  const expectedFreeze = argument("freeze-commit", dataset.runtimeFreezeCommit);
  if (expectedFreeze !== dataset.runtimeFreezeCommit) throw new Error("Runtime freeze argument does not match the sealed dataset");
  const systems = argument("systems", "v3,v5").split(",").map((value) => value.trim()).filter(Boolean) as SystemName[];
  if (!systems.length || systems.some((system) => !new Set<SystemName>(["v3", "v5"]).has(system))) {
    throw new Error("--systems must be a comma-separated subset of v3,v5");
  }
  const selectedCaseIds = mode === "repeatability" ? new Set(dataset.repeatability.independentCaseIds) : null;
  const selectedConversationIds = mode === "repeatability" ? new Set(dataset.repeatability.conversationIds) : null;
  const diagnosticIds = diagnosticOnly && argument("ids")
    ? new Set(argument("ids").split(",").map((value) => value.trim()).filter(Boolean))
    : null;
  const cases = dataset.cases
    .filter((item) => (!selectedCaseIds || selectedCaseIds.has(item.id)) && (!diagnosticIds || diagnosticIds.has(item.id)))
    .map((item): EvaluatedItem => ({ ...item, systems: {} }));
  const conversations = dataset.conversations
    .filter((item) => (!selectedConversationIds || selectedConversationIds.has(item.id)) &&
      (!diagnosticIds || diagnosticIds.has(item.id) || item.prompts.some((prompt) => diagnosticIds.has(prompt.id))))
    .map((conversation): EvaluatedConversation => ({
      ...conversation,
      prompts: conversation.prompts
        .filter((prompt) => !diagnosticIds || diagnosticIds.has(conversation.id) || diagnosticIds.has(prompt.id))
        .map((prompt) => ({ ...prompt, systems: {} })),
    }));
  if (mode === "repeatability" && (cases.length !== 7 || conversations.length !== 6)) {
    throw new Error("Repeatability selection no longer matches the preregistered subset");
  }
  const totalPrompts = cases.length + conversations.reduce((total, conversation) => total + conversation.prompts.length, 0);
  const report = {
    schemaVersion: diagnosticOnly ? "ask-sales-v5-4-revealed-regression-runtime-v1" : "ask-sales-v5-3-independent-runtime-v1",
    status: "running",
    mode,
    promotionEvidence: mode === "primary" && !diagnosticOnly,
    diagnosticOnly,
    datasetName: dataset.name,
    datasetPath,
    datasetSha256: sha256(datasetRaw),
    datasetSealedAt: dataset.sealedAt,
    runtimeFreezeCommit: dataset.runtimeFreezeCommit,
    evaluationToolCommit: argument("evaluation-commit") || null,
    candidateTunedAfterSeal: diagnosticOnly,
    systems,
    pairing: "deterministically alternated per standalone case or complete conversation",
    reverseOrder,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    expectedPromptsPerSystem: totalPrompts,
    executionOrder: [] as Array<{ key: string; systems: SystemName[] }>,
    cases,
    conversations,
    summary: {} as Record<string, unknown>,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });

  for (const item of report.cases) {
    const order = systemOrder(item.id, reverseOrder).filter((system) => systems.includes(system));
    report.executionOrder.push({ key: item.id, systems: order });
    for (const system of order) {
      const history: AskSalesFaqChatMessage[] = [{ role: "user", content: item.question }];
      item.systems[system] = await run(system, item.question, history);
      report.summary = summary(report.cases, report.conversations, systems);
      await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      process.stdout.write(`${JSON.stringify({ mode, id: item.id, system, lane: lane(item.systems[system]!) })}\n`);
    }
  }

  for (const conversation of report.conversations) {
    const order = systemOrder(conversation.id, reverseOrder).filter((system) => systems.includes(system));
    report.executionOrder.push({ key: conversation.id, systems: order });
    for (const system of order) {
      const history: AskSalesFaqChatMessage[] = [];
      for (const prompt of conversation.prompts) {
        history.push({ role: "user", content: prompt.question });
        prompt.systems[system] = await run(system, prompt.question, history);
        history.push({ role: "assistant", content: prompt.systems[system]!.answer });
        report.summary = summary(report.cases, report.conversations, systems);
        await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
        process.stdout.write(`${JSON.stringify({ mode, conversation: conversation.id, id: prompt.id, system, lane: lane(prompt.systems[system]!) })}\n`);
      }
    }
  }

  report.summary = summary(report.cases, report.conversations, systems);
  for (const system of systems) {
    const systemSummary = report.summary[system] as { completed: number; terminalProviderFailures: number };
    if (systemSummary.completed !== totalPrompts || systemSummary.terminalProviderFailures !== 0) {
      throw new Error(`${system} did not produce all ${totalPrompts} terminally successful outputs`);
    }
  }
  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, status: report.status, mode, totalPrompts, summary: report.summary }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
