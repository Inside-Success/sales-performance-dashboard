export type PolicyDecisionRelation = "same_decision" | "related" | "unrelated";

export type PolicyDecisionProfile = {
  text: string;
  decisionKey?: string | null;
  productScopes?: string[];
  domains?: string[];
  actions?: string[];
  entities?: string[];
  policyObject?: string | null;
  conditions?: string | null;
};

export type PolicyDecisionMatch = {
  relation: PolicyDecisionRelation;
  score: number;
  scopeCompatible: boolean;
  sharedDomains: string[];
  sharedActions: string[];
  sharedSubjects: string[];
  sharedPolicyObjects: string[];
  reasons: string[];
};

const STOPWORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "between", "but",
  "can", "could", "does", "for", "from", "have", "into", "its", "just", "more", "not", "only", "our", "should",
  "that", "the", "their", "then", "there", "these", "they", "this", "those", "through", "too", "under", "was",
  "were", "what", "when", "where", "which", "while", "who", "will", "with", "would", "you", "your",
]);

const GENERIC_MATCH_TERMS = new Set([
  "all", "answer", "approved", "both", "call", "candidate", "change", "client", "clients", "company", "current",
  "daily", "day", "days", "decision", "document", "exact", "follow", "guidance", "linked", "list", "must", "new",
  "notes", "official", "per", "policy", "post", "process", "product", "product_agnostic", "proposal", "read", "rep",
  "reps", "required", "rule", "sales", "sheet", "sop", "standard", "timeline", "update", "updated", "use",
]);

const GENERIC_SCOPES = new Set(["", "all", "any", "general", "product_agnostic", "unknown"]);
const STRUCTURED_TERM_ALIASES: Record<string, string[]> = {
  qualify: ["fit", "qualify", "qualified", "eligible", "eligibility"],
  access: ["access", "download", "watch", "watchable", "available"],
  verify: ["verify", "factcheck", "fact", "current", "currently", "confirm", "status"],
  discount: ["discount", "discounted"],
  price: ["price", "prices", "pricing", "cost"],
  produce: ["produce", "film", "filming", "episode"],
  promise: ["promise", "guarantee", "guaranteed"],
};

export function policyDecisionProfile(input: PolicyDecisionProfile): PolicyDecisionProfile {
  return {
    text: String(input.text || "").slice(0, 80_000),
    decisionKey: normalizeIdentifier(input.decisionKey || ""),
    productScopes: normalizeIdentifiers(input.productScopes),
    domains: normalizeIdentifiers(input.domains),
    actions: normalizeIdentifiers(input.actions),
    entities: normalizeIdentifiers(input.entities),
    policyObject: cleanText(input.policyObject || ""),
    conditions: cleanText(input.conditions || ""),
  };
}

