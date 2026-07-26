import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;
type SystemName = "v3" | "v56";
type Mapping = { A: SystemName; B: SystemName };

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

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalized(value: unknown) {
  return text(value).toLowerCase().replace(/[’']/g, "'");
}

function hasExpectedOwner(answer: string, expectedRouteKey: string) {
  const expected = expectedRouteKey === "finance" ? "#sales-finance-requests" : "#greenlight-requests";
  const wrong = expectedRouteKey === "finance" ? "#greenlight-requests" : "#sales-finance-requests";
  return answer.includes(expected) && !answer.includes(wrong);
}

function flatten(report: JsonRecord) {
  return [
    ...(Array.isArray(report.cases) ? report.cases.map(object) : []),
    ...(Array.isArray(report.conversations) ? report.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
  ];
}

async function main() {
  const directory = path.resolve(argument("dir", "artifacts/ask-sales-faq-v5-6-causal"));
  const blindDirectory = path.join(directory, "blind-review");
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-5-blind-human-gold-2026-07-26.json"));
  const feedbackPath = path.resolve(argument("feedback"));
  assert(argument("feedback"), "Provide completed feedback with --feedback=/absolute/or/relative/path.json");
  const outputPath = path.resolve(argument("output", path.join(blindDirectory, "blind-human-score.json")));
  const [datasetRaw, runtimeRaw, analysisRaw, packetRaw, keyRaw, feedbackRaw] = await Promise.all([
    readFile(datasetPath, "utf8"),
    readFile(path.join(directory, "comparison-runtime.json"), "utf8"),
    readFile(path.join(directory, "repeatability-analysis.json"), "utf8"),
    readFile(path.join(blindDirectory, "blinded-review-packet.json"), "utf8"),
    readFile(path.join(blindDirectory, "sealed-unblind-key.json"), "utf8"),
    readFile(feedbackPath, "utf8"),
  ]);
  const dataset = object(JSON.parse(datasetRaw));
  const runtime = object(JSON.parse(runtimeRaw));
  const analysis = object(JSON.parse(analysisRaw));
  const packet = object(JSON.parse(packetRaw));
  const key = object(JSON.parse(keyRaw));
  const feedback = object(JSON.parse(feedbackRaw));
  const mappings = object(key.mappingByItem);
  const packetItems = Array.isArray(packet.items) ? packet.items.map(object) : [];
  const feedbackItems = Array.isArray(feedback.items) ? feedback.items.map(object) : [];
  const feedbackById = new Map(feedbackItems.map((item) => [text(item.id), item]));

  assert(text(runtime.status) === "complete", "Comparison runtime is incomplete");
  assert(text(analysis.status) === "complete", "Repeatability analysis is incomplete");
  assert(text(runtime.datasetSha256) === sha256(datasetRaw), "Comparison runtime is not bound to this source-gold dataset");
  assert(text(key.packetFileSha256) === sha256(packetRaw), "Unblind key is not bound to this packet");
  assert(text(feedback.schemaVersion) === "ask-sales-blind-human-review-v2", "Feedback schema is invalid");
  assert(text(feedback.packetId) === text(packet.packetId) && text(feedback.packetSha256) === text(packet.packetSha256), "Feedback belongs to a different packet");
  assert(feedback.systemsStillBlindedDuringReview === true, "Feedback must confirm that system identities stayed hidden during review");
  assert(packetItems.length === 20 && feedbackItems.length === 20, "Packet and feedback must each contain 20 items");

  const validPreferences = new Set(["A", "B", "both", "neither"]);
  const validErrors = new Set(["none", "A", "B", "both"]);
  for (const item of packetItems) {
    const response = feedbackById.get(text(item.id));
    assert(response, `Missing feedback for ${text(item.id)}`);
    assert(validPreferences.has(text(response.preference)), `Invalid preference for ${text(item.id)}`);
    assert(validErrors.has(text(response.materialError)), `Invalid material-error choice for ${text(item.id)}`);
  }

  const perSystem: Record<SystemName, { exclusiveWins: number; acceptable: number; materialErrors: number; wrongActionOwners: number }> = {
    v3: { exclusiveWins: 0, acceptable: 0, materialErrors: 0, wrongActionOwners: 0 },
    v56: { exclusiveWins: 0, acceptable: 0, materialErrors: 0, wrongActionOwners: 0 },
  };
  let ties = 0;
  let neither = 0;
  const scoredItems = packetItems.map((item) => {
    const id = text(item.id);
    const response = feedbackById.get(id)!;
    const mapping = object(mappings[id]) as Mapping;
    assert(new Set([text(mapping.A), text(mapping.B)]).size === 2 && [mapping.A, mapping.B].every((system) => ["v3", "v56"].includes(system)), `Invalid mapping for ${id}`);
    const preference = text(response.preference);
    const materialError = text(response.materialError);
    if (preference === "A" || preference === "B") {
      perSystem[mapping[preference]].exclusiveWins += 1;
      perSystem[mapping[preference]].acceptable += 1;
    } else if (preference === "both") {
      ties += 1;
      perSystem.v3.acceptable += 1;
      perSystem.v56.acceptable += 1;
    } else neither += 1;
    if (materialError === "A" || materialError === "B") perSystem[mapping[materialError]].materialErrors += 1;
    else if (materialError === "both") {
      perSystem.v3.materialErrors += 1;
      perSystem.v56.materialErrors += 1;
    }
    return {
      id,
      preference,
      materialError,
      note: text(response.note),
      unblindedPreference: preference === "A" || preference === "B" ? mapping[preference] : preference,
      unblindedMaterialError: materialError === "A" || materialError === "B" ? mapping[materialError] : materialError,
    };
  });

  const runtimeById = new Map(flatten(runtime).map((item) => [text(item.id), item]));
  for (const gold of flatten(dataset).filter((item) => text(item.expectedDisposition) === "route")) {
    const runtimeItem = runtimeById.get(text(gold.id));
    assert(runtimeItem, `Missing routed control ${text(gold.id)}`);
    for (const system of ["v3", "v56"] as const) {
      const result = object(object(runtimeItem.systems)[system]);
      const routeText = Array.isArray(result.routeChannels) ? result.routeChannels.map(normalized).join(" ") : "";
      if (!hasExpectedOwner(`${normalized(result.answer)} ${routeText}`, text(gold.expectedRouteKey))) perSystem[system].wrongActionOwners += 1;
    }
  }

  const gate = object(dataset.promotionGate);
  const aggregate = object(analysis.aggregate);
  const total = packetItems.length;
  const v56AcceptableRate = perSystem.v56.acceptable / total;
  const pairwiseNetWins = perSystem.v56.exclusiveWins - perSystem.v3.exclusiveWins;
  const checks = {
    meaningfulPairwiseLead: pairwiseNetWins >= numeric(gate.minimumPairwiseNetWinsOverV3),
    noV56MaterialErrors: perSystem.v56.materialErrors <= numeric(gate.maximumV55CriticalErrors),
    noV56WrongActionOwners: perSystem.v56.wrongActionOwners <= numeric(gate.maximumV55WrongActionOwners),
    minimumV56AcceptableRate: v56AcceptableRate >= numeric(gate.minimumV55AcceptableRate),
    repeatabilityDecisionStable: numeric(aggregate.laneFlipComparisons) === 0 && numeric(aggregate.decisionBoundaryFlipComparisons) === 0,
    explicitOwnerApprovalRecorded: false,
  };
  const technicalGatePassed = checks.meaningfulPairwiseLead && checks.noV56MaterialErrors && checks.noV56WrongActionOwners && checks.minimumV56AcceptableRate && checks.repeatabilityDecisionStable;
  const result = {
    schemaVersion: "ask-sales-v5-6-blind-human-score-v1",
    scoredAt: new Date().toISOString(),
    packetId: text(packet.packetId),
    packetSha256: text(packet.packetSha256),
    feedbackSha256: sha256(feedbackRaw),
    totals: {
      prompts: total,
      ties,
      neither,
      v3: { ...perSystem.v3, acceptableRate: perSystem.v3.acceptable / total },
      v56: { ...perSystem.v56, acceptableRate: v56AcceptableRate },
      v56PairwiseNetWinsOverV3: pairwiseNetWins,
    },
    checks,
    technicalGatePassed,
    productionPromotionAuthorized: false,
    decision: technicalGatePassed
      ? "Technical blind gate passed; production still requires explicit owner approval and separate release verification."
      : "Technical blind gate failed; keep V3 in production and do not promote V5.6.",
    scoredItems,
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, ...result.totals, checks, technicalGatePassed, productionPromotionAuthorized: false }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
