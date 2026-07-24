import { matchingV4SystemicAuthorityResolutions } from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions";
import {
  getV4AtomicDecisionLedger,
  v4AtomicDecisionEvidence,
  v4AtomicTerms,
} from "@/lib/ask-sales-faq/v4/systemic/decision-ledger";
import {
  inferV4SystemicPolicyRelations,
  v4SystemicDecisionObjectScore,
  v4SystemicRelationCompatibility,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import { retrieveV4SystemicBlockedMatches } from "@/lib/ask-sales-faq/v4/systemic/retrieval";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import type { V3ProductScope, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { evaluateV51DecisionContract, evaluateV52DecisionIdentity } from "@/lib/ask-sales-faq/v5/decision-contract";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";

const snapshot = getV5KnowledgeSnapshot();
const policyById = new Map(snapshot.policies.map((policy) => [policy.id, policy]));

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "been", "before", "but", "by", "can", "could", "did", "do", "does", "for", "from", "had", "has", "have", "how", "i", "if", "in", "is", "it", "may", "must", "of", "on", "or", "our", "should", "that", "the", "their", "then", "this", "to", "was", "we", "what", "when", "where", "which", "who", "will", "with", "would", "you",
]);

const EQUIVALENTS: Record<string, string[]> = {
  buy: ["purchase"],
  purchase: ["buy"],
  cost: ["price", "fee"],
  price: ["cost", "fee"],
  pay: ["payment", "billing"],
  payment: ["pay", "billing"],
  contract: ["agreement", "license"],
  agreement: ["contract", "license"],
  call: ["meeting", "appointment"],
  meeting: ["call", "appointment"],
  reschedule: ["rebook", "move"],
  reapply: ["reapplication", "apply"],
  client: ["prospect", "cast", "customer"],
  prospect: ["client", "applicant", "lead"],
  show: ["program", "episode"],
  watch: ["view", "stream"],
  tech: ["technical", "system", "tool"],
  current: ["latest", "active"],
  latest: ["current", "active"],
  include: ["included", "cover", "benefit"],
  mother: ["family", "parent", "relative", "attendee", "guest"],
  father: ["family", "parent", "relative", "attendee", "guest"],
  parent: ["family", "mother", "father", "relative", "attendee"],
  spouse: ["family", "relative", "attendee", "guest"],
  relative: ["family", "attendee", "guest"],
  family: ["relative", "attendee", "guest"],
  guest: ["attendee", "family"],
  attendee: ["guest", "family"],
};

const GENERIC_ENTITY_TERMS = new Set([
  "answer", "approved", "call", "cast", "client", "company", "confirm", "confirmed", "current", "customer", "date", "document", "event", "exact", "form", "letter", "link", "member", "next", "owner", "payment", "person", "policy", "process", "prospect", "record", "recording", "rep", "request", "rule", "sales", "show", "status", "team", "time", "user",
].map(stem));

function normalize(value: string) {
  return value.toLowerCase()
    .replace(/[^a-z0-9$%]+/g, " ")
    .replace(/\bcall\s+(?:2|two|second)\b/g, "second call")
    .replace(/\s+/g, " ")
    .trim();
}

function stem(value: string) {
  if (value.length <= 4) return value;
  return value
    .replace(/(?:ies)$/i, "y")
    .replace(/(?:ing|ers|er|ed|es|s)$/i, "");
}

function tokens(value: string, expand = false) {
  const base = normalize(value).split(" ").map(stem).filter((token) => token.length >= 2 && !STOP.has(token));
  if (!expand) return base;
  return [...new Set(base.flatMap((token) => [token, ...(EQUIVALENTS[token] || []).map(stem)]))];
}

function overlap(left: string[], right: string[]) {
  if (!left.length || !right.length) return 0;
  const rightSet = new Set(right);
  return [...new Set(left)].filter((token) => rightSet.has(token)).length / new Set(left).size;
}

function phraseCoverage(query: string, families: string[]) {
  const queryTokens = tokens(query, true);
  return Math.max(0, ...families.map((family) => overlap(queryTokens, tokens(family, true))));
}

