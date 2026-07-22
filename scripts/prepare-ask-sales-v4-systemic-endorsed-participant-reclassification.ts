import { createHash } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type ThreadMessage = { role: "participant" | "authority"; text: string };
type Corpus = {
  records: Array<{
    source_id: string;
    authority_replies: Array<{ text: string }>;
    thread_messages?: ThreadMessage[];
  }>;
};
type Checkpoint = {
  schema_version: "ask-sales-v4-systemic-classification-v1";
  input_sha256: string;
  model: string;
  completed: Record<string, unknown>;
  failures: Record<string, string>;
};

const sourcePath = resolve(process.argv[2]);
const previousPath = resolve(process.argv[3]);
const outputPath = resolve(process.argv[4]);
const sourceRaw = readFileSync(sourcePath, "utf8");
const corpus = JSON.parse(sourceRaw) as Corpus;
const previous = JSON.parse(readFileSync(previousPath, "utf8")) as Checkpoint;
const explicitEndorsement = new RegExp([
  "\\b(?:suggestion|advice|answer|response|idea|process|steps?)\\s+(?:is|are|was|were|looks?|sounds?)\\s+(?:great|good|correct|right|fine|approved|perfect|spot[ -]on)\\b",
  "\\b(?:what|as)\\s+(?:\\[person\\]|[A-Z][a-z]+)\\s+(?:said|suggested|mentioned|recommended)\\b",
  "\\b(?:agree|agreed)\\s+with\\b",
  "\\b(?:that(?:'s| is)?|this is|those are)\\s+(?:correct|right|approved|perfect|spot[ -]on)\\b",
  "(?:^|[.!?]\\s*)(?:correct|exactly|approved|spot[ -]on)(?:[.!?,]|$)",
].join("|"), "i");

const affected = new Set(corpus.records.flatMap((record) => {
  const participantReplies = (record.thread_messages || []).slice(1).filter((message) => message.role === "participant");
  if (!participantReplies.length) return [];
  const authorityText = record.authority_replies.map((reply) => reply.text).join(" ");
  return explicitEndorsement.test(authorityText) ? [record.source_id] : [];
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
