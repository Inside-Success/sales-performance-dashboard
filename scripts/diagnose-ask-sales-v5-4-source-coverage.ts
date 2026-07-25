import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  classifyV54GovernedOperationalRule,
  getV5KnowledgeSnapshot,
} from "@/lib/ask-sales-faq/v5/knowledge";

type Item = { id: string; sourceIds?: string[] };
type Dataset = { cases?: Item[]; conversations?: Array<{ prompts?: Item[] }> };

async function main() {
  const datasetPath = path.resolve(process.argv.find((value) => value.startsWith("--dataset="))?.slice(10) ||
    "tests/ask-sales-faq/v5-3-independent-slack-gold-2026-07-25.json");
  const outputPath = process.argv.find((value) => value.startsWith("--output="))?.slice(9);
  const dataset = JSON.parse(await readFile(datasetPath, "utf8")) as Dataset;
  const snapshot = getV5KnowledgeSnapshot();
  const items = [
    ...(dataset.cases || []),
    ...(dataset.conversations || []).flatMap((conversation) => conversation.prompts || []),
  ];

  const details = items.map((item) => {
    const sourceIds = item.sourceIds || [];
    const policies = snapshot.policies.filter((policy) => policy.source.ids.some((sourceId) => sourceIds.includes(sourceId)));
    return {
      id: item.id,
      sourceIds,
      policies: policies.map((policy) => ({
        id: policy.id,
        decisionKey: policy.decision_key,
        answerability: policy.answerability,
        qualityTier: policy.quality_tier,
        approvedBy: policy.source.approved_by,
        lastReviewed: policy.last_reviewed,
        classification: classifyV54GovernedOperationalRule(policy, snapshot.referenceReviewDate),
      })),
    };
  });

  const report = {
    datasetPath,
    sourceBackedItems: details.filter((item) => item.sourceIds.length).length,
    exactSourcePresent: details.filter((item) => item.sourceIds.length && item.policies.length).length,
    answerEvidencePresent: details.filter((item) => item.policies.some((policy) => policy.answerability === "answer_evidence")).length,
    details,
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  if (outputPath) {
    const resolvedOutput = path.resolve(outputPath);
    await mkdir(path.dirname(resolvedOutput), { recursive: true });
    await writeFile(resolvedOutput, serialized, "utf8");
  }
  process.stdout.write(serialized);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
