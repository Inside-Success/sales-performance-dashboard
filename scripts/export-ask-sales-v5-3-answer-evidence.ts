import { writeFile } from "node:fs/promises";
import path from "node:path";

import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

async function main() {
  const snapshot = getV5KnowledgeSnapshot();
  const payload = {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    knowledgeVersion: snapshot.knowledgeVersion,
    snapshotHash: snapshot.snapshotHash,
    answerEvidence: snapshot.policies
      .filter((policy) => policy.answerability === "answer_evidence")
      .map((policy) => ({
        id: policy.id,
        decisionKey: policy.decision_key,
        title: policy.title,
        questionFamilies: policy.question_families,
        decision: policy.decision,
        productScopes: policy.product_scopes,
        domains: policy.domains,
        actions: policy.actions,
        entities: policy.entities,
        riskLevel: policy.risk_level,
        effectiveAt: policy.effective_at,
        lastReviewed: policy.last_reviewed,
        approvedBy: policy.source.approved_by,
        sourceIds: policy.source.ids,
        qualityFlags: policy.quality_flags,
      })),
  };
  const output = argument("output");
  if (output) {
    await writeFile(path.resolve(output), `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    process.stdout.write(`${JSON.stringify({ output: path.resolve(output), count: payload.answerEvidence.length })}\n`);
    return;
  }
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
