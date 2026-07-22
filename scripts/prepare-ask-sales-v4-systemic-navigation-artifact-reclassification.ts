import { createHash } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Corpus = {
  records: Array<{
    source_id: string;
    authority_replies: Array<{ text: string }>;
  }>;
};
type Decision = {
  decision?: string;
  answerability?: string;
  temporal_risk?: string;
};
type ClassifiedThread = { decisions?: Decision[] };
type Checkpoint = {
  schema_version: "ask-sales-v4-systemic-classification-v1";
  input_sha256: string;
  model: string;
  completed: Record<string, ClassifiedThread>;
  failures: Record<string, string>;
};

const sourcePath = resolve(process.argv[2]);
const previousPath = resolve(process.argv[3]);
const outputPath = resolve(process.argv[4]);
const sourceRaw = readFileSync(sourcePath, "utf8");
const corpus = JSON.parse(sourceRaw) as Corpus;
const previous = JSON.parse(readFileSync(previousPath, "utf8")) as Checkpoint;
const sourceById = new Map(corpus.records.map((record) => [record.source_id, record]));
const navigation = /\b(?:search(?: for)?|type\s+in|navigate\s+to|go\s+to|open|look\s+up|find)\b/i;
const artifact = /\b(?:attach(?:ed|ment)?|photo|image|screenshot|current\s+(?:link|form|document|sheet|template)|link|form|document|sheet|template)\b/i;
const affected = new Set(Object.entries(previous.completed).flatMap(([sourceId, thread]) => {
  const source = sourceById.get(sourceId);
  if (!source) return [];
  const authorityText = source.authority_replies.map((reply) => reply.text).join(" ");
  if (!navigation.test(authorityText) || !artifact.test(authorityText)) return [];
  const hasStableNavigationDecision = (thread.decisions || []).some((decision) =>
    decision.answerability === "answer" &&
    decision.temporal_risk === "stable" &&
    navigation.test(decision.decision || ""),
  );
  return hasStableNavigationDecision ? [] : [sourceId];
}));
const completed = Object.fromEntries(Object.entries(previous.completed).filter(([sourceId]) => !affected.has(sourceId)));
const output: Checkpoint = {
  schema_version: "ask-sales-v4-systemic-classification-v1",
  input_sha256: createHash("sha256").update(sourceRaw).digest("hex"),
  model: previous.model,
  completed,
  failures: {},
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
chmodSync(outputPath, 0o600);
process.stdout.write(`${JSON.stringify({ records: corpus.records.length, reused: Object.keys(completed).length, reclassify: affected.size })}\n`);