const documents = getV4AtomicDecisionLedger().flatMap((decision) => {
  const policy = policyById.get(decision.parentPolicyId);
  if (!policy) return [];
  const decisionText = v4AtomicDecisionEvidence(decision);
  const text = [
    policy.title,
    ...policy.question_families,
    decisionText,
    ...policy.product_scopes,
    ...policy.domains,
    ...policy.actions,
    ...policy.entities,
  ].join(" ");
  return [{
    policy,
    decision,
    decisionText,
    text,
    tokens: tokens(text),
    expandedTokens: tokens(text, true),
    relations: decision.relations.length ? decision.relations : inferV4SystemicPolicyRelations(policy),
    vector: sparseVector(text),
  }];
});

const documentFrequency = new Map<string, number>();
for (const document of documents) {
  for (const token of new Set(document.tokens)) documentFrequency.set(token, (documentFrequency.get(token) || 0) + 1);
}
const averageDocumentLength = documents.reduce((sum, document) => sum + document.tokens.length, 0) / Math.max(1, documents.length);

function bm25(query: string[], document: string[]) {
  if (!query.length || !document.length) return 0;
  const frequencies = new Map<string, number>();
  for (const token of document) frequencies.set(token, (frequencies.get(token) || 0) + 1);
  let score = 0;
  for (const token of new Set(query)) {
    const frequency = frequencies.get(token) || 0;
    if (!frequency) continue;
    const df = documentFrequency.get(token) || 0;
    const idf = Math.log(1 + (documents.length - df + 0.5) / (df + 0.5));
    const denominator = frequency + 1.2 * (1 - 0.75 + 0.75 * document.length / Math.max(1, averageDocumentLength));
    score += idf * (frequency * 2.2) / denominator;
  }
  return score;
}

function sparseVector(value: string) {
  const vector = new Map<string, number>();
  for (const token of v4AtomicTerms(value)) vector.set(token, (vector.get(token) || 0) + 1);
  return vector;
}

function cosine(left: Map<string, number>, right: Map<string, number>) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const value of left.values()) leftNorm += value * value;
  for (const value of right.values()) rightNorm += value * value;
  for (const [key, value] of left) dot += value * (right.get(key) || 0);
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function scopeError(policy: V4SystemicCandidate["policy"], need: V4SystemicNeed, turn: V3TurnResolution) {
  if (turn.excludedScopes.some((scope) => policy.product_scopes.includes(scope))) return "excluded_product_scope";
  const scope: V3ProductScope = need.productScope === "unknown" ? turn.productScope : need.productScope;
  if (scope === "unknown" || scope === "comparison") return null;
  if (policy.product_scopes.includes(scope) || policy.product_scopes.includes("product_agnostic")) return null;
  if (policy.systemic.sourceClass === "authoritative_operational_qna" && policy.systemic.scopeRisk === "general" && policy.product_scopes.includes("unknown")) return null;
  return "wrong_product_scope";
}

const ACTION_FACETS = [
  ["submit", /\b(?:submit|upload|attach|post|tag)\w*\b/i],
  ["record", /\b(?:record|capture|film)\w*\b|\bkeep\s+zoom\s+running\b/i],
  ["locate", /\b(?:where|find|locate|access|download|get\s+(?:the\s+)?(?:link|form|file|recording|document))\b/i],
  ["verify", /\b(?:verify|check|confirm|investigate|went\s+through|captured|cleared)\w*\b/i],
  ["modify", /\b(?:change|edit|update|modify|correct|replace)\w*\b/i],
  ["reschedule", /\b(?:reschedule|rebook|move)\w*\b/i],
  ["cancel", /\b(?:cancel|pause|stop|reverse|refund)\w*\b/i],
  ["send", /\b(?:send|email|issue|provide|deliver)\w*\b/i],
  ["create", /\b(?:create|generate|prepare|produce)\w*\b/i],
] as const;

function actionFacetError(request: string, evidence: string) {
  // The first explicit operational verb is the requested action. Nouns such as
  // "recording" must not turn "submit this recording" into a request to
  // create a recording. This is the exact relation mistake seen in V4.4.
  const requested = ACTION_FACETS.find(([, pattern]) => pattern.test(request))?.[0];
  const evidenced = ACTION_FACETS.filter(([, pattern]) => pattern.test(evidence)).map(([facet]) => facet);
  if (!requested || !evidenced.length || evidenced.includes(requested)) return null;
  return `requested_${requested}_not_${evidenced[0]}`;
}

