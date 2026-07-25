import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Grade = "pass" | "partial" | "fail" | "critical";
type SystemName = "v3" | "v5";
type JsonRecord = Record<string, unknown>;

const gradeScore: Record<Grade, number> = { pass: 1, partial: 0.5, fail: 0, critical: 0 };

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

function grade(value: unknown): Grade {
  const candidate = text(value) as Grade;
  if (!new Set<Grade>(["pass", "partial", "fail", "critical"]).has(candidate)) throw new Error(`Invalid or missing grade: ${text(value)}`);
  return candidate;
}

function summarize(details: Array<{ grade: Grade; wrongActionOwner: boolean }>) {
  const counts = details.reduce<Record<Grade, number>>((result, item) => {
    result[item.grade] += 1;
    return result;
  }, { pass: 0, partial: 0, fail: 0, critical: 0 });
  const weightedUtility = details.reduce((total, item) => total + gradeScore[item.grade], 0);
  return {
    total: details.length,
    counts,
    weightedUtility,
    weightedUtilityRate: Number((weightedUtility / details.length).toFixed(4)),
    wrongActionOwners: details.filter((item) => item.wrongActionOwner).length,
  };
}

async function main() {
  const packetPath = path.resolve(argument("packet"));
  const keyPath = path.resolve(argument("key"));
  const reviewPath = path.resolve(argument("review"));
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-3-independent-slack-gold-2026-07-25.json"));
  const outputPath = path.resolve(argument("output"));
  if (!argument("packet") || !argument("key") || !argument("review") || !argument("output")) {
    throw new Error("--packet, --key, --review, and --output are required");
  }
  const [packetRaw, keyRaw, reviewRaw, datasetRaw] = await Promise.all([
    readFile(packetPath, "utf8"),
    readFile(keyPath, "utf8"),
    readFile(reviewPath, "utf8"),
    readFile(datasetPath, "utf8"),
  ]);
  const packet = object(JSON.parse(packetRaw));
  const key = object(JSON.parse(keyRaw));
  const review = object(JSON.parse(reviewRaw));
  const dataset = object(JSON.parse(datasetRaw));
  const packetSha256 = createHash("sha256").update(packetRaw).digest("hex");
  if (text(review.packetSha256) !== packetSha256) throw new Error("Review does not name the final blinded packet hash");
  if (review.systemsStillBlindedDuringReview !== true) throw new Error("Review must attest that systems remained blinded while grades were assigned");
  if (text(packet.datasetSha256) !== text(key.datasetSha256) || text(packet.datasetSha256) !== text(review.datasetSha256)) {
    throw new Error("Packet, key, and review dataset hashes do not match");
  }
  const packetItems = Array.isArray(packet.items) ? packet.items.map(object) : [];
  const reviewItems = Array.isArray(review.items) ? review.items.map(object) : [];
  const reviewById = new Map(reviewItems.map((item) => [text(item.id), item]));
  if (packetItems.length !== reviewItems.length || new Set(reviewItems.map((item) => text(item.id))).size !== packetItems.length) {
    throw new Error("Blind review does not cover every packet item exactly once");
  }
  const mappingByItem = object(key.mappingByItem);
  const details: Record<SystemName, Array<{
    id: string;
    conversationId: string | null;
    grade: Grade;
    wrongActionOwner: boolean;
    note: string;
  }>> = { v3: [], v5: [] };

  for (const item of packetItems) {
    const id = text(item.id);
    const itemReview = reviewById.get(id);
    if (!itemReview) throw new Error(`Missing review row for ${id}`);
    const mapping = object(mappingByItem[id]);
    if (!new Set(["v3", "v5"]).has(text(mapping.A)) || !new Set(["v3", "v5"]).has(text(mapping.B)) || mapping.A === mapping.B) {
      throw new Error(`Invalid unblind mapping for ${id}`);
    }
    for (const label of ["A", "B"] as const) {
      const system = text(mapping[label]) as SystemName;
      const reviewedOutput = object(itemReview[`output${label}`]);
      details[system].push({
        id,
        conversationId: text(item.conversationId) || null,
        grade: grade(reviewedOutput.grade),
        wrongActionOwner: reviewedOutput.wrongActionOwner === true,
        note: text(reviewedOutput.note),
      });
    }
  }

  const summaries = {
    v3: summarize(details.v3),
    v5: summarize(details.v5),
  };
  const conversationSummaries = {
    v3: summarize(details.v3.filter((item) => item.conversationId)),
    v5: summarize(details.v5.filter((item) => item.conversationId)),
  };
  const v3ById = new Map(details.v3.map((item) => [item.id, item]));
  const headToHead = details.v5.reduce((counts, item) => {
    const v3 = v3ById.get(item.id)!;
    const delta = gradeScore[item.grade] - gradeScore[v3.grade];
    if (delta > 0) counts.v5Wins += 1;
    else if (delta < 0) counts.v3Wins += 1;
    else counts.ties += 1;
    return counts;
  }, { v5Wins: 0, v3Wins: 0, ties: 0 });
  const mode = text(packet.mode);
  const promotionGate = object(dataset.promotionGate);
  const utilityLead = Number((summaries.v5.weightedUtilityRate - summaries.v3.weightedUtilityRate).toFixed(4));
  const checks = mode === "primary" ? {
    weightedUtilityLead: utilityLead >= Number(promotionGate.minimumWeightedUtilityLeadOverV3),
    zeroV5CriticalErrors: summaries.v5.counts.critical <= Number(promotionGate.maximumV5CriticalErrors),
    zeroV5WrongActionOwners: summaries.v5.wrongActionOwners <= Number(promotionGate.maximumV5WrongActionOwners),
    conversationUtility: conversationSummaries.v5.weightedUtilityRate >= Number(promotionGate.minimumV5ConversationWeightedUtility),
  } : null;
  const technicalGatePassed = checks ? Object.values(checks).every(Boolean) : null;
  const result = {
    schemaVersion: "ask-sales-v5-3-unblinded-human-score-v1",
    scoredAt: new Date().toISOString(),
    mode,
    manualSourceReviewPrimary: true,
    aiJudgePromotionAuthority: false,
    datasetSha256: text(packet.datasetSha256),
    packetPath,
    packetSha256,
    reviewPath,
    reviewSha256: createHash("sha256").update(reviewRaw).digest("hex"),
    keyPath,
    summaries,
    conversationSummaries,
    headToHead,
    weightedUtilityLeadV5OverV3: utilityLead,
    promotionGate: {
      applicable: mode === "primary",
      checks,
      technicalGatePassed,
      stakeholderApprovalRecorded: false,
      productionCutoverAuthorized: false,
    },
    details,
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, mode, summaries, conversationSummaries, headToHead, utilityLead, promotionGate: result.promotionGate }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
