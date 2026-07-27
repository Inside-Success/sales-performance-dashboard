import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

// The analyzer intentionally traverses frozen JSON evidence from multiple runtime versions.
/* eslint-disable @typescript-eslint/no-explicit-any */
type Json = Record<string, any>;

const highConfidenceMaterialErrors: Record<string, { category: string; reason: string }> = {
  "production-008": { category: "follow_up_non_answer", reason: "Repeated the platform boundary instead of answering what else VIP includes." },
  "production-019": { category: "request_relationship_mismatch", reason: "Returned a platform boundary instead of reviewing or improving the customer email." },
  "production-031": { category: "request_relationship_mismatch", reason: "Returned the no-contract-amendment rule for a contract-delivery automation question." },
  "production-082": { category: "wrong_topic_match", reason: "Returned an onboarding-call attendance rule for a question about leveraging client material." },
  "production-087": { category: "follow_up_wrong_topic", reason: "Returned the DJ cohort rule for a follow-up asking whether Mastermind is networking or marketing education." },
  "production-098": { category: "wrong_procedure", reason: "Returned a reapply-wait rule for the live Call 1 no-show procedure; historical V3 had the directly responsive SOP and positive feedback." },
  "production-109": { category: "wrong_topic_match", reason: "Returned an agent-switch notification rule for a daily-stats reporting question." },
  "production-110": { category: "request_relationship_mismatch", reason: "Answered contract-duration language instead of the time until an episode becomes live on Amazon." },
  "production-111": { category: "wrong_owner_and_topic", reason: "Returned a client scheduling-extension rule instead of routing the urgent greenlight action to the greenlight owner." },
  "production-126": { category: "scope_leakage", reason: "Used a SAG-specific production-details record for a general studio-address request and returned unrelated personnel details." },
  "production-127": { category: "scope_leakage", reason: "Repeated the SAG-specific production-details record for a general Miami studio-address follow-up." },
  "production-133": { category: "composed_irrelevant_rule", reason: "Appended an unrelated missing-show disposition rule to a DNC/opt-out procedure answer." },
};

const highConfidenceFalseRoutes: Record<string, string> = {
  "production-032": "Contract-link delivery was directly answerable from the historical approved guidance.",
  "production-036": "The major-platform boundary was directly answerable.",
  "production-041": "The approved no-ROI-discussion boundary was directly answerable.",
  "production-042": "The internal-material privacy boundary was directly answerable.",
  "production-045": "The discontinued weekly-social-support rule was directly answerable.",
  "production-058": "The Call 1 pricing boundary was directly answerable.",
  "production-077": "The no-cohort rule for DJ/NLCEO was directly answerable.",
  "production-120": "The immediate follow-up referred to the prison-rejection procedure and should have retained context.",
  "production-131": "The current events/Mastermind terms had a directly responsive historical answer.",
};

