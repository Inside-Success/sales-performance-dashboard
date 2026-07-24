import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

type Grade = "pass" | "partial" | "fail" | "critical";
type JsonRecord = Record<string, unknown>;

const freezeCommit = "d8f3867";
const consumedFiles = [1, 2, 3, 4].map((chunk) =>
  `artifacts/ask-sales-faq-v5-3/consumed40-v53-${freezeCommit}-chunk${chunk}.json`,
);
const retainedFiles = [1, 2, 3, 4].map((chunk) =>
  `artifacts/ask-sales-faq-v5-3/retained50-v53-${freezeCommit}-chunk${chunk}.json`,
);

const consumedGrades: Record<Grade, string[]> = {
  pass: ["04", "07", "08", "09", "10", "11", "12", "13", "14", "17", "22", "23", "24", "25", "26", "28", "29", "36", "37", "38", "39"].map((id) => `v52fresh-${id}`),
  partial: ["03", "05", "06", "20", "21", "34", "40"].map((id) => `v52fresh-${id}`),
  fail: ["01", "02", "15", "16", "18", "19", "27", "30", "31", "32", "33", "35"].map((id) => `v52fresh-${id}`),
  critical: [],
};

const retainedGrades: Record<Grade, string[]> = {
  pass: [
    ...Array.from({ length: 30 }, (_, index) => `fresh-slack-v42-a${String(index + 1).padStart(2, "0")}`),
    "fresh-slack-v42-r02", "fresh-slack-v42-r03", "fresh-slack-v42-r04", "fresh-slack-v42-r05",
    "fresh-slack-v42-r06", "fresh-slack-v42-r07", "fresh-slack-v42-r08", "fresh-slack-v42-r09",
    "fresh-slack-v42-r10", "fresh-slack-v42-r11", "fresh-slack-v42-r12", "fresh-slack-v42-r13",
    "fresh-slack-v42-r14", "fresh-slack-v42-r15", "fresh-slack-v42-r17", "fresh-slack-v42-r18",
    "fresh-slack-v42-r19", "fresh-slack-v42-r20",
  ].filter((id) => !["fresh-slack-v42-a08", "fresh-slack-v42-a13", "fresh-slack-v42-a20", "fresh-slack-v42-a23"].includes(id)),
  partial: ["fresh-slack-v42-a13", "fresh-slack-v42-a23", "fresh-slack-v42-r01", "fresh-slack-v42-r16"],
  fail: ["fresh-slack-v42-a08", "fresh-slack-v42-a20"],
  critical: [],
};

const notes: Record<string, string> = {
  "v52fresh-01": "Does not answer the sourced 20-percent outreach procedure.",
  "v52fresh-02": "Safely avoids the stale Keap rule but does not answer the current HubSpot requirement.",
  "v52fresh-03": "Uses Finance, but dilutes the correct owner with unnecessary Sales Questions and Fulfillment routes.",
  "v52fresh-05": "Routes the case safely but omits Rich's controlling three-month minimum.",
  "v52fresh-06": "Protects private contact details but does not clearly answer whether anonymized examples may be discussed.",
  "v52fresh-12": "Answers the complete reviewed manual-booking procedure and preserves the Master Calendar prohibition.",
  "v52fresh-20": "Allows telephone onboarding but omits the material requirement to keep Zoom running and recorded.",
  "v52fresh-21": "Correctly denies an automatic bank-closure exception but omits the three-month and Rich-approval boundaries.",
  "v52fresh-24": "Correctly routes a sensitive case-specific eligibility decision without leaking an unrelated rule.",
  "v52fresh-26": "Correctly pauses and routes a pending-felony case instead of generalizing from a loose red-flags policy.",
  "v52fresh-34": "Correctly prohibits cross-side transfer but omits the sourced reapplication-to-the-correct-show step.",
  "v52fresh-40": "Correctly gives the English-only boundary but adds an unnecessary partner caveat.",
  "fresh-slack-v42-a08": "Avoidable abstention on the source-reviewed Love Experts availability question.",
  "fresh-slack-v42-a12": "Correctly uses Rich's later controlling three-month minimum; the retained dataset's six-month gold is superseded.",
  "fresh-slack-v42-a13": "Protects private introductions but does not clearly state the allowed anonymized-example boundary.",
  "fresh-slack-v42-a20": "Avoidable abstention on the documented one-Tier-1-platform package rule.",
  "fresh-slack-v42-a23": "Correctly denies SAG eligibility but omits the explicit no-SAG-credits part.",
  "fresh-slack-v42-r01": "Provides useful recovery steps but does not make the current Sales Tech handoff explicit enough.",
  "fresh-slack-v42-r12": "Correctly answers from the later reviewed direct-Zoom-link authority; the older route-only label is superseded.",
  "fresh-slack-v42-r14": "Correctly answers from the later reviewed OnceHub first-text authority; the older route-only label is superseded.",
  "fresh-slack-v42-r16": "Safely abstains, but the generic Sales Questions owner is not established as the exact document owner.",
};