export function classifyPolicyDecisionRelation(
  leftInput: PolicyDecisionProfile,
  rightInput: PolicyDecisionProfile,
): PolicyDecisionMatch {
  const left = policyDecisionProfile(leftInput);
  const right = policyDecisionProfile(rightInput);
  const scopeCompatible = compatibleScopes(left.productScopes || [], right.productScopes || []);
  const sharedDomains = intersection(left.domains || [], right.domains || []);
  const sharedActions = intersection(left.actions || [], right.actions || []);
  const leftText = distinctiveTokens([
    left.text,
    left.policyObject || "",
    left.conditions || "",
    ...(left.entities || []),
  ].join(" "));
  const leftSubject = decisionSubjectTokens(left);
  const rightSubject = decisionSubjectTokens(right);
  const rightText = distinctiveTokens([
    right.text,
    right.policyObject || "",
    right.conditions || "",
    ...(right.entities || []),
  ].join(" "));
  const leftTerms = semanticTokens([
    left.text,
    left.policyObject || "",
    left.conditions || "",
    ...(left.entities || []),
  ].join(" "));
  const sharedSubjects = Array.from(leftSubject).filter((token) => rightSubject.has(token));
  const rightPolicyObject = distinctiveTokens(right.policyObject || "");
  const sharedPolicyObjects = Array.from(leftSubject).filter((token) => rightPolicyObject.has(token));
  const sharedText = Array.from(leftText).filter((token) => rightText.has(token));
  const domainMention = structuredOrTextOverlap(left.domains || [], right.domains || [], leftTerms, right.domains || []);
  const actionMention = structuredOrTextOverlap(left.actions || [], right.actions || [], leftTerms, right.actions || []);
  const exactDecisionKey = Boolean(
    left.decisionKey &&
    right.decisionKey &&
    left.decisionKey === right.decisionKey,
  );
  const reasons: string[] = [];

  if (!scopeCompatible) {
    return {
      relation: "unrelated",
      score: 0,
      scopeCompatible,
      sharedDomains,
      sharedActions,
      sharedSubjects,
      sharedPolicyObjects,
      reasons: ["Product scopes are incompatible."],
    };
  }

  if (exactDecisionKey) {
    return {
      relation: "same_decision",
      score: 1,
      scopeCompatible,
      sharedDomains,
      sharedActions,
      sharedSubjects,
      sharedPolicyObjects,
      reasons: ["The normalized decision key is identical."],
    };
  }

  const explicitDomainMismatch = Boolean(
    left.domains?.length &&
    right.domains?.length &&
    !sharedDomains.length,
  );
  const explicitActionMismatch = Boolean(
    left.actions?.length &&
    right.actions?.length &&
    !sharedActions.length,
  );

  if (explicitDomainMismatch) reasons.push("The structured policy domains do not overlap.");
  if (explicitActionMismatch) reasons.push("The structured policy actions do not overlap.");
  if (domainMention) reasons.push("The same policy domain is present.");
  if (actionMention) reasons.push("The same policy action is present.");
  if (sharedSubjects.length) reasons.push(`Shared decision subject: ${sharedSubjects.slice(0, 4).join(", ")}.`);

  const bothStructurallyClassified = Boolean(
    left.domains?.length &&
    left.actions?.length &&
    left.entities?.length &&
    right.domains?.length &&
    right.actions?.length &&
    right.entities?.length,
  );
  const hasStrongNumericAnchor = sharedSubjects.some((token) => /^\d+(?:\.\d+)?(?:%|percent)$/.test(token));
  const leftStructurallyClassified = Boolean(
    left.domains?.length &&
    left.actions?.length &&
    left.entities?.length,
  );
  const hasSpecificObjectOverlap = sharedPolicyObjects.length > 0;
  const sameDecision =
    !explicitDomainMismatch &&
    !explicitActionMismatch &&
    (bothStructurallyClassified
      ? domainMention && actionMention && (hasSpecificObjectOverlap || sharedSubjects.length >= 2)
      : leftStructurallyClassified
        ? domainMention && actionMention && (hasSpecificObjectOverlap || sharedSubjects.length >= 2)
        : (
          (domainMention && actionMention && (
            (hasSpecificObjectOverlap && sharedSubjects.length >= 1) || sharedSubjects.length >= 2
          )) ||
          (actionMention && (sharedSubjects.length >= 2 || hasStrongNumericAnchor))
        ));

  const score = Math.min(
    0.99,
    (domainMention ? 0.3 : 0) +
    (actionMention ? 0.25 : 0) +
    Math.min(0.45, sharedSubjects.length * 0.15) +
    Math.min(0.15, Math.max(0, sharedText.length - sharedSubjects.length) * 0.03),
  );

  if (sameDecision) {
    return {
      relation: "same_decision",
      score,
      scopeCompatible,
      sharedDomains,
      sharedActions,
      sharedSubjects,
      sharedPolicyObjects,
      reasons,
    };
  }

  const related = !explicitDomainMismatch && !explicitActionMismatch &&
    (domainMention || actionMention || sharedSubjects.length >= 1);
  return {
    relation: related ? "related" : "unrelated",
    score,
    scopeCompatible,
    sharedDomains,
    sharedActions,
    sharedSubjects,
    sharedPolicyObjects,
    reasons: reasons.length ? reasons : ["No distinctive policy subject or action overlap was found."],
  };
}

function compatibleScopes(left: string[], right: string[]) {
  const leftSpecific = left.filter((scope) => !GENERIC_SCOPES.has(scope));
  const rightSpecific = right.filter((scope) => !GENERIC_SCOPES.has(scope));
  if (!leftSpecific.length || !rightSpecific.length) return true;
  return leftSpecific.some((scope) => rightSpecific.includes(scope));
}

function structuredOrTextOverlap(left: string[], right: string[], leftText: Set<string>, rightTerms: string[]) {
  if (intersection(left, right).length) return true;
  return rightTerms.some((term) => {
    const normalized = normalizeIdentifier(term);
    const aliases = STRUCTURED_TERM_ALIASES[normalized] || [];
    return [...identifierTokens(term), ...aliases].some((token) => leftText.has(token));
  });
}

function distinctiveTokens(value: string) {
  return new Set(
    cleanText(value)
      .split(" ")
      .filter((token) =>
        (token.length > 2 || /^(?:\$\d|\d+%)/.test(token)) &&
        !STOPWORDS.has(token) &&
        !GENERIC_MATCH_TERMS.has(token),
      ),
  );
}

function semanticTokens(value: string) {
  return new Set(
    cleanText(value)
      .split(" ")
      .filter((token) => (token.length > 2 || /^\d+$/.test(token)) && !STOPWORDS.has(token)),
  );
}

function decisionSubjectTokens(profile: PolicyDecisionProfile) {
  const subjects = distinctiveTokens([
    profile.text,
    profile.policyObject || "",
    profile.conditions || "",
    ...(profile.entities || []),
  ].join(" "));
  for (const structuredTerm of [...(profile.domains || []), ...(profile.actions || [])]) {
    for (const token of identifierTokens(structuredTerm)) subjects.delete(token);
  }
  return subjects;
}

function identifierTokens(value: string) {
  return normalizeIdentifier(value)
    .split("_")
    .filter((token) => token && !GENERIC_MATCH_TERMS.has(token));
}

function normalizeIdentifiers(values?: string[]) {
  return Array.from(new Set((values || []).map(normalizeIdentifier).filter(Boolean)));
}

function normalizeIdentifier(value: string) {
  return cleanText(value).replace(/\s+/g, "_");
}

function cleanText(value: string) {
  return value
    .toLowerCase()
    .replace(/(\d+)\s*%/g, "$1percent")
    .replace(/(\d+)\s+percent\b/g, "$1percent")
    .replace(/[^a-z0-9#$%]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function intersection(left: string[], right: string[]) {
  const rightSet = new Set(right);
  return left.filter((value) => rightSet.has(value));
}