function argument(name: string, fallback = "") {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || fallback;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function v3Lane(item: Json) {
  if (item.productionOutcome === "conversation_reply") return "conversation";
  return item.productionNeedsRoute ? "route" : "answer";
}

function percentile(values: number[], quantile: number) {
  if (!values.length) return 0;
  const ordered = [...values].sort((left, right) => left - right);
  return ordered[Math.min(ordered.length - 1, Math.max(0, Math.ceil(ordered.length * quantile) - 1))];
}

function latency(values: number[]) {
  return {
    mean: Math.round(values.reduce((total, value) => total + value, 0) / Math.max(1, values.length)),
    p50: percentile(values, 0.5),
    p90: percentile(values, 0.9),
    max: Math.max(0, ...values),
  };
}

function counts(values: string[]) {
  return Object.fromEntries(Object.entries(values.reduce<Record<string, number>>((summary, value) => {
    summary[value] = (summary[value] || 0) + 1;
    return summary;
  }, {})).sort());
}

async function main() {
  const inputArgument = argument("input");
  if (!inputArgument) throw new Error("--input is required");
  const inputPath = path.resolve(inputArgument);
  const outputDir = path.resolve(argument("output-dir", "artifacts/ask-sales-faq-v5-12-production-head-to-head/final"));
  const raw = await readFile(inputPath, "utf8");
  const runtime = JSON.parse(raw) as Json;
  if (runtime.status !== "complete" || runtime.sourcePopulationCount !== 134 || runtime.results?.length !== 134) {
    throw new Error("Expected the complete frozen 134-response V5.12 production replay");
  }
  const providerOutputFailures = runtime.results.filter((item: Json) => {
    const attempts = item.candidate?.runtimeMetadata?.providerAttempts || [];
    return attempts.length > 0 && attempts.every((attempt: Json) => attempt.status !== "success");
  });
  if (providerOutputFailures.length) throw new Error("Completed replay contains provider-failure-only output");

  const transitions = counts(runtime.results.map((item: Json) => `${v3Lane(item)}->${item.candidate.lane}`));
  const v3Latencies = runtime.results.map((item: Json) => item.productionLatencyMs).filter((value: unknown) => typeof value === "number" && value > 0);
  const v5Latencies = runtime.results.map((item: Json) => item.candidate.latencyMs).filter((value: unknown) => typeof value === "number" && value > 0);
  const attemptedStages = runtime.results.flatMap((item: Json) => item.candidate.runtimeMetadata.providerAttempts || []);
  const report = {
    schemaVersion: "ask-sales-v5-12-production-head-to-head-analysis-v1",
    createdAt: new Date().toISOString(),
    sourceRuntimeSha256: sha256(raw),
    scope: {
      responses: 134,
      conversations: 87,
      selection: "complete privacy-reduced production population in the frozen launch window; no favorable-case sampling",
      historicalControl: "actual stored V3 answer and route outcome",
      challenger: "fresh isolated V5.12 replay with candidate-owned conversation history",
      productionMutation: false,
      productionPromotion: false,
    },
    laneCounts: {
      v3: counts(runtime.results.map((item: Json) => v3Lane(item))),
      v512: counts(runtime.results.map((item: Json) => item.candidate.lane)),
      transitions,
    },
    runtime: {
      v3LatencyMs: latency(v3Latencies),
      v512LatencyMs: latency(v5Latencies),
      v512ProviderStageAttempts: attemptedStages.length,
      v512FailedStageAttemptsRecovered: attemptedStages.filter((attempt: Json) => attempt.status !== "success").length,
      v512ProviderFailureOnlyOutputs: providerOutputFailures.length,
    },
    manualAudit: {
      method: "Engineering review of every lane change, every feedback-bearing response, multi-turn failures, and selected-source/answer alignment. This is not independent SME gold.",
      highConfidenceMaterialErrorCount: Object.keys(highConfidenceMaterialErrors).length,
      highConfidenceMaterialErrors,
      highConfidenceFalseRouteCount: Object.keys(highConfidenceFalseRoutes).length,
      highConfidenceFalseRoutes,
      primaryFailureMode: "The stored rule can be correct while V5.12 binds it to the wrong requested relationship, topic, workflow stage, or follow-up referent.",
    },
    conclusion: {
      meaningfullyBetterThanV3OnThisPopulation: false,
      safeForDirectProductionReplacement: false,
      promotionGate: "failed",
      reason: "The higher answer rate includes multiple high-confidence wrong-topic and wrong-procedure answers, including live greenlight and Call 1 cases. These are more dangerous than a safe route.",
      nextAction: "Keep V3 live. Treat wrong-relationship admission and follow-up object binding as release blockers before another direct-replacement test.",
    },
  };
  const markdown = `# Ask Sales V5.12 production-log head-to-head\n\n` +
    `## Result\n\n` +
    `V5.12 is **not approved for direct production replacement**. It answered more often, but at least ${report.manualAudit.highConfidenceMaterialErrorCount} responses contained a high-confidence material answer error and ${report.manualAudit.highConfidenceFalseRouteCount} additional source-answerable responses were routed.\n\n` +
    `## Complete-population comparison\n\n` +
    `- Population: 134 stored production responses across 87 anonymous conversations.\n` +
    `- V3: ${report.laneCounts.v3.answer || 0} answers, ${report.laneCounts.v3.route || 0} routes, ${report.laneCounts.v3.conversation || 0} conversation reply.\n` +
    `- V5.12: ${report.laneCounts.v512.answer || 0} answers, ${report.laneCounts.v512.partial || 0} partial answers, ${report.laneCounts.v512.route || 0} routes, ${report.laneCounts.v512.conversation || 0} conversation reply.\n` +
    `- V3 route -> V5.12 answer/partial: ${(transitions["route->answer"] || 0) + (transitions["route->partial"] || 0)}.\n` +
    `- V3 answer -> V5.12 route: ${transitions["answer->route"] || 0}.\n` +
    `- V5.12 runtime: ${report.runtime.v512ProviderStageAttempts} provider-stage attempts; ${report.runtime.v512FailedStageAttemptsRecovered} failed attempts recovered; zero provider-failure-only outputs.\n` +
    `- Mean latency: V3 ${report.runtime.v3LatencyMs.mean} ms; V5.12 ${report.runtime.v512LatencyMs.mean} ms. P90: V3 ${report.runtime.v3LatencyMs.p90} ms; V5.12 ${report.runtime.v512LatencyMs.p90} ms.\n\n` +
    `## Release blocker\n\n` +
    `The dominant defect is not missing knowledge. A correct source record is often present, but the runtime applies it to the wrong relationship. Confirmed examples include material-leverage -> onboarding attendance, daily-stats -> agent switch, urgent greenlight -> scheduling extension, Call 1 no-show -> reapply wait, and general studio address -> SAG-specific production metadata.\n\n` +
    `This is precisely why the raw answer-rate increase is not a safe promotion signal. A confident wrong operational answer can affect a salesperson's real decision; V3's safe route is preferable in those cases.\n\n` +
    `## Recommendation\n\n` +
    `Keep production V3 unchanged. Do not repair individual benchmark questions. The next candidate must enforce exact requested-relationship and workflow-stage compatibility after retrieval and before answer projection, preserve follow-up objects, and route when that compatibility cannot be proved. Then rerun this exact frozen population plus a later untouched production slice.\n`;
  await mkdir(outputDir, { recursive: true });
  await Promise.all([
    writeFile(path.join(outputDir, "analysis.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(path.join(outputDir, "RESULTS.md"), markdown, "utf8"),
  ]);
  console.log(JSON.stringify({ outputDir, conclusion: report.conclusion, laneCounts: report.laneCounts, runtime: report.runtime }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
