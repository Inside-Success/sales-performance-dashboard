import type { AskSalesFaqChatMessage, AskSalesFaqStructuredAnswer } from "@/lib/ask-sales-faq/types";
import { parseV3Json } from "@/lib/ask-sales-faq/v3/provider";
import { resolveV3Turn } from "@/lib/ask-sales-faq/v3/turn-resolver";
import type { V3Policy, V3Provider, V3ProviderAttempt, V3TurnResolution } from "@/lib/ask-sales-faq/v3/types";
import { v4BlockedTopicDecisionMatch, v4BlockedTopicMatchesNeed, v4PolicyCanAnswer, v4PolicyBoundaryErrors } from "@/lib/ask-sales-faq/v4/boundaries";
import { getV4KnowledgeVersion, getV4RouteCatalog } from "@/lib/ask-sales-faq/v4/corpus";
import { deterministicV4SentenceErrors } from "@/lib/ask-sales-faq/v4/facts";
import { generateV4Json, generateV4ValidationJson, providerAttemptsFromV4Error } from "@/lib/ask-sales-faq/v4/provider";
import { resolveV4PriorityPolicyFamily, retrieveV4Policies } from "@/lib/ask-sales-faq/v4/retrieval";
import type {
  AskSalesFaqV4Result,
  V4AnswerPlan,
  V4Candidate,
  V4ComposedSentence,
  V4Composition,
  V4BlockedCandidate,
  V4Lane,
  V4PlannedNeed,
  V4RuntimeOptions,
  V4SentenceCheck,
  V4Validation,
  V4RetrievalResult,
} from "@/lib/ask-sales-faq/v4/types";

const routeCatalog = getV4RouteCatalog();
const allowedRouteKeys = new Set(Object.keys(routeCatalog));

function clean(value: unknown, limit = 4000) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, limit);
}

function displayText(value: unknown, limit = 4000) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim()
    .replace(/\s*(?:\(|\[)(?:C\d{1,2}|E\d{1,2})(?:\s*[,;]\s*(?:C\d{1,2}|E\d{1,2}))*\s*(?:\)|\])/gi, "")
    .replace(/\b(?:in|from) (?:my|the|our) (?:knowledge base|retrieval|RAG|evidence set)\b/gi, "in the current guidance")
    .replace(/\s+/g, " ")
    .trim();
  if (normalized.length <= limit) return normalized;
  const prefix = normalized.slice(0, Math.max(1, limit));
  const sentenceBoundary = Math.max(prefix.lastIndexOf(". "), prefix.lastIndexOf("! "), prefix.lastIndexOf("? "));
  if (sentenceBoundary >= Math.floor(limit * 0.6)) return prefix.slice(0, sentenceBoundary + 1).trim();
  const wordBoundary = prefix.lastIndexOf(" ");
  return `${prefix.slice(0, wordBoundary > 0 ? wordBoundary : limit).trimEnd()}…`;
}

function stringArray(value: unknown, limit = 20) {
  return Array.isArray(value) ? value.map((item) => clean(item, 500)).filter(Boolean).slice(0, limit) : [];
}

function clampConfidence(value: unknown) {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(numeric)) return 0;
  const scaled = numeric >= 0 && numeric <= 1 ? numeric * 100 : numeric;
  return Math.max(0, Math.min(100, Math.round(scaled)));
}

function redactSensitiveText(value: string) {
  const redactions: string[] = [];
  let text = value;
  const replacements: Array<[RegExp, string, string]> = [
    [/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted email]", "email"],
    [/\+?\d[\d ()-]{8,}\d/g, "[redacted phone]", "phone"],
    [/\b(?:\d[ -]*?){13,19}\b/g, "[redacted payment card]", "payment_card"],
  ];
  for (const [pattern, replacement, label] of replacements) {
    if (pattern.test(text)) redactions.push(label);
    pattern.lastIndex = 0;
    text = text.replace(pattern, replacement);
  }
  return { text: clean(text, 12000), redactions: [...new Set(redactions)] };
}

function evidenceDecision(policy: V3Policy) {
  const match = policy.decision.match(/^\s*Policy context:\s*[\s\S]*?\s*Decision evidence:\s*([\s\S]+?)\s*$/i);
  const value = displayText(match?.[1] || policy.decision, 4000).replace(/^"([\s\S]+)"$/, "$1");
  if (!value.includes("|")) return value;
  return value.split("|")
    .map((cell) => cell.replace(/\s+/g, " ").trim())
    .filter((cell) => cell && !/^[-: ]+$/.test(cell))
    .join("; ")
    .replace(/;\s*;/g, ";")
    .replace(/:;/g, ":")
    .trim();
}

function evidenceText(policies: V3Policy[]) {
  return policies.map((policy) => `${policy.title}: ${evidenceDecision(policy)}`).join("\n");
}

function candidateCards(candidates: V4Candidate[]) {
  return candidates.slice(0, 28).map((candidate, index) => ({
    ref: `C${index + 1}`,
    title: candidate.policy.title,
    question_families: candidate.policy.question_families.slice(0, 5),
    decision: evidenceDecision(candidate.policy),
    decision_key: candidate.policy.decision_key,
    product_scopes: candidate.policy.product_scopes,
    domains: candidate.policy.domains,
    actions: candidate.policy.actions,
    entities: candidate.policy.entities,
    answerability: candidate.policy.answerability,
    quality_tier: candidate.policy.quality_tier,
    authority: candidate.policy.authority,
    route_key: candidate.policy.route_key,
    last_reviewed: candidate.policy.last_reviewed,
  }));
}

function resolveCandidateRef(value: string, candidates: V4Candidate[]) {
  const direct = candidates.find((candidate) => candidate.policy.id === value)?.policy.id;
  if (direct) return direct;
  const ref = value.match(/^C(\d{1,2})$/i);
  if (!ref) return null;
  return candidates[Number.parseInt(ref[1], 10) - 1]?.policy.id || null;
}

type ConcreteProductScope = "main_istv" | "dj_nlceo";

function mentionedProductScopes(value: string) {
  const scopes = new Set<ConcreteProductScope>();
  if (/\b(?:main\s+istv|inside success(?:\s+tv)?|istv)\b/i.test(value)) scopes.add("main_istv");
  if (/\b(?:daymond john|next level ceo|nlceo|dj\/nlceo|dj show)\b/i.test(value)) scopes.add("dj_nlceo");
  return scopes;
}

function decisionProductScopes(policy: V3Policy) {
  const explicit = mentionedProductScopes(evidenceDecision(policy));
  if (explicit.size) return explicit;
  return new Set(policy.product_scopes.filter((scope): scope is ConcreteProductScope => scope === "main_istv" || scope === "dj_nlceo"));
}

function productScopeErrorsForNeed(needText: string, policies: V3Policy[], turn: V3TurnResolution) {
  const evidenceScopes = policies.map((policy) => decisionProductScopes(policy));
  if (!evidenceScopes.some((scopes) => scopes.size)) return [];
  if (turn.productScope === "unknown") {
    const boundaryText = `${turn.currentQuestion} ${needText}`;
    const exactTierOneBoundary = policies.length > 0 &&
      policies.every((policy) => policy.decision_key === "vip-license-platform-coverage") &&
      /\b(?:tier[ -]?1|platforms?|placement|submit|submission|apple tv|amazon prime|tubi)\b/i.test(boundaryText);
    if (exactTierOneBoundary) return [];
    return ["product-specific evidence cannot answer a need whose product scope is unknown"];
  }
  if (turn.productScope !== "comparison") return [];

  const needScopes = mentionedProductScopes(needText);
  if (!needScopes.size) {
    return ["comparison needs must name the product scope for each product-sensitive atomic answer"];
  }
  if (evidenceScopes.some((scopes) => scopes.size && ![...scopes].some((scope) => needScopes.has(scope)))) {
    return ["comparison evidence does not match the product scope named by the atomic need"];
  }
  if ([...needScopes].some((scope) => !evidenceScopes.some((scopes) => scopes.has(scope)))) {
    return ["comparison evidence does not cover every product scope named by the atomic need"];
  }
  return [];
}

function v4PolicySupportErrors(policy: V3Policy, turn: V3TurnResolution, needText: string) {
  const errors = v4PolicyBoundaryErrors(policy, turn);
  const exactNegativeWatchabilityBoundary = policy.id === "owner-current-show-list-watchability-boundary" &&
    /\b(?:show list|catalog|listed|watch|watchable|on air|aired|airing|episode availability)\b/i.test(`${turn.currentQuestion} ${needText}`);
  const exactStopReinstatementRoute = policy.id === "claim_d2519c5b8045823b" &&
    /\b(?:texted|replied|said|wrote) stop\b|\bstop\b.{0,80}\b(?:reinstat|resubscrib|contact|book)\w*\b/i.test(`${turn.currentQuestion} ${needText}`);
  return exactNegativeWatchabilityBoundary || exactStopReinstatementRoute
    ? errors.filter((error) => error !== "route or resource evidence cannot authorize a substantive decision")
    : errors;
}

function v4PolicyCanSupportNeed(policy: V3Policy, turn: V3TurnResolution, needText: string) {
  return (v4PolicyCanAnswer(policy, turn) || ["owner-current-show-list-watchability-boundary", "claim_d2519c5b8045823b"].includes(policy.id)) &&
    v4PolicySupportErrors(policy, turn, needText).length === 0;
}

type V4QuestionCoverageFacet =
  | "app_access"
  | "artifact"
  | "discount"
  | "guarantee"
  | "language"
  | "payment"
  | "platform_coverage"
  | "price"
  | "qualification"
  | "refund_or_cancel"
  | "rights"
  | "roi"
  | "schedule_or_timing"
  | "season_capacity"
  | "show_list"
  | "submission"
  | "technical_access"
  | "upgrade"
  | "viewer_statistics"
  | "watchability"
  | "quantity";

