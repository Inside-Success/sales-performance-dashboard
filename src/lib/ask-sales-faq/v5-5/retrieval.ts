import type { V3ProductScope, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import type {
  V4SystemicCandidate,
  V4SystemicNeed,
  V4SystemicQueryPlan,
  V4SystemicRetrieval,
} from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";

const snapshot = getV5KnowledgeSnapshot();

const STOP = new Set([
  "a", "an", "and", "are", "as", "at", "be", "by", "can", "current", "determine", "do", "does", "for", "from", "have", "how", "i", "in", "is", "it", "located", "of", "on", "or", "our", "should", "that", "the", "their", "this", "to", "was", "we", "what", "when", "where", "whether", "which", "who", "with", "would", "you",
]);

function stem(value: string) {
  if (value.length <= 4) return value;
  return value
    .replace(/ies$/i, "y")
    .replace(/s$/i, "");
}

function tokens(value: string) {
  return [...new Set(value.toLowerCase()
    .replace(/\b(?:outside|not\s+in|beyond)\s+(?:the\s+)?u\.?s\.?(?:a\.)?\b/g, "international")
    .replace(/\bnon[- ]?u\.?s\.?(?:a\.)?\b/g, "international")
    .replace(/\b(?:united states(?: of america)?|u\.?s\.?a?)\b/g, "us")
    .replace(/[^a-z0-9$%]+/g, " ")
    .split(/\s+/)
    .map(stem)
    .map((token) => new Set(["applicant", "cast", "customer", "individual", "lead", "member", "person", "prospect", "someone"]).has(token) ? "client" : token)
    .map((token) => new Set(["accept", "accepted", "consider", "considered", "fit", "qualification", "qualify", "qualified"]).has(token) ? "eligible" : token)
    .map((token) => new Set(["live", "reside", "resident", "residency"]).has(token) ? "based" : token)
    .filter((token) => token.length >= 2 && !STOP.has(token)))];
}

function scopeCompatible(policyScopes: string[], need: V4SystemicNeed, turn: V3TurnResolution) {
  const scope: V3ProductScope = need.productScope === "unknown" ? turn.productScope : need.productScope;
  if (turn.excludedScopes.some((excluded) => policyScopes.includes(excluded))) return false;
  if (scope === "unknown" || scope === "comparison") return true;
  // Operational Slack Q&A often carries `unknown` when the answer is a
  // reusable company-wide rule rather than a product-specific decision. Do
  // not hide that evidence from a scoped question; raw record entailment still
  // has to prove that the exact rule answers the exact request.
  return policyScopes.includes(scope) || policyScopes.includes("product_agnostic") || policyScopes.includes("unknown");
}

function siblingScore(request: string, decision: string) {
  const requested = tokens(request);
  const evidence = new Set(tokens(decision));
  if (!requested.length) return { score: 0, matched: [] as string[] };
  const matched = requested.filter((token) => evidence.has(token));
  return { score: matched.length / requested.length, matched };
}

function rawLexicalScore(request: string, policy: V4SystemicCandidate["policy"]) {
  const requested = tokens(request);
  const directEvidence = new Set(tokens(policy.decision));
  const contextEvidence = new Set(tokens([
    policy.title,
    ...policy.question_families,
    policy.search_text,
  ].join(" ")));
  if (!requested.length) return { score: 0, matched: [] as string[] };
  const directMatched = requested.filter((token) => directEvidence.has(token));
  const contextMatched = requested.filter((token) => contextEvidence.has(token));
  const matched = [...new Set([...directMatched, ...contextMatched])];
  const score = directMatched.length / requested.length * 0.65 + contextMatched.length / requested.length * 0.35;
  return { score, matched };
}

function syntheticCandidate(
  policy: V4SystemicCandidate["policy"],
  need: V4SystemicNeed,
  request: string,
  matched: string[],
  score: number,
  rank: number,
  globalRank: number,
  label: string,
): V4SystemicCandidate {
  const needScore = {
    score: score * 100,
    rank,
    lexicalScore: score * 10,
    familyScore: 0,
    characterScore: 0,
    structuredScore: 0,
    semanticVectorScore: 0,
    relationScore: 0,
    matchedDecisionId: `${policy.id}::${label}`,
    matchedDecisionText: policy.decision,
  };
  return {
    policy,
    rank: globalRank,
    score: needScore.score,
    matchedQueries: [request],
    matchedTerms: matched,
    lexicalScore: needScore.lexicalScore,
    familyScore: 0,
    characterScore: 0,
    structuredScore: 0,
    authorityScore: Math.min(3, policy.authority / 4),
    relationScore: 0,
    semanticVectorScore: 0,
    matchedDecisionId: needScore.matchedDecisionId,
    matchedDecisionText: policy.decision,
    needScores: { [need.id]: needScore },
  };
}

/**
 * The governed knowledge publisher intentionally atomizes long articles into
 * separate decisions. Bounded retrieval can find one atom while a neighboring
 * atom from the same approved article contains another requested fact. V5.5
 * keeps a small, raw-text-scored sibling set so the entailment model sees the
 * complete local policy unit without opening the entire corpus or trusting an
 * article title as evidence.
 */
export function retrieveV55Policies(
  turn: V3TurnResolution,
  plan: V4SystemicQueryPlan,
): V4SystemicRetrieval {
  const base = retrieveV5Policies(turn, plan);
  const byId = new Map(base.candidates.map((candidate) => [candidate.policy.id, candidate]));
  let siblingCount = 0;
  let rawLexicalCount = 0;

  for (const need of plan.needs) {
    const atomicRequest = plan.needs.length > 1 || turn.usedImmediateContext
      ? need.text
      : need.authorityText || need.originalRequestText || need.text;
    const retrievalRequests = [...new Set([need.text, atomicRequest].filter(Boolean))];
    const isInclusionOverview = need.relation === "inclusion" && /\b(?:what (?:else|all)|include)\b/i.test(atomicRequest);
    const sourceArticles = [...new Set(base.candidates
      .filter((candidate) => candidate.needScores?.[need.id])
      .filter((candidate) => candidate.policy.answerability === "answer_evidence")
      .slice(0, 8)
      .map((candidate) => candidate.policy.source.article_id)
      .filter((articleId): articleId is string => Boolean(articleId)))];
    const rankedSiblings = snapshot.policies
      .filter((policy) => policy.answerability === "answer_evidence")
      .filter((policy) => policy.source.article_id && sourceArticles.includes(policy.source.article_id))
      .filter((policy) => scopeCompatible(policy.product_scopes, need, turn))
      .filter((policy) => !byId.get(policy.id)?.needScores?.[need.id])
      .map((policy) => {
        const scores = retrievalRequests.map((request) => siblingScore(request, policy.decision));
        return { policy, ...scores.sort((left, right) => right.score - left.score || right.matched.length - left.matched.length)[0] };
      })
      .filter((item) => item.matched.length >= 2 && item.score >= 0.2)
      .sort((left, right) =>
        right.score - left.score ||
        right.matched.length - left.matched.length ||
        right.policy.authority - left.policy.authority ||
        left.policy.id.localeCompare(right.policy.id),
      )
      .slice(0, 4);

    rankedSiblings.forEach((item, index) => {
      const existing = byId.get(item.policy.id);
      const sourceRank = Math.min(99, ...base.candidates
        .filter((candidate) => candidate.policy.source.article_id === item.policy.source.article_id)
        .map((candidate) => candidate.needScores?.[need.id]?.rank || candidate.rank));
      const synthetic = syntheticCandidate(
        item.policy,
        need,
        atomicRequest,
        item.matched,
        item.score,
        sourceRank + 0.25 + index / 100,
        base.candidates.length + siblingCount + 1,
        "publisher-sibling",
      );
      const needScore = synthetic.needScores![need.id];
      if (existing) {
        byId.set(item.policy.id, {
          ...existing,
          matchedQueries: [...new Set([...existing.matchedQueries, atomicRequest])],
          matchedTerms: [...new Set([...existing.matchedTerms, ...item.matched])],
          needScores: { ...(existing.needScores || {}), [need.id]: needScore },
        });
        return;
      }
      siblingCount += 1;
      byId.set(item.policy.id, { ...synthetic, rank: base.candidates.length + siblingCount });
    });

    const perSource = new Map<string, number>();
    const rawCandidates = snapshot.policies
      .filter((policy) => policy.answerability === "answer_evidence" || (
        policy.answerability === "route_or_support" &&
        policy.systemic.sourceClass === "authoritative_operational_qna" &&
        policy.systemic.scopeRisk !== "case_specific" &&
        policy.systemic.temporalRisk !== "live_only" &&
        policy.source.approved_by.some((name) => /\b(?:Rich|Mike|Rudy|Raul|Madeline)\b/i.test(name))
      ))
      .filter((policy) => scopeCompatible(policy.product_scopes, need, turn))
      .filter((policy) => !byId.get(policy.id)?.needScores?.[need.id])
      .map((policy) => {
        const scores = retrievalRequests.map((request) => rawLexicalScore(request, policy));
        return { policy, ...scores.sort((left, right) => right.score - left.score || right.matched.length - left.matched.length)[0] };
      })
      .filter((item) => item.matched.length >= 2 && item.score >= (
        item.policy.answerability === "route_or_support" ? 0.3 : isInclusionOverview ? 0.25 : 0.3
      ))
      .sort((left, right) =>
        right.score - left.score ||
        right.matched.length - left.matched.length ||
        right.policy.authority - left.policy.authority ||
        left.policy.id.localeCompare(right.policy.id),
      );
    let rawNeedIndex = 0;
    for (const item of rawCandidates) {
      const sourceKey = item.policy.source.article_id || item.policy.source.ids[0] || item.policy.id;
      const sourceCount = perSource.get(sourceKey) || 0;
      if (sourceCount >= 4) continue;
      perSource.set(sourceKey, sourceCount + 1);
      const existing = byId.get(item.policy.id);
      const synthetic = syntheticCandidate(
        item.policy,
        need,
        atomicRequest,
        item.matched,
        item.score,
        1.5 + rawNeedIndex / 100,
        base.candidates.length + siblingCount + rawLexicalCount + 1,
        "raw-lexical-recall",
      );
      if (existing) {
        byId.set(item.policy.id, {
          ...existing,
          matchedQueries: [...new Set([...existing.matchedQueries, atomicRequest])],
          matchedTerms: [...new Set([...existing.matchedTerms, ...item.matched])],
          needScores: { ...(existing.needScores || {}), [need.id]: synthetic.needScores![need.id] },
        });
      } else {
        rawLexicalCount += 1;
        byId.set(item.policy.id, { ...synthetic, rank: base.candidates.length + siblingCount + rawLexicalCount });
      }
      rawNeedIndex += 1;
      if (rawNeedIndex >= 24) break;
    }
  }

  const candidates = [...byId.values()];
  return {
    ...base,
    candidates,
    diagnostics: base.diagnostics ? {
      ...base.diagnostics,
      needs: base.diagnostics.needs.map((diagnostic) => ({
        ...diagnostic,
        selectedPolicyIds: [...new Set([
          ...diagnostic.selectedPolicyIds,
          ...candidates.filter((candidate) => candidate.needScores?.[diagnostic.needId]).map((candidate) => candidate.policy.id),
        ])],
      })),
    } : base.diagnostics,
    stageTimings: {
      ...base.stageTimings,
      v55PublisherSiblingExpansionCount: siblingCount,
      v55RawLexicalRecallCount: rawLexicalCount,
    },
  };
}
