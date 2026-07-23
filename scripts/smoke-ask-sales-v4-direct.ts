import { generateV4Json, generateV4ValidationJson } from "../src/lib/ask-sales-faq/v4/provider";
import { runAskSalesFaqV4 } from "../src/lib/ask-sales-faq/v4/runtime";

const REQUIRED_STAGE_PURPOSES = ["v4_atomic_plan", "v4_claim_composition", "v4_claim_validation"] as const;
const DEFAULT_QUESTION = "What are the current main ISTV price options and payment plans?";

function argument(name: string) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function boundedRuns(value: string | null) {
  if (value === null) return 3;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 3) throw new Error("--runs must be an integer from 1 to 3");
  return parsed;
}

function assertIsolatedDirectPreview() {
  if (process.env.VERCEL_ENV !== "preview") throw new Error("The V4 direct smoke may run only with VERCEL_ENV=preview");
  if (process.env.ASK_SALES_V4_ISOLATED !== "true") throw new Error("ASK_SALES_V4_ISOLATED must be true for the V4 direct smoke");
  if (process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY === "true") throw new Error("The V4 direct smoke refuses Gateway mode");
  if (!process.env.ASK_SALES_V4_DEEPSEEK_API_KEY) throw new Error("The isolated V4 DeepSeek credential is not configured");
  if ((process.env.FAQ_V4_DEEPSEEK_MODEL || "deepseek-v4-pro") !== "deepseek-v4-pro") {
    throw new Error("The V4 direct smoke requires FAQ_V4_DEEPSEEK_MODEL=deepseek-v4-pro");
  }
}

function sanitizedDiagnosticText(value: unknown) {
  return String(value || "")
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|x-api-key|oidc[_-]?token)["'\s:=]+[^\s"']+/gi, "credential=[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

async function main() {
  assertIsolatedDirectPreview();
  const runs = boundedRuns(argument("runs"));
  const question = argument("question")?.trim() || DEFAULT_QUESTION;
  const summaries: Array<Record<string, unknown>> = [];

  for (let run = 1; run <= runs; run += 1) {
    const result = await runAskSalesFaqV4(question, [{ role: "user", content: question }], {
      provider: generateV4Json,
      validatorProvider: generateV4ValidationJson,
    });
    const attempts = result.runtimeMetadata.providerAttempts;
    const successfulPurposes = new Set(attempts.filter((attempt) => attempt.status === "success").map((attempt) => attempt.purpose));
    const missingPurposes = REQUIRED_STAGE_PURPOSES.filter((purpose) => !successfulPurposes.has(purpose));
    const stages = REQUIRED_STAGE_PURPOSES.map((purpose) => {
      const stageAttempts = attempts.filter((attempt) => attempt.purpose === purpose);
      return {
        purpose,
        attempts: stageAttempts.length,
        statuses: stageAttempts.map((attempt) => attempt.status),
        finalStatus: stageAttempts.at(-1)?.status || "missing",
        totalLatencyMs: stageAttempts.reduce((total, attempt) => total + attempt.latencyMs, 0),
      };
    });
    const failedChecks: string[] = [];
    if (missingPurposes.length) failedChecks.push(`missing model stage(s): ${missingPurposes.join(", ")}`);
    if (result.provider !== "deepseek" || result.model !== "deepseek-v4-pro") failedChecks.push("unexpected provider or model");
    if (
      result.runtimeMetadata.executionMode.planning !== "model" ||
      result.runtimeMetadata.executionMode.composition !== "model" ||
      result.runtimeMetadata.executionMode.validation !== "model_and_deterministic"
    ) failedChecks.push("model planner, composer, and validator path was incomplete");
    if (result.lane !== "answer" || result.needsRoute || !result.answer || !result.citations.length) failedChecks.push("complete cited answer was not produced");
    if (result.runtimeMetadata.validation.verdict !== "pass" || result.runtimeMetadata.validation.removedSentences.length) {
      failedChecks.push("claim validation did not pass cleanly");
    }
    if (failedChecks.length) {
      process.stderr.write(`Ask Sales V4 direct smoke diagnostics: ${JSON.stringify({
        run,
        ok: false,
        failedChecks,
        lane: result.lane,
        needsRoute: result.needsRoute,
        answerLength: result.answer.length,
        citationCount: result.citations.length,
        selectedPolicyCount: result.selectedPolicyIds.length,
        provider: result.provider,
        model: result.model,
        executionModes: result.runtimeMetadata.executionMode,
        validation: {
          verdict: result.runtimeMetadata.validation.verdict,
          reason: sanitizedDiagnosticText(result.runtimeMetadata.validation.reason),
          removedSentenceCount: result.runtimeMetadata.validation.removedSentences.length,
          unresolvedNeedIds: result.runtimeMetadata.validation.unresolvedNeedIds,
          sentenceChecks: result.runtimeMetadata.validation.sentenceChecks.map((check) => ({
            sentenceId: check.sentenceId,
            status: check.status,
            evidenceRefCount: check.evidenceRefs.length,
            deterministicErrors: check.deterministicErrors.map((error) => sanitizedDiagnosticText(error)),
            reason: sanitizedDiagnosticText(check.reason),
          })),
        },
        planningReason: sanitizedDiagnosticText(result.runtimeMetadata.plan.reasoning_summary),
        plannedNeeds: result.runtimeMetadata.plan.needs.map((need) => ({
          id: need.id,
          lane: need.lane,
          evidenceRefCount: need.evidence_refs.length,
          supportedClaimLength: need.supported_claim.length,
          routeKey: need.route_key,
        })),
        stages,
      })}\n`);
      throw new Error(`Run ${run} ${failedChecks.join("; ")}`);
    }

    const recoveredAttempts = attempts.filter((attempt) => attempt.status === "failed").length;
    const summary = {
      run,
      ok: true,
      lane: result.lane,
      model: result.model,
      latencyMs: result.latencyMs,
      recoveredAttempts,
      stages,
      removedSentenceCount: result.runtimeMetadata.validation.removedSentences.length,
      citationCount: result.citations.length,
      knowledgeVersion: result.runtimeMetadata.knowledgeVersion,
    };
    summaries.push(summary);
    process.stdout.write(`${JSON.stringify(summary)}\n`);
  }

  const latencies = summaries.map((summary) => Number(summary.latencyMs)).sort((left, right) => left - right);
  process.stdout.write(`${JSON.stringify({
    ok: true,
    smoke: "ask-sales-v4-direct-three-stage",
    runs,
    modelAccessConfirmed: process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED === "true",
    latencyMs: {
      min: latencies[0],
      median: latencies[Math.floor(latencies.length / 2)],
      max: latencies.at(-1),
    },
    recoveredAttemptCount: summaries.reduce((total, summary) => total + Number(summary.recoveredAttempts), 0),
  })}\n`);
}

main().catch((error) => {
  process.stderr.write(`Ask Sales V4 direct smoke failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
