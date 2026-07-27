import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";
import { getV4ProviderReadiness } from "@/lib/ask-sales-faq/v4/provider";
import { runAskSalesFaqV55 } from "@/lib/ask-sales-faq/v5-5/runtime";
import { runAskSalesFaqV56 } from "@/lib/ask-sales-faq/v5-6/runtime";
import { runAskSalesFaqV57 } from "@/lib/ask-sales-faq/v5-7/runtime";
import { runAskSalesFaqV58 } from "@/lib/ask-sales-faq/v5-8/runtime";

type SystemName = "v3" | "v55" | "v56" | "v57" | "v58";
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
  repeatability: { caseIds: string[]; conversationIds: string[] };
  cases: GoldItem[];
  conversations: Conversation[];
};
type RuntimeResult = Awaited<ReturnType<typeof runAskSalesFaqV3>> |
  Awaited<ReturnType<typeof runAskSalesFaqV55>> |
  Awaited<ReturnType<typeof runAskSalesFaqV56>> |
  Awaited<ReturnType<typeof runAskSalesFaqV57>> |
  Awaited<ReturnType<typeof runAskSalesFaqV58>>;
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

function providerUnavailable(result: RuntimeResult) {
  return /(?:no provider configured|provider succeeded|evidence selector was unavailable|source adjudicator was unavailable)/i
    .test(JSON.stringify(result));
}

function successfulProviderAttempts(result: RuntimeResult) {
  return providerAttempts(result).filter((attempt) => attempt.status === "success").length;
}

function providerPreflight(systems: SystemName[]) {
  const v4 = getV4ProviderReadiness();
  const v3Configured = Boolean(process.env.DEEPSEEK_API_KEY || (
    process.env.ANTHROPIC_API_KEY && process.env.FAQ_ALLOW_CLAUDE_FALLBACK === "true"
  ));
  const preflight = {
    v3: {
      configured: v3Configured,
      provider: process.env.DEEPSEEK_API_KEY ? "deepseek" : v3Configured ? "anthropic" : null,
      model: process.env.DEEPSEEK_API_KEY
        ? process.env.FAQ_V3_DEEPSEEK_MODEL || process.env.FAQ_DEEPSEEK_MODEL || "deepseek-v4-pro"
        : v3Configured ? process.env.FAQ_V3_CLAUDE_MODEL || process.env.FAQ_CLAUDE_MODEL || "claude-sonnet-4-6" : null,
    },
    v55: {
      configured: v4.modelConfigured,
      provider: v4.provider,
      model: v4.model,
      transport: v4.transport,
    },
    v56: {
      configured: v4.modelConfigured,
      provider: v4.provider,
      model: v4.model,
      transport: v4.transport,
    },
    v57: {
      configured: v4.modelConfigured,
      provider: v4.provider,
      model: v4.model,
      transport: v4.transport,
    },
    v58: {
      configured: v4.modelConfigured,
      provider: v4.provider,
      model: v4.model,
      transport: v4.transport,
    },
  };
  const missing = systems.filter((system) => !preflight[system].configured);
  if (missing.length) {
    throw new Error(`Provider preflight failed for ${missing.join(", ")}; no runtime output was generated`);
  }
  const challengers = systems.filter((system): system is "v55" | "v56" | "v57" | "v58" => system !== "v3");
  if (systems.includes("v3") && challengers.some((system) =>
    preflight.v3.provider !== preflight[system].provider || preflight.v3.model !== preflight[system].model)) {
    throw new Error("Provider parity failed: V3 and every requested V5 candidate must use the same provider and model");
  }
  return preflight;
}

async function run(system: SystemName, question: string, history: AskSalesFaqChatMessage[]) {
  if (system === "v3") return runAskSalesFaqV3(question, history);
  if (system === "v55") return runAskSalesFaqV55(question, history);
  if (system === "v56") return runAskSalesFaqV56(question, history);
  return system === "v57" ? runAskSalesFaqV57(question, history) : runAskSalesFaqV58(question, history);
}

function systemOrder(key: string, reverse: boolean, systems: SystemName[]): SystemName[] {
  const parity = Number.parseInt(sha256(key).slice(-1), 16) % 2;
  const order = parity === 0 ? [...systems] : [...systems].reverse();
  return reverse ? order.reverse() : order;
}

function summary(cases: EvaluatedItem[], conversations: EvaluatedConversation[], systems: SystemName[]) {
  const items = [...cases, ...conversations.flatMap((conversation) => conversation.prompts)];
  return Object.fromEntries(systems.map((system) => {
    const results = items.flatMap((item) => item.systems[system] ? [item.systems[system]!] : []);
    const latencies = results.map((result) => result.latencyMs).filter((value): value is number => typeof value === "number").sort((a, b) => a - b);
    return [system, {
      completed: results.length,
      lanes: results.reduce<Record<string, number>>((counts, result) => {
        const value = String(lane(result) || "unknown");
        counts[value] = (counts[value] || 0) + 1;
        return counts;
      }, {}),
      providerAttempts: results.reduce((total, result) => total + providerAttempts(result).length, 0),
      successfulProviderAttempts: results.reduce((total, result) => total + successfulProviderAttempts(result), 0),
      providerBackedOutputs: results.filter((result) => successfulProviderAttempts(result) > 0).length,
      unsuccessfulProviderAttempts: results.reduce((total, result) =>
        total + providerAttempts(result).filter((attempt) => attempt.status !== "success").length, 0),
      terminalProviderFailures: results.filter(terminalProviderFailure).length,
      providerUnavailableOutputs: results.filter(providerUnavailable).length,
      meanLatencyMs: latencies.length ? Math.round(latencies.reduce((total, value) => total + value, 0) / latencies.length) : null,
      p90LatencyMs: latencies.length ? latencies[Math.min(latencies.length - 1, Math.ceil(latencies.length * 0.9) - 1)] : null,
    }];
  }));
}

