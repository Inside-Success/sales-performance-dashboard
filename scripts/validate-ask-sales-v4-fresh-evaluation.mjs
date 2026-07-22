import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const freshPath = path.resolve(
  process.argv.find((value) => value.startsWith("--fresh="))?.slice("--fresh=".length)
    || "tests/ask-sales-faq/v4-fresh-slack-source-gold-2026-07-22.json",
);
const replayPath = path.resolve(
  process.argv.find((value) => value.startsWith("--replay="))?.slice("--replay=".length)
    || "tests/ask-sales-faq/v4-live-v3-log-replay-2026-07-22.json",
);
const benchmarkPath = path.resolve("scripts/benchmark-ask-sales-faq-v4-paired.ts");

const stop = new Set([
  "a", "an", "and", "are", "as", "at", "be", "but", "by", "can", "do", "does", "for", "from", "had",
  "has", "have", "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "our", "should",
  "so", "that", "the", "their", "them", "they", "this", "to", "was", "we", "what", "when", "where",
  "which", "who", "will", "with", "would", "you",
]);

function normalizedText(value) {
  return value
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9$%]+/g, " ")
    .trim();
}

function tokens(value) {
  return new Set(normalizedText(value).split(/\s+/).filter((token) => token.length > 1 && !stop.has(token)));
}

