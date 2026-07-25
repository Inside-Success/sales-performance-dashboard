import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;
type SystemName = "v3" | "v5";

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

function systemMapping(datasetSha256: string, groupId: string): { A: SystemName; B: SystemName } {
  const parity = Number.parseInt(createHash("sha256").update(`${datasetSha256}:${groupId}`).digest("hex").slice(-1), 16) % 2;
  return parity === 0 ? { A: "v3", B: "v5" } : { A: "v5", B: "v3" };
}

function blindedOutput(result: JsonRecord) {
  return {
    answer: text(result.answer),
    disposition: text(result.lane) || text(result.outcome),
    needsRoute: result.needsRoute === true,
    routeChannels: Array.isArray(result.routeChannels) ? result.routeChannels : [],
  };
}

async function main() {
  const inputPath = path.resolve(argument("input", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-runtime.json"));
  const packetPath = path.resolve(argument("packet", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-blinded-packet.json"));
  const keyPath = path.resolve(argument("key", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-unblind-key.json"));
  const templatePath = path.resolve(argument("template", "artifacts/ask-sales-faq-v5-3-independent-gate/primary-blinded-review-template.json"));
  const raw = await readFile(inputPath, "utf8");
  const report = object(JSON.parse(raw));
  if (text(report.status) !== "complete") throw new Error("Only a complete runtime report can be blinded");
  const datasetSha256 = text(report.datasetSha256);
  if (!datasetSha256) throw new Error("Runtime report is missing datasetSha256");

  const rows: Array<{ groupId: string; conversationId: string | null; item: JsonRecord }> = [];
  for (const item of Array.isArray(report.cases) ? report.cases.map(object) : []) {
    rows.push({ groupId: text(item.id), conversationId: null, item });
  }
  for (const conversation of Array.isArray(report.conversations) ? report.conversations.map(object) : []) {
    const conversationId = text(conversation.id);
    for (const item of Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) {
      rows.push({ groupId: conversationId, conversationId, item });
    }
  }
  if (!rows.length) throw new Error("Runtime report has no evaluation rows");

  const packetItems = rows.map(({ groupId, conversationId, item }) => {
    const mapping = systemMapping(datasetSha256, groupId);
    const systems = object(item.systems);
    return {
      id: text(item.id),
      conversationId,
      question: text(item.question),
      expectedDisposition: text(item.expectedDisposition),
      expectedRouteKey: text(item.expectedRouteKey) || null,
      goldAnswer: text(item.goldAnswer),
      requiredConcepts: Array.isArray(item.requiredConcepts) ? item.requiredConcepts : [],
      forbiddenConcepts: Array.isArray(item.forbiddenConcepts) ? item.forbiddenConcepts : [],
      evaluationStrata: Array.isArray(item.evaluationStrata) ? item.evaluationStrata : [],
      sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds : [],
      approvedBy: Array.isArray(item.approvedBy) ? item.approvedBy : [],
      outputA: blindedOutput(object(systems[mapping.A])),
      outputB: blindedOutput(object(systems[mapping.B])),
    };
  });
  const key = {
    schemaVersion: "ask-sales-v5-3-unblind-key-v1",
    runtimeInput: inputPath,
    runtimeInputSha256: createHash("sha256").update(raw).digest("hex"),
    datasetSha256,
    mappingByItem: Object.fromEntries(packetItems.map((item) => [item.id, systemMapping(datasetSha256, item.conversationId || item.id)])),
  };
  const packet = {
    schemaVersion: "ask-sales-v5-3-blinded-packet-v1",
    createdAt: new Date().toISOString(),
    runtimeInput: inputPath,
    runtimeInputSha256: key.runtimeInputSha256,
    datasetSha256,
    mode: text(report.mode),
    systemsHidden: true,
    grading: {
      pass: "Correct, safe, directly useful, and grounded in the source-only gold or correct workflow owner.",
      partial: "Safe and materially useful, but incomplete, over-routed, or containing a non-critical irrelevant fragment.",
      fail: "Safe but avoidably unhelpful, materially incomplete, or sent to a non-required owner.",
      critical: "Confident materially wrong rule, unsafe over-answer, or high-impact relationship mismatch.",
      wrongActionOwner: "True only when an action request is sent to the wrong workflow owner or the bot falsely claims it completed the action.",
    },
    items: packetItems,
  };
  const reviewTemplate = {
    schemaVersion: "ask-sales-v5-3-blinded-human-review-v1",
    reviewedAt: null,
    reviewer: "Codex manual source review",
    packetSha256: "GENERATE_AFTER_PACKET_IS_FINAL",
    datasetSha256,
    systemsStillBlindedDuringReview: true,
    items: packetItems.map((item) => ({
      id: item.id,
      outputA: { grade: "", wrongActionOwner: false, note: "" },
      outputB: { grade: "", wrongActionOwner: false, note: "" },
    })),
  };
  await mkdir(path.dirname(packetPath), { recursive: true });
  await Promise.all([
    writeFile(packetPath, `${JSON.stringify(packet, null, 2)}\n`, "utf8"),
    writeFile(keyPath, `${JSON.stringify(key, null, 2)}\n`, "utf8"),
    writeFile(templatePath, `${JSON.stringify(reviewTemplate, null, 2)}\n`, "utf8"),
  ]);
  process.stdout.write(`${JSON.stringify({ packetPath, keyPath, templatePath, items: packetItems.length }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