async function main() {
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-5-blind-human-gold-2026-07-26.json"));
  const mode = argument("mode", "primary");
  if (!new Set(["primary", "repeatability", "development"]).has(mode)) throw new Error("--mode must be primary, repeatability, or development");
  const outputPath = path.resolve(argument(
    "output",
    `artifacts/ask-sales-faq-v5-5-blind-gate/provider-corrected/${mode === "repeatability" ? "repeatability" : "primary"}-runtime.json`,
  ));
  const reverseOrder = argument("reverse-order", mode === "repeatability" ? "true" : "false") === "true";
  const datasetRaw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(datasetRaw) as Dataset;
  const providerCorrectedBlindGate = dataset.schemaVersion === 4 && dataset.status === "sealed_for_provider_corrected_evaluation";
  const v56UnseenPromotionGate = dataset.schemaVersion === 3 && dataset.status === "sealed_before_runtime_evaluation";
  if (!providerCorrectedBlindGate && !v56UnseenPromotionGate) {
    throw new Error("Blind benchmark requires a supported sealed evaluation dataset");
  }
  const expectedFreeze = argument("freeze-commit", dataset.runtimeFreezeCommit);
  if (expectedFreeze !== dataset.runtimeFreezeCommit) throw new Error("Runtime freeze argument does not match the sealed dataset");
  const systems = argument("systems", "v3,v55").split(",").map((value) => value.trim()).filter(Boolean) as SystemName[];
  if (!systems.length || systems.some((system) => !new Set<SystemName>(["v3", "v55", "v56", "v57", "v58"]).has(system))) {
    throw new Error("--systems must be a comma-separated subset of v3,v55,v56,v57,v58");
  }
  const preflight = providerPreflight(systems);
  const selectedCases = mode === "repeatability" ? new Set(dataset.repeatability.caseIds) : null;
  const selectedConversations = mode === "repeatability" ? new Set(dataset.repeatability.conversationIds) : null;
  const cases = dataset.cases.filter((item) => !selectedCases || selectedCases.has(item.id)).map((item): EvaluatedItem => ({ ...item, systems: {} }));
  const conversations = dataset.conversations.filter((item) => !selectedConversations || selectedConversations.has(item.id)).map((conversation): EvaluatedConversation => ({
    ...conversation,
    prompts: conversation.prompts.map((prompt) => ({ ...prompt, systems: {} })),
  }));
  const totalPrompts = cases.length + conversations.reduce((total, conversation) => total + conversation.prompts.length, 0);
  const report = {
    schemaVersion: "ask-sales-v5-5-blind-runtime-v2",
    status: "running",
    mode,
    promotionEvidence: mode === "primary",
    datasetName: dataset.name,
    datasetPath,
    datasetSha256: sha256(datasetRaw),
    datasetSealedAt: dataset.sealedAt,
    runtimeFreezeCommit: dataset.runtimeFreezeCommit,
    evaluationToolCommit: argument("evaluation-commit") || null,
    systems,
    providerPreflight: preflight,
    runtimeEntrypoints: {
      v3: "@/lib/ask-sales-faq/v3/runtime#runAskSalesFaqV3",
      v55: "@/lib/ask-sales-faq/v5-5/runtime#runAskSalesFaqV55",
      v56: "@/lib/ask-sales-faq/v5-6/runtime#runAskSalesFaqV56",
      v57: "@/lib/ask-sales-faq/v5-7/runtime#runAskSalesFaqV57",
      v58: "@/lib/ask-sales-faq/v5-8/runtime#runAskSalesFaqV58",
    },
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
    const order = systemOrder(item.id, reverseOrder, systems);
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
    const order = systemOrder(conversation.id, reverseOrder, systems);
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
    const systemSummary = report.summary[system] as {
      completed: number;
      successfulProviderAttempts: number;
      providerBackedOutputs: number;
      terminalProviderFailures: number;
      providerUnavailableOutputs: number;
    };
    if (
      systemSummary.completed !== totalPrompts ||
      systemSummary.successfulProviderAttempts === 0 ||
      systemSummary.providerBackedOutputs < Math.ceil(totalPrompts * 0.5) ||
      systemSummary.terminalProviderFailures !== 0 ||
      systemSummary.providerUnavailableOutputs !== 0
    ) {
      throw new Error(`${system} did not produce all ${totalPrompts} provider-backed terminally successful outputs`);
    }
  }
  const answerItems = [...report.cases, ...report.conversations.flatMap((conversation) => conversation.prompts)]
    .filter((item) => item.expectedDisposition === "answer");
  for (const item of answerItems) {
    for (const system of systems) {
      const result = item.systems[system];
      if (!result || providerUnavailable(result)) {
        throw new Error(`${system} returned a provider-unavailable fallback for answer prompt ${item.id}`);
      }
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
