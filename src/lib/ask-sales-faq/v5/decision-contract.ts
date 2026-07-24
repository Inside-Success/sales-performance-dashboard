import {
  inferV4SystemicPolicyRelations,
  v4SystemicMaterialQualifierErrors,
  v4SystemicNeedPolicyRelationErrors,
  v4SystemicRelationCompatibility,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import { matchingV4SystemicAuthorityResolutions } from "@/lib/ask-sales-faq/v4/systemic/authority-resolutions";
import type { V4SystemicNeed, V4SystemicPolicy } from "@/lib/ask-sales-faq/v4/systemic/types";

export type V51DecisionContractResult = {
  disposition: "exact" | "compatible" | "rejected";
  errors: string[];
  matchedFacets: string[];
};

export type V52DecisionIdentityResult = {
  exact: boolean;
  score: number;
  requestTerms: string[];
  matchedTerms: string[];
  reason: string;
};

const PRODUCT_PATTERNS = {
  main_istv: /\b(?:main\s+istv|inside\s+success\s+tv|istv)\b/i,
  dj_nlceo: /\b(?:daymond\s+john|next\s+level\s+ceo|nlceo|dj)\b/i,
} as const;

const DECISION_OBJECTS = [
  ["program_format", /\b(?:reality[- ]?tv|reality\s+show|documentary[- ]?style|documentary\s+programming)\b/i],
  ["seo_benefit_definition", /\bseo\b.{0,140}\b(?:benefit|mean|meaning|rank|ranking|google|keywords?)\b|\b(?:benefit|mean|meaning|rank|ranking|google|keywords?)\b.{0,140}\bseo\b/i],
  ["social_promo_asset_definition", /\bsocial\s+promo(?:tional)?\s+assets?\b/i],
  ["swag_package_definition", /\bswag(?:\s+package)?\b.{0,120}\b(?:mean|meaning|merchandise|souvenir|promotional\s+material)\b|\b(?:mean|meaning|merchandise|souvenir|promotional\s+material)\b.{0,120}\bswag(?:\s+package)?\b/i],
  ["promotional_activity_obligation", /\bpromotional\s+activities\b.{0,180}\b(?:cooperat|share|post|trailers?|social)\w*\b|\b(?:cooperat|share|post)\w*\b.{0,180}\b(?:promotional\s+activities|trailers?|social\s+posts?)\b/i],
  ["emergency_payment_link_exception", /\bemergency\s+payment\s+links?\b/i],
  ["multi_episode_starting_recommendation", /\b(?:multi[- ]?episode|docu[- ]?series|docuseries|\d+[- ]episode|one[- ]episode|single[- ]episode|larger\s+project)\b/i],
  ["payment_change_new_contract", /\b(?:payment\s+(?:arrangement|plan|split|structure|terms?)\s+(?:change|changes|changed)|change\w*\s+payment\s+(?:arrangement|plan|split|structure|terms?))\b.{0,180}\b(?:new|another|replacement)\s+(?:contract|agreement)\b|\b(?:new|another|replacement)\s+(?:contract|agreement)\b.{0,180}\b(?:payment\s+(?:arrangement|plan|split|structure|terms?)\s+(?:change|changes|changed)|change\w*\s+payment)\b/i],
  ["filming_completion_window", /\b(?:film|filming)\b.{0,140}\b(?:within|deadline|window|months?|delay|availability|studio)\b|\b(?:within|deadline|window|months?|delay|availability|studio)\b.{0,140}\b(?:film|filming)\b/i],
  ["multi_participant_episode", /\b(?:two|three|multiple|several|partners?|owners?|co[- ]?owners?)\b.{0,140}\b(?:same|one|together|separate)\b.{0,80}\b(?:business|episode|show)\b|\b(?:same|one|together|separate)\b.{0,100}\b(?:episode|show)\b.{0,140}\b(?:partners?|owners?|co[- ]?owners?)\b/i],
  ["additional_attendee_link", /\b(?:same|share)\b.{0,80}\b(?:onboarding|call)\s+(?:link|url)\b|\b(?:onboarding|call)\s+(?:link|url)\b.{0,80}\b(?:same|share|family|mother|father|spouse|guest|attendee)\b/i],
  ["supporting_approval_evidence", /\b(?:supporting\s+)?(?:documents?|links?|evidence|proof)\b.{0,120}\b(?:greenlight|green\s+light|approval)\b|\b(?:greenlight|green\s+light|approval)\b.{0,120}\b(?:supporting\s+)?(?:documents?|links?|evidence|proof)\b/i],
  ["stats_submission_correction", /\b(?:daily|eod|end[- ]of[- ]day)\s+stats?\b.{0,120}\b(?:incorrect|wrong|mistake|correct|correction)\w*\b|\b(?:incorrect|wrong|mistake|correct|correction)\w*\b.{0,120}\b(?:daily|eod|end[- ]of[- ]day)\s+stats?\b/i],
  ["stats_second_call_classification", /\b(?:call\s*(?:2|two)|second\s+calls?)\b.{0,140}\b(?:daily|eod|end[- ]of[- ]day)\s+stats?\b|\b(?:daily|eod|end[- ]of[- ]day)\s+stats?\b.{0,140}\b(?:call\s*(?:2|two)|second\s+calls?|follow[- ]?ups?)\b/i],
  ["payment_contract_automation", /\b(?:payment|paid)\b.{0,160}\b(?:contract|agreement)\b.{0,160}\b(?:automation|redirect|workflow|integration|generate|populate|send|appear)\w*\b|\b(?:automation|redirect|workflow|integration)\b.{0,160}\b(?:payment|paid)\b.{0,160}\b(?:contract|agreement)\b/i],
  ["live_card_failure", /\b(?:amex|american\s+express|card|payment\s+method)\b.{0,120}\b(?:fail|declin|reject|not\s+work|error)\w*\b|\b(?:fail|declin|reject|not\s+work|error)\w*\b.{0,120}\b(?:amex|american\s+express|card|payment\s+method)\b/i],
  ["greenlight_contract_dispatch", /\b(?:greenlight|green\s+light)\b.{0,160}\b(?:contract|agreement)\b.{0,100}\b(?:sent|send|dispatch|deliver|receive|status|confirm)\w*\b|\b(?:contract|agreement)\b.{0,160}\b(?:greenlight|green\s+light)\b.{0,100}\b(?:sent|send|dispatch|deliver|receive|status|confirm)\w*\b/i],
  ["contract_dispatch_status", /\b(?:contract|agreement)\b.{0,140}\b(?:sent|send|dispatch|deliver|receive|received|arrive|status)\w*\b|\b(?:sent|send|dispatch|deliver|receive|received|arrive|status)\w*\b.{0,140}\b(?:contract|agreement)\b/i],
] as const;

const ACTION_FACETS = [
  ["share", /\b(?:share|send|provide|give|forward)\w*\b/i],
  ["submit", /\b(?:submit|post|upload|attach|tag)\w*\b/i],
  ["locate", /\b(?:where|find|locate|access|download|get)\w*\b/i],
  ["verify", /\b(?:verify|check|confirm|trace|investigate)\w*\b/i],
  ["modify", /\b(?:change|edit|update|correct|replace|fix|repair)\w*\b/i],
  ["reschedule", /\b(?:reschedule|rebook|move)\w*\b/i],
  ["cancel", /\b(?:cancel|void|reverse|refund|pause|stop)\w*\b/i],
  ["interview", /\binterview\w*\b/i],
  ["create", /\b(?:create|generate|prepare|produce)\w*\b/i],
] as const;

function requestText(need: V4SystemicNeed) {
  // Contract each atomic need against its own wording. The full original
  // request may contain several independent decision objects; using it here
  // made every evidence card appear responsible for every object in a
  // compound question (for example SEO + social assets + swag).
  return need.text || need.authorityText || need.originalRequestText || "";
}

function policyText(policy: V4SystemicPolicy) {
  return [
    policy.title,
    ...policy.question_families,
    policy.decision,
    ...policy.domains,
    ...policy.actions,
    ...policy.entities,
  ].join(" ");
}

function objectFacets(value: string) {
  return new Set(DECISION_OBJECTS.filter(([, pattern]) => pattern.test(value)).map(([name]) => name));
}

function actionFacets(value: string) {
  return new Set(ACTION_FACETS.filter(([, pattern]) => pattern.test(value)).map(([name]) => name));
}

const IDENTITY_STOP = new Set([
  "about", "after", "again", "also", "answer", "appointment", "before", "best", "call", "can", "client", "company", "could", "does", "from", "give", "help", "keep", "need", "person", "policy", "prospect", "question", "rep", "representative", "rule", "sales", "should", "someone", "tell", "their", "there", "they", "this", "what", "when", "where", "which", "with", "would",
]);

const IDENTITY_EQUIVALENTS: Record<string, string[]> = {
  agreement: ["contract"],
  applicant: ["lead", "prospect"],
  booking: ["appointment", "schedule"],
  contract: ["agreement"],
  customer: ["client", "prospect"],
  lead: ["applicant", "prospect"],
  meeting: ["appointment", "call"],
  overrun: ["schedule", "time", "wrap"],
  parent: ["family", "mother", "father"],
  prospect: ["applicant", "lead", "client"],
  rebook: ["reschedule"],
  reschedule: ["rebook", "move"],
};

function identityStem(value: string) {
  if (value.length <= 4) return value;
  return value
    .replace(/(?:ies)$/i, "y")
    .replace(/(?:ing|ers|er|ed|es|s)$/i, "");
}

function identityTerms(value: string) {
  const base = value.toLowerCase()
    .replace(/\bcall\s+(?:1|one|first)\b/g, "call-one")
    .replace(/\bcall\s+(?:2|two|second)\b/g, "call-two")
    .replace(/[^a-z0-9%]+/g, " ")
    .split(/\s+/)
    .map(identityStem)
    .filter((term) => term.length >= 3 && !IDENTITY_STOP.has(term));
  return [...new Set(base.flatMap((term) => [term, ...(IDENTITY_EQUIVALENTS[term] || []).map(identityStem)]))];
}

/**
 * Requires shared decision identity, not merely a generic relationship such as
 * "procedure" or "permission". It is used at the recovery boundary where a
 * deterministic fallback would otherwise be able to replace an abstention.
 */
export function evaluateV52DecisionIdentity(
  need: V4SystemicNeed,
  policy: V4SystemicPolicy,
  matchedDecisionText = "",
): V52DecisionIdentityResult {
  const request = requestText(need);
  const evidence = [
    policy.title,
    ...policy.question_families,
    matchedDecisionText || policy.decision,
    ...policy.domains,
    ...policy.actions,
    ...policy.entities,
  ].join(" ");
  const explicitlyControlled = matchingV4SystemicAuthorityResolutions(need).some((resolution) =>
    resolution.controlling_policy_ids.includes(policy.id) && resolution.relations.includes(need.relation),
  );
  if (explicitlyControlled) return {
    exact: true,
    score: 100,
    requestTerms: identityTerms(request),
    matchedTerms: ["claim-scoped-authority-resolution"],
    reason: "A claim-scoped authority resolution explicitly controls this decision.",
  };
  const requestTerms = identityTerms([
    request,
    ...need.domains,
    ...need.actions,
    ...need.entities,
  ].join(" "));
  const evidenceTerms = new Set(identityTerms(evidence));
  const matchedTerms = requestTerms.filter((term) => evidenceTerms.has(term));
  const coverage = requestTerms.length ? matchedTerms.length / requestTerms.length : 0;
  const requestedObjects = objectFacets(request);
  const evidenceObjects = objectFacets(evidence);
  const exactObject = requestedObjects.size > 0 && [...requestedObjects].every((object) => evidenceObjects.has(object));
  const requestedActions = actionFacets(request);
  const evidenceActions = actionFacets(evidence);
  const exactAction = requestedActions.size > 0 && [...requestedActions].some((action) => evidenceActions.has(action));
  const relation = v4SystemicRelationCompatibility(need.relation, inferV4SystemicPolicyRelations(policy));
  const score = matchedTerms.length * 2 + coverage * 6 + (exactObject ? 5 : 0) + (exactAction ? 2 : 0) + (relation === "exact" ? 1 : 0);
  const exact = exactObject || (
    relation !== "unknown" &&
    matchedTerms.length >= 2 &&
    coverage >= 0.28 &&
    score >= 6
  );
  return {
    exact,
    score,
    requestTerms,
    matchedTerms,
    reason: exact
      ? `Matched the same decision identity (${matchedTerms.join(", ") || "explicit object"}).`
      : `Only ${matchedTerms.length} distinctive decision terms matched; generic relationship overlap is insufficient.`,
  };
}

function actorActionError(request: string, evidence: string) {
  if (/\bdoes\s+(?:the\s+)?(?:rep|representative|closer|salesperson|we|i)\s+need\s+to\b/i.test(request)) return null;
  const match = request.match(/\bdoes\s+([a-z][a-z .'-]{1,55}?)\s+(?:personally\s+)?(interview|create|record|host|meet|call|approve|review|send|provide)\w*\b/i);
  if (!match) return null;
  const actorTokens = match[1].toLowerCase().split(/\s+/).filter((token) => token.length >= 3 && !["the", "our", "any"].includes(token));
  const evidenceLower = evidence.toLowerCase();
  if (actorTokens.length && !actorTokens.every((token) => evidenceLower.includes(token))) return "the evidence governs a different actor";
  const verb = match[2];
  return new RegExp(`\\b${verb}\\w*\\b`, "i").test(evidence)
    ? null
    : `the evidence does not decide whether the named actor performs the requested ${verb} action`;
}

function productErrors(need: V4SystemicNeed, policy: V4SystemicPolicy, request: string, evidence: string) {
  if (need.productScope !== "unknown") return [];
  const explicitPolicyScopes = policy.product_scopes.filter((scope) => scope === "main_istv" || scope === "dj_nlceo");
  if (!explicitPolicyScopes.length || policy.product_scopes.includes("product_agnostic")) return [];
  if (explicitPolicyScopes.some((scope) => PRODUCT_PATTERNS[scope].test(request))) return [];

  // A source may resolve an unnamed product only when it repeats a rare,
  // decision-defining object from the request. This admits an exact program-
  // format rule while rejecting a nearby product-specific contract route.
  const requestedObjects = objectFacets(request);
  const evidenceObjects = objectFacets(evidence);
  if ([...requestedObjects].some((facet) => evidenceObjects.has(facet))) return [];
  return ["a product-specific policy cannot answer an unnamed product without an exact decision object match"];
}

export function evaluateV51DecisionContract(
  need: V4SystemicNeed,
  policy: V4SystemicPolicy,
): V51DecisionContractResult {
  const request = requestText(need);
  const evidence = policyText(policy);
  const requestedObjects = objectFacets(request);
  const evidenceObjects = objectFacets(evidence);
  const requestedActions = actionFacets(request);
  const evidenceActions = actionFacets(evidence);
  const exactDecisionObjectMatch = requestedObjects.size > 0 &&
    [...requestedObjects].every((object) => evidenceObjects.has(object));
  const explicitlyControlled = matchingV4SystemicAuthorityResolutions(need).some((resolution) =>
    resolution.controlling_policy_ids.includes(policy.id) && resolution.relations.includes(need.relation),
  );
  const errors = [
    ...(explicitlyControlled || exactDecisionObjectMatch
      ? v4SystemicMaterialQualifierErrors(need, policy)
      : v4SystemicNeedPolicyRelationErrors(need, policy)),
    ...productErrors(need, policy, request, evidence),
  ];

  for (const object of requestedObjects) {
    if (!evidenceObjects.has(object)) errors.push(`the evidence does not govern the requested ${object.replace(/_/g, " ")} decision object`);
  }
  const actorError = actorActionError(request, evidence);
  if (actorError) errors.push(actorError);

  const relationCompatibility = v4SystemicRelationCompatibility(need.relation, inferV4SystemicPolicyRelations(policy));
  const matchedFacets = [
    ...[...requestedObjects].filter((facet) => evidenceObjects.has(facet)),
    ...[...requestedActions].filter((facet) => evidenceActions.has(facet)).map((facet) => `action:${facet}`),
  ];
  const uniqueErrors = [...new Set(errors)];
  if (uniqueErrors.length) return { disposition: "rejected", errors: uniqueErrors, matchedFacets };
  const exact = relationCompatibility === "exact" || matchedFacets.length > 0;
  return { disposition: exact ? "exact" : "compatible", errors: [], matchedFacets };
}

const ROUTE_DESTINATIONS = [
  ["finance", /#sales-finance-requests\b|\bfinance\s+(?:request|channel|team)\b/i],
  ["sales_tech", /#sales-tech-requests\b|\bsales\s+tech\b/i],
  ["greenlight", /#greenlight-requests\b|\bgreenlight\s+(?:request|channel|team)\b/i],
  ["fulfillment", /\bfulfillment\s+hotline\b|\bfulfillment\s+(?:channel|team)\b/i],
  ["sales_policy", /#sales-questions-requests\b|\bsales\s+(?:questions|policy)\b/i],
] as const;

function polarity(value: string) {
  if (/\b(?:do not|don't|does not|doesn't|must not|cannot|can't|may not|not allowed|not permitted|prohibited|never|no[,.;:]?)\b/i.test(value)) return "negative";
  if (/\b(?:may|can|allowed|permitted|must|should|required|yes[,.;:]?)\b/i.test(value)) return "positive";
  return "neutral";
}

export function v51OperationalEffectErrors(need: V4SystemicNeed, sentence: string, evidence: string) {
  const request = requestText(need);
  const errors: string[] = [];
  if (/\b(?:Policy context|Decision evidence|knowledge base|retrieval candidate|evidence card)\b/i.test(sentence)) {
    errors.push("internal evidence metadata cannot be rendered as a user-facing answer");
  }

  const requestedObjects = objectFacets(request);
  const answeredObjects = objectFacets(sentence);
  if (requestedObjects.has("program_format") && !answeredObjects.has("program_format")) {
    errors.push("the answer does not decide the requested program-format relationship");
  }
  const actorError = actorActionError(request, sentence);
  if (actorError) errors.push(actorError);

  if (need.relation === "permission") {
    const sentencePolarity = polarity(sentence);
    if (sentencePolarity === "neutral") errors.push("a permission answer must state an explicit allowed or prohibited outcome");
    const evidencePolarity = polarity(evidence);
    if (sentencePolarity !== "neutral" && evidencePolarity !== "neutral" && sentencePolarity !== evidencePolarity) {
      errors.push("the answer reverses the permission polarity in the evidence");
    }
  }

  const sentenceDestinations = ROUTE_DESTINATIONS.filter(([, pattern]) => pattern.test(sentence)).map(([key]) => key);
  const evidenceDestinations = new Set(ROUTE_DESTINATIONS.filter(([, pattern]) => pattern.test(evidence)).map(([key]) => key));
  for (const destination of sentenceDestinations) {
    if (!evidenceDestinations.has(destination)) errors.push(`the ${destination.replace(/_/g, " ")} destination is not supported by the cited evidence`);
  }

  const sentenceActions = actionFacets(sentence);
  const evidenceActions = actionFacets(evidence);
  const assertsOperationalEffect = /\b(?:may|can|must|should|required|do not|don't|cannot|can't|never)\b/i.test(sentence);
  if (assertsOperationalEffect && sentenceActions.size && ![...sentenceActions].some((facet) => evidenceActions.has(facet))) {
    errors.push("the answer asserts an operational action that is not supported by the cited evidence");
  }
  return [...new Set(errors)];
}

const MATERIAL_CAUTION = /\b(?:not\s+advised|not\s+recommended|should\s+not|do\s+not|don't|must\s+not|only\s+if|unless|except|does\s+not\s+(?:guarantee|authorize|apply)|without\s+(?:approval|permission|confirmation))\b/gi;

function materialCautions(value: string) {
  return [...new Set([...value.matchAll(MATERIAL_CAUTION)].map((match) => match[0].toLowerCase()))];
}

function preservesCaution(sentence: string, caution: string) {
  if (/not\s+(?:advised|recommended)/.test(caution)) return /\b(?:not\s+advised|not\s+recommended|not\s+ideal|avoid)\b/i.test(sentence);
  if (/^(?:should|do|must)\s+not|^don't$/.test(caution)) return /\b(?:should\s+not|do\s+not|don't|must\s+not|cannot|can't|never)\b/i.test(sentence);
  if (/^(?:only\s+if|unless|except)$/.test(caution)) return /\b(?:only\s+if|unless|except|provided\s+that|as\s+long\s+as)\b/i.test(sentence);
  if (/does\s+not\s+(?:guarantee|authorize|apply)/.test(caution)) return /\b(?:does\s+not|doesn't|not\s+guaranteed|not\s+authorized|do\s+not\s+assume)\b/i.test(sentence);
  if (/without\s+(?:approval|permission|confirmation)/.test(caution)) return /\b(?:approval|permission|confirmation)\b/i.test(sentence) && /\b(?:need|require|must|cannot|can't|do\s+not|don't|without)\b/i.test(sentence);
  return sentence.toLowerCase().includes(caution);
}

/** Prevents a fluent paraphrase from dropping a safety-changing exception. */
export function v52OperationalEffectErrors(need: V4SystemicNeed, sentence: string, evidence: string) {
  const errors = v51OperationalEffectErrors(need, sentence, evidence);
  const cautions = materialCautions(evidence);
  const assertsPermissionOrInstruction = /\b(?:can|may|allowed|should|must|use|send|share|offer|provide|book|schedule|route)\b/i.test(sentence);
  if (assertsPermissionOrInstruction && cautions.length) {
    for (const caution of cautions) {
      if (!preservesCaution(sentence, caution)) {
        errors.push(`the answer omits a material evidence boundary: ${caution}`);
      }
    }
  }
  return [...new Set(errors)];
}
