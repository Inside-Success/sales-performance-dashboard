import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type JsonRecord = Record<string, unknown>;
type SystemName = "v3" | "v55";
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

function number(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function normalizedAnswer(value: unknown) {
  return text(value).toLowerCase().replace(/[’']/g, "'");
}

function hasExpectedOwner(answer: string, expectedRouteKey: string) {
  const expected = expectedRouteKey === "finance" ? "#sales-finance-requests" : "#greenlight-requests";
  const wrong = expectedRouteKey === "finance" ? "#greenlight-requests" : "#sales-finance-requests";
  return answer.includes(expected) && !answer.includes(wrong);
}

async function main() {
  const directory = path.resolve(argument("dir", "artifacts/ask-sales-faq-v5-5-blind-gate/provider-corrected"));
  const datasetPath = path.resolve(argument("dataset", "tests/ask-sales-faq/v5-5-blind-human-gold-2026-07-26.json"));
  const feedbackPath = path.resolve(argument("feedback"));
  assert(argument("feedback"), "Provide the completed blind feedback with --feedback=/absolute/or/relative/path.json");
  const outputPath = path.resolve(argument("output", path.join(directory, "blind-human-score.json")));

  const [datasetRaw, runtimeRaw, repeatabilityRaw, packetRaw, keyRaw, feedbackRaw] = await Promise.all([
    readFile(datasetPath, "utf8"),
    readFile(path.join(directory, "primary-runtime.json"), "utf8"),
    readFile(path.join(directory, "repeatability-runtime.json"), "utf8"),
    readFile(path.join(directory, "blinded-review-packet.json"), "utf8"),
    readFile(path.join(directory, "sealed-unblind-key.json"), "utf8"),
    readFile(feedbackPath, "utf8"),
  ]);
  const dataset = object(JSON.parse(datasetRaw));
  const runtime = object(JSON.parse(runtimeRaw));
  const repeatability = object(JSON.parse(repeatabilityRaw));
  const packet = object(JSON.parse(packetRaw));
  const key = object(JSON.parse(keyRaw));
  const feedback = object(JSON.parse(feedbackRaw));
  const gate = object(dataset.promotionGate);
  const mappings = object(key.mappingByItem);
  const feedbackItems = Array.isArray(feedback.items) ? feedback.items.map(object) : [];

  assert(text(runtime.status) === "complete", "Primary runtime report is incomplete");
  assert(text(repeatability.status) === "complete" && text(repeatability.mode) === "repeatability", "Repeatability report is incomplete");
  assert(text(feedback.schemaVersion) === "ask-sales-blind-human-review-v2", "Feedback must use the corrected review schema");
  assert(text(runtime.datasetSha256) === sha256(datasetRaw), "Runtime report is not bound to this dataset");
  assert(text(key.packetFileSha256) === sha256(packetRaw), "Unblind key is not bound to this packet file");
  assert(text(feedback.packetId) === text(packet.packetId), "Feedback packet ID does not match");
  assert(text(feedback.packetSha256) === text(packet.packetSha256), "Feedback packet hash does not match");
  assert(feedback.systemsStillBlindedDuringReview === true, "Feedback must confirm that identities remained hidden during review");
  assert(feedbackItems.length === 20, "Feedback must contain exactly 20 responses");
  assert(new Set(feedbackItems.map((item) => text(item.id))).size === 20, "Feedback response IDs must be unique");

  const validPreferences = new Set(["A", "B", "both", "neither"]);
  const validErrors = new Set(["none", "A", "B", "both"]);
  const feedbackById = new Map(feedbackItems.map((item) => [text(item.id), item]));
  const packetItems = Array.isArray(packet.items) ? packet.items.map(object) : [];
  assert(packetItems.length === 20, "Blind packet must contain exactly 20 items");
  for (const item of packetItems) {
    const response = feedbackById.get(text(item.id));
    assert(response, `Missing feedback for ${text(item.id)}`);
    assert(validPreferences.has(text(response.preference)), `Missing or invalid preference for ${text(item.id)}`);
    assert(validErrors.has(text(response.materialError)), `Missing or invalid material-error choice for ${text(item.id)}`);
  }

  const perSystem = {
    v3: { exclusiveWins: 0, acceptable: 0, materialErrors: 0, wrongActionOwners: 0 },
    v55: { exclusiveWins: 0, acceptable: 0, materialErrors: 0, wrongActionOwners: 0 },
  };
  let ties = 0;
  let neither = 0;
  const scoredItems = packetItems.map((item) => {
    const id = text(item.id);
    const response = feedbackById.get(id)!;
    const mapping = object(mappings[id]) as Mapping;
    assert(new Set([text(mapping.A), text(mapping.B)]).size === 2, `Invalid system mapping for ${id}`);
    const preference = text(response.preference);
    const materialError = text(response.materialError);

    if (preference === "A" || preference === "B") {
      const winner = mapping[preference];
      perSystem[winner].exclusiveWins += 1;
      perSystem[winner].acceptable += 1;
    } else if (preference === "both") {
      ties += 1;
      perSystem.v3.acceptable += 1;
      perSystem.v55.acceptable += 1;
    } else {
      neither += 1;
    }

    if (materialError === "A" || materialError === "B") {
      perSystem[mapping[materialError]].materialErrors += 1;
    } else if (materialError === "both") {
      perSystem.v3.materialErrors += 1;
      perSystem.v55.materialErrors += 1;
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

  const goldItems = [
    ...(Array.isArray(dataset.cases) ? dataset.cases.map(object) : []),
    ...(Array.isArray(dataset.conversations) ? dataset.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
  ];
  const runtimeItems = [
    ...(Array.isArray(runtime.cases) ? runtime.cases.map(object) : []),
    ...(Array.isArray(runtime.conversations) ? runtime.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
  ];
  const runtimeById = new Map(runtimeItems.map((item) => [text(item.id), item]));
  const repeatabilityItems = [
    ...(Array.isArray(repeatability.cases) ? repeatability.cases.map(object) : []),
    ...(Array.isArray(repeatability.conversations) ? repeatability.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
  ];
  const repeatabilityMismatches: Array<{ id: string; system: string }> = [];
  const stableDecision = (value: JsonRecord) => JSON.stringify({
    lane: text(value.lane) || text(value.outcome),
    needsRoute: value.needsRoute === true,
    routeChannels: Array.isArray(value.routeChannels) ? value.routeChannels : [],
  });
  for (const repeated of repeatabilityItems) {
    const primary = runtimeById.get(text(repeated.id));
    assert(primary, `Repeatability prompt ${text(repeated.id)} is missing from the primary report`);
    for (const system of ["v3", "v55"] as const) {
      if (stableDecision(object(object(primary.systems)[system])) !== stableDecision(object(object(repeated.systems)[system]))) {
        repeatabilityMismatches.push({ id: text(repeated.id), system });
      }
    }
  }
  for (const item of goldItems.filter((entry) => text(entry.expectedDisposition) === "route")) {
    const runtimeItem = runtimeById.get(text(item.id));
    assert(runtimeItem, `Runtime output missing for routed control ${text(item.id)}`);
    const systems = object(runtimeItem.systems);
    for (const system of ["v3", "v55"] as const) {
      const result = object(systems[system]);
      const answer = normalizedAnswer(result.answer);
      const routeChannels = Array.isArray(result.routeChannels) ? result.routeChannels.map(normalizedAnswer).join(" ") : "";
      if (!hasExpectedOwner(`${answer} ${routeChannels}`, text(item.expectedRouteKey))) {
        perSystem[system].wrongActionOwners += 1;
      }
    }
  }

  const total = packetItems.length;
  const v55AcceptableRate = perSystem.v55.acceptable / total;
  const pairwiseNetWins = perSystem.v55.exclusiveWins - perSystem.v3.exclusiveWins;
  const checks = {
    meaningfulPairwiseLead: pairwiseNetWins >= number(gate.minimumPairwiseNetWinsOverV3),
    noV55CriticalErrors: perSystem.v55.materialErrors <= number(gate.maximumV55CriticalErrors),
    noV55WrongActionOwners: perSystem.v55.wrongActionOwners <= number(gate.maximumV55WrongActionOwners),
    minimumV55AcceptableRate: v55AcceptableRate >= number(gate.minimumV55AcceptableRate),
    repeatabilityDecisionStable: repeatabilityMismatches.length === 0,
    explicitOwnerApprovalRecorded: false,
  };
  const technicalGatePassed = checks.meaningfulPairwiseLead
    && checks.noV55CriticalErrors
    && checks.noV55WrongActionOwners
    && checks.minimumV55AcceptableRate
    && checks.repeatabilityDecisionStable;
  const result = {
    schemaVersion: "ask-sales-v5-5-blind-human-score-v2",
    scoredAt: new Date().toISOString(),
    packetId: text(packet.packetId),
    packetSha256: text(packet.packetSha256),
    datasetSha256: sha256(datasetRaw),
    feedbackSha256: sha256(feedbackRaw),
    conservativeScoringNote: "An exclusive A/B preference counts only the preferred system as acceptable. 'Both acceptable' counts both; 'Neither' counts neither.",
    totals: {
      prompts: total,
      ties,
      neither,
      v3: { ...perSystem.v3, acceptableRate: perSystem.v3.acceptable / total },
      v55: { ...perSystem.v55, acceptableRate: v55AcceptableRate },
      v55PairwiseNetWinsOverV3: pairwiseNetWins,
    },
    preregisteredGate: gate,
    checks,
    repeatabilityMismatches,
    technicalGatePassed,
    productionPromotionAuthorized: false,
    decision: technicalGatePassed
      ? "Technical blind gate passed; production still requires explicit owner approval and separate release verification."
      : "Technical blind gate failed; keep V3 in production and do not promote V5.5.",
    scoredItems,
  };
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, ...result.totals, checks, technicalGatePassed, productionPromotionAuthorized: false }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