const V4_QUESTION_COVERAGE_FACETS: Array<[V4QuestionCoverageFacet, RegExp]> = [
  ["app_access", /\b(?:download|install|get)\b.{0,50}\bapp\b|\bapp\b.{0,50}\b(?:device|devices|roku|fire stick|apple tv)\b/i],
  ["artifact", /\b(?:pdf|deck|slide deck|presentation|document|script|template|media kit|resource|contract link|payment link|training video|recording link)\b/i],
  ["discount", /\b(?:discount|discounted|half[ -]?off|same[ -]?day|crossover|cross[ -]?product)\b|\b50\s*%/i],
  ["guarantee", /\b(?:promise|promised|guarantee|guaranteed|definitely approved|assure|assured|commit|committed)\b/i],
  ["language", /\b(?:spanish|non[- ]english|another language|translation|translate|translated|bilingual)\b/i],
  ["payment", /\b(?:pay|paid|payment|payments|deposit|down payment|installments?|instalments?|split option|split options|pif|paid in full)\b|\b\d+\s*x\s*\$?\s*\d/i],
  ["platform_coverage", /\b(?:tier[ -]?1|platform|platforms|apple tv|amazon prime|tubi)\b/i],
  ["price", /\b(?:price|prices|pricing|cost|costs|costing)\b|(?:\$|£)\s*\d/i],
  ["qualification", /\b(?:qualify|qualifies|qualified|qualification|eligible|eligibility|disqualify|disqualified)\b/i],
  ["refund_or_cancel", /\b(?:refund|refundable|cancel|cancellation|chargeback)\b/i],
  ["rights", /\b(?:content rights|ownership|own the|license rights|reuse|use their segment|contract rights)\b/i],
  ["roi", /\b(?:roi|return on investment|revenue|leads?|fundrais|business outcome)\b/i],
  ["schedule_or_timing", /\b(?:schedule|scheduled|booking|book|deadline|cutoff|timing|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b|\bwhen\b.{0,50}\b(?:submit|submission|film|filming|receive|deliver)\b/i],
  ["season_capacity", /\b(?:season|seasons|episodes per season|season capacity)\b/i],
  ["show_list", /\b(?:show list|list of shows|list the shows|what shows|approved shows|active shows|available shows)\b/i],
  ["submission", /\b(?:submit|submits|submitted|submission)\b/i],
  ["technical_access", /\b(?:login|log in|access issue|cannot access|can't access|broken link|keap|sales tech|technical issue)\b/i],
  ["upgrade", /\b(?:upgrade|upgrading|move from|moving from)\b/i],
  ["viewer_statistics", /\b(?:views|viewers|viewership|audience|demographics|awards)\b/i],
  ["watchability", /\b(?:watch|watchable|stream|streaming|on air|aired|airing|episode availability|episode link|available to view)\b/i],
  ["quantity", /\b(?:how many|number of|count|one|two|three|multiple|all three)\b|\b\d+\b/i],
];

// These decision facets must appear in the supported claim, not merely in a
// planner need that could have copied the user's wording while answering less.
const V4_CLAIM_REQUIRED_COVERAGE_FACETS = new Set<V4QuestionCoverageFacet>([
  "app_access",
  "discount",
  "guarantee",
  "language",
  "payment",
  "platform_coverage",
  "price",
  "qualification",
  "refund_or_cancel",
  "rights",
  "roi",
  "schedule_or_timing",
  "season_capacity",
  "submission",
  "technical_access",
  "upgrade",
  "viewer_statistics",
  "watchability",
  "quantity",
]);

const V4_COVERAGE_STOP_WORDS = new Set([
  "a", "about", "an", "and", "are", "as", "at", "be", "by", "can", "could", "do", "does", "for", "from", "has", "have", "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "our", "should", "that", "the", "their", "this", "to", "we", "what", "when", "where", "which", "who", "why", "will", "with", "would", "you",
]);

const V4_BROAD_BLOCKED_SUBJECTS = new Set([
  "applicant", "applicants", "client", "clients", "customer", "customers", "episode", "episodes", "istv", "lead", "leads", "nlceo", "package", "packages", "prospect", "prospects", "rep", "reps", "sale", "sales", "show", "shows", "vip",
]);

function v4CoverageFacets(value: string) {
  return new Set(V4_QUESTION_COVERAGE_FACETS.flatMap(([facet, pattern]) => pattern.test(value) ? [facet] : []));
}

function v4CoverageTerms(value: string) {
  return new Set(value.toLowerCase()
    .replace(/tier[ -]?1/g, "tier1")
    .replace(/apple tv/g, "appletv")
    .replace(/amazon prime/g, "amazonprime")
    .replace(/daymond john|next level ceo|dj\s*\/\s*nlceo/g, "nlceo")
    .replace(/inside success tv|main istv/g, "istv")
    .replace(/same[ -]?day/g, "sameday")
    .replace(/cross[ -]?product/g, "crossover")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((term) => term.length > 2 && !V4_COVERAGE_STOP_WORDS.has(term)));
}

function v4BlockedTopicMatchesOriginalQuestion(topic: V4BlockedCandidate["topic"], question: string) {
  const match = v4BlockedTopicDecisionMatch(topic, question);
  return match.matches && match.matchedSubjects.some((subject) =>
    !V4_BROAD_BLOCKED_SUBJECTS.has(subject) && !/^\d{1,2}$/.test(subject),
  );
}

function v4QuestionCoverageSegments(question: string) {
  const boundary = /\s*;\s*|\?\s+(?=\S)|(?:,\s*)?\band\s+(?=(?:also\s+)?(?:can|could|do|does|did|is|are|was|were|will|would|should|may|might|must|what|when|where|which|who|why|how|exactly\s+when|use|verify|confirm|check|fix|get|download|tell|promise)\b)|\s+\bwhile\b\s+/gi;
  const segments = displayText(question, 12000)
    .split(boundary)
    .map((segment) => clean(segment.replace(/[?.!,;:]+$/g, ""), 1000))
    .filter((segment) => segment && (v4CoverageFacets(segment).size > 0 || v4CoverageTerms(segment).size > 0))
    .slice(0, 8);
  return segments.length ? segments : [displayText(question, 1000)];
}

function asksShowListLocation(question: string) {
  return /\b(?:where|source|location|link)\b.{0,80}\b(?:current|active|approved|latest)?\s*show(?:s| list)?\b|\b(?:where|source|location|link)\b.{0,80}\blist of shows\b/i.test(question) ||
    /\b(?:check|find|locate|access)\b.{0,50}\b(?:current|active|approved|latest)\s+show list\b/i.test(question);
}

function asksPaidAllThreePlatforms(question: string) {
  return /\b(?:pay|paid|extra|upgrade)\b.{0,80}\ball\s+(?:3|three)\b.{0,40}\b(?:tier[ -]?1|platforms?)\b/i.test(question) ||
    /\ball\s+(?:3|three)\b.{0,80}\b(?:tier[ -]?1|platforms?)\b.{0,50}\b(?:pay|paid|extra|upgrade)\b/i.test(question);
}

function asksClientMessageReview(question: string) {
  return /\b(?:email|message|reply|response)\b/i.test(question) &&
    /\b(?:fact[ -]?check|write|draft|rewrite|respond|reply|word|better|send)\b/i.test(question);
}

function asksStopReinstatement(question: string) {
  return /\b(?:texted|replied|said|wrote) stop\b|\bstop\b.{0,80}\b(?:reinstat|resubscrib|contact|book)\w*\b/i.test(question);
}

function asksExactSeasonCount(question: string) {
  return /\b(?:how many|number of|exact(?:ly)? how many)\s+seasons?\b/i.test(question);
}

function asksConceptualWatchabilityBoundary(question: string) {
  const hasCatalog = /\b(?:show list|approved list|catalog|listed|list membership)\b/i.test(question);
  const hasBoundaryIntent = /\b(?:mean|means|prove|proves|guarantee|guarantees|does not|doesn't|right)\b/i.test(question);
  return hasCatalog && hasBoundaryIntent;
}

function asksSpecificShowWatchability(question: string) {
  return /\b(?:currently on air|on air|aired|airing|watch|watchable|episode availability|episode link|available to view)\b/i.test(question) &&
    !asksConceptualWatchabilityBoundary(question);
}

function v4BlockedTopicMatchesQuestion(topic: V4BlockedCandidate["topic"], question: string) {
  return v4QuestionCoverageSegments(question).some((segment) => v4BlockedTopicMatchesOriginalQuestion(topic, segment));
}

function v4NeedCoversQuestionSegment(need: V4PlannedNeed, segment: string) {
  const segmentFacets = v4CoverageFacets(segment);
  const representation = `${need.text} ${need.reason} ${need.clarification_question} ${need.supported_claim}`;
  const representationFacets = v4CoverageFacets(representation);
  const resolutionFacets = v4CoverageFacets(need.lane === "answer" ? need.supported_claim : representation);
  if (segmentFacets.size) {
    return [...segmentFacets].every((facet) =>
      representationFacets.has(facet) &&
      (!V4_CLAIM_REQUIRED_COVERAGE_FACETS.has(facet) || resolutionFacets.has(facet)),
    );
  }
  const segmentTerms = v4CoverageTerms(segment);
  const needTerms = v4CoverageTerms(representation);
  const overlap = [...segmentTerms].filter((term) => needTerms.has(term));
  return overlap.length >= Math.min(2, segmentTerms.size);
}

function v4OverallPlanLane(needs: V4PlannedNeed[]): V4Lane {
  const answered = needs.filter((need) => need.lane === "answer").length;
  const unresolved = needs.length - answered;
  return answered && unresolved
    ? "partial"
    : answered
      ? "answer"
      : needs.some((need) => need.lane === "clarify")
        ? "clarify"
        : needs.some((need) => need.lane === "live_lookup")
          ? "live_lookup"
          : needs.some((need) => need.lane === "artifact")
            ? "artifact"
            : "route";
}

function enforceV4QuestionCompleteness(
  plan: V4AnswerPlan,
  turn: V3TurnResolution,
  retrieval: V4RetrievalResult,
  planningMode: "model" | "deterministic_fallback",
) {
  const blocked = retrieval.blocked;
  const additions: Array<Omit<V4PlannedNeed, "id">> = [];
  const segments = v4QuestionCoverageSegments(turn.currentQuestion);
  const wholeQuestionIsAlreadyBounded = plan.needs.some((need) => {
    if (need.lane === "answer") return false;
    if (clean(need.text).toLowerCase() === clean(turn.currentQuestion).toLowerCase()) return true;
    const representation = `${need.text} ${need.reason}`;
    if (asksStopReinstatement(turn.currentQuestion)) {
      return need.route_key === "sales_tech" && /\b(?:stop|resubscrib|tech confirmation|outreach|booking)\b/i.test(representation);
    }
    if (asksClientMessageReview(turn.currentQuestion)) {
      return need.route_key === "sales_policy" && /\bclient-message fact check and rewrite\b/i.test(representation);
    }
    return false;
  });

  if (!wholeQuestionIsAlreadyBounded) {
    if (planningMode === "model" && segments.length > 1) {
      // Explicit compound questions require distinct atomic needs. A planner
      // cannot make one narrow answer need stand in for two requested actions.
      const needToSegment = new Map<number, number>();
      const matchSegment = (segmentIndex: number, visited: Set<number>): boolean => {
        for (let needIndex = 0; needIndex < plan.needs.length; needIndex += 1) {
          if (visited.has(needIndex) || !v4NeedCoversQuestionSegment(plan.needs[needIndex], segments[segmentIndex])) continue;
          visited.add(needIndex);
          const previousSegment = needToSegment.get(needIndex);
          if (previousSegment === undefined || matchSegment(previousSegment, visited)) {
            needToSegment.set(needIndex, segmentIndex);
            return true;
          }
        }
        return false;
      };
      segments.forEach((segment, index) => {
        if (matchSegment(index, new Set())) return;
        additions.push({
          text: segment,
          lane: "route",
          evidence_refs: [],
          supported_claim: "",
          reason: "The model plan did not account for this independently requested part of the original question.",
          route_key: null,
          clarification_question: "",
        });
      });
    } else {
      for (const segment of segments) {
        if (plan.needs.some((need) => v4NeedCoversQuestionSegment(need, segment))) continue;
        additions.push({
          text: segment,
          lane: "route",
          evidence_refs: [],
          supported_claim: "",
          reason: "The answer plan did not account for this requested part of the original question.",
          route_key: null,
          clarification_question: "",
        });
      }
    }
  }

  const answerPolicies = plan.needs
    .filter((need) => need.lane === "answer")
    .flatMap((need) => need.evidence_refs)
    .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy)
    .filter((policy): policy is V3Policy => Boolean(policy));
  const boundedNeedMatches = (pattern: RegExp) => [...plan.needs, ...additions].some((need) =>
    need.lane !== "answer" && pattern.test(`${need.text} ${need.reason}`),
  );
  const addBoundedNeed = (input: Omit<V4PlannedNeed, "id">, pattern: RegExp) => {
    if (!boundedNeedMatches(pattern)) additions.push(input);
  };

  if (asksShowListLocation(turn.currentQuestion)) {
    addBoundedNeed({
      text: "Where the maintained active-show source is located",
      lane: "route",
      evidence_refs: [],
      supported_claim: "",
      reason: "The approved catalog provides the current list but does not identify a rep-facing maintained link or location.",
      route_key: "sales_policy",
      clarification_question: "",
    }, /\b(?:where|source|location|link|find|check)\b/i);
  }

  const hasPaidAllThreeDecision = answerPolicies.some((policy) =>
    /\b(?:pay|paid|extra|upgrade)\b.{0,100}\ball\s+(?:3|three)\b|\ball\s+(?:3|three)\b.{0,100}\b(?:pay|paid|extra|upgrade)\b/i.test(policy.decision),
  );
  if (asksPaidAllThreePlatforms(turn.currentQuestion) && !hasPaidAllThreeDecision) {
    addBoundedNeed({
      text: "Whether a client may pay extra for submission to all three Tier-1 platforms",
      lane: "route",
      evidence_refs: [],
      supported_claim: "",
      reason: "Current evidence covers one included platform and paid Apple TV guarantees, but not a paid all-three option.",
      route_key: "sales_policy",
      clarification_question: "",
    }, /\b(?:pay|paid|extra|upgrade)\b.{0,100}\ball\s+(?:3|three)\b|\ball\s+(?:3|three)\b.{0,100}\b(?:pay|paid|extra|upgrade)\b/i);
  }

  const hasExactSeasonCount = answerPolicies.some((policy) => /\b\d+\s+(?:total\s+)?seasons?\b/i.test(policy.decision));
  if (asksExactSeasonCount(turn.currentQuestion) && !hasExactSeasonCount) {
    addBoundedNeed({
      text: "The exact number of seasons",
      lane: "route",
      evidence_refs: [],
      supported_claim: "",
      reason: "Current evidence confirms multiple seasons but does not provide a fixed total season count.",
      route_key: "sales_policy",
      clarification_question: "",
    }, /\b(?:exact|number|how many|total)\b.{0,50}\bseasons?\b/i);
  }

  const usesCatalogWatchabilityBoundary = answerPolicies.some((policy) => policy.id === "owner-current-show-list-watchability-boundary");
  if (usesCatalogWatchabilityBoundary && asksSpecificShowWatchability(turn.currentQuestion)) {
    addBoundedNeed({
      text: "The exact show's current public episode availability",
      lane: "live_lookup",
      evidence_refs: [],
      supported_claim: "",
      reason: "Catalog membership cannot establish current public watchability.",
      route_key: "sales_policy",
      clarification_question: "",
    }, /\b(?:exact|current|currently|watch|watchable|air|aired|availability)\b/i);
  }

  for (const candidate of blocked) {
    if (!v4BlockedTopicMatchesQuestion(candidate.topic, turn.currentQuestion)) continue;
    const alreadyBounded = [...plan.needs, ...additions].some((need) =>
      need.lane !== "answer" && v4BlockedTopicMatchesQuestion(candidate.topic, need.text),
    );
    if (alreadyBounded) continue;
    additions.push({
      text: turn.currentQuestion,
      lane: "route",
      evidence_refs: [],
      supported_claim: "",
      reason: `The matching governance topic ${candidate.topic.id} is explicitly unresolved.`,
      route_key: null,
      clarification_question: "",
    });
  }

  if (!additions.length) return plan;
  const needs = [...plan.needs, ...additions].map((need, index) => ({ ...need, id: `N${index + 1}` }));
  const overallLane = v4OverallPlanLane(needs);
  return {
    ...plan,
    needs,
    overall_lane: overallLane,
    confidence_score: Math.min(plan.confidence_score, overallLane === "partial" ? 79 : 49),
    reasoning_summary: `${plan.reasoning_summary} Deterministic completeness checks preserved ${additions.length} omitted or blocked need${additions.length === 1 ? "" : "s"} as unresolved.`.trim(),
  };
}

function parsePlan(content: string, candidates: V4Candidate[], blocked: V4BlockedCandidate[], turn: V3TurnResolution): V4AnswerPlan {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const rawNeeds = Array.isArray(raw.needs) ? raw.needs : [];
  const parsedNeeds = rawNeeds.slice(0, 8).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const text = clean(entry.text || entry.need, 300);
    if (!text) return [];
    const matchedBlockedTopic = blocked.find((candidate) => v4BlockedTopicMatchesNeed(candidate.topic, text));
    const proposedLane = ["answer", "clarify", "live_lookup", "artifact", "route"].includes(String(entry.lane))
      ? String(entry.lane) as V4PlannedNeed["lane"]
      : "route";
    const evidenceRefs = stringArray(entry.evidence_refs, 8)
      .map((ref) => resolveCandidateRef(ref, candidates))
      .filter((ref): ref is string => Boolean(ref));
    const referencedPolicies = evidenceRefs
      .map((id) => candidates.find((candidate) => candidate.policy.id === id)?.policy)
      .filter((policy): policy is V3Policy => Boolean(policy));
    const productScopeErrors = proposedLane === "answer" ? productScopeErrorsForNeed(text, referencedPolicies, turn) : [];
    const canAnswer = evidenceRefs.length > 0 &&
      referencedPolicies.length === evidenceRefs.length &&
      referencedPolicies.every((policy) => v4PolicyCanSupportNeed(policy, turn, text)) &&
      productScopeErrors.length === 0;
    const lane = matchedBlockedTopic
      ? "route"
      : proposedLane === "answer" && !canAnswer
        ? productScopeErrors.length && turn.productScope === "unknown" ? "clarify" : "route"
        : proposedLane;
    const routeKey = allowedRouteKeys.has(String(entry.route_key)) ? String(entry.route_key) : null;
    return [{
      text,
      lane,
      evidence_refs: [...new Set(evidenceRefs)],
      supported_claim: lane === "answer" ? displayText(entry.supported_claim, 1000) : "",
      reason: matchedBlockedTopic
        ? `The matching governance topic ${matchedBlockedTopic.topic.id} is explicitly unresolved.`
        : productScopeErrors.length
          ? productScopeErrors.join("; ")
        : clean(entry.reason, 600) || (lane === "route" ? "No controlling applicable answer evidence was selected." : "Applicable evidence was selected."),
      route_key: routeKey,
      clarification_question: lane === "clarify"
        ? displayText(entry.clarification_question, 400) || "Which product does this request apply to: main ISTV or Daymond John / Next Level CEO?"
        : "",
    } satisfies Omit<V4PlannedNeed, "id">];
  });
  const needs: V4PlannedNeed[] = parsedNeeds.map((need, index) => ({ ...need, id: `N${index + 1}` }));

  const safeNeeds = needs.length ? needs : [{
    id: "N1",
    text: turn.currentQuestion,
    lane: "route" as const,
    evidence_refs: [],
    supported_claim: "",
    reason: "The planner did not return a usable atomic need.",
    route_key: null,
    clarification_question: "",
  }];
  return {
    needs: safeNeeds,
    overall_lane: v4OverallPlanLane(safeNeeds),
    confidence_score: clampConfidence(raw.confidence_score),
    reasoning_summary: clean(raw.reasoning_summary || raw.reason, 700),
  };
}

function planningPrompt(turn: V3TurnResolution, candidates: V4Candidate[], blocked: Array<{ topic: { id: string; resolution?: string | null; question_families?: string[] } }>) {
  return {
    system: [
      "You are the evidence planner for an internal sales FAQ. Return JSON only.",
      "Decompose the user's request into atomic decision needs. For each need choose exactly one lane: answer, clarify, live_lookup, artifact, or route.",
      "Use answer only when one or more supplied cards directly entail the exact need under the same product, actor, timing, relationship, conditions, and requested action.",
      "route_or_support cards can support a route or resource instruction but can never authorize a substantive answer.",
      "Do not infer public watchability from membership in a show catalog. Do not turn 'one of three platforms' into 'all three'. Do not treat a listed installment choice as a custom payment-plan exception.",
      "Do not use model confidence as authority. Prefer current canonical or trusted evidence, but do not combine conflicting cards into a new rule.",
      "Account for every independently requested decision or action in current_question. Never replace the original compound request with a narrower need from resolved_question. Keep any uncovered or unresolved clause as its own non-answer need.",
      "If any supplied unresolved governance topic matches one requested clause, include that clause as a route need even when a different clause can be answered.",
      "When some needs are answerable and others are not, answer the supported needs and route only the unresolved needs.",
      "For answer lanes, supported_claim must be a concise, exact paraphrase of the selected decision text with no new numbers, guarantees, exceptions, or operational steps.",
      "Use only candidate refs C1..Cn. Return {needs:[{id,text,lane,evidence_refs,supported_claim,reason,route_key,clarification_question}],confidence_score,reasoning_summary}.",
    ].join("\n"),
    user: JSON.stringify({
      current_question: turn.currentQuestion,
      resolved_question: turn.standaloneQuestion,
      resolved_product_scope: turn.productScope,
      excluded_product_scopes: turn.excludedScopes,
      candidates: candidateCards(candidates),
      unresolved_governance_topics: blocked.map((item) => ({ id: item.topic.id, resolution: item.topic.resolution, question_families: item.topic.question_families })),
    }),
  };
}

type SafeFallbackFamily = Parameters<typeof resolveV4PriorityPolicyFamily>[1];

const SAFE_FALLBACK_POLICY_FAMILIES = {
  mainPrices: "main_prices",
  mainPayments: "main_payments",
  sameDayDiscount: "same_day_discount",
  djOffers: "dj_offers",
  tierOneBoundary: "tier_one_boundary",
  appDevices: "app_devices",
  showList: "show_list",
  watchabilityBoundary: "watchability",
  roiBoundary: "roi_boundary",
  languageBoundary: "language_boundary",
  seasonCapacity: "season_capacity",
  callOneFlow: "call_1_flow",
  postSaleHandoff: "post_sale_handoff",
  contractBeforeCallTwo: "contract_before_call_2",
  stopReinstatement: "stop_reinstatement",
} as const;
const safeFallbackFamilies = [...new Set<SafeFallbackFamily>(Object.values(SAFE_FALLBACK_POLICY_FAMILIES))];

function isDeterministicWhitelistPlan(plan: V4AnswerPlan, retrieval: V4RetrievalResult, turn: V3TurnResolution) {
  const answerNeeds = plan.needs.filter((need) => need.lane === "answer");
  const safePolicyIds = new Set(safeFallbackFamilies.flatMap((family) =>
    resolveV4PriorityPolicyFamily(retrieval.candidates.map((candidate) => candidate.policy), family)
      .filter((policy) => v4PolicyCanSupportNeed(policy, turn, turn.currentQuestion))
      .map((policy) => policy.id),
  ));
  return answerNeeds.length > 0 && answerNeeds.every((need) =>
    need.evidence_refs.length > 0 && need.evidence_refs.every((policyId) => safePolicyIds.has(policyId)),
  );
}

function fallbackPlanForLane(
  turn: V3TurnResolution,
  lane: Exclude<V4PlannedNeed["lane"], "answer">,
  reason: string,
  routeKey: string | null = null,
  clarificationQuestion = "",
): V4AnswerPlan {
  return {
    needs: [{
      id: "N1",
      text: turn.currentQuestion,
      lane,
      evidence_refs: [],
      supported_claim: "",
      reason,
      route_key: routeKey,
      clarification_question: lane === "clarify" ? clarificationQuestion : "",
    }],
    overall_lane: lane,
    confidence_score: lane === "clarify" ? 95 : 0,
    reasoning_summary: reason,
  };
}

function fallbackPolicies(retrieval: V4RetrievalResult, turn: V3TurnResolution, families: SafeFallbackFamily[]) {
  const policies = retrieval.candidates.map((candidate) => candidate.policy);
  const selections = families.map((family) =>
    resolveV4PriorityPolicyFamily(policies, family)
      .filter((policy) => v4PolicyCanSupportNeed(policy, turn, turn.currentQuestion))
      .flatMap((policy) => {
        const candidate = retrieval.candidates.find((item) => item.policy.id === policy.id);
        return candidate ? [candidate] : [];
      }),
  );
  if (selections.some((selection) => !selection.length)) return null;
  return [...new Map(selections.flat().map((candidate) => [candidate.policy.id, candidate])).values()];
}

function exactFallbackAnswerPlan(
  turn: V3TurnResolution,
  retrieval: V4RetrievalResult,
  families: SafeFallbackFamily[],
  reason: string,
  unresolved?: { lane: "route" | "live_lookup" | "artifact"; text: string; reason: string; routeKey?: string },
): V4AnswerPlan {
  const selected = fallbackPolicies(retrieval, turn, families);
  if (!selected) {
    return fallbackPlanForLane(turn, "route", "The safe fallback could not find every required controlling policy card.");
  }
  const answerNeed: V4PlannedNeed = {
    id: "N1",
    text: turn.currentQuestion,
    lane: "answer",
    evidence_refs: selected.map((candidate) => candidate.policy.id),
    supported_claim: selected.map((candidate) => evidenceDecision(candidate.policy)).join(" "),
    reason,
    route_key: null,
    clarification_question: "",
  };
  if (!unresolved) {
    return { needs: [answerNeed], overall_lane: "answer", confidence_score: 90, reasoning_summary: reason };
  }
  return {
    needs: [answerNeed, {
      id: "N2",
      text: unresolved.text,
      lane: unresolved.lane,
      evidence_refs: [],
      supported_claim: "",
      reason: unresolved.reason,
      route_key: unresolved.routeKey || null,
      clarification_question: "",
    }],
    overall_lane: "partial",
    confidence_score: 79,
    reasoning_summary: `${reason} The separable unresolved part remains bounded.`,
  };
}

function deterministicPlan(turn: V3TurnResolution, retrieval: V4RetrievalResult): V4AnswerPlan {
  const normalizedQuestion = turn.currentQuestion.toLowerCase().replace(/\s+/g, " ").trim();
  const blocked = retrieval.blocked.find((candidate) => v4BlockedTopicMatchesQuestion(candidate.topic, turn.currentQuestion));
  if (blocked) {
    return fallbackPlanForLane(
      turn,
      "route",
      `The matching governance topic ${blocked.topic.id} is explicitly unresolved.`,
    );
  }

  const asksTierOneBoundary = /\b(?:tier[ -]?1|apple tv|amazon(?: prime)?|tubi|streaming platforms?|streaming plaforms?|platform placement)\b/.test(normalizedQuestion) &&
    /\b(?:one|all|all (?:3|three)|which|what|how|list|choose|choice|guarantee|guaranteed|pay extra|force|placement|submit|submission|cover|include|appear)\b/.test(normalizedQuestion);
  if (asksTierOneBoundary && !/\b(?:film|filming|book|schedule|after purchase)\b/.test(normalizedQuestion)) {
    const paidAllThree = asksPaidAllThreePlatforms(turn.currentQuestion);
    const asksPlatformMechanics = /\bhow\b.{0,60}\b(?:appear|placed|placement|submitted|submission|find|search)\b|\bhow do episodes appear\b/.test(normalizedQuestion);
    const asksClientMessageDraft = asksClientMessageReview(turn.currentQuestion);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.tierOneBoundary],
      "The owner-reviewed one-platform and no-guarantee boundary directly applies.",
      paidAllThree
        ? {
          lane: "route",
          text: "Whether a client may pay extra for submission to all three Tier-1 platforms",
          reason: "The current boundary does not expressly approve or prohibit a paid all-three option.",
          routeKey: "sales_policy",
        }
        : asksPlatformMechanics
          ? {
            lane: "route",
            text: "The platform-specific appearance or discovery mechanics",
            reason: "The current boundary names eligible platforms but does not establish how an episode appears or is found there.",
            routeKey: "sales_policy",
          }
          : asksClientMessageDraft
            ? {
              lane: "route",
              text: "The requested client-message fact check and rewrite",
              reason: "One platform boundary cannot validate every factual claim or complete the requested client-facing draft.",
              routeKey: "sales_policy",
            }
          : undefined,
    );
  }

  const asksContractBeforeCallTwo = /\b(?:send|share|provide)\b.{0,80}\b(?:contract|agreement)\b.{0,80}\b(?:before call 2|legal|review)\b|\b(?:contract|agreement)\b.{0,80}\b(?:legal|review)\b.{0,80}\bbefore call 2\b/.test(normalizedQuestion);
  if (asksContractBeforeCallTwo) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.contractBeforeCallTwo],
      "The canonical contract-before-Call-2 boundary directly answers this request.",
    );
  }

  if (asksStopReinstatement(turn.currentQuestion)) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.stopReinstatement],
      "The current STOP-reinstatement support instruction directly applies.",
      {
        lane: "route",
        text: "Whether sales tech has cleared the prospect for renewed outreach and booking",
        reason: "A prior STOP response requires the current sales-tech resubscription check before proceeding.",
        routeKey: "sales_tech",
      },
    );
  }

  const asksAppDownload = /\b(?:download|install)\b.{0,40}\b(?:istv|isn)(?:\s+app)?\b|\bget\b.{0,40}\b(?:istv|isn)?\s*app\b|\b(?:roku|fire stick|apple tv)\b.{0,40}\bapp\b/.test(normalizedQuestion);
  const asksControlledArtifact = /\b(?:pdf|deck|slide deck|presentation|document|script|template|media kit|resource|contract link|payment link|training video|recording link)\b/.test(normalizedQuestion) && !asksAppDownload;
  if (asksControlledArtifact) {
    return fallbackPlanForLane(turn, "artifact", "The no-model fallback does not return or authorize controlled files.");
  }

  const asksViewerStatistic = /\b(?:average|exact|how many|number of)\b.{0,35}\b(?:views?|viewers?|viewership|audience|demographics?|awards?)\b/.test(normalizedQuestion);
  if (asksViewerStatistic) {
    return fallbackPlanForLane(turn, "route", "Viewer, audience, and award statistics require a current governed source.");
  }

  const asksSameDayDiscount = /\b(?:same day|same-day)\b.{0,40}\bdiscount\b|\bdiscount\b.{0,40}\b(?:same day|same-day)\b/.test(normalizedQuestion);
  if (asksSameDayDiscount) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.sameDayDiscount],
      "An exact canonical same-day-discount boundary is available.",
    );
  }

  const asksPricing = /\b(?:prices?|pricing|costs?|packages?|offers?|payment plans?|payment options?|installments?|instalments?)\b/.test(normalizedQuestion);
  if (asksPricing && turn.productScope === "unknown") {
    return fallbackPlanForLane(
      turn,
      "clarify",
      "Pricing differs by product and the question does not establish the product.",
      null,
      "Do you mean main ISTV or Daymond John / Next Level CEO?",
    );
  }
  if (asksPricing && turn.productScope === "dj_nlceo") {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.djOffers],
      "The current owner-approved DJ/NLCEO offer table directly answers this request.",
    );
  }
  if (asksPricing && turn.productScope === "main_istv") {
    const asksPaymentPlan = /\b(?:payment plans?|payment options?|installments?|instalments?|split)\b/.test(normalizedQuestion);
    const asksPriceOrPackage = /\b(?:prices?|pricing|costs?|packages?|offers?)\b/.test(normalizedQuestion);
    const families = [
      ...(asksPriceOrPackage ? [SAFE_FALLBACK_POLICY_FAMILIES.mainPrices] : []),
      ...(asksPaymentPlan ? [SAFE_FALLBACK_POLICY_FAMILIES.mainPayments] : []),
    ];
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      families.length ? families : [SAFE_FALLBACK_POLICY_FAMILIES.mainPrices, SAFE_FALLBACK_POLICY_FAMILIES.mainPayments],
      "The canonical main ISTV price and listed-plan cards directly answer this request.",
    );
  }

  if (asksAppDownload) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.appDevices],
      "The owner-reviewed device list directly answers this app-download question.",
    );
  }

  const asksEpisodeAiringTimeline = /\b(?:how long|timeline|turnaround|time frame|timeframe)\b.{0,100}\b(?:episode|air|aired|airing)\b|\bhow long does it take\b.{0,100}\b(?:air|aired|airing)\b/.test(normalizedQuestion);
  if (asksEpisodeAiringTimeline) {
    return fallbackPlanForLane(
      turn,
      "route",
      "The current catalog-versus-watchability boundary does not establish an episode production or airing timeline.",
      "sales_policy",
    );
  }

  const asksWatchability = /\b(?:watch|watchable|stream|streaming|on air|aired|airing|episode availability|episode link|available to view)\b/.test(normalizedQuestion);
  if (asksWatchability) {
    const onlyAsksConceptualBoundary = asksConceptualWatchabilityBoundary(turn.currentQuestion);
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.watchabilityBoundary],
      "The owner-reviewed catalog-versus-watchability boundary directly applies.",
      onlyAsksConceptualBoundary ? undefined : {
        lane: "live_lookup",
        text: "The exact show's current public episode availability",
        reason: "Catalog membership cannot establish current public watchability.",
        routeKey: "sales_policy",
      },
    );
  }

  const asksShowList = /\b(?:current|active|approved|available|latest)\b.{0,35}\bshow(?:s| list)?\b|\bwhat shows\b|\blist (?:of|the) shows\b|\bshows (?:we are|we re) currently casting\b/.test(normalizedQuestion);
  if (asksShowList) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.showList],
      "The current canonical approved-show list directly answers this request.",
      asksShowListLocation(turn.currentQuestion)
        ? {
          lane: "route",
          text: "Where the maintained active-show source is located",
          reason: "The approved catalog provides the current list but not a rep-facing maintained link or location.",
          routeKey: "sales_policy",
        }
        : undefined,
    );
  }

  const asksRoiBoundary = /\b(?:roi|return on investment|revenue guarantee|guaranteed leads?|fundrais|business outcome)\b/.test(normalizedQuestion);
  if (asksRoiBoundary) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.roiBoundary],
      "A direct approved prohibition covers ROI claims.",
    );
  }

  const asksLanguageBoundary = /\b(?:spanish|non[- ]english|another language|translation|translate|translated|bilingual)\b/.test(normalizedQuestion);
  if (asksLanguageBoundary) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.languageBoundary],
      "The approved production-language boundary directly applies.",
    );
  }

  const asksSeasonCapacity = /\b(?:how many|multiple)\b.{0,35}\b(?:seasons?|episodes?(?: per season| for (?:a|the) show)?)\b|\bseason capacity\b/.test(normalizedQuestion);
  if (asksSeasonCapacity) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.seasonCapacity],
      "A direct governed season-capacity statement answers this narrow question.",
      asksExactSeasonCount(turn.currentQuestion)
        ? {
          lane: "route",
          text: "The exact number of seasons",
          reason: "Current evidence confirms multiple seasons but not a fixed total season count.",
          routeKey: "sales_policy",
        }
        : undefined,
    );
  }

  const asksCallOneFlow = /\b(?:approved guidance (?:for|on)|guidance (?:for|on))\s+call\s*1 flow\b|\bcall\s*1 flow\b/.test(normalizedQuestion);
  if (asksCallOneFlow) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.callOneFlow],
      "The canonical Call 1 answer and escalation rules directly answer this named-guidance request.",
    );
  }

  const asksPostSaleHandoff = /\b(?:approved guidance (?:for|on)|guidance (?:for|on))\s+post[- ]sale handoff after close\b|\bpost[- ]sale handoff after close\b/.test(normalizedQuestion);
  if (asksPostSaleHandoff) {
    return exactFallbackAnswerPlan(
      turn,
      retrieval,
      [SAFE_FALLBACK_POLICY_FAMILIES.postSaleHandoff],
      "The canonical post-sale handoff answer cards directly answer this named-guidance request.",
    );
  }

  const asksLiveLookup = /\b(?:currently|right now|today|latest status|available now|exact status)\b/.test(normalizedQuestion);
  return fallbackPlanForLane(
    turn,
    asksLiveLookup ? "live_lookup" : "route",
    "The no-model fallback is intentionally limited to explicit high-confidence governed question families.",
  );
}

