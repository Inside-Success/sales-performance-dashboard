import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  inferV4SystemicRelation,
  inferV4SystemicRequestKind,
  v4SystemicNeedPolicyRelationErrors,
  v4SystemicRelation,
  v4SystemicRequestKind,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import type { V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";

type JsonRecord = Record<string, unknown>;

function argument(name: string) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : undefined;
}

const runPath = argument("--run");
const manualPath = argument("--manual");
if (!runPath || !manualPath) {
  throw new Error("Usage: npm run benchmark:ask-sales-faq:v5:retrieval -- --run <three-way.json> --manual <manual-review.json>");
}

function json(path: string) {
  return JSON.parse(readFileSync(resolve(path), "utf8")) as JsonRecord;
}

function records(value: unknown): JsonRecord[] {
  return Array.isArray(value) ? value.filter((item): item is JsonRecord => Boolean(item) && typeof item === "object") : [];
}

function strings(value: unknown) {
  return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function currentV44(item: JsonRecord) {
  const explicit = item.v44;
  if (explicit && typeof explicit === "object") return explicit as JsonRecord;
  return item.systemic && typeof item.systemic === "object" ? item.systemic as JsonRecord : {};
}

function metadata(result: JsonRecord) {
  return result.runtimeMetadata && typeof result.runtimeMetadata === "object" ? result.runtimeMetadata as JsonRecord : {};
}

function planFrom(item: JsonRecord, result: JsonRecord): V4SystemicQueryPlan {
  const runtime = metadata(result);
  const rawPlan = runtime.plan && typeof runtime.plan === "object" ? runtime.plan as JsonRecord : {};
  const question = text(item.question);
  const needs = records(rawPlan.needs).map((raw, index): V4SystemicNeed => {
    const needText = text(raw.text) || question;
    return {
      id: text(raw.id) || `N${index + 1}`,
      text: needText,
      authorityText: question,
      originalRequestText: question,
      retrievalQueries: [needText],
      productScope: ["main_istv", "dj_nlceo", "comparison"].includes(text(raw.product_scope))
        ? text(raw.product_scope) as V4SystemicNeed["productScope"] : "unknown",
      domains: strings(raw.domains),
      actions: strings(raw.actions),
      entities: strings(raw.entities),
      relation: v4SystemicRelation(raw.relation, inferV4SystemicRelation(needText)),
      requestKind: v4SystemicRequestKind(raw.request_kind, inferV4SystemicRequestKind(needText)),
      ambiguity: "none",
      clarificationQuestion: "",
      forcedRouteKey: null,
    };
  });
  return {
    needs: needs.length ? needs : [{
      id: "N1",
      text: question,
      authorityText: question,
      originalRequestText: question,
      retrievalQueries: [question],
      productScope: "unknown",
      domains: [],
      actions: [],
      entities: [],
      relation: inferV4SystemicRelation(question),
      requestKind: inferV4SystemicRequestKind(question),
      ambiguity: "none",
      clarificationQuestion: "",
      forcedRouteKey: null,
    }],
    conversationIntent: "answer",
    reasoningSummary: "Consumed source-review retrieval diagnostic",
  };
}

function turnFrom(item: JsonRecord, result: JsonRecord): V3TurnResolution {
  const runtime = metadata(result);
  const raw = runtime.turn && typeof runtime.turn === "object" ? runtime.turn as JsonRecord : {};
  const question = text(item.question);
  return {
    kind: ["new", "follow_up"].includes(text(raw.kind)) ? text(raw.kind) as V3TurnResolution["kind"] : "new",
    currentQuestion: text(raw.currentQuestion) || question,
    standaloneQuestion: text(raw.standaloneQuestion) || question,
    immediatePreviousUserQuestion: text(raw.immediatePreviousUserQuestion) || null,
    immediatePreviousAssistantAnswer: text(raw.immediatePreviousAssistantAnswer) || null,
    productScope: ["main_istv", "dj_nlceo", "comparison"].includes(text(raw.productScope))
      ? text(raw.productScope) as V3TurnResolution["productScope"] : "unknown",
    excludedScopes: strings(raw.excludedScopes).filter((scope): scope is Exclude<V3TurnResolution["productScope"], "unknown" | "comparison"> => scope === "main_istv" || scope === "dj_nlceo"),
    memoryAnswer: text(raw.memoryAnswer) || null,
    usedImmediateContext: Boolean(raw.usedImmediateContext),
    explicitCorrection: Boolean(raw.explicitCorrection),
    explicitScopeSwitch: Boolean(raw.explicitScopeSwitch),
    stylePreferences: strings(raw.stylePreferences),
    contextMessages: records(raw.contextMessages).flatMap((message) => {
      const role = text(message.role);
      const content = text(message.content);
      return (role === "user" || role === "assistant") && content ? [{ role, content }] : [];
    }),
    intentResolutionMode: "deterministic",
    intentResolutionReason: "Replayed from a consumed source-reviewed evaluation.",
  };
}

const run = json(runPath);
const manual = json(manualPath);
const items = records(run.items);
const manualDetails = records(manual.scoredNeedsDetail);
const helpful = new Set(["correct_full", "correct_partial"]);
const policiesById = new Map(getV5KnowledgeSnapshot().policies.map((policy) => [policy.id, policy]));

let v44CandidateTotal = 0;
let v5CandidateTotal = 0;
let v44HardIncompatible = 0;
let v5HardIncompatible = 0;
let answerCasesWithOracle = 0;
let oracleHitAt10 = 0;
let incorrectV44Selections = 0;
let incorrectV44SelectionsRetained = 0;
const cases: JsonRecord[] = [];

for (const item of items) {
  const id = text(item.id);
  const v44 = currentV44(item);
  const runtime = metadata(v44);
  const rawRetrieval = runtime.retrieval && typeof runtime.retrieval === "object" ? runtime.retrieval as JsonRecord : {};
  const v44Candidates = records(rawRetrieval.candidates);
  const plan = planFrom(item, v44);
  const turn = turnFrom(item, v44);
  const v5 = retrieveV5Policies(turn, plan);
  v44CandidateTotal += v44Candidates.length;
  v5CandidateTotal += v5.candidates.length;

  for (const candidate of v44Candidates) {
    const policy = policiesById.get(text(candidate.id));
    if (policy && !plan.needs.some((need) => !v4SystemicNeedPolicyRelationErrors(need, policy).length)) v44HardIncompatible += 1;
  }
  for (const candidate of v5.candidates) {
    if (!plan.needs.some((need) => !v4SystemicNeedPolicyRelationErrors(need, candidate.policy).length)) v5HardIncompatible += 1;
  }

  const details = manualDetails.filter((detail) => text(detail.caseId) === id);
  const answerable = details.some((detail) => text(detail.expectedDisposition) === "answer");
  const reference = item.reference && typeof item.reference === "object" ? item.reference as JsonRecord : {};
  const v3 = reference.v3 && typeof reference.v3 === "object" ? reference.v3 as JsonRecord : {};
  const v3Meta = metadata(v3);
  const v3Selection = v3Meta.selection && typeof v3Meta.selection === "object" ? v3Meta.selection as JsonRecord : {};
  const v3Ids = strings(v3Selection.selectedPolicyIds);
  const v44Ids = strings(v44.selectedPolicyIds);
  const v3Helpful = details.some((detail) => {
    const scores = detail.scores && typeof detail.scores === "object" ? detail.scores as JsonRecord : {};
    return helpful.has(text(scores.v3));
  });
  const v44Helpful = details.some((detail) => {
    const scores = detail.scores && typeof detail.scores === "object" ? detail.scores as JsonRecord : {};
    return helpful.has(text(scores.v44));
  });
  const oracleIds = [...new Set([...(v3Helpful ? v3Ids : []), ...(v44Helpful ? v44Ids : [])])];
  const v5Ids = new Set(v5.candidates.slice(0, 10).map((candidate) => candidate.policy.id));
  const oracleHit = oracleIds.some((policyId) => v5Ids.has(policyId));
  if (answerable && oracleIds.length) {
    answerCasesWithOracle += 1;
    if (oracleHit) oracleHitAt10 += 1;
  }

  const v44Incorrect = details.some((detail) => {
    const scores = detail.scores && typeof detail.scores === "object" ? detail.scores as JsonRecord : {};
    return text(scores.v44) === "incorrect";
  });
  const retainedBadIds = v44Incorrect ? v44Ids.filter((policyId) => v5Ids.has(policyId)) : [];
  if (v44Incorrect && v44Ids.length) {
    incorrectV44Selections += v44Ids.length;
    incorrectV44SelectionsRetained += retainedBadIds.length;
  }
  cases.push({
    id,
    question: text(item.question),
    v44CandidateCount: v44Candidates.length,
    v5CandidateCount: v5.candidates.length,
    answerable,
    oracleIds,
    oracleHit,
    v44Incorrect,
    v44SelectedIds: v44Ids,
    retainedBadIds,
    v5TopIds: [...v5Ids],
    diagnostics: v5.diagnostics,
  });
}

const report = {
  schemaVersion: "ask-sales-v5-retrieval-bakeoff-v1",
  source: { runPath: resolve(runPath), manualPath: resolve(manualPath) },
  knowledgeVersion: getV5KnowledgeSnapshot().knowledgeVersion,
  cases: items.length,
  summary: {
    averageCandidateCount: {
      v44: Number((v44CandidateTotal / Math.max(1, items.length)).toFixed(2)),
      v5: Number((v5CandidateTotal / Math.max(1, items.length)).toFixed(2)),
    },
    hardIncompatibleCandidates: { v44: v44HardIncompatible, v5: v5HardIncompatible },
    sourceReviewedAnswerOracleRecallAt10: {
      eligibleCases: answerCasesWithOracle,
      hits: oracleHitAt10,
      rate: answerCasesWithOracle ? Number((oracleHitAt10 / answerCasesWithOracle).toFixed(4)) : null,
      note: "Diagnostic only: oracle IDs are selected evidence from systems manually marked correct_full or correct_partial.",
    },
    incorrectV44SelectedIdsRetainedByV5: {
      total: incorrectV44Selections,
      retained: incorrectV44SelectionsRetained,
      rate: incorrectV44Selections ? Number((incorrectV44SelectionsRetained / incorrectV44Selections).toFixed(4)) : null,
      note: "Diagnostic only: an incorrect answer can still cite a relevant card; lower is useful but not a standalone quality score.",
    },
  },
  casesDetail: cases,
};

process.stdout.write(`${JSON.stringify(process.argv.includes("--summary") ? report.summary : report, null, 2)}\n`);