function overlap(left, right) {
  const a = tokens(left);
  const b = tokens(right);
  if (!a.size || !b.size) return { jaccard: 0, containment: 0 };
  const intersection = [...a].filter((token) => b.has(token)).length;
  return {
    jaccard: intersection / (a.size + b.size - intersection),
    containment: intersection / Math.min(a.size, b.size),
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function promptEntries(dataset) {
  if (!Array.isArray(dataset.conversations)) throw new Error(`${dataset.name || "dataset"} must contain conversations.`);
  return dataset.conversations.flatMap((conversation, conversationIndex) => {
    if (!Array.isArray(conversation.prompts) || !conversation.prompts.length) {
      throw new Error(`conversations[${conversationIndex}] must contain prompts.`);
    }
    return conversation.prompts.map((prompt, promptIndex) => {
      const entry = typeof prompt === "string" ? { question: prompt } : prompt;
      if (!entry || typeof entry !== "object" || typeof entry.question !== "string" || !entry.question.trim()) {
        throw new Error(`conversations[${conversationIndex}].prompts[${promptIndex}] needs a question.`);
      }
      return { ...entry, conversationId: conversation.id, promptIndex: promptIndex + 1 };
    });
  });
}

function validateCounts(dataset, entries, label) {
  if (dataset.promptCount !== entries.length) {
    throw new Error(`${label} declares ${dataset.promptCount} prompts but contains ${entries.length}.`);
  }
  if (dataset.conversationCount !== dataset.conversations.length) {
    throw new Error(`${label} declares ${dataset.conversationCount} conversations but contains ${dataset.conversations.length}.`);
  }
  const ids = entries.map((entry) => `${entry.conversationId}-${entry.promptIndex}`);
  if (new Set(ids).size !== ids.length) throw new Error(`${label} contains duplicate stable case IDs.`);
}

function validateNoSensitiveQuestion(entry, label) {
  const question = entry.question;
  const violations = [
    [/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i, "email address"],
    [/<@U[A-Z0-9]+/i, "Slack user mention"],
    [/\bU[A-Z0-9]{8,}\b/, "Slack user ID"],
    [/\b(?:\+?\d[\s().-]*){10,}\b/, "phone-like number"],
    [/mailto:/i, "mailto link"],
  ].filter(([pattern]) => pattern.test(question));
  if (violations.length) throw new Error(`${label} contains ${violations.map(([, name]) => name).join(", ")}.`);
}

function validateGold(dataset, entries, label) {
  const adjudication = dataset.adjudication;
  if (!adjudication || adjudication.independentFromSystems !== true || !Array.isArray(adjudication.sourceRefs) || !adjudication.sourceRefs.length) {
    throw new Error(`${label} needs source-backed adjudication provenance.`);
  }
  for (const entry of entries) {
    if (!Array.isArray(entry.goldNeeds) || !entry.goldNeeds.length) {
      throw new Error(`${label} ${entry.conversationId}-${entry.promptIndex} lacks atomic gold needs.`);
    }
    validateNoSensitiveQuestion(entry, `${label} ${entry.conversationId}-${entry.promptIndex}`);
  }
}

function validateEvaluationProviderGuard(source) {
  const requiredFragments = [
    'const v3UsesV4EvaluationProvider = argument("v3-provider") === "v4";',
    "v3UsesV4EvaluationProvider && !forceFreshV3",
    "--v3-provider=v4 is evaluation-only and requires --v3-source=fresh.",
    "{ provider: generateV4Json, validatorProvider: generateV4Json }",
    "v3UsesV4EvaluationProvider,",
  ];
  const missing = requiredFragments.filter((fragment) => !source.includes(fragment));
  if (missing.length) {
    throw new Error(`Paired evaluator lost its isolated V3 Gateway guard: ${missing.join(" | ")}`);
  }
}

async function previousQuestions(excluded) {
  const directory = path.resolve("tests/ask-sales-faq");
  const files = (await readdir(directory))
    .filter((name) => name.endsWith(".json"))
    .map((name) => path.join(directory, name))
    .filter((name) => !excluded.has(name));
  const questions = [];
  for (const file of files) {
    const raw = JSON.parse(await readFile(file, "utf8"));
    for (const conversation of raw.conversations || []) {
      for (const prompt of conversation.prompts || []) {
        const question = typeof prompt === "string" ? prompt : prompt?.question;
        if (typeof question === "string" && question.trim()) questions.push({ file, question: question.trim() });
      }
    }
    for (const item of raw.items || []) {
      if (typeof item?.question === "string" && item.question.trim()) questions.push({ file, question: item.question.trim() });
    }
  }
  return questions;
}

function freshnessAudit(entries, prior) {
  const findings = entries.map((entry) => {
    let closest = { jaccard: 0, containment: 0, file: "", question: "" };
    for (const candidate of prior) {
      const score = overlap(entry.question, candidate.question);
      if (score.jaccard > closest.jaccard || (score.jaccard === closest.jaccard && score.containment > closest.containment)) {
        closest = { ...score, ...candidate };
      }
    }
    return { id: `${entry.conversationId}-${entry.promptIndex}`, question: entry.question, closest };
  });
  const exact = findings.filter((item) => normalizedText(item.question) === normalizedText(item.closest.question));
  const near = findings.filter((item) => item.closest.jaccard >= 0.72 || (item.closest.containment >= 0.9 && item.closest.jaccard >= 0.55));
  if (exact.length || near.length) {
    const details = [...new Map([...exact, ...near].map((item) => [item.id, item])).values()]
      .map((item) => `${item.id} overlaps ${path.basename(item.closest.file)} at J=${item.closest.jaccard.toFixed(2)}, C=${item.closest.containment.toFixed(2)}`)
      .join("; ");
    throw new Error(`Fresh-source contamination audit failed: ${details}`);
  }
  return findings.sort((left, right) => right.closest.jaccard - left.closest.jaccard)[0] || null;
}

async function main() {
  const [freshContents, replayContents, benchmarkContents] = await Promise.all([
    readFile(freshPath, "utf8"),
    readFile(replayPath, "utf8"),
    readFile(benchmarkPath, "utf8"),
  ]);
  validateEvaluationProviderGuard(benchmarkContents);
  const fresh = JSON.parse(freshContents);
  const replay = JSON.parse(replayContents);
  const freshEntries = promptEntries(fresh);
  const replayEntries = promptEntries(replay);
  validateCounts(fresh, freshEntries, "fresh dataset");
  validateCounts(replay, replayEntries, "replay dataset");
  validateGold(fresh, freshEntries, "fresh dataset");
  validateGold(replay, replayEntries, "replay dataset");
  for (const entry of freshEntries) {
    if (entry.sourceCohort !== "fresh_slack_authoritative_thread" || !/^https:\/\/istvoffical\.slack\.com\/archives\/C0AUQKNR8CF\/p\d+$/.test(entry.sourceRef || "")) {
      throw new Error(`Fresh case ${entry.conversationId}-${entry.promptIndex} lacks its read-only Slack thread permalink.`);
    }
    if (entry.productionAnswer !== undefined) throw new Error(`Fresh case ${entry.conversationId}-${entry.promptIndex} must not contain a production answer.`);
  }
  for (const entry of replayEntries) {
    if (entry.sourceCohort !== "production_v3_log" || !/^launch-\d{3}$/.test(entry.productionLogId || "")) {
      throw new Error(`Replay case ${entry.conversationId}-${entry.promptIndex} lacks its production log ID.`);
    }
    if (typeof entry.productionAnswer !== "string" || typeof entry.productionNeedsRoute !== "boolean") {
      throw new Error(`Replay case ${entry.conversationId}-${entry.promptIndex} lacks its captured V3 answer.`);
    }
  }
  const normalizedQuestions = [...freshEntries, ...replayEntries].map((entry) => normalizedText(entry.question));
  if (new Set(normalizedQuestions).size !== normalizedQuestions.length) throw new Error("Fresh and replay datasets contain a duplicate question.");
  const prior = await previousQuestions(new Set([freshPath, replayPath]));
  const closestFreshPrior = freshnessAudit(freshEntries, prior);
  console.log(JSON.stringify({
    fresh: { path: freshPath, sha256: sha256(freshContents), prompts: freshEntries.length, conversations: fresh.conversations.length },
    replay: { path: replayPath, sha256: sha256(replayContents), prompts: replayEntries.length, conversations: replay.conversations.length },
    priorQuestionCount: prior.length,
    closestFreshPrior: closestFreshPrior ? {
      caseId: closestFreshPrior.id,
      priorFile: path.basename(closestFreshPrior.closest.file),
      jaccard: Number(closestFreshPrior.closest.jaccard.toFixed(4)),
      containment: Number(closestFreshPrior.closest.containment.toFixed(4)),
    } : null,
    piiCheck: "passed",
    sourceTraceability: "passed",
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