function parseComposition(content: string, plan: V4AnswerPlan, candidates: V4Candidate[]): V4Composition {
  const raw = parseV3Json<Record<string, unknown>>(content);
  const needIds = new Set(plan.needs.map((need) => need.id));
  const plannedRefs = new Set(plan.needs.flatMap((need) => need.evidence_refs));
  const sentences = Array.isArray(raw.sentences) ? raw.sentences.slice(0, 16).flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const text = displayText(entry.text || entry.sentence, 900);
    if (!text) return [];
    const refs = stringArray(entry.evidence_refs, 8)
      .map((ref) => resolveCandidateRef(ref, candidates))
      .filter((ref): ref is string => ref !== null)
      .filter((ref) => plannedRefs.has(ref));
    const attachedNeeds = [...new Set(stringArray(entry.need_ids, 8).filter((id) => {
      if (!needIds.has(id)) return false;
      const need = plan.needs.find((candidate) => candidate.id === id);
      return Boolean(need && need.lane === "answer");
    }))];
    const kind = ["answer", "boundary", "clarification"].includes(String(entry.kind))
      ? String(entry.kind) as V4ComposedSentence["kind"]
      : "answer";
    return [{ id: `S${index + 1}`, text, need_ids: attachedNeeds, evidence_refs: [...new Set(refs)], kind }];
  }) : [];
  return { summary: displayText(raw.summary, 1000), sentences };
}

