import { createHash } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getV4Corpus, getV4RouteCatalog } from "@/lib/ask-sales-faq/v4/corpus";
import {
  compileV4SystemicOperationalKnowledge,
  type V4SystemicClassificationCheckpoint,
  type V4SystemicSourceThread,
} from "@/lib/ask-sales-faq/v4/systemic/source-compiler";

type SourceCorpus = {
  schema_version: string;
  records: V4SystemicSourceThread[];
};

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function readJson<T>(path: string): { raw: string; value: T } {
  const raw = readFileSync(path, "utf8");
  return { raw, value: JSON.parse(raw) as T };
}

const sourcePath = resolve(process.argv[2] || "artifacts/ask-sales-faq-v4-systemic/slack-authority-thread-corpus.json");
const classificationPath = resolve(process.argv[3] || "artifacts/ask-sales-faq-v4-systemic/slack-authority-thread-classification.json");
const outputPath = resolve(process.argv[4] || "src/lib/ask-sales-faq/v4/systemic/generated-operational-qna.json");
const holdoutPath = resolve(process.argv[5] || "artifacts/ask-sales-faq-v4-systemic/sealed-source-holdout.json");
const source = readJson<SourceCorpus>(sourcePath);
const checkpoint = readJson<V4SystemicClassificationCheckpoint>(classificationPath);

if (checkpoint.value.input_sha256 !== sha(source.raw)) {
  throw new Error("classification checkpoint does not match the source corpus");
}
if (Object.keys(checkpoint.value.failures).length) {
  throw new Error(`classification checkpoint still has ${Object.keys(checkpoint.value.failures).length} failures`);
}
if (Object.keys(checkpoint.value.completed).length !== source.value.records.length) {
  throw new Error(`classification is incomplete: ${Object.keys(checkpoint.value.completed).length}/${source.value.records.length}`);
}

const compiled = compileV4SystemicOperationalKnowledge({
  sources: source.value.records,
  checkpoint: checkpoint.value,
  governedPolicies: getV4Corpus(),
  routeCatalog: getV4RouteCatalog(),
});
const latestSourceTimestamp = source.value.records.reduce((latest, record) => Math.max(latest, Number.parseFloat(record.root_ts) || 0), 0);
const generatedAt = latestSourceTimestamp ? new Date(latestSourceTimestamp * 1000).toISOString() : "2026-07-22T00:00:00.000Z";
const output = {
  schema_version: "ask-sales-v4-systemic-operational-qna-v1",
  generated_at: generatedAt,
  source_sha256: sha(source.raw),
  classification_sha256: sha(checkpoint.raw),
  classification_model: checkpoint.value.model,
  split_policy: "all approved sources included in runtime; fixed-salt 20 percent source-derived question holdout reserved for evaluation",
  compilation: compiled.metrics,
  policies: compiled.policies,
};
const holdout = {
  schema_version: "ask-sales-v4-systemic-sealed-holdout-v1",
  generated_at: generatedAt,
  source_sha256: sha(source.raw),
  classification_sha256: sha(checkpoint.raw),
  split_policy: output.split_policy,
  item_count: compiled.holdout.length,
  items: compiled.holdout,
};

mkdirSync(dirname(outputPath), { recursive: true });
mkdirSync(dirname(holdoutPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
writeFileSync(holdoutPath, `${JSON.stringify(holdout, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
chmodSync(holdoutPath, 0o600);
process.stdout.write(`${JSON.stringify({ outputPath, holdoutPath, ...compiled.metrics })}\n`);
