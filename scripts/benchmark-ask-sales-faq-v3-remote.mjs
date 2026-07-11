import { spawn } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

function argument(name) {
  const prefix = `--${name}=`;
  return process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length) || null;
}

function percentile(values, fraction) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * fraction) - 1))];
}

function summarize(report) {
  const items = report.conversations.flatMap((conversation) => conversation.items);
  const outcomes = Object.fromEntries(
    Array.from(new Set(items.map((item) => item.outcome))).sort().map((outcome) => [outcome, items.filter((item) => item.outcome === outcome).length]),
  );
  const validations = Object.fromEntries(
    Array.from(new Set(items.map((item) => item.runtimeMetadata?.v3?.validation?.verdict || "none"))).sort().map((verdict) => [verdict, items.filter((item) => (item.runtimeMetadata?.v3?.validation?.verdict || "none") === verdict).length]),
  );
  const latencies = items.map((item) => item.latencyMs);
  const normalizedAnswers = items.map((item) => item.answer.toLowerCase().replace(/\s+/g, " ").trim());
  const repeatedAnswers = Array.from(new Set(normalizedAnswers))
    .map((answer) => ({ answer, count: normalizedAnswers.filter((candidate) => candidate === answer).length }))
    .filter((item) => item.count > 1)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  const directOrConversation = items.filter((item) => item.outcome === "answer_from_evidence" || item.outcome === "conversation_reply").length;
  return {
    total: items.length,
    directOrConversation,
    directOrConversationRate: Math.round((directOrConversation / Math.max(1, items.length)) * 1000) / 10,
    routedOrUnanswered: items.length - directOrConversation,
    outcomes,
    validations,
    errors: items.filter((item) => Boolean(item.errorClass)).length,
    providers: Object.fromEntries(
      Array.from(new Set(items.map((item) => item.provider || "none"))).sort().map((provider) => [provider, items.filter((item) => (item.provider || "none") === provider).length]),
    ),
    latencyMs: {
      average: Math.round(latencies.reduce((total, value) => total + value, 0) / Math.max(1, latencies.length)),
      p50: percentile(latencies, 0.5),
      p95: percentile(latencies, 0.95),
      max: Math.max(0, ...latencies),
    },
    repeatedAnswers,
  };
}

async function callRemoteBenchmark(deployment, payload) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "vercel",
      [
        "curl",
        "/api/ask-sales-faq/v3-benchmark",
        "--deployment",
        deployment,
        "--",
        "--silent",
        "--request",
        "POST",
        "--header",
        "content-type: application/json",
        "--header",
        "x-ask-sales-benchmark: v3-isolated",
        "--data-binary",
        "@-",
      ],
      { cwd: process.cwd(), stdio: ["pipe", "pipe", "pipe"] },
    );
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(`Remote benchmark failed with exit ${code}: ${Buffer.concat(stderr).toString("utf8").slice(-1000)}`));
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(stdout).toString("utf8")));
      } catch (error) {
        reject(new Error(`Remote benchmark returned invalid JSON: ${error instanceof Error ? error.message : String(error)}`));
      }
    });
    child.stdin.end(JSON.stringify(payload));
  });
}

async function main() {
  const deployment = argument("deployment");
  if (!deployment) throw new Error("Pass --deployment=<Vercel deployment id or URL>.");
  const datasetPath = path.resolve(argument("dataset") || "tests/ask-sales-faq/v3-regression-78.json");
  const payload = JSON.parse(await readFile(datasetPath, "utf8"));
  const limit = Number.parseInt(argument("limit") || "0", 10);
  if (limit > 0) payload.limit = limit;
  const startedAt = new Date().toISOString();
  const report = await callRemoteBenchmark(deployment, payload);
  const completedAt = new Date().toISOString();
  const outputDir = path.resolve(argument("output-dir") || "artifacts/ask-sales-faq-v3");
  await mkdir(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `remote-${completedAt.replace(/[:.]/g, "-")}.json`);
  const artifact = { schemaVersion: 1, deployment, startedAt, completedAt, summary: summarize(report), ...report };
  await writeFile(outputPath, JSON.stringify(artifact, null, 2) + "\n", "utf8");
  console.log(JSON.stringify({ outputPath, summary: artifact.summary }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