function compositionPrompt(plan: V4AnswerPlan, candidates: V4Candidate[], turn: V3TurnResolution) {
  const selectedIds = new Set(plan.needs.flatMap((need) => need.evidence_refs));
  const evidence = candidateCards(candidates).filter((_, index) => selectedIds.has(candidates[index].policy.id));
  return {
    system: [
      "Write a concise internal sales answer from the approved atomic plan and exact evidence. Return JSON only.",
      "Return each factual sentence separately as {id,text,need_ids,evidence_refs,kind}. Use only plan need IDs and supplied C refs.",
      "Every factual sentence must be fully entailed by its cited evidence. Preserve amounts and units exactly, although equivalent formatting such as $20k and $20,000 is allowed.",
      "Do not add a route channel, caveat, exception, guarantee, deadline, step, platform, or actor unless the cited evidence says it.",
      "Do not mention evidence, policy IDs, RAG, source files, approval mechanics, or governance to the sales rep.",
      "Compose only answer-lane needs. The runtime will add clarification and route language for other needs.",
      "Return {summary,sentences:[...]}.",
    ].join("\n"),
    user: JSON.stringify({ question: turn.currentQuestion, plan, evidence }),
  };
}

function exactEvidenceFallback(plan: V4AnswerPlan, candidates: V4Candidate[]): V4Composition {
  const sentences = plan.needs.flatMap((need, needIndex) => {
    if (need.lane !== "answer") return [];
    return need.evidence_refs.flatMap((policyId, evidenceIndex) => {
      const policy = candidates.find((candidate) => candidate.policy.id === policyId)?.policy;
      if (!policy) return [];
      return [{ id: `F${needIndex + 1}_${evidenceIndex + 1}`, text: evidenceDecision(policy), need_ids: [need.id], evidence_refs: [policy.id], kind: "answer" as const }];
    });
  });
  return { summary: sentences.map((sentence) => sentence.text).join(" "), sentences };
}

