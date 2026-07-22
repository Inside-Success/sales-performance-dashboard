import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { retrieveV4SystemicPolicies } from "@/lib/ask-sales-faq/v4/systemic/retrieval";
import type { V4SystemicNeed, V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";
import { resolveV4Turn } from "@/lib/ask-sales-faq/v4/turn";

type SourceCorpus = { records: Array<{ source_id: string; question: string }> };

function summary(ranks: Array<number | null>) {
  const found = ranks.filter((rank): rank is number => rank !== null).sort((left, right) => left - right);
  const total = ranks.length;
  const recall = (limit: number) => Number((ranks.filter((rank) => rank !== null && rank <= limit).length / Math.max(1, total)).toFixed(4));
  return {
    cases: total,
    top1: recall(1),
    top5: recall(5),
    top10: recall(10),
    top20: recall(20),
    top60: recall(60),
    medianRank: found.length ? found[Math.floor((found.length - 1) / 2)] : null,
    missing: total - found.length,
  };
}

function scope(policy: V4SystemicPolicy): V4SystemicNeed["productScope"] {
  const candidate = policy.product_scopes[0];
  return candidate === "main_istv" || candidate === "dj_nlceo" || candidate === "comparison" ? candidate : "unknown";
}

function rank(policy: V4SystemicPolicy, question: string, structured: boolean) {
  const turn = resolveV4Turn(question, []);
  const retrieval = retrieveV4SystemicPolicies(turn, {
    needs: [{
      id: "N1",
      text: question,
      retrievalQueries: [question],
      productScope: scope(policy),
      domains: structured ? policy.domains : [],
      actions: structured ? policy.actions : [],
      entities: structured ? policy.entities : [],
      ambiguity: "none",
      clarificationQuestion: "",
    }],
    conversationIntent: "answer",
    reasoningSummary: structured ? "structured" : "plain",
  });
  return retrieval.candidates.find((candidate) => candidate.policy.id === policy.id)?.rank || null;
}

const sourcePath = resolve(process.argv[2] || "artifacts/ask-sales-faq-v4-systemic/slack-authority-thread-corpus.json");
const outputPath = resolve(process.argv[3] || "artifacts/ask-sales-faq-v4-systemic/retrieval-benchmark.json");
const sources = JSON.parse(readFileSync(sourcePath, "utf8")) as SourceCorpus;
const sourceById = new Map(sources.records.map((source) => [source.source_id, source.question]));
const policies = getV4SystemicCorpus().filter((policy) =>
  policy.systemic.sourceClass === "authoritative_operational_qna" &&
  policy.answerability === "answer_evidence" &&
  policy.question_families[0],
);
const results = policies.map((policy) => {
  const familyQuestion = policy.question_families[0];
  const sourceQuestion = policy.systemic.sourceIds.map((id) => sourceById.get(id)).find(Boolean) || familyQuestion;
  return {
    policyId: policy.id,
    questionFamilyPlainRank: rank(policy, familyQuestion, false),
    questionFamilyStructuredRank: rank(policy, familyQuestion, true),
    sourceReplayPlainRank: rank(policy, sourceQuestion, false),
    sourceReplayStructuredRank: rank(policy, sourceQuestion, true),
  };
});
const report = {
  schema_version: "ask-sales-v4-systemic-retrieval-benchmark-v1",
  diagnostic_only: true,
  note: "Development-source replay measures retriever mechanics; it is not promotion evidence.",
  corpusSize: getV4SystemicCorpus().length,
  operationalAnswerPolicies: policies.length,
  questionFamilyPlain: summary(results.map((item) => item.questionFamilyPlainRank)),
  questionFamilyStructured: summary(results.map((item) => item.questionFamilyStructuredRank)),
  sourceReplayPlain: summary(results.map((item) => item.sourceReplayPlainRank)),
  sourceReplayStructured: summary(results.map((item) => item.sourceReplayStructuredRank)),
  results,
};
mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, "utf8");
process.stdout.write(`${JSON.stringify({
  corpusSize: report.corpusSize,
  operationalAnswerPolicies: report.operationalAnswerPolicies,
  questionFamilyPlain: report.questionFamilyPlain,
  questionFamilyStructured: report.questionFamilyStructured,
  sourceReplayPlain: report.sourceReplayPlain,
  sourceReplayStructured: report.sourceReplayStructured,
})}\n`);
