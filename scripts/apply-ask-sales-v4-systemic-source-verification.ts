import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import type { V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

type Verification = {
  policy_id: string;
  verdict: "supported" | "partial" | "unsupported";
  scope_complete: boolean;
  temporally_reusable: boolean;
  confidence: number;
  reason: string;
};
type Checkpoint = {
  schema_version: string;
  input_sha256: string;
  model: string;
  completed: Record<string, Verification>;
  failures: Record<string, string>;
};
type Bundle = {
  compilation: Record<string, number>;
  policies: V4SystemicPolicy[];
  [key: string]: unknown;
};

function sha(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

const sourcePath = resolve(process.argv[2] || "artifacts/ask-sales-faq-v4-systemic/slack-authority-thread-corpus.json");
const policyPath = resolve(process.argv[3] || "src/lib/ask-sales-faq/v4/systemic/generated-operational-qna.json");
const verificationPath = resolve(process.argv[4] || "artifacts/ask-sales-faq-v4-systemic/operational-source-verification.json");
const sourceRaw = readFileSync(sourcePath, "utf8");
const policyRaw = readFileSync(policyPath, "utf8");
const verificationRaw = readFileSync(verificationPath, "utf8");
const bundle = JSON.parse(policyRaw) as Bundle;
const checkpoint = JSON.parse(verificationRaw) as Checkpoint;
const verificationSha = sha(verificationRaw);
if (checkpoint.input_sha256 !== sha(`${sourceRaw}\n${policyRaw}`) && bundle.source_verification_sha256 !== verificationSha) {
  throw new Error("source verification does not match the current compiled policy bundle");
}
if (Object.keys(checkpoint.failures).length) throw new Error(`source verification still has ${Object.keys(checkpoint.failures).length} failures`);

const answerPolicies = bundle.policies.filter((policy) => policy.answerability === "answer_evidence");
const missing = answerPolicies.filter((policy) => !checkpoint.completed[policy.id]);
if (missing.length) throw new Error(`source verification is incomplete for ${missing.length} answer policies`);

let verifiedAnswers = 0;
let withheld = 0;
let temporalModelDisagreementsAccepted = 0;
const residualTemporalPattern = /\b(?:will be (?:added|updated)|will work its way|pending update|documentation (?:will|is going to))\b/i;
for (const policy of answerPolicies) {
  const verification = checkpoint.completed[policy.id];
  const passes = verification.verdict === "supported" &&
    verification.scope_complete &&
    verification.confidence >= 0.9 &&
    policy.systemic.temporalRisk === "stable" &&
    !residualTemporalPattern.test(`${policy.title} ${policy.decision}`);
  if (passes) {
    if (!verification.temporally_reusable) temporalModelDisagreementsAccepted += 1;
    policy.quality_flags = [...new Set([
      ...policy.quality_flags,
      "independent_source_verified",
      ...(!verification.temporally_reusable ? ["model_temporal_disagreement_deterministic_stable"] : []),
    ])];
    verifiedAnswers += 1;
    continue;
  }
  policy.answerability = "route_or_support";
  policy.quality_tier = "contextual_evidence";
  policy.quality_flags = [...new Set([...policy.quality_flags, `source_verification_withheld:${verification.verdict}`])];
  policy.route_reason = "The operational source did not pass the independent reusable-answer verification gate.";
  withheld += 1;
}

bundle.compilation = {
  ...bundle.compilation,
  answerPolicies: bundle.policies.filter((policy) => policy.answerability === "answer_evidence").length,
  routePolicies: bundle.policies.filter((policy) => policy.answerability === "route_or_support").length,
  sourceVerifiedAnswerPolicies: bundle.policies.filter((policy) => policy.answerability === "answer_evidence" && policy.quality_flags.includes("independent_source_verified")).length,
  sourceVerificationWithheld: Number(bundle.compilation.sourceVerificationWithheld || 0) + withheld,
  sourceVerificationTemporalDisagreementsAccepted: temporalModelDisagreementsAccepted,
};
bundle.source_verification_sha256 = verificationSha;
bundle.source_verification_model = checkpoint.model;
bundle.source_verification_policy = "source-supported, complete scope, confidence at least 0.90, and deterministic compiler temporal risk stable; model temporal disagreement is retained as an audit flag";
writeFileSync(policyPath, `${JSON.stringify(bundle, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({ verifiedAnswers, withheld, temporalModelDisagreementsAccepted, answerPolicies: bundle.compilation.answerPolicies, routePolicies: bundle.compilation.routePolicies, totalWithheld: bundle.compilation.sourceVerificationWithheld })}\n`);