function validatorPrompt(composition: V4Composition, plan: V4AnswerPlan, candidates: V4Candidate[]) {
  const evidenceForRefs = (refs: string[]) => {
    const selectedIds = new Set(refs);
    return candidates.filter((candidate) => selectedIds.has(candidate.policy.id)).map((candidate) => ({
      id: candidate.policy.id,
      title: candidate.policy.title,
      decision: evidenceDecision(candidate.policy),
      product_scopes: candidate.policy.product_scopes,
    }));
  };
  const sentenceAudits = composition.sentences.map((sentence) => ({
    sentence_id: sentence.id,
    text: sentence.text,
    need_ids: sentence.need_ids,
    evidence: evidenceForRefs(sentence.evidence_refs),
  }));
  const needAudits = plan.needs.filter((need) => need.lane === "answer").map((need) => ({
    need_id: need.id,
    text: need.text,
    supported_claim: need.supported_claim,
    sentences: composition.sentences.filter((sentence) => sentence.need_ids.includes(need.id)).map((sentence) => {
      const needSentenceRefs = sentence.evidence_refs.filter((ref) => need.evidence_refs.includes(ref));
      return {
        sentence_id: sentence.id,
        text: sentence.text,
        evidence: evidenceForRefs(needSentenceRefs),
      };
    }),
  }));
  return {
    system: [
      "Audit each proposed sentence against only its cited evidence. Return JSON only.",
      "Treat every sentence_audit and need_audit as an isolated packet. Never use evidence from another sentence or need to support the packet being checked.",
      "Mark supported only when the whole sentence is entailed under the same product, actor, timing, relationship, conditions, quantity, and requested action.",
      "Formatting-equivalent numbers are equal: $20k equals $20,000 and $2.5k equals $2,500.",
      "A sentence with any unsupported clause is unsupported. Do not rewrite it and do not approve it because it sounds plausible.",
      "For each supported sentence, evidence_refs must contain at least one evidence ID from that sentence_audit and no ID outside that packet.",
      "Sentence-check status must be exactly supported, unsupported, or irrelevant. Need-check status must be exactly answered, partial, or unresolved.",
      "Return exactly one sentence_check for every supplied sentence_id and exactly one need_check for every supplied need_id. Do not omit, duplicate, rename, or add IDs.",
      "Return {sentence_checks:[{sentence_id,status,evidence_refs,reason}],need_checks:[{need_id,status,reason}],reason}.",
    ].join("\n"),
    user: JSON.stringify({
      sentence_audits: sentenceAudits,
      need_audits: needAudits,
    }),
  };
}

