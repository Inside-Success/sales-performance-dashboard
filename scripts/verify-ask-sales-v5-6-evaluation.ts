import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
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

function numeric(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function items(report: JsonRecord) {
  return [
    ...(Array.isArray(report.cases) ? report.cases.map(object) : []),
    ...(Array.isArray(report.conversations) ? report.conversations.map(object).flatMap((conversation) =>
      Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : []) : []),
  ];
}

async function main() {
  const directory = path.resolve(argument("dir", "artifacts/ask-sales-faq-v5-6-causal"));
  const blindDirectory = path.join(directory, "blind-review");
  const runPaths = [1, 2, 3, 4, 5].map((run) => path.join(directory, `release-candidate-${run}.json`));
  const [
    ...raws
  ] = await Promise.all([
    ...runPaths.map((runPath) => readFile(runPath, "utf8")),
    readFile(path.join(directory, "repeatability-analysis.json"), "utf8"),
    readFile(path.join(directory, "comparison-runtime.json"), "utf8"),
    readFile(path.join(blindDirectory, "blinded-review-packet.json"), "utf8"),
    readFile(path.join(blindDirectory, "sealed-unblind-key.json"), "utf8"),
    readFile(path.join(blindDirectory, "review-feedback-template.json"), "utf8"),
    readFile(path.join(blindDirectory, "ASK-SALES-BLIND-REVIEW.html"), "utf8"),
  ]);
  const runRaws = raws.slice(0, 5);
  const [analysisRaw, comparisonRaw, packetRaw, keyRaw, templateRaw, html] = raws.slice(5);
  const runs = runRaws.map((raw) => object(JSON.parse(raw)));
  const analysis = object(JSON.parse(analysisRaw));
  const comparison = object(JSON.parse(comparisonRaw));
  const packet = object(JSON.parse(packetRaw));
  const key = object(JSON.parse(keyRaw));
  const template = object(JSON.parse(templateRaw));

  const expectedIds = items(runs[0]).map((item) => text(item.id));
  assert(expectedIds.length === 20 && new Set(expectedIds).size === 20, "Repeatability run 1 must contain 20 unique prompts");
  for (const [index, run] of runs.entries()) {
    assert(text(run.status) === "complete", `Repeatability run ${index + 1} is incomplete`);
    assert(Array.isArray(run.systems) && run.systems.length === 1 && run.systems[0] === "v56", `Repeatability run ${index + 1} must execute only V5.6`);
    assert(JSON.stringify(items(run).map((item) => text(item.id))) === JSON.stringify(expectedIds), `Repeatability run ${index + 1} changed prompt order or identity`);
    const summary = object(object(run.summary).v56);
    assert(summary.completed === 20, `Repeatability run ${index + 1} did not complete all prompts`);
    assert(summary.terminalProviderFailures === 0 && summary.providerUnavailableOutputs === 0, `Repeatability run ${index + 1} contains provider failures`);
    assert(numeric(summary.successfulProviderAttempts) > 0, `Repeatability run ${index + 1} did not execute provider-backed stages`);
    for (const item of items(run)) {
      const result = object(object(item.systems).v56);
      assert(text(result.answer), `Repeatability run ${index + 1} has an empty answer for ${text(item.id)}`);
      assert(text(object(result.runtimeMetadata).pipelineVersion) === "v5.6-isolated", `Repeatability run ${index + 1} did not execute V5.6 for ${text(item.id)}`);
    }
  }

  assert(text(analysis.status) === "complete", "Repeatability analysis is incomplete");
  const aggregate = object(analysis.aggregate);
  assert(aggregate.runs === 5 && aggregate.prompts === 20 && aggregate.executions === 100, "Repeatability analysis did not cover five by twenty executions");
  const analysisInputs = Array.isArray(analysis.inputs) ? analysis.inputs.map(object) : [];
  assert(analysisInputs.length === 5, "Repeatability analysis input manifest is incomplete");
  for (const [index, input] of analysisInputs.entries()) {
    assert(text(input.sha256) === sha256(runRaws[index]), `Repeatability analysis hash mismatch for run ${index + 1}`);
  }

  assert(text(comparison.status) === "complete", "Three-system comparison is incomplete");
  assert(JSON.stringify(comparison.systems) === JSON.stringify(["v3", "v55", "v56"]), "Comparison must contain V3, V5.5, and V5.6 in that order");
  const preflight = object(comparison.providerPreflight);
  const providerModels = ["v3", "v55", "v56"].map((system) => `${text(object(preflight[system]).provider)}:${text(object(preflight[system]).model)}`);
  assert(new Set(providerModels).size === 1 && !providerModels[0].startsWith(":"), "Comparison provider/model parity failed");
  for (const system of ["v3", "v55", "v56"]) {
    const summary = object(object(comparison.summary)[system]);
    assert(summary.completed === 20, `${system} did not complete all comparison prompts`);
    assert(summary.terminalProviderFailures === 0 && summary.providerUnavailableOutputs === 0, `${system} contains a provider failure`);
  }

  const packetItems = Array.isArray(packet.items) ? packet.items.map(object) : [];
  const mappings = object(key.mappingByItem);
  assert(packetItems.length === 20 && new Set(packetItems.map((item) => text(item.id))).size === 20, "Blind packet must contain 20 unique prompts");
  assert(packetItems.every((item) => text(item.goldAnswer) && text(object(item.outputA).answer) && text(object(item.outputB).answer)), "Every blind item must show the verified rule and two answers");
  assert(packetItems.every((item, index) => item.order === index + 1 && item.batch === Math.floor(index / 5) + 1), "Blind packet must remain four batches of five");
  assert(packetItems.every((item) => {
    const mapping = object(mappings[text(item.id)]);
    return new Set([text(mapping.A), text(mapping.B)]).size === 2 && [text(mapping.A), text(mapping.B)].every((system) => ["v3", "v56"].includes(system));
  }), "Blind key must map every item to V3 and V5.6");
  assert(text(key.packetFileSha256) === sha256(packetRaw), "Blind packet and unblind key hashes do not match");
  assert(text(template.packetSha256) === text(packet.packetSha256), "Feedback template is not bound to the blind packet");
  assert(/Verified rule/.test(html) && /one question at a time/i.test(html), "Blind reviewer does not expose the verified rule in the low-overload workflow");
  assert(!/sealed-unblind-key|mappingByItem|"v3"|"v56"/.test(html), "Blind reviewer leaks system identity or key details");
  assert(!/<script[^>]+src=|<link[^>]+href=|https?:\/\//i.test(html), "Blind reviewer must be self-contained and make no network requests");

  const secretPattern = /(?:\bsk-[A-Za-z0-9_-]{20,}|\bgh[opsu]_[A-Za-z0-9]{20,}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/;
  for (const [name, raw] of Object.entries({ analysisRaw, comparisonRaw, packetRaw, keyRaw, templateRaw, html })) {
    assert(!secretPattern.test(raw), `${name} contains a credential-like value`);
  }

  const result = {
    schemaVersion: "ask-sales-v5-6-evaluation-verification-v1",
    status: "verified",
    verifiedAt: new Date().toISOString(),
    repeatability: {
      executions: aggregate.executions,
      laneFlipComparisons: aggregate.laneFlipComparisons,
      decisionBoundaryFlipComparisons: aggregate.decisionBoundaryFlipComparisons,
      exactAnswerFlipComparisons: aggregate.exactAnswerFlipComparisons,
      casesRequiringManualReview: aggregate.casesRequiringManualReview,
    },
    comparison: Object.fromEntries(["v3", "v55", "v56"].map((system) => [system, object(object(comparison.summary)[system])])),
    blindReview: { prompts: 20, batches: 4, verifiedRuleShown: true, systemsHidden: true, selfContained: true },
    productionPromotionAuthorized: false,
  };
  const outputPath = path.join(directory, "evaluation-verification.json");
  await writeFile(outputPath, `${JSON.stringify(result, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({ outputPath, ...result }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
