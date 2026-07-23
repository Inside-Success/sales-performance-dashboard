import { createHash } from "node:crypto";
import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

type Bundle = { policies: Array<{ id: string; answerability: string }> };
type Checkpoint = {
  schema_version: "ask-sales-v4-systemic-source-verification-v1";
  input_sha256: string;
  model: string;
  completed: Record<string, unknown>;
  failures: Record<string, string>;
};

const sourcePath = resolve(process.argv[2]);
const policyPath = resolve(process.argv[3]);
const previousPath = resolve(process.argv[4]);
const outputPath = resolve(process.argv[5]);
const sourceRaw = readFileSync(sourcePath, "utf8");
const policyRaw = readFileSync(policyPath, "utf8");
const policies = JSON.parse(policyRaw) as Bundle;
const previous = JSON.parse(readFileSync(previousPath, "utf8")) as Checkpoint;
const answerIds = new Set(policies.policies.filter((policy) => policy.answerability === "answer_evidence").map((policy) => policy.id));
const completed = Object.fromEntries(Object.entries(previous.completed).filter(([id]) => answerIds.has(id)));
const output: Checkpoint = {
  schema_version: "ask-sales-v4-systemic-source-verification-v1",
  input_sha256: createHash("sha256").update(`${sourceRaw}\n${policyRaw}`).digest("hex"),
  model: previous.model,
  completed,
  failures: {},
};
writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
chmodSync(outputPath, 0o600);
process.stdout.write(`${JSON.stringify({ answerPolicies: answerIds.size, reused: Object.keys(completed).length, pending: answerIds.size - Object.keys(completed).length })}\n`);
