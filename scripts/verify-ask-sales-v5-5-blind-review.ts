import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const directory = path.resolve(argument("dir", "artifacts/ask-sales-faq-v5-5-blind-gate"));
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-5-blind-human-gold-2026-07-26.json"));
  const [datasetRaw, runtimeRaw, packetRaw, keyRaw, templateRaw, html, guide] = await Promise.all([
    readFile(datasetPath, "utf8"),
    readFile(path.join(directory, "primary-runtime.json"), "utf8"),
    readFile(path.join(directory, "blinded-review-packet.json"), "utf8"),
    readFile(path.join(directory, "sealed-unblind-key.json"), "utf8"),
    readFile(path.join(directory, "review-feedback-template.json"), "utf8"),
    readFile(path.join(directory, "ASK-SALES-BLIND-REVIEW.html"), "utf8"),
    readFile(path.join(directory, "README.md"), "utf8"),
  ]);
  const runtime = object(JSON.parse(runtimeRaw));
  const packet = object(JSON.parse(packetRaw));
  const key = object(JSON.parse(keyRaw));
  const template = object(JSON.parse(templateRaw));
  const items = Array.isArray(packet.items) ? packet.items.map(object) : [];
  const mappings = object(key.mappingByItem);
  const runtimeSummary = object(runtime.summary);

  assert(text(runtime.status) === "complete", "Runtime report is not complete");
  assert(text(runtime.datasetSha256) === sha256(datasetRaw), "Runtime dataset hash does not match the sealed gold");
  assert(object(runtimeSummary.v3).completed === 20 && object(runtimeSummary.v55).completed === 20, "Both systems must complete all 20 prompts");
  assert(object(runtimeSummary.v3).terminalProviderFailures === 0 && object(runtimeSummary.v55).terminalProviderFailures === 0, "Provider failures invalidate the blind packet");
  assert(items.length === 20, "Blind packet must contain exactly 20 items");
  assert(new Set(items.map((item) => text(item.id))).size === 20, "Blind packet IDs must be unique");
  assert(items.every((item) => text(object(item.outputA).answer) && text(object(item.outputB).answer)), "Every item must contain two non-empty answers");
  assert(items.every((item, index) => item.order === index + 1 && item.batch === Math.floor(index / 5) + 1), "Packet must be split into four ordered batches of five");
  assert(items.every((item) => mappings[text(item.id)]), "Every blinded item must have a sealed identity mapping");
  assert(Object.keys(mappings).length === 20, "Unblind key must contain exactly 20 item mappings");
  assert(text(key.packetContentSha256) === text(packet.packetSha256), "Packet content hash does not match unblind key");
  assert(text(key.packetFileSha256) === sha256(packetRaw), "Packet file hash does not match unblind key");
  assert(text(template.packetSha256) === text(packet.packetSha256), "Feedback template is bound to the wrong packet");

  const groupMappings = new Map<string, string>();
  const dataset = object(JSON.parse(datasetRaw));
  const conversationByPrompt = new Map<string, string>();
  for (const conversation of Array.isArray(dataset.conversations) ? dataset.conversations.map(object) : []) {
    for (const prompt of Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) {
      conversationByPrompt.set(text(prompt.id), text(conversation.id));
    }
  }
  for (const item of items) {
    const id = text(item.id);
    const group = conversationByPrompt.get(id) || id;
    const mapping = JSON.stringify(mappings[id]);
    const prior = groupMappings.get(group);
    assert(!prior || prior === mapping, `Conversation ${group} changed answer identity between turns`);
    groupMappings.set(group, mapping);
  }
  const aCounts = [...groupMappings.values()].reduce<Record<string, number>>((counts, rawMapping) => {
    const mapping = object(JSON.parse(rawMapping));
    const system = text(mapping.A);
    counts[system] = (counts[system] || 0) + 1;
    return counts;
  }, {});
  assert(Math.abs((aCounts.v3 || 0) - (aCounts.v55 || 0)) <= 1, "Blinding is not balanced across independent groups");

  assert(!/sealed-unblind-key|mappingByItem|\"v3\"|\"v55\"/.test(html), "Reviewer HTML leaks system identity or the key location");
  assert(!/<script[^>]+src=|<link[^>]+href=|https?:\/\//i.test(html), "Reviewer HTML must be self-contained and make no network requests");
  assert(/one question at a time/i.test(guide) && /four batches of five/i.test(guide), "Reviewer guide does not state the low-overload workflow");
  assert(/Download feedback JSON/.test(html) && /Both acceptable/.test(html) && /No serious error/.test(html), "Reviewer controls are incomplete");

  const secretPattern = /(?:sk-[A-Za-z0-9_-]{20,}|gh[opsu]_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
  for (const [name, contents] of Object.entries({ datasetRaw, runtimeRaw, packetRaw, keyRaw, templateRaw, html, guide })) {
    assert(!secretPattern.test(contents), `${name} contains a credential-like value`);
  }

  process.stdout.write(`${JSON.stringify({
    status: "verified",
    prompts: items.length,
    batches: 4,
    systemsHidden: true,
    selfContainedHtml: true,
    groupBalance: aCounts,
    datasetSha256: sha256(datasetRaw),
    runtimeSha256: sha256(runtimeRaw),
    packetFileSha256: sha256(packetRaw),
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