function parseValidator(content: string, expectedSentenceIds: string[], expectedNeedIds: string[]) {
  const raw = parseV3Json<Record<string, unknown>>(content);
  if (!Array.isArray(raw.sentence_checks)) throw new Error("V4 validator omitted sentence checks");
  if (!Array.isArray(raw.need_checks)) throw new Error("V4 validator omitted need checks");
  const checks = raw.sentence_checks.slice(0, 20).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const sentenceId = clean(entry.sentence_id, 40);
    if (!sentenceId) return [];
    if (!["supported", "unsupported", "irrelevant"].includes(String(entry.status))) {
      throw new Error("V4 validator returned an invalid sentence-check status");
    }
    const status = String(entry.status) as "supported" | "unsupported" | "irrelevant";
    return [{ sentenceId, status, evidenceRefs: stringArray(entry.evidence_refs, 8), reason: clean(entry.reason, 500) }];
  });
  const needChecks = raw.need_checks.slice(0, 12).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Record<string, unknown>;
    const needId = clean(entry.need_id, 40);
    if (!needId) return [];
    if (!["answered", "partial", "unresolved"].includes(String(entry.status))) {
      throw new Error("V4 validator returned an invalid need-check status");
    }
    const status = String(entry.status) as "answered" | "partial" | "unresolved";
    return [{ needId, status, reason: clean(entry.reason, 500) }];
  });
  const exactIds = (actual: string[], expected: string[], label: string) => {
    const actualSet = new Set(actual);
    const expectedSet = new Set(expected);
    if (
      actual.length !== actualSet.size ||
      actual.length !== expected.length ||
      actual.some((id) => !expectedSet.has(id)) ||
      expected.some((id) => !actualSet.has(id))
    ) {
      throw new Error(`V4 validator must return exactly one ${label} for every supplied ID`);
    }
  };
  exactIds(checks.map((check) => check.sentenceId), expectedSentenceIds, "sentence check");
  exactIds(needChecks.map((check) => check.needId), expectedNeedIds, "need check");
  return { checks, needChecks, reason: clean(raw.reason, 700) };
}

function policiesForSentence(sentence: V4ComposedSentence, candidates: V4Candidate[]) {
  return sentence.evidence_refs
    .map((id) => candidates.find((candidate) => candidate.policy.id === id)?.policy)
    .filter((policy): policy is V3Policy => Boolean(policy));
}

async function validateComposition(input: {
  composition: V4Composition;
  plan: V4AnswerPlan;
  candidates: V4Candidate[];
  turn: V3TurnResolution;
  provider: V3Provider;
  attempts: V3ProviderAttempt[];
  allowModelValidationBypass: boolean;
}) {
  let modelChecks = new Map<string, { status: "supported" | "unsupported" | "irrelevant"; evidenceRefs: string[]; reason: string }>();
  let modelNeedChecks = new Map<string, { status: "answered" | "partial" | "unresolved"; reason: string }>();
  let modelReason = input.allowModelValidationBypass ? "Runtime-generated exact evidence from a deterministic whitelist plan." : "";
  if (!input.allowModelValidationBypass && input.composition.sentences.length) {
    try {
      const prompt = validatorPrompt(input.composition, input.plan, input.candidates);
      const expectedSentenceIds = input.composition.sentences.map((sentence) => sentence.id);
      const expectedNeedIds = input.plan.needs.filter((need) => need.lane === "answer").map((need) => need.id);
      const result = await input.provider({
        purpose: "v4_claim_validation",
        system: prompt.system,
        user: prompt.user,
        maxTokens: 1800,
        parse: (content) => parseValidator(content, expectedSentenceIds, expectedNeedIds),
      });
      input.attempts.push(...result.attempts);
      modelChecks = new Map(result.output.checks.map((check) => [check.sentenceId, check]));
      modelNeedChecks = new Map(result.output.needChecks.map((check) => [check.needId, check]));
      modelReason = result.output.reason;
    } catch (error) {
      input.attempts.push(...providerAttemptsFromV4Error(error));
      modelReason = `Claim validator unavailable: ${clean(error, 400)}`;
    }
  }

  const sentenceChecks: V4SentenceCheck[] = input.composition.sentences.map((sentence) => {
    const policies = policiesForSentence(sentence, input.candidates);
    const evidence = evidenceText(policies);
    const attachedNeeds = sentence.need_ids
      .map((id) => input.plan.needs.find((need) => need.id === id))
      .filter((need): need is V4PlannedNeed => Boolean(need && need.lane === "answer"));
    const deterministicErrors = [
      ...(sentence.evidence_refs.length ? [] : ["sentence has no evidence reference"]),
      ...(attachedNeeds.length ? [] : ["sentence is not attached to an answer need"]),
      ...(policies.length === sentence.evidence_refs.length ? [] : ["sentence references evidence outside the selected candidate set"]),
      ...attachedNeeds.flatMap((need) =>
        sentence.evidence_refs.every((ref) => need.evidence_refs.includes(ref))
          ? []
          : [`sentence cites evidence outside need ${need.id}`],
      ),
      ...policies.flatMap((policy) => v4PolicySupportErrors(policy, input.turn, attachedNeeds.map((need) => need.text).join(" "))),
      ...deterministicV4SentenceErrors(sentence.text, evidence),
    ];
    const model = modelChecks.get(sentence.id);
    const resolvedValidatorRefs = model?.evidenceRefs.map((ref) => resolveCandidateRef(ref, input.candidates)) || [];
    const validatorRefsValid = Boolean(
      model &&
      model.evidenceRefs.length > 0 &&
      resolvedValidatorRefs.every((ref) => ref !== null && sentence.evidence_refs.includes(ref)),
    );
    if (model && !model.evidenceRefs.length) deterministicErrors.push("validator supplied no evidence reference");
    if (model && model.evidenceRefs.length && !validatorRefsValid) deterministicErrors.push("validator cited evidence outside the sentence");
    const modelRejected = model && model.status !== "supported";
    const validatorMissing = !input.allowModelValidationBypass && !model;
    const status = deterministicErrors.length || modelRejected || validatorMissing ? (model?.status === "irrelevant" ? "irrelevant" : "unsupported") : "supported";
    return {
      sentenceId: sentence.id,
      status,
      evidenceRefs: sentence.evidence_refs,
      reason: deterministicErrors.join("; ") || model?.reason || (input.allowModelValidationBypass ? "Exact governed decision passed deterministic checks." : "Sentence passed claim validation."),
      deterministicErrors,
    };
  });
  const supportedSentenceIds = new Set(sentenceChecks.filter((check) => check.status === "supported").map((check) => check.sentenceId));
  const answeredNeedIds = new Set(input.plan.needs.flatMap((need) => {
    if (need.lane !== "answer") return [];
    const hasGroundedSentence = input.composition.sentences.some((sentence) =>
      supportedSentenceIds.has(sentence.id) &&
      sentence.need_ids.includes(need.id) &&
      sentence.evidence_refs.length > 0 &&
      sentence.evidence_refs.every((ref) => need.evidence_refs.includes(ref)),
    );
    const modelAnswered = input.allowModelValidationBypass || modelNeedChecks.get(need.id)?.status === "answered";
    return hasGroundedSentence && modelAnswered ? [need.id] : [];
  }));
  const unresolvedNeedIds = input.plan.needs.filter((need) => need.lane !== "answer" || !answeredNeedIds.has(need.id)).map((need) => need.id);
  const removedSentences = input.composition.sentences.filter((sentence) => !supportedSentenceIds.has(sentence.id)).map((sentence) => sentence.text);
  const supportedCount = supportedSentenceIds.size;
  const verdict: V4Validation["verdict"] = supportedCount && !unresolvedNeedIds.length && !removedSentences.length
    ? "pass"
    : supportedCount && removedSentences.length
      ? "partial_recovery"
      : supportedCount
        ? "repair"
        : "route";
  return {
    validation: { verdict, sentenceChecks, removedSentences, unresolvedNeedIds, reason: modelReason || "Claim-level checks completed." } satisfies V4Validation,
    supportedSentenceIds,
  };
}

