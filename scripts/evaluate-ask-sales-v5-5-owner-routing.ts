import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { deterministicV54ActionOwner } from "@/lib/ask-sales-faq/v5/decision-routing";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";

type GoldItem = { id: string; question: string; expectedRouteKey?: string };
type Dataset = { cases?: GoldItem[]; conversations?: Array<{ prompts?: GoldItem[] }> };

const owners = ["finance", "greenlight", "sales_policy", "sales_tech", "fulfillment"] as const;
type Owner = typeof owners[number];

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function isOwner(value: unknown): value is Owner {
  return typeof value === "string" && owners.includes(value as Owner);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function evaluate(items: Array<{ id: string; question: string; expected: Owner }>) {
  const details = items.map((item) => ({ ...item, predicted: deterministicV54ActionOwner(item.question) || "unclassified" }));
  const labels = [...owners, "unclassified"];
  const confusionMatrix = Object.fromEntries(owners.map((expected) => [expected, Object.fromEntries(labels.map((predicted) => [
    predicted,
    details.filter((item) => item.expected === expected && item.predicted === predicted).length,
  ]))]));
  const perOwner = Object.fromEntries(owners.map((owner) => {
    const truePositive = details.filter((item) => item.expected === owner && item.predicted === owner).length;
    const predicted = details.filter((item) => item.predicted === owner).length;
    const expected = details.filter((item) => item.expected === owner).length;
    return [owner, {
      support: expected,
      precision: predicted ? Number((truePositive / predicted).toFixed(4)) : null,
      recall: expected ? Number((truePositive / expected).toFixed(4)) : null,
    }];
  }));
  const correct = details.filter((item) => item.expected === item.predicted).length;
  return {
    total: details.length,
    correct,
    accuracy: details.length ? Number((correct / details.length).toFixed(4)) : 0,
    unclassified: details.filter((item) => item.predicted === "unclassified").length,
    confusionMatrix,
    perOwner,
    details,
  };
}

async function main() {
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-3-independent-slack-gold-2026-07-25.json"));
  const outputPath = path.resolve(argument("output", "artifacts/ask-sales-faq-v5-5/owner-routing-evaluation.json"));
  const raw = await readFile(datasetPath, "utf8");
  const dataset = JSON.parse(raw) as Dataset;
  const independentItems = [
    ...(dataset.cases || []),
    ...(dataset.conversations || []).flatMap((conversation) => conversation.prompts || []),
  ].filter((item): item is GoldItem & { expectedRouteKey: Owner } => isOwner(item.expectedRouteKey))
    .map((item) => ({ id: item.id, question: item.question, expected: item.expectedRouteKey }));

  const governedItems = getV5KnowledgeSnapshot().policies.flatMap((policy) => {
    if (!isOwner(policy.route_key)) return [];
    const question = policy.question_families.find((family) => /\b(?:where|which channel|who|help|report|send|submit|request|handle|fix|status|trace|verify|confirm)\b/i.test(family));
    return question ? [{ id: policy.id, question, expected: policy.route_key }] : [];
  });
  const report = {
    schemaVersion: "ask-sales-v5-5-owner-routing-evaluation-v1",
    createdAt: new Date().toISOString(),
    fiveOwners: owners,
    independentGold: {
      datasetPath,
      datasetSha256: sha256(raw),
      ...evaluate(independentItems),
    },
    governedRouteCards: {
      role: "supporting diagnostic only; these records helped shape prior routing and are not independent promotion evidence",
      ...evaluate(governedItems),
    },
  };
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({
    outputPath,
    independentGold: {
      total: report.independentGold.total,
      accuracy: report.independentGold.accuracy,
      unclassified: report.independentGold.unclassified,
    },
    governedRouteCards: {
      total: report.governedRouteCards.total,
      accuracy: report.governedRouteCards.accuracy,
      unclassified: report.governedRouteCards.unclassified,
    },
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
