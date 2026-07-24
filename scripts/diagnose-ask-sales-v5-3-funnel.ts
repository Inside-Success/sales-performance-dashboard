import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { classifyV52StableOperationalRule, getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { evaluateV51DecisionContract, evaluateV52DecisionIdentity } from "@/lib/ask-sales-faq/v5/decision-contract";
import type { V4SystemicNeed } from "@/lib/ask-sales-faq/v4/systemic/types";

type GoldCase = {
  id: string;
  question: string;
  expectedDisposition: "answer" | "answer_and_route" | "route";
  expectedRouteKey?: "sales_policy" | "sales_tech" | "finance" | "fulfillment" | "greenlight";
  requiredConcepts?: string[];
  forbiddenConcepts?: string[];
  sourceIds?: string[];
  sourceState?: string;
};

type GoldDataset = { name: string; cases: GoldCase[] };

type RuntimeNeed = {
  id: string;
  text?: string;
  authority_text?: string;
  original_request_text?: string;
  retrieval_queries?: string[];
  product_scope?: V4SystemicNeed["productScope"];
  domains?: string[];
  actions?: string[];
  entities?: string[];
  relation?: V4SystemicNeed["relation"];
  request_kind?: V4SystemicNeed["requestKind"];
  ambiguity?: V4SystemicNeed["ambiguity"];
  clarification_question?: string;
  lane: string;
  route_key?: NonNullable<V4SystemicNeed["forcedRouteKey"]> | null;
  evidence_refs?: string[];
};

type RuntimeResult = {
  answer: string;
  lane: string;
  routeChannels?: string[];
  selectedPolicyIds?: string[];
  runtimeMetadata?: {
    retrieval?: {
      candidates?: Array<{ id: string }>;
      diagnostics?: { needs?: Array<{ evidenceState?: string }> };
    };
    plan?: { needs?: RuntimeNeed[] };
    sourcePlan?: {
      needs?: Array<{
        lane: string;
        preferredPolicyIds?: string[];
        directPolicyIds?: string[];
      }>;
    };
  };
};

type RuntimeArtifact = {
  items: Array<GoldCase & { systems: { v5?: RuntimeResult } }>;
};

type ManualArtifact = {
  details: Array<{
    id: string;
    v52: { grade: "pass" | "partial" | "fail" | "critical"; note: string };
  }>;
};

const ROUTE_CHANNELS: Record<string, string> = {
  finance: "#sales-finance-requests",
  sales_tech: "#sales-tech-requests",
  greenlight: "#greenlight-requests",
  fulfillment: "the fulfillment hotline",
  sales_policy: "#sales-questions-requests",
};
const ROUTE_KEYS_BY_CHANNEL = new Map(Object.entries(ROUTE_CHANNELS).map(([key, channel]) => [channel, key]));

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "do", "does", "for", "from", "how", "i", "in", "is", "it", "may", "must", "of", "on", "or", "our", "should", "that", "the", "their", "this", "to", "was", "we", "what", "when", "where", "which", "with", "you",
]);

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9%]+/g, " ").replace(/\s+/g, " ").trim();
}

function terms(value: string) {
  return [...new Set(normalize(value).split(" ").filter((term) => term.length >= 2 && !STOP.has(term)))];
}

function conceptPresent(text: string, concept: string) {
  const haystack = new Set(terms(text));
  const requested = terms(concept);
  if (!requested.length) return true;
  const matches = requested.filter((term) => haystack.has(term)).length;
  return matches >= Math.max(1, Math.ceil(requested.length * 0.7));
}

function conceptCoverage(text: string, concepts: string[] = []) {
  if (!concepts.length) return { matched: 0, total: 0, complete: true };
  const matched = concepts.filter((concept) => conceptPresent(text, concept)).length;
  return { matched, total: concepts.length, complete: matched === concepts.length };
}

function policyText(policy: ReturnType<typeof getV5KnowledgeSnapshot>["policies"][number]) {
  return [
    policy.title,
    ...policy.question_families,
    policy.decision,
    ...policy.domains,
    ...policy.actions,
    ...policy.entities,
  ].join(" ");
}

