import { createInterface } from "node:readline";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const AUTHORITY_IDS = {
  U097MUCC1PD: "madeline",
  U04P5KM875L: "raul",
  U04960NQARM: "rich",
  U01JYL9AYBF: "mike",
  U01K7SFHKT6: "rudy",
};

function clean(value) {
  return String(value || "")
    .replace(/<@[A-Z0-9]+(?:\|[^>]+)?>/g, "[person]")
    .replace(/<!channel>/g, "[channel]")
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[email]")
    .replace(/https?:\/\/\S+/gi, "[internal link]")
    .replace(/\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]\d{3}[-.\s]\d{4}\b/g, "[phone]")
    .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[payment-card]")
    .replace(/&amp;/g, "&")
    .replace(/\nReactions:[\s\S]*$/i, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}

function parseThread(value) {
  const messages = [];
  const pattern = /(?:=== THREAD PARENT MESSAGE ===|--- Reply \d+ of \d+ ---)\nFrom: [^\n]* \((U[A-Z0-9]+)\)\nTime: [^\n]*\nMessage TS: ([^\n]+)\n([\s\S]*?)(?=\n\n--- Reply \d+ of \d+ ---|$)/g;
  for (const match of String(value || "").matchAll(pattern)) {
    const text = clean(match[3]);
    if (!text) continue;
    const authority = AUTHORITY_IDS[match[1]] || null;
    messages.push({
      role: authority ? "authority" : "participant",
      ...(authority ? { authority } : {}),
      message_ts: match[2].trim(),
      text,
    });
  }
  return messages;
}

const sourcePath = resolve(process.argv[2]);
const outputPath = resolve(process.argv[3]);
const batchPath = process.argv[4] ? resolve(process.argv[4]) : null;
if (!sourcePath || !outputPath) throw new Error("usage: node enrich-ask-sales-v4-systemic-thread-corpus.mjs source.json output.json");
const source = JSON.parse(readFileSync(sourcePath, "utf8"));
const byId = new Map();
const lines = batchPath
  ? readFileSync(batchPath, "utf8").split(/\r?\n/)
  : createInterface({ input: process.stdin, crlfDelay: Infinity });
for await (const line of lines) {
  if (!line.trim()) continue;
  const item = JSON.parse(line);
  if (item.__end === true) break;
  const messages = Array.isArray(item.thread_messages) ? item.thread_messages : parseThread(item.messages);
  if (messages.length) byId.set(item.source_id, messages);
}
const records = source.records.map((record) => ({
  ...record,
  thread_messages: byId.get(record.source_id) || [{
    role: "participant",
    message_ts: record.root_ts,
    text: clean(record.question),
  }, ...record.authority_replies.map((reply) => ({
    role: "authority",
    authority: reply.authority,
    message_ts: reply.message_ts,
    text: clean(reply.text),
  }))],
}));
const output = {
  ...source,
  schema_version: "ask-sales-v4-systemic-authority-threads-v2",
  source_mode: "read_only_full_thread_enriched",
  records,
  enrichment: {
    requested_threads: source.records.length,
    connector_threads_received: byId.size,
    threads_with_participant_followups: records.filter((record) => record.thread_messages.some((message) => message.role === "participant" && message.message_ts !== record.root_ts)).length,
  },
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
process.stdout.write(`${JSON.stringify(output.enrichment)}\n`);