function entityIdentityError(need: V4SystemicNeed, documentTokens: string[]) {
  const distinctive = [...new Set(need.entities.flatMap((entity) => tokens(entity, true)))]
    .filter((token) => token.length >= 3 && !GENERIC_ENTITY_TERMS.has(token));
  if (!distinctive.length) return null;
  const evidence = new Set(documentTokens);
  const matched = distinctive.filter((token) => evidence.has(token));
  const minimum = distinctive.length >= 2 ? 2 : 1;
  return matched.length >= minimum ? null : "named_entity_identity_mismatch";
}

function qualityScore(policy: V4SystemicCandidate["policy"]) {
  const quality = policy.quality_tier === "canonical" ? 5
    : policy.quality_tier === "trusted_evidence" ? 4
      : policy.quality_tier === "supporting" ? 2.5
        : 1;
  const answerability = policy.answerability === "answer_evidence" ? 3 : policy.answerability === "route_or_support" ? 0.5 : -20;
  return quality + answerability + Math.min(3, policy.authority / 4);
}

function rejectionKey(errors: string[]) {
  const text = errors.join(" ").toLowerCase();
  if (/scope/.test(text)) return "scope";
  if (/relationship|requested .* rather than|does not establish the requested/.test(text)) return "relation";
  if (/amount|payment/.test(text)) return "payment_qualifier";
  if (/stage|timing|duration|deadline/.test(text)) return "workflow_stage_or_time";
  if (/artifact|location|access/.test(text)) return "artifact";
  if (/trigger|condition|scenario|modality/.test(text)) return "material_condition";
  if (/object|subject|identity|role/.test(text)) return "decision_object";
  return "other_hard_boundary";
}

type Ranked = {
  document: typeof documents[number];
  score: number;
  directScore: number;
  expansionScore: number;
  lexicalScore: number;
  familyScore: number;
  structuredScore: number;
  semanticVectorScore: number;
  relationScore: number;
  matchedTerms: string[];
  matchedQueries: string[];
  lane: "direct" | "expansion";
  contractDisposition: "exact" | "compatible";
};