function routeKeyFor(question: string, policies: V3Policy[], plannedNeeds: V4PlannedNeed[]) {
  const explicit = [...new Set(plannedNeeds.map((need) => need.route_key).filter((key): key is string => key !== null).filter((key) => allowedRouteKeys.has(key)))];
  if (explicit.length === 1) return explicit[0];
  const policyKeys = [...new Set(policies.map((policy) => policy.route_key).filter((key): key is string => key !== null).filter((key) => allowedRouteKeys.has(key)))];
  if (policyKeys.length === 1) return policyKeys[0];
  const normalized = question.toLowerCase();
  if (/\b(?:login|log in|access|keap|zoom phone|calendar|recording|hubspot|form|dropdown|tool|broken link|checkout page|sms|text message|subscriber|resubscribe|re subscribe|opt in|opt out|stop keyword)\b/.test(normalized)) return "sales_tech";
  if (/\b(?:greenlight letter|green light letter|approval letter|greenlight pdf|greenlight status|greenlight cap)\b/.test(normalized)) return "greenlight";
  if (/\b(?:payment|pay|ach|wire|invoice|receipt|refund|charge|installment|billing|bank)\b|\b(?:payment|credit|debit) card\b|\bcard (?:charge|payment|update|decline)\b/.test(normalized)) return "finance";
  return "sales_policy";
}

function finalLane(plan: V4AnswerPlan, validation: V4Validation, supportedCount: number): V4Lane {
  if (supportedCount && validation.unresolvedNeedIds.length) return "partial";
  if (supportedCount) return "answer";
  if (plan.needs.some((need) => need.lane === "clarify")) return "clarify";
  if (plan.needs.some((need) => need.lane === "live_lookup")) return "live_lookup";
  if (plan.needs.some((need) => need.lane === "artifact")) return "artifact";
  return "route";
}

function safeRouteAnswer(channel: string) {
  return `I can’t confirm that exact case safely yet. Please check ${channel} before replying to the prospect.`;
}

function structuredAnswer(answer: string, lane: V4Lane, confidence: number, routeChannels: string[]): AskSalesFaqStructuredAnswer {
  const confidenceScore = clampConfidence(confidence);
  const sections = lane === "partial" && routeChannels.length
    ? [{ title: "Needs confirmation", items: [`Verify only the unresolved part${routeChannels.length > 1 ? "s" : ""} in ${routeChannels.join(" or ")}.`], tone: "route" as const }]
    : [];
  return {
    summary: answer,
    sections,
    confidenceLabel: confidenceScore >= 80 ? "High" : confidenceScore >= 50 ? "Medium" : "Low",
    confidenceScore,
    sourceMode: lane === "conversation" ? "conversation" : lane === "answer" || lane === "partial" ? "evidence" : "fallback",
  };
}

