import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getV4ProviderReadiness } from "@/lib/ask-sales-faq/v4/provider";
import { getV4SystemicEffectiveCorpusSnapshot } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import {
  classifyV53ActiveScopedOperationalRule,
  getV5KnowledgeSnapshot,
} from "@/lib/ask-sales-faq/v5/knowledge";
import { ASK_SALES_V51_PIPELINE_VERSION, getV51KnowledgeVersion } from "@/lib/ask-sales-faq/v5/runtime";

async function main() {
  const snapshot = getV5KnowledgeSnapshot();
  const dispositionCounts = snapshot.governedOperationalAuditReport.reduce<Record<string, number>>((counts, item) => {
    counts[item.disposition] = (counts[item.disposition] || 0) + 1;
    return counts;
  }, {});
  const governedPromotions = snapshot.policies.filter((policy) =>
    policy.quality_flags.includes("v54_governed_consensus_rule"),
  );
  const originalPolicies = new Map(getV4SystemicEffectiveCorpusSnapshot().policies.map((policy) => [policy.id, policy]));
  const approverCounts = governedPromotions.reduce<Record<string, number>>((counts, policy) => {
    const key = policy.source.approved_by.slice().sort().join(" + ") || "unknown";
    counts[key] = (counts[key] || 0) + 1;
    return counts;
  }, {});

  const report = {
    runtime: ASK_SALES_V51_PIPELINE_VERSION,
    knowledgeVersion: getV51KnowledgeVersion(),
    schemaVersion: snapshot.schemaVersion,
    policyCount: snapshot.policies.length,
    stableOperationalPromotionCount: snapshot.stableOperationalPromotionCount,
    activeScopedOperationalPromotionCount: snapshot.activeScopedOperationalPromotionCount,
    governedOperationalPromotionCount: snapshot.governedOperationalPromotionCount,
    governedAuditDispositionCounts: dispositionCounts,
    governedPromotionApproverCounts: approverCounts,
    governedPromotions: governedPromotions.map((policy) => ({
      id: policy.id,
      decisionKey: policy.decision_key,
      decision: policy.decision,
      approvedBy: policy.source.approved_by,
      riskLevel: policy.risk_level,
      sourceIds: policy.source.ids,
      priorClassification: originalPolicies.has(policy.id)
        ? classifyV53ActiveScopedOperationalRule(originalPolicies.get(policy.id)!, snapshot.referenceReviewDate)
        : null,
    })),
    provider: getV4ProviderReadiness(),
  };
  const serialized = `${JSON.stringify(report, null, 2)}\n`;
  const outputPath = process.argv.find((value) => value.startsWith("--output="))?.slice(9);
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