function rankNeed(need: V4SystemicNeed, turn: V3TurnResolution) {
  const authoritativeText = need.originalRequestText || need.authorityText || need.text;
  const directText = [need.text, authoritativeText, turn.usedImmediateContext ? turn.standaloneQuestion : ""].filter(Boolean).join(" ");
  const directTokens = tokens(directText, true);
  const structuredTokens = tokens([...need.domains, ...need.actions, ...need.entities].join(" "), true);
  const expansionQueries = [...new Set(need.retrievalQueries.map(normalize).filter((query) => query && query !== normalize(need.text)))];
  const resolution = matchingV4SystemicAuthorityResolutions(need);
  const excluded = new Set(resolution.flatMap((item) => item.excluded_policy_ids));
  const controlling = new Set(resolution.flatMap((item) => item.controlling_policy_ids));
  const rejectionCounts: Record<string, number> = {};
  const compatible: Ranked[] = [];
  let exactContractRejected = 0;

  for (const document of documents) {
    if (excluded.has(document.policy.id)) {
      rejectionCounts.authority_excluded = (rejectionCounts.authority_excluded || 0) + 1;
      continue;
    }
    const scope = scopeError(document.policy, need, turn);
    if (scope) {
      rejectionCounts[scope] = (rejectionCounts[scope] || 0) + 1;
      continue;
    }
    const contract = evaluateV51DecisionContract(need, document.policy);
    const hardErrors = [...contract.errors];
    const decisionIdentity = evaluateV52DecisionIdentity(need, document.policy, document.decisionText);
    if (contract.disposition === "exact" && !contract.matchedFacets.length && !decisionIdentity.exact && !controlling.has(document.policy.id)) {
      hardErrors.push("exact relationship label without exact decision identity");
    }
    const actionError = actionFacetError(authoritativeText, document.text);
    if (actionError) hardErrors.push(actionError);
    // Once both sides match the same explicit decision object, broad entity
    // identity is no longer a safer discriminator: it rejected parent/family
    // and SEO/PR paraphrases even though the governing object was exact. Actor,
    // product, condition, stage, and action boundaries remain enforced by the
    // decision contract above.
    const exactDecisionObject = contract.disposition === "exact" &&
      contract.matchedFacets.some((facet) => !facet.startsWith("action:"));
    const entityError = exactDecisionObject ? null : entityIdentityError(need, document.expandedTokens);
    if (entityError) hardErrors.push(entityError);
    if (hardErrors.length) {
      if (contract.errors.length && contract.matchedFacets.length) exactContractRejected += 1;
      const key = rejectionKey(hardErrors);
      rejectionCounts[key] = (rejectionCounts[key] || 0) + 1;
      if (contract.errors.length) rejectionCounts.decision_contract = (rejectionCounts.decision_contract || 0) + 1;
      continue;
    }

    const matchedTerms = [...new Set(directTokens.filter((token) => document.expandedTokens.includes(token)))];
    const rareMatches = matchedTerms.filter((token) => token.length >= 5 && (documentFrequency.get(token) || 0) <= 16);
    const family = phraseCoverage(authoritativeText, document.policy.question_families);
    const lexical = bm25(directTokens, document.tokens);
    const structured = overlap(structuredTokens, tokens([
      ...document.policy.domains,
      ...document.policy.actions,
      ...document.policy.entities,
    ].join(" "), true));
    const relationCompatibility = v4SystemicRelationCompatibility(need.relation, document.relations);
    const relationScore = relationCompatibility === "exact" ? 14 : relationCompatibility === "compatible" ? 7 : 1;
    const directSignal = lexical * 3.4 + family * 18 + structured * 9 + Math.min(30, rareMatches.length * 12) +
      v4SystemicDecisionObjectScore(authoritativeText, document.text) + relationScore;
    const expansionScores = expansionQueries.map((query) => ({
      query,
      score: bm25(tokens(query, true), document.tokens) * 2.2 + cosine(sparseVector(query), document.vector) * 10,
    })).sort((left, right) => right.score - left.score);
    const bestExpansion = expansionScores[0];
    const expansionScore = bestExpansion?.score || 0;
    const directAdmission = matchedTerms.length >= 2 || rareMatches.length >= 1 || family >= 0.45 || controlling.has(document.policy.id);
    const expansionAdmission = matchedTerms.length >= 1 && expansionScore >= 5 && relationCompatibility !== "unknown";
    if (!directAdmission && !expansionAdmission) {
      rejectionCounts.insufficient_direct_signal = (rejectionCounts.insufficient_direct_signal || 0) + 1;
      continue;
    }
    const lane = directAdmission ? "direct" as const : "expansion" as const;
    const boundedExpansion = directAdmission ? Math.min(expansionScore, Math.max(0, directSignal * 0.2)) : expansionScore;
    const authorityResolutionScore = controlling.has(document.policy.id) ? 40 : 0;
    compatible.push({
      document,
      score: directSignal + boundedExpansion + qualityScore(document.policy) + authorityResolutionScore,
      directScore: directSignal,
      expansionScore,
      lexicalScore: lexical,
      familyScore: family * 10,
      structuredScore: structured * 10,
      semanticVectorScore: bestExpansion ? cosine(sparseVector(bestExpansion.query), document.vector) : 0,
      relationScore,
      matchedTerms,
      matchedQueries: [need.text, ...(bestExpansion ? [bestExpansion.query] : [])],
      lane,
      contractDisposition: contract.disposition === "exact" ? "exact" : "compatible",
    });
  }

  compatible.sort((left, right) =>
    Number(controlling.has(right.document.policy.id)) - Number(controlling.has(left.document.policy.id)) ||
    (left.lane === right.lane ? 0 : left.lane === "direct" ? -1 : 1) ||
    right.score - left.score ||
    right.document.policy.authority - left.document.policy.authority ||
    left.document.decision.id.localeCompare(right.document.decision.id),
  );
  const perDecision = new Map<string, number>();
  const direct: Ranked[] = [];
  const expansion: Ranked[] = [];
  for (const candidate of compatible) {
    const count = perDecision.get(candidate.document.policy.decision_key) || 0;
    if (count >= 2) continue;
    if (candidate.lane === "direct" && direct.length < 8) direct.push(candidate);
    else if (candidate.lane === "expansion" && expansion.length < 2) expansion.push(candidate);
    else continue;
    perDecision.set(candidate.document.policy.decision_key, count + 1);
    if (direct.length >= 8 && expansion.length >= 2) break;
  }
  const selected = [...direct, ...expansion].sort((left, right) => right.score - left.score);
  const selectedExact = selected.some((candidate) => candidate.contractDisposition === "exact");
  return {
    selected,
    diagnostic: {
      needId: need.id,
      evidenceState: selectedExact
        ? "exact_evidence_found" as const
        : exactContractRejected > 0
          ? "exact_evidence_rejected" as const
          : selected.length
            ? "neighbor_only" as const
            : "knowledge_absent" as const,
      documentsConsidered: documents.length,
      hardCompatible: compatible.length,
      directLaneSelected: direct.length,
      expansionLaneSelected: expansion.length,
      selectedPolicyIds: [...new Set(selected.map((candidate) => candidate.document.policy.id))],
      rejectionCounts,
    },
  };
}

