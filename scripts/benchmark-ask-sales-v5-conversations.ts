import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import type { AskSalesFaqChatMessage } from "@/lib/ask-sales-faq/types";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";
import { runAskSalesFaqV5 } from "@/lib/ask-sales-faq/v5/runtime";

type SystemName = "v3" | "v5";
type Prompt = {
  question: string;
  independent?: boolean;
  evaluationStrata?: string[];
  goldNeeds?: Array<Record<string, unknown>>;
};
type Conversation = { id: string; title?: string; prompts: Prompt[] };
type Dataset = {
  name: string;
  diagnosticOnly: true;
  conversations: Conversation[];
};
type RuntimeResult = Awaited<ReturnType<typeof runAskSalesFaqV3>> | Awaited<ReturnType<typeof runAskSalesFaqV5>>;

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function requestedSystems() {
  const allowed = new Set<SystemName>(["v3", "v5"]);
  const systems = argument("systems", "v3,v5").split(",").map((value) => value.trim()).filter(Boolean);
  if (!systems.length || systems.some((value) => !allowed.has(value as SystemName))) {
    throw new Error("--systems must be a comma-separated subset of v3,v5");
  }
  return systems as SystemName[];
}

function lane(result: RuntimeResult) {
  return "lane" in result ? result.lane : result.outcome;
}

function providerFailures(result: RuntimeResult) {
  const attempts = result.runtimeMetadata?.providerAttempts || [];
  return attempts.filter((attempt) => attempt.status !== "success").length;
}

async function run(system: SystemName, question: string, history: AskSalesFaqChatMessage[]) {
  if (system === "v3") return runAskSalesFaqV3(question, history);
  return runAskSalesFaqV5(question, history);
}

async function main() {
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v4-1-focused-post-fix-development.json"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5/conversation-diagnostic.json"));
  const datasetRaw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(datasetRaw) as Dataset;
  if (dataset.diagnosticOnly !== true || !Array.isArray(dataset.conversations)) {
    throw new Error("Conversation benchmark accepts diagnostic-only datasets, never promotion holdouts");
  }
  const systems = requestedSystems();
  const report = {
    schemaVersion: 1,
    status: "running",
    datasetPath,
    datasetSha256: sha256(datasetRaw),
    runtimeFreezeCommit: argument("freeze-commit") || null,
    systems,
    startedAt: new Date().toISOString(),
    completedAt: null as string | null,
    conversations: dataset.conversations.map((conversation) => ({
      id: conversation.id,
      title: conversation.title || "",
      prompts: conversation.prompts.map((prompt) => ({ ...prompt, systems: {} as Partial<Record<SystemName, RuntimeResult>> })),
    })),
    summary: {} as Record<string, unknown>,
  };
  await mkdir(path.dirname(outputPath), { recursive: true });

  for (const system of systems) {
    for (const conversation of report.conversations) {
      const history: AskSalesFaqChatMessage[] = [];
      for (const prompt of conversation.prompts) {
        if (prompt.independent) history.splice(0, history.length);
        history.push({ role: "user", content: prompt.question });
        const result = await run(system, prompt.question, history);
        prompt.systems[system] = result;
        history.push({ role: "assistant", content: result.answer });
        process.stdout.write(`${JSON.stringify({ system, conversation: conversation.id, question: prompt.question, lane: lane(result) })}\n`);
        await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
      }
    }
  }

  report.summary = Object.fromEntries(systems.map((system) => {
    const results = report.conversations.flatMap((conversation) =>
      conversation.prompts.flatMap((prompt) => prompt.systems[system] ? [prompt.systems[system]!] : []),
    );
    return [system, {
      completed: results.length,
      lanes: results.reduce<Record<string, number>>((counts, result) => {
        counts[lane(result)] = (counts[lane(result)] || 0) + 1;
        return counts;
      }, {}),
      providerFailures: results.reduce((total, result) => total + providerFailures(result), 0),
    }];
  }));
  report.status = "complete";
  report.completedAt = new Date().toISOString();
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, summary: report.summary }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