function object(value: unknown): JsonRecord {
  return value && typeof value === "object" ? value as JsonRecord : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function gradeMap(groups: Record<Grade, string[]>) {
  const map = new Map<string, Grade>();
  for (const grade of ["pass", "partial", "fail", "critical"] as Grade[]) {
    for (const id of groups[grade]) {
      if (map.has(id)) throw new Error(`Duplicate grade for ${id}`);
      map.set(id, grade);
    }
  }
  return map;
}

function summarize(details: Array<{ grade: Grade }>) {
  const counts = details.reduce<Record<Grade, number>>((result, item) => {
    result[item.grade] += 1;
    return result;
  }, { pass: 0, partial: 0, fail: 0, critical: 0 });
  const weightedUtility = counts.pass + counts.partial * 0.5;
  return {
    counts,
    weightedUtility,
    weightedUtilityRate: Number((weightedUtility / details.length).toFixed(4)),
  };
}

function aggregateLanes(results: JsonRecord[]) {
  return results.reduce<Record<string, number>>((counts, result) => {
    const lane = text(result.lane) || text(result.outcome) || "unknown";
    counts[lane] = (counts[lane] || 0) + 1;
    return counts;
  }, {});
}

function providerFailures(results: JsonRecord[]) {
  return results.reduce((total, result) => {
    const metadata = object(result.runtimeMetadata);
    const attempts = Array.isArray(metadata.providerAttempts) ? metadata.providerAttempts.map(object) : [];
    return total + attempts.filter((attempt) => text(attempt.status) !== "success").length;
  }, 0);
}

async function loadRuns(files: string[]) {
  return Promise.all(files.map(async (file) => {
    const absolutePath = path.resolve(file);
    const raw = await readFile(absolutePath, "utf8");
    const run = JSON.parse(raw) as JsonRecord;
    if (text(run.status) !== "complete" || text(run.runtimeFreezeCommit) !== freezeCommit) {
      throw new Error(`${file} is not a complete ${freezeCommit} run`);
    }
    return { file, sha256: createHash("sha256").update(raw).digest("hex"), run };
  }));
}

function assertCoverage(ids: string[], grades: Map<string, Grade>, expected: number) {
  if (ids.length !== expected || new Set(ids).size !== expected) throw new Error(`Expected ${expected} unique cases`);
  const missing = ids.filter((id) => !grades.has(id));
  const extra = [...grades.keys()].filter((id) => !ids.includes(id));
  if (missing.length || extra.length) throw new Error(`Grade coverage mismatch; missing=${missing.join(",")} extra=${extra.join(",")}`);
}

async function main() {
  const consumedRuns = await loadRuns(consumedFiles);
  const retainedRuns = await loadRuns(retainedFiles);
  const consumedItems = consumedRuns.flatMap(({ run }) => Array.isArray(run.items) ? run.items.map(object) : []);
  const retainedItems = retainedRuns.flatMap(({ run }) => {
    const conversations = Array.isArray(run.conversations) ? run.conversations.map(object) : [];
    return conversations.flatMap((conversation) => {
      const prompts = Array.isArray(conversation.prompts) ? conversation.prompts.map(object) : [];
      return prompts.map((prompt) => ({ id: text(conversation.id), prompt }));
    });
  });
  const consumedMap = gradeMap(consumedGrades);
  const retainedMap = gradeMap(retainedGrades);
  assertCoverage(consumedItems.map((item) => text(item.id)), consumedMap, 40);
  assertCoverage(retainedItems.map((item) => item.id), retainedMap, 50);

  const consumedDetails = consumedItems.map((item) => {
    const result = object(object(item.systems).v5);
    const id = text(item.id);
    const grade = consumedMap.get(id)!;
    return {
      id,
      grade,
      note: notes[id] || (grade === "pass" ? "Matches the source-only gold answer or required live owner." : grade === "partial" ? "Safe and useful, but materially incomplete." : "Safe but avoidably unhelpful on an answerable question."),
      question: text(item.question),
      expectedDisposition: text(item.expectedDisposition),
      expectedRouteKey: text(item.expectedRouteKey) || null,
      goldAnswer: text(item.goldAnswer),
      lane: text(result.lane) || text(result.outcome),
      answer: text(result.answer),
      routeChannels: result.routeChannels || [],
      selectedPolicyIds: result.selectedPolicyIds || [],
    };
  });
  const retainedDetails = retainedItems.map(({ id, prompt }) => {
    const result = object(object(prompt.systems).v5);
    const goldNeeds = Array.isArray(prompt.goldNeeds) ? prompt.goldNeeds.map(object) : [];
    const grade = retainedMap.get(id)!;
    return {
      id,
      grade,
      note: notes[id] || (grade === "pass" ? "Matches the reviewed answer or required owner." : grade === "partial" ? "Safe and useful, but materially incomplete." : "Avoidable abstention on a reviewed answerable question."),
      question: text(prompt.question),
      expectedDisposition: text(goldNeeds[0]?.expectedDisposition),
      expectedRouteKey: text(goldNeeds[0]?.expectedRouteKey) || null,
      lane: text(result.lane) || text(result.outcome),
      answer: text(result.answer),
      routeChannels: result.routeChannels || [],
      selectedPolicyIds: result.selectedPolicyIds || [],
    };
  });
  const allResults = [
    ...consumedItems.map((item) => object(object(item.systems).v5)),
    ...retainedItems.map(({ prompt }) => object(object(prompt.systems).v5)),
  ];
  if (providerFailures(allResults) !== 0) throw new Error("Provider failures make this diagnostic review incomplete");

  const historicalRaw = await readFile(path.resolve("artifacts/ask-sales-faq-v5-2/fresh-slack-v3-v52-manual-review.json"), "utf8");
  const historical = JSON.parse(historicalRaw) as JsonRecord;
  const report = {
    schemaVersion: "ask-sales-v5-3-human-source-review-v1",
    reviewedAt: new Date().toISOString(),
    runtimeFreezeCommit: freezeCommit,
    diagnosticOnly: true,
    promotionEvidence: false,
    aiJudgePromotionAuthority: false,
    grading: {
      pass: "Correct and useful answer, or correct safe route to the required owner.",
      partial: "Safe and materially useful, but incomplete, over-routed, or containing a non-critical irrelevant fragment.",
      fail: "Safe but unhelpful abstention, wrong owner, or answer that does not resolve the question.",
      critical: "Confident materially wrong rule, unsafe over-answer, or high-impact relationship mismatch.",
    },
    consumedSourceGold40: {
      revealedBeforeThisRun: true,
      runFiles: consumedRuns.map(({ file, sha256 }) => ({ file, sha256 })),
      rawLanes: aggregateLanes(consumedItems.map((item) => object(object(item.systems).v5))),
      providerFailures: providerFailures(consumedItems.map((item) => object(object(item.systems).v5))),
      summary: summarize(consumedDetails),
      historicalComparison: object(historical.summary),
      details: consumedDetails,
    },
    retainedReviewed50: {
      revealedBeforeThisRun: true,
      containsSupersededGold: true,
      supersededGoldNotes: [
        "fresh-slack-v42-a12: Rich's reviewed three-month minimum supersedes the retained six-month label.",
        "fresh-slack-v42-r12 and r14: later source review established safe reusable answers instead of route-only handling.",
      ],
      runFiles: retainedRuns.map(({ file, sha256 }) => ({ file, sha256 })),
      rawLanes: aggregateLanes(retainedItems.map(({ prompt }) => object(object(prompt.systems).v5))),
      providerFailures: providerFailures(retainedItems.map(({ prompt }) => object(object(prompt.systems).v5))),
      summary: summarize(retainedDetails),
      details: retainedDetails,
    },
  };
  const outputPath = path.resolve("artifacts/ask-sales-faq-v5-3/human-source-review-d8f3867.json");
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  process.stdout.write(`${JSON.stringify({
    outputPath,
    consumedSourceGold40: report.consumedSourceGold40.summary,
    retainedReviewed50: report.retainedReviewed50.summary,
    providerFailures: 0,
  }, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