function policySourceIds(policy: ReturnType<typeof getV5KnowledgeSnapshot>["policies"][number]) {
  return new Set([...policy.source.ids, ...policy.systemic.sourceIds]);
}

function tally(values: string[]) {
  return values.reduce<Record<string, number>>((counts, value) => {
    counts[value] = (counts[value] || 0) + 1;
    return counts;
  }, {});
}

function percent(value: number, total: number) {
  return total ? Number((value / total * 100).toFixed(1)) : 0;
}

function assertUniqueIds(label: string, ids: string[]) {
  const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);
  if (duplicates.length) throw new Error(`${label} contains duplicate IDs: ${[...new Set(duplicates)].join(", ")}`);
}

function routeOwnerLabel(channels: string[]) {
  if (!channels.length) return "none";
  return [...new Set(channels.map((channel) => ROUTE_KEYS_BY_CHANNEL.get(channel) || `unknown:${channel}`))]
    .sort()
    .join("+");
}

async function loadJson<T>(file: string) {
  return JSON.parse(await readFile(file, "utf8")) as T;
}

async function main() {
  const root = process.cwd();
  const datasetPaths = [
    "tests/ask-sales-faq/v5-fresh-slack-holdout-2026-07-24.json",
    "tests/ask-sales-faq/v5-1-post-freeze-slack-holdout-2026-07-24.json",
    "tests/ask-sales-faq/v5-2-fresh-slack-gold-2026-07-24.json",
  ];
  const datasets = await Promise.all(datasetPaths.map((file) => loadJson<GoldDataset>(path.join(root, file))));
  const runtime = await loadJson<RuntimeArtifact>(path.join(root, "artifacts/ask-sales-faq-v5-2/fresh-slack-v3-v52.json"));
  const manual = await loadJson<ManualArtifact>(path.join(root, "artifacts/ask-sales-faq-v5-2/fresh-slack-v3-v52-manual-review.json"));
  const runtimeById = new Map(runtime.items.map((item) => [item.id, item.systems.v5]));
  const manualById = new Map(manual.details.map((item) => [item.id, item.v52]));
  const snapshot = getV5KnowledgeSnapshot();
  const policies = snapshot.policies;
  const policyById = new Map(policies.map((policy) => [policy.id, policy]));
  const cases = datasets.flatMap((dataset) => dataset.cases.map((item) => ({ ...item, dataset: dataset.name })));
  assertUniqueIds("gold datasets", cases.map((item) => item.id));
  assertUniqueIds("runtime artifact", runtime.items.map((item) => item.id));
  assertUniqueIds("manual review artifact", manual.details.map((item) => item.id));
  const runtimeIds = new Set(runtime.items.map((item) => item.id));
  const manualIds = new Set(manual.details.map((item) => item.id));
  const unknownRuntimeIds = [...runtimeIds].filter((id) => !cases.some((item) => item.id === id));
  const missingManualIds = [...runtimeIds].filter((id) => !manualIds.has(id));
  const unknownManualIds = [...manualIds].filter((id) => !runtimeIds.has(id));
  if (unknownRuntimeIds.length || missingManualIds.length || unknownManualIds.length) {
    throw new Error([
      unknownRuntimeIds.length ? `runtime IDs outside gold datasets: ${unknownRuntimeIds.join(", ")}` : "",
      missingManualIds.length ? `runtime IDs missing manual review: ${missingManualIds.join(", ")}` : "",
      unknownManualIds.length ? `manual IDs outside runtime artifact: ${unknownManualIds.join(", ")}` : "",
    ].filter(Boolean).join("; "));
  }

  const traces = cases.map((item) => {
    const sources = new Set(item.sourceIds || []);
    const sourceLinked = policies.filter((policy) => [...policySourceIds(policy)].some((id) => sources.has(id)));
    const sourceLinkedAnswerable = sourceLinked.filter((policy) => policy.answerability === "answer_evidence");
    const required = item.requiredConcepts || [];
    const equivalent = policies.map((policy) => ({ policy, coverage: conceptCoverage(policyText(policy), required) }))
      .filter((entry) => entry.coverage.complete);
    const equivalentAnswerable = equivalent.filter((entry) => entry.policy.answerability === "answer_evidence");
    const result = runtimeById.get(item.id);
    const retrievedIds = new Set(result?.runtimeMetadata?.retrieval?.candidates?.map((candidate) => candidate.id) || []);
    const preferredIds = new Set(result?.runtimeMetadata?.sourcePlan?.needs?.flatMap((need) => need.preferredPolicyIds || []) || []);
    const selectedIds = new Set(result?.selectedPolicyIds || []);
    const retrievedEquivalent = equivalentAnswerable.filter((entry) => retrievedIds.has(entry.policy.id));
    const preferredEquivalent = equivalentAnswerable.filter((entry) => preferredIds.has(entry.policy.id));
    const selectedEquivalent = equivalentAnswerable.filter((entry) => selectedIds.has(entry.policy.id));
    const retrievedSourceLinked = sourceLinkedAnswerable.filter((policy) => retrievedIds.has(policy.id));
    const preferredSourceLinked = sourceLinkedAnswerable.filter((policy) => preferredIds.has(policy.id));
    const selectedSourceLinked = sourceLinkedAnswerable.filter((policy) => selectedIds.has(policy.id));
    const answerCoverage = conceptCoverage(result?.answer || "", required);
    const forbiddenPresent = (item.forbiddenConcepts || []).filter((concept) => conceptPresent(result?.answer || "", concept));
    const manualReview = manualById.get(item.id);
    const expectedChannel = item.expectedRouteKey ? ROUTE_CHANNELS[item.expectedRouteKey] : null;
    const routeOwnerCorrect = expectedChannel ? Boolean(result?.routeChannels?.includes(expectedChannel)) : null;
    const linkedRejectionReasons = sourceLinked
      .filter((policy) => policy.systemic.sourceClass === "authoritative_operational_qna" && policy.answerability !== "answer_evidence")
      .flatMap((policy) => classifyV52StableOperationalRule(policy).reasons);
    const plannedNeeds = (result?.runtimeMetadata?.plan?.needs || []).flatMap((need): V4SystemicNeed[] => {
      if (!need.text || !need.relation || !need.request_kind) return [];
      return [{
        id: need.id,
        text: need.text,
        authorityText: need.authority_text || need.text,
        originalRequestText: need.original_request_text || item.question,
        retrievalQueries: need.retrieval_queries || [need.text],
        productScope: need.product_scope || "unknown",
        domains: need.domains || [],
        actions: need.actions || [],
        entities: need.entities || [],
        relation: need.relation,
        requestKind: need.request_kind,
        ambiguity: need.ambiguity || "none",
        clarificationQuestion: need.clarification_question || "",
        forcedRouteKey: need.route_key || null,
      }];
    });
    const sourcePolicyGateAudit = sourceLinkedAnswerable.map((policy) => ({
      policyId: policy.id,
      needs: plannedNeeds.map((need) => ({
        needId: need.id,
        contract: evaluateV51DecisionContract(need, policy),
        identity: evaluateV52DecisionIdentity(need, policy),
      })),
    }));
    return {
      id: item.id,
      dataset: item.dataset,
      question: item.question,
      expectedDisposition: item.expectedDisposition,
      expectedRouteKey: item.expectedRouteKey || null,
      sourceState: item.sourceState || null,
      sourceLineage: {
        requestedSourceIds: [...sources],
        linkedPolicyIds: sourceLinked.map((policy) => policy.id),
        answerEligiblePolicyIds: sourceLinkedAnswerable.map((policy) => policy.id),
        linkedPolicies: sourceLinked.map((policy) => ({
          id: policy.id,
          decisionKey: policy.decision_key,
          decision: policy.decision,
          answerability: policy.answerability,
          approvedBy: policy.source.approved_by,
          effectiveAt: policy.effective_at,
          lastReviewed: policy.last_reviewed,
          routeKey: policy.route_key,
          systemic: policy.systemic,
        })),
      },
      equivalentSupport: {
        allConceptPolicyIds: equivalent.map((entry) => entry.policy.id),
        answerEligiblePolicyIds: equivalentAnswerable.map((entry) => entry.policy.id),
      },
      runtime: result ? {
        lane: result.lane,
        routeChannels: result.routeChannels || [],
        retrievalStates: result.runtimeMetadata?.retrieval?.diagnostics?.needs?.map((need) => need.evidenceState || "unknown") || [],
        retrievedSourceLinkedPolicyIds: retrievedSourceLinked.map((policy) => policy.id),
        preferredSourceLinkedPolicyIds: preferredSourceLinked.map((policy) => policy.id),
        selectedSourceLinkedPolicyIds: selectedSourceLinked.map((policy) => policy.id),
        retrievedEquivalentPolicyIds: retrievedEquivalent.map((entry) => entry.policy.id),
        preferredEquivalentPolicyIds: preferredEquivalent.map((entry) => entry.policy.id),
        selectedEquivalentPolicyIds: selectedEquivalent.map((entry) => entry.policy.id),
        planLanes: result.runtimeMetadata?.plan?.needs?.map((need) => need.lane) || [],
        answerConceptCoverage: answerCoverage,
        forbiddenConceptsPresent: forbiddenPresent,
        routeOwnerCorrect,
        routeOwnerLabel: routeOwnerLabel(result.routeChannels || []),
        sourcePolicyGateAudit,
      } : null,
      manual: manualReview || null,
      admissionRejectionReasons: tally(linkedRejectionReasons),
    };
  });

  const sourcePopulation = traces.filter((item) => item.sourceLineage.requestedSourceIds.length);
  const sourceAnswerPopulation = sourcePopulation.filter((item) => item.expectedDisposition !== "route");
  const runtimePopulation = traces.filter((item) => item.runtime);
  const runtimeAnswerPopulation = runtimePopulation.filter((item) => item.expectedDisposition !== "route");
  const runtimeRoutePopulation = runtimePopulation.filter((item) => item.expectedDisposition === "route");
  const count = <T>(items: T[], predicate: (item: T) => boolean) => items.filter(predicate).length;
  const routingConfusionMatrix = runtimeRoutePopulation.reduce<Record<string, Record<string, number>>>((matrix, item) => {
    const expected = item.expectedRouteKey || "unlabelled";
    const actual = item.runtime?.routeOwnerLabel || "none";
    matrix[expected] ||= {};
    matrix[expected][actual] = (matrix[expected][actual] || 0) + 1;
    return matrix;
  }, {});
  const summary = {
    generatedAt: new Date().toISOString(),
    status: "diagnostic_only",
    promotionEvidence: false,
    populations: {
      sourceReviewedCases: sourcePopulation.length,
      sourceReviewedExpectedAnswers: sourceAnswerPopulation.length,
      v52RuntimeCases: runtimePopulation.length,
      v52RuntimeExpectedAnswers: runtimeAnswerPopulation.length,
      v52RuntimeExpectedRoutes: runtimeRoutePopulation.length,
    },
    sourceAndAdmission: {
      exactSourceLineagePresent: count(sourceAnswerPopulation, (item) => item.sourceLineage.linkedPolicyIds.length > 0),
      exactSourceLineageAnswerEligible: count(sourceAnswerPopulation, (item) => item.sourceLineage.answerEligiblePolicyIds.length > 0),
      conceptEquivalentAnswerEligible: count(sourceAnswerPopulation, (item) => item.equivalentSupport.answerEligiblePolicyIds.length > 0),
    },
    v52AnswerFunnel: {
      exactSourceLineagePresent: count(runtimeAnswerPopulation, (item) => item.sourceLineage.linkedPolicyIds.length > 0),
      exactSourceLineageAnswerEligible: count(runtimeAnswerPopulation, (item) => item.sourceLineage.answerEligiblePolicyIds.length > 0),
      sourceLinkedAnswerEvidenceEnteredTopK: count(runtimeAnswerPopulation, (item) => Boolean(item.runtime?.retrievedSourceLinkedPolicyIds.length)),
      sourceLinkedAnswerEvidenceSurvivedSourcePlan: count(runtimeAnswerPopulation, (item) => Boolean(item.runtime?.preferredSourceLinkedPolicyIds.length)),
      sourceLinkedAnswerEvidenceSelectedForComposition: count(runtimeAnswerPopulation, (item) => Boolean(item.runtime?.selectedSourceLinkedPolicyIds.length)),
      conceptEquivalentAnswerEligible: count(runtimeAnswerPopulation, (item) => item.equivalentSupport.answerEligiblePolicyIds.length > 0),
      equivalentEnteredTopK: count(runtimeAnswerPopulation, (item) => Boolean(item.runtime?.retrievedEquivalentPolicyIds.length)),
      equivalentSurvivedSourcePlan: count(runtimeAnswerPopulation, (item) => Boolean(item.runtime?.preferredEquivalentPolicyIds.length)),
      equivalentSelectedForComposition: count(runtimeAnswerPopulation, (item) => Boolean(item.runtime?.selectedEquivalentPolicyIds.length)),
      answerOrPartialOutput: count(runtimeAnswerPopulation, (item) => ["answer", "partial"].includes(item.runtime?.lane || "")),
      allRequiredConceptsPreserved: count(runtimeAnswerPopulation, (item) => Boolean(item.runtime?.answerConceptCoverage.complete && !item.runtime.forbiddenConceptsPresent.length)),
    },
    v52RouteFunnel: {
      correctOwner: count(runtimeRoutePopulation, (item) => item.runtime?.routeOwnerCorrect === true),
      wrongOwner: count(runtimeRoutePopulation, (item) => item.runtime?.routeOwnerCorrect === false),
      noExpectedOwnerLabel: count(runtimeRoutePopulation, (item) => item.runtime?.routeOwnerCorrect === null),
      confusionMatrix: routingConfusionMatrix,
    },
    manualOutcome: tally(runtimePopulation.map((item) => item.manual?.grade || "unreviewed")),
    topAdmissionRejectionReasons: tally(sourceAnswerPopulation.flatMap((item) =>
      Object.entries(item.admissionRejectionReasons).flatMap(([reason, total]) => Array(total).fill(reason) as string[]),
    )),
  };

  const answerTotal = runtimeAnswerPopulation.length;
  const routeTotal = runtimeRoutePopulation.length;
  const markdown = `# Ask Sales V5.3 seven-stage failure funnel\n\n` +
    `Generated: ${summary.generatedAt}\n\n` +
    `Status: consumed-data diagnostic only. This is not promotion evidence and must not be used to tune question-specific rules.\n\n` +
    `## Populations\n\n` +
    `- Source/admission audit: ${sourcePopulation.length} source-reviewed cases across the V5, V5.1, and V5.2 consumed Slack sets.\n` +
    `- Runtime funnel: ${runtimePopulation.length} V5.2 cases with frozen runtime traces and manual source review.\n` +
    `- Expected-answer runtime cases: ${answerTotal}; expected-route runtime cases: ${routeTotal}.\n\n` +
    `## Answer funnel\n\n` +
    `| Stage | Cases | Rate |\n|---|---:|---:|\n` +
    `| Exact Slack source lineage exists in the snapshot | ${summary.v52AnswerFunnel.exactSourceLineagePresent} | ${percent(summary.v52AnswerFunnel.exactSourceLineagePresent, answerTotal)}% |\n` +
    `| Exact source-linked policy is answer eligible | ${summary.v52AnswerFunnel.exactSourceLineageAnswerEligible} | ${percent(summary.v52AnswerFunnel.exactSourceLineageAnswerEligible, answerTotal)}% |\n` +
    `| Source-linked answer evidence entered top-k | ${summary.v52AnswerFunnel.sourceLinkedAnswerEvidenceEnteredTopK} | ${percent(summary.v52AnswerFunnel.sourceLinkedAnswerEvidenceEnteredTopK, answerTotal)}% |\n` +
    `| Source-linked answer evidence survived source planning | ${summary.v52AnswerFunnel.sourceLinkedAnswerEvidenceSurvivedSourcePlan} | ${percent(summary.v52AnswerFunnel.sourceLinkedAnswerEvidenceSurvivedSourcePlan, answerTotal)}% |\n` +
    `| Source-linked answer evidence was selected for composition | ${summary.v52AnswerFunnel.sourceLinkedAnswerEvidenceSelectedForComposition} | ${percent(summary.v52AnswerFunnel.sourceLinkedAnswerEvidenceSelectedForComposition, answerTotal)}% |\n` +
    `| Concept-equivalent answer evidence exists | ${summary.v52AnswerFunnel.conceptEquivalentAnswerEligible} | ${percent(summary.v52AnswerFunnel.conceptEquivalentAnswerEligible, answerTotal)}% |\n` +
    `| Equivalent evidence entered top-k | ${summary.v52AnswerFunnel.equivalentEnteredTopK} | ${percent(summary.v52AnswerFunnel.equivalentEnteredTopK, answerTotal)}% |\n` +
    `| Equivalent evidence survived source planning | ${summary.v52AnswerFunnel.equivalentSurvivedSourcePlan} | ${percent(summary.v52AnswerFunnel.equivalentSurvivedSourcePlan, answerTotal)}% |\n` +
    `| Equivalent evidence was selected for composition | ${summary.v52AnswerFunnel.equivalentSelectedForComposition} | ${percent(summary.v52AnswerFunnel.equivalentSelectedForComposition, answerTotal)}% |\n` +
    `| Runtime returned answer or partial | ${summary.v52AnswerFunnel.answerOrPartialOutput} | ${percent(summary.v52AnswerFunnel.answerOrPartialOutput, answerTotal)}% |\n` +
    `| Output preserved all simple gold concepts | ${summary.v52AnswerFunnel.allRequiredConceptsPreserved} | ${percent(summary.v52AnswerFunnel.allRequiredConceptsPreserved, answerTotal)}% |\n\n` +
    `## Route funnel\n\n` +
    `- Correct owner: ${summary.v52RouteFunnel.correctOwner}/${routeTotal}.\n` +
    `- Wrong owner: ${summary.v52RouteFunnel.wrongOwner}/${routeTotal}.\n` +
    `- Route cases without a single owner label: ${summary.v52RouteFunnel.noExpectedOwnerLabel}/${routeTotal}.\n\n` +
    `### Confusion matrix\n\n` +
    `Rows are the source-reviewed owner; columns show the runtime owner or \`none\`. Multi-owner outputs retain every owner instead of being forced into one label.\n\n` +
    `\`\`\`json\n${JSON.stringify(summary.v52RouteFunnel.confusionMatrix, null, 2)}\n\`\`\`\n\n` +
    `## Interpretation boundary\n\n` +
    `Concept matching is a deterministic diagnostic approximation, not an answer judge. The per-case traces and manual source review remain controlling. The funnel separates source coverage, answer admission, top-k retrieval, source planning, composition, routing, and final manual outcome so later work changes the stage that actually loses support.\n`;

  const outputDir = path.join(root, "artifacts/ask-sales-faq-v5-3");
  await mkdir(outputDir, { recursive: true });
  await writeFile(path.join(outputDir, "v52-seven-stage-funnel.json"), `${JSON.stringify({ schemaVersion: 1, summary, traces }, null, 2)}\n`, "utf8");
  await writeFile(path.join(outputDir, "v52-seven-stage-funnel.md"), markdown, "utf8");
  process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack || error.message : String(error));
  process.exitCode = 1;
});