function deterministicRewrite(question: string, previousAnswer: string) {
  const previous = displayText(previousAnswer, 5000);
  const wantsBullets = /\b(?:bullet|bullets|bullet points|checklist|format(?:ted)? (?:as|into) (?:a )?list)\b/i.test(question);
  const wantsNoRoute = /\b(?:without repeating (?:the )?route|do not repeat (?:the )?route|don't repeat (?:the )?route|remove (?:the )?route(?: note)?|only what is confirmed|keep only (?:the )?confirmed)\b/i.test(question);
  const wantsShorter = /\b(?:shorten|shorter|summari[sz]e|brief|briefly|concise|concisely|keep (?:that|it|the answer) short)\b/i.test(question);
  const wantsSimpler = /\b(?:simpler|simple language|plain english|more naturally|more clearly)\b/i.test(question);
  let items = (previous.match(/[^.!?]+(?:[.!?]+|$)/g) || [])
    .map((item) => displayText(item.replace(/^\s*[-*•]\s*/, ""), 1000))
    .filter(Boolean)
    .slice(0, 16);
  if (!items.length) return previous;

  const routeOnly = (item: string) => /#[a-z0-9_-]+/i.test(item) && (
    /^For\b.{0,500}\b(?:check|get|use)\b/i.test(item) ||
    /^Please\s+(?:check|verify|use)\b/i.test(item) ||
    /^Verify only\b/i.test(item) ||
    /\b(?:current live lookup is required|before replying)\b/i.test(item)
  );
  if (wantsNoRoute) {
    const factualItems = items.filter((item) => !routeOnly(item));
    if (factualItems.length) items = factualItems;
  }

  if (wantsShorter || wantsSimpler) {
    const seen = new Set<string>();
    items = items.filter((item) => {
      const key = item.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    }).map((item) => {
      if (!routeOnly(item)) return item;
      const check = item.match(/^For\s+(.+?),\s+(?:a current live lookup is required;\s*)?please check\s+(#[a-z0-9_-]+)(?:\s+for the latest status|\s+before replying)?[.!]?$/i);
      if (check) return `${check[1].charAt(0).toUpperCase()}${check[1].slice(1)}: check ${check[2]}.`;
      const resource = item.match(/^For\s+(.+?),\s+get the current controlled resource or file from\s+(#[a-z0-9_-]+)[.!]?$/i);
      if (resource) return `${resource[1].charAt(0).toUpperCase()}${resource[1].slice(1)}: get the current file from ${resource[2]}.`;
      return item;
    });
  }

  if (wantsBullets) return items.length > 1 ? items.map((item) => `• ${item}`).join(" ") : previous;
  return items.join(" ") || previous;
}

function deterministicConversation(turn: V3TurnResolution) {
  if (turn.kind === "memory") return turn.memoryAnswer || "This is the first question I can see in this isolated chat.";
  if (turn.kind === "rewrite" && turn.immediatePreviousAssistantAnswer) return deterministicRewrite(turn.currentQuestion, turn.immediatePreviousAssistantAnswer);
  if (turn.kind === "clarification") return "Please tell me which product or show this applies to and the exact decision you need to make.";
  return "Hi! I’m ready—ask me a sales-policy, qualification, offer, payment, content-rights, or process question.";
}

export async function runAskSalesFaqV4(
  question: string,
  conversationMessages: AskSalesFaqChatMessage[] = [],
  options: V4RuntimeOptions = {},
): Promise<AskSalesFaqV4Result> {
  const startedAt = Date.now();
  const stageTimings: Record<string, number> = {};
  const attempts: V3ProviderAttempt[] = [];
  const provider = options.provider || generateV4Json;
  const validatorProvider = options.validatorProvider || options.provider || generateV4ValidationJson;
  const redacted = redactSensitiveText(question);
  const messages = conversationMessages.map((message) => ({ role: message.role, content: redactSensitiveText(message.content).text }));
  const turnStarted = Date.now();
  let turn = resolveV3Turn(redacted.text, messages);
  if (
    turn.productScope === "unknown" &&
    /\bISTV\b/i.test(turn.currentQuestion) &&
    !/\b(?:not|excluding|except)\s+(?:main\s+)?ISTV\b/i.test(turn.currentQuestion) &&
    !/\b(?:Daymond John|Next Level CEO|NLCEO|DJ\/NLCEO)\b/i.test(turn.currentQuestion)
  ) {
    turn = {
      ...turn,
      productScope: "main_istv",
      intentResolutionReason: `${turn.intentResolutionReason || "Deterministic turn resolution."} V4 resolved explicit ISTV wording to the main ISTV product scope.`,
    };
  }
  stageTimings.turnResolutionMs = Date.now() - turnStarted;

  if (["social", "topic_intro", "memory", "rewrite", "clarification"].includes(turn.kind)) {
    const answer = deterministicConversation(turn);
    const validation: V4Validation = { verdict: "pass", sentenceChecks: [], removedSentences: [], unresolvedNeedIds: [], reason: "No policy answer was required." };
    const plan: V4AnswerPlan = { needs: [], overall_lane: "conversation", confidence_score: 100, reasoning_summary: "Conversation-only turn." };
    stageTimings.totalMs = Date.now() - startedAt;
    return {
      ok: true,
      answer,
      structuredAnswer: structuredAnswer(answer, "conversation", 100, []),
      lane: "conversation",
      needsRoute: false,
      routeReason: null,
      routeChannels: [],
      provider: null,
      model: null,
      latencyMs: stageTimings.totalMs,
      citations: [],
      selectedPolicyIds: [],
      redactions: redacted.redactions,
      runtimeMetadata: {
        pipelineVersion: "v4-isolated",
        isolation: { productionSelectorChanged: false, databaseWrites: false, historyPersistence: false },
        knowledgeVersion: getV4KnowledgeVersion(),
        turn,
        retrieval: { corpusSize: 0, candidateCount: 0, candidates: [], blockedTopicIds: [] },
        plan,
        executionMode: { planning: "conversation", composition: "not_required", validation: "not_required" },
        validation,
        providerAttempts: [],
        stageTimings,
      },
    };
  }

  const retrieval = retrieveV4Policies(turn);
  Object.assign(stageTimings, retrieval.stageTimings);
  let providerName: "deepseek" | "anthropic" | null = null;
  let model: string | null = null;
  let plan: V4AnswerPlan;
  let planningMode: "model" | "deterministic_fallback" = "model";
  const planStarted = Date.now();
  try {
    const prompt = planningPrompt(turn, retrieval.candidates, retrieval.blocked);
    const result = await provider({ purpose: "v4_atomic_plan", system: prompt.system, user: prompt.user, maxTokens: 2400, parse: (content) => parsePlan(content, retrieval.candidates, retrieval.blocked, turn) });
    plan = result.output;
    attempts.push(...result.attempts);
    providerName = result.provider;
    model = result.model;
  } catch (error) {
    attempts.push(...providerAttemptsFromV4Error(error));
    plan = deterministicPlan(turn, retrieval);
    planningMode = "deterministic_fallback";
    plan.reasoning_summary = `${plan.reasoning_summary} Model planner unavailable: ${clean(error, 180)}`;
  }
  plan = enforceV4QuestionCompleteness(plan, turn, retrieval, planningMode);
  stageTimings.planningMs = Date.now() - planStarted;
  const deterministicWhitelistPlan = planningMode === "deterministic_fallback" && isDeterministicWhitelistPlan(plan, retrieval, turn);

  let composition: V4Composition = { summary: "", sentences: [] };
  let compositionMode: "model" | "exact_evidence" | "not_required" = "not_required";
  if (plan.needs.some((need) => need.lane === "answer")) {
    const compositionStarted = Date.now();
    try {
      const prompt = compositionPrompt(plan, retrieval.candidates, turn);
      const result = await provider({ purpose: "v4_claim_composition", system: prompt.system, user: prompt.user, maxTokens: 1800, parse: (content) => parseComposition(content, plan, retrieval.candidates) });
      composition = result.output.sentences.length ? result.output : exactEvidenceFallback(plan, retrieval.candidates);
      compositionMode = result.output.sentences.length ? "model" : "exact_evidence";
      attempts.push(...result.attempts);
      providerName = result.provider;
      model = result.model;
    } catch (error) {
      attempts.push(...providerAttemptsFromV4Error(error));
      composition = exactEvidenceFallback(plan, retrieval.candidates);
      compositionMode = "exact_evidence";
    }
    stageTimings.compositionMs = Date.now() - compositionStarted;
  }

  const validationStarted = Date.now();
  const { validation, supportedSentenceIds } = await validateComposition({
    composition,
    plan,
    candidates: retrieval.candidates,
    turn,
    provider: validatorProvider,
    attempts,
    allowModelValidationBypass: deterministicWhitelistPlan && compositionMode === "exact_evidence",
  });
  stageTimings.validationMs = Date.now() - validationStarted;
  const supportedSentences = composition.sentences.filter((sentence) => supportedSentenceIds.has(sentence.id));
  const selectedPolicyIds = [...new Set(supportedSentences.flatMap((sentence) => sentence.evidence_refs))];
  const selectedPolicies = selectedPolicyIds
    .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy)
    .filter((policy): policy is V3Policy => Boolean(policy));
  const lane = finalLane(plan, validation, supportedSentences.length);
  const unresolvedNeeds = plan.needs.filter((need) => validation.unresolvedNeedIds.includes(need.id));
  const routeRequiredNeeds = unresolvedNeeds.filter((need) => need.lane !== "clarify");
  const routeAssignments = routeRequiredNeeds.map((need) => {
    const needPolicies = need.evidence_refs
      .map((id) => retrieval.candidates.find((candidate) => candidate.policy.id === id)?.policy)
      .filter((policy): policy is V3Policy => Boolean(policy));
    const routeKey = routeKeyFor(`${need.text} ${need.reason}`, needPolicies, [need]);
    return { need, route: routeCatalog[routeKey] || routeCatalog.sales_policy };
  });
  const fallbackRouteKey = routeKeyFor(turn.currentQuestion, selectedPolicies, []);
  const fallbackRoute = routeCatalog[fallbackRouteKey] || routeCatalog.sales_policy;
  const needsRoute = lane === "route" || lane === "live_lookup" || lane === "artifact" || routeRequiredNeeds.length > 0;
  const routeChannels = needsRoute
    ? [...new Set((routeAssignments.length ? routeAssignments.map((assignment) => assignment.route.channel) : [fallbackRoute.channel]))]
    : [];
  const supportedSentenceLimit = compositionMode === "exact_evidence" ? 4000 : 900;
  const supportedText = supportedSentences
    .map((sentence) => displayText(sentence.text, supportedSentenceLimit))
    .filter(Boolean)
    .map((sentence) => /[.!?](?:["'”’])?$/.test(sentence) ? sentence : `${sentence}.`)
    .join(" ");
  const unresolvedInstructions = unresolvedNeeds.map((need) => {
    if (need.lane === "clarify") return need.clarification_question || `Please clarify: ${need.text}`;
    const route = routeAssignments.find((assignment) => assignment.need.id === need.id)?.route || fallbackRoute;
    const subject = displayText(need.text, 240) || "that unresolved part";
    const sentenceSubject = /^[A-Z][a-z]/.test(subject) ? `${subject.charAt(0).toLowerCase()}${subject.slice(1)}` : subject;
    if (need.lane === "live_lookup") return `A current live lookup is required for ${sentenceSubject}; please check ${route.channel} for the latest status.`;
    if (need.lane === "artifact") return `Get the current controlled resource or file for ${sentenceSubject} from ${route.channel}.`;
    if (/^(?:Confirm|Verify|Check|Fix|Get)\b/.test(subject)) return `${subject}. Check ${route.channel} before replying.`;
    return `Please check ${route.channel} to confirm ${sentenceSubject} before replying.`;
  });
  const unresolvedAnswer = unresolvedInstructions.length ? unresolvedInstructions.join(" ") : safeRouteAnswer(fallbackRoute.channel);
  const answer = lane === "answer"
    ? supportedText
    : lane === "partial"
      ? [supportedText, unresolvedAnswer].filter(Boolean).join(" ")
      : unresolvedAnswer;
  const confidence = lane === "answer" ? plan.confidence_score : lane === "partial" ? Math.min(plan.confidence_score, 79) : lane === "conversation" ? 100 : Math.min(plan.confidence_score, 49);
  stageTimings.totalMs = Date.now() - startedAt;

  return {
    ok: true,
    answer: displayText(answer, 5000),
    structuredAnswer: structuredAnswer(displayText(answer, 5000), lane, confidence, routeChannels),
    lane,
    needsRoute,
    routeReason: needsRoute ? `Verify only the unresolved need${routeChannels.length > 1 ? "s" : ""} in ${routeChannels.join(" or ")}.` : null,
    routeChannels,
    provider: providerName,
    model,
    latencyMs: stageTimings.totalMs,
    citations: selectedPolicies.map((policy) => ({
      policyId: policy.id,
      title: policy.title,
      decisionKey: policy.decision_key,
      lastReviewed: policy.last_reviewed,
      authority: policy.authority,
      sourceKind: policy.source.kind,
      approvedBy: policy.source.approved_by,
    })),
    selectedPolicyIds,
    redactions: redacted.redactions,
    runtimeMetadata: {
      pipelineVersion: "v4-isolated",
      isolation: { productionSelectorChanged: false, databaseWrites: false, historyPersistence: false },
      knowledgeVersion: getV4KnowledgeVersion(),
      turn,
      retrieval: {
        corpusSize: retrieval.corpusSize,
        candidateCount: retrieval.candidates.length,
        candidates: retrieval.candidates.map((candidate) => ({
          id: candidate.policy.id,
          rank: candidate.rank,
          score: candidate.score,
          decisionKey: candidate.policy.decision_key,
          answerability: candidate.policy.answerability,
          qualityTier: candidate.policy.quality_tier,
          productScopes: candidate.policy.product_scopes,
        })),
        blockedTopicIds: retrieval.blocked.map((candidate) => candidate.topic.id),
      },
      plan,
      executionMode: {
        planning: planningMode,
        composition: compositionMode,
        validation: compositionMode === "not_required"
          ? "not_required"
          : deterministicWhitelistPlan && compositionMode === "exact_evidence"
            ? "deterministic_exact_evidence"
            : "model_and_deterministic",
      },
      validation,
      providerAttempts: attempts,
      stageTimings,
    },
  };
}