export function retrieveV5Policies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
  totalLimit = 24,
): V4SystemicRetrieval {
  const startedAt = Date.now();
  const byNeed = plan.needs.map((need) => ({ need, ...rankNeed(need, turn) }));
  const fused = new Map<string, Omit<V4SystemicCandidate, "rank">>();
  const maxDepth = Math.max(0, ...byNeed.map((entry) => entry.selected.length));
  const orderedIds: string[] = [];

  for (let depth = 0; depth < maxDepth; depth += 1) {
    for (const entry of byNeed) {
      const candidate = entry.selected[depth];
      if (!candidate) continue;
      const policy = candidate.document.policy;
      const existing = fused.get(policy.id);
      const needScore = {
        score: candidate.score,
        rank: depth + 1,
        lexicalScore: candidate.lexicalScore,
        familyScore: candidate.familyScore,
        characterScore: 0,
        structuredScore: candidate.structuredScore,
        semanticVectorScore: candidate.semanticVectorScore,
        relationScore: candidate.relationScore,
        matchedDecisionId: candidate.document.decision.id,
        matchedDecisionText: candidate.document.decisionText,
      };
      if (!existing) orderedIds.push(policy.id);
      fused.set(policy.id, {
        policy,
        score: Math.max(existing?.score || 0, candidate.score),
        matchedQueries: [...new Set([...(existing?.matchedQueries || []), ...candidate.matchedQueries])],
        matchedTerms: [...new Set([...(existing?.matchedTerms || []), ...candidate.matchedTerms])],
        lexicalScore: Math.max(existing?.lexicalScore || 0, candidate.lexicalScore),
        familyScore: Math.max(existing?.familyScore || 0, candidate.familyScore),
        characterScore: 0,
        structuredScore: Math.max(existing?.structuredScore || 0, candidate.structuredScore),
        authorityScore: Math.min(3, policy.authority / 4),
        relationScore: Math.max(existing?.relationScore || 0, candidate.relationScore),
        semanticVectorScore: Math.max(existing?.semanticVectorScore || 0, candidate.semanticVectorScore),
        matchedDecisionId: candidate.document.decision.id,
        matchedDecisionText: candidate.document.decisionText,
        needScores: { ...(existing?.needScores || {}), [entry.need.id]: needScore },
      });
      if (orderedIds.length >= totalLimit) break;
    }
    if (orderedIds.length >= totalLimit) break;
  }

  const candidates = orderedIds.slice(0, totalLimit).flatMap((id, index): V4SystemicCandidate[] => {
    const candidate = fused.get(id);
    if (!candidate) return [];
    return [{ ...candidate, rank: index + 1 }];
  });
  const blockedMatches = retrieveV4SystemicBlockedMatches(plan);
  return {
    query: turn.standaloneQuestion,
    turn,
    corpusSize: snapshot.policies.length,
    candidates,
    blockedTopicIds: [...new Set(blockedMatches.map((match) => match.topicId))],
    blockedMatches,
    stageTimings: { v5BoundedRetrievalMs: Date.now() - startedAt },
    diagnostics: {
      snapshotVersion: snapshot.knowledgeVersion,
      needs: byNeed.map((entry) => entry.diagnostic),
    },
  };
}
