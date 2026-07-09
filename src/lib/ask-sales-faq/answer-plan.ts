import type {
  CanonicalProductScope,
  QuestionFrame as AskSalesQuestionFrame,
  QuestionScope,
} from "./question-frame";

export type ApprovedPolicyUnitScope = CanonicalProductScope | "product_agnostic";

export type ApprovedPolicyUnitScopeBehavior = "require" | "clarify_if_unknown" | "product_agnostic";

export type ApprovedPolicyUnitFallbackMode = "approved_answer" | "clarify" | "scope_safe_route";

export type ApprovedPolicyUnit = {
  id: string;
  title: string;
  source_article_ids: string[];
  product_scope: ApprovedPolicyUnitScope;
  scope_behavior: ApprovedPolicyUnitScopeBehavior;
  critical_rule_ids: string[];
  intents: string[];
  match_any: string[];
  approved_text: string;
  forbidden_claims: string[];
  route_required: boolean;
  fallback_mode: ApprovedPolicyUnitFallbackMode;
  safe_fallback: string;
  approval_reference: string;
  last_reviewed: string;
};

export type ApprovedPolicyUnitsDocument = {
  schema_version: number;
  description?: string;
  units: ApprovedPolicyUnit[];
};

export type AnswerPlanFallbackMode = ApprovedPolicyUnitFallbackMode;

export type AskSalesAnswerPlan = {
  selectedPolicyUnits: ApprovedPolicyUnit[];
  resolvedProductScope: QuestionScope;
  excludedScopes: CanonicalProductScope[];
  allowedArticleIds: string[];
  applicableCriticalRuleIds: string[];
  clarificationRequired: boolean;
  routeRequired: boolean;
  fallbackMode: AnswerPlanFallbackMode;
};

export type BuildAnswerPlanInput = {
  questionFrame: AskSalesQuestionFrame;
  approvedArticleId: string | null;
  policyUnits: ApprovedPolicyUnitsDocument;
};

type PolicyIntent =
  | "pricing"
  | "payment_plan"
  | "discount"
  | "payment_timing"
  | "cohort"
  | "reschedule"
  | "document_sharing"
  | "upgrade"
  | "greenlight_letter";

const PRODUCT_SENSITIVE_INTENTS = new Set<PolicyIntent>([
  "pricing",
  "payment_plan",
  "discount",
  "payment_timing",
  "cohort",
  "reschedule",
  "upgrade",
]);

const TIMING_INTENTS = new Set<PolicyIntent>(["payment_timing", "cohort", "reschedule"]);

const SPECIFIC_INTENTS = new Set<PolicyIntent>(["document_sharing", "greenlight_letter", "upgrade", "discount"]);

const CRITICAL_RULE_ARTICLE_IDS: Record<string, string> = {
  "dj-nlceo-no-cohort-deposit-boundary": "main-istv-call-2-cohort-reschedule-rules",
  "dj-nlceo-pricing-no-cohort-deposit-boundary": "istv-nlceo-pricing-and-same-day-discount",
  "pricing-ambiguous-payment-hold-product-check": "istv-nlceo-pricing-and-same-day-discount",
  "pricing-standard-upgrade-discount": "istv-nlceo-pricing-and-same-day-discount",
  "pricing-vip-upgrade-discount": "istv-nlceo-pricing-and-same-day-discount",
};

export function buildAnswerPlan(input: BuildAnswerPlanInput): AskSalesAnswerPlan {
  const question = normalizePlanText(input.questionFrame.effectiveQuestion || input.questionFrame.currentQuestion);
  const detectedIntents = detectPolicyIntents(question);
  const focusedIntents = focusPolicyIntents(detectedIntents);
  const clarificationRequired =
    input.questionFrame.scope === "unknown" &&
    Array.from(focusedIntents).some((intent) => PRODUCT_SENSITIVE_INTENTS.has(intent));

  const selectedPolicyUnits = validPolicyUnits(input.policyUnits).filter((unit) => {
    if (!unitMatchesApprovedArticle(unit, input.approvedArticleId)) return false;
    if (!unitIsProductCompatible(unit, input.questionFrame)) return false;
    return unitMatchesFocusedIntent(unit, focusedIntents, clarificationRequired);
  });

  const allowedArticleIds = uniqueSorted(
    selectedPolicyUnits.flatMap((unit) =>
      input.approvedArticleId
        ? unit.source_article_ids.filter((articleId) => articleId === input.approvedArticleId)
        : unit.source_article_ids,
    ),
  );
  const applicableCriticalRuleIds = uniqueSorted(
    selectedPolicyUnits
      .flatMap((unit) => unit.critical_rule_ids)
      .filter((ruleId) =>
        criticalRuleApplies({
          ruleId,
          approvedArticleId: input.approvedArticleId,
          frame: input.questionFrame,
          focusedIntents,
          question,
          clarificationRequired,
        }),
      ),
  );

  const routeRequired = !clarificationRequired && selectedPolicyUnits.some((unit) => unit.route_required);
  const fallbackMode = resolveFallbackMode({
    selectedPolicyUnits,
    clarificationRequired,
    routeRequired,
  });

  return {
    selectedPolicyUnits,
    resolvedProductScope: input.questionFrame.scope,
    excludedScopes: uniqueScopes(input.questionFrame.excludedScopes),
    allowedArticleIds,
    applicableCriticalRuleIds,
    clarificationRequired,
    routeRequired,
    fallbackMode,
  };
}

function validPolicyUnits(document: ApprovedPolicyUnitsDocument) {
  if (!document || document.schema_version !== 1 || !Array.isArray(document.units)) return [];

  return document.units.filter(
    (unit) =>
      Boolean(unit?.id) &&
      Array.isArray(unit.source_article_ids) &&
      Array.isArray(unit.critical_rule_ids) &&
      Array.isArray(unit.intents),
  );
}

function unitMatchesApprovedArticle(unit: ApprovedPolicyUnit, approvedArticleId: string | null) {
  return !approvedArticleId || unit.source_article_ids.includes(approvedArticleId);
}

function unitIsProductCompatible(unit: ApprovedPolicyUnit, frame: AskSalesQuestionFrame) {
  if (unit.product_scope === "product_agnostic") {
    return unit.scope_behavior !== "clarify_if_unknown" || frame.scope === "unknown";
  }

  if (frame.excludedScopes.includes(unit.product_scope)) return false;
  if (frame.scope === "comparison") return true;
  return frame.scope === unit.product_scope;
}

function unitMatchesFocusedIntent(
  unit: ApprovedPolicyUnit,
  focusedIntents: ReadonlySet<PolicyIntent>,
  clarificationRequired: boolean,
) {
  if (unit.scope_behavior === "clarify_if_unknown") {
    return clarificationRequired;
  }

  const unitSpecificIntents = unit.intents.filter((intent) => SPECIFIC_INTENTS.has(intent as PolicyIntent));
  if (unitSpecificIntents.length) {
    return unitSpecificIntents.some((intent) => focusedIntents.has(intent as PolicyIntent));
  }

  return unit.intents.some((intent) => focusedIntents.has(intent as PolicyIntent));
}

function detectPolicyIntents(question: string) {
  const intents = new Set<PolicyIntent>();

  if (/\b(?:green\s*light|conditional approval|approval letter|expiration section)\b/.test(question)) {
    intents.add("greenlight_letter");
  }
  if (/\b(?:license options?|reuse license|licensing options?)\b/.test(question)) {
    intents.add("document_sharing");
  }
  if (/\b(?:upgrade|upgraded|upgrading)\b/.test(question)) intents.add("upgrade");
  if (/\b(?:discount|same day offer|same day price|money off)\b/.test(question)) intents.add("discount");
  if (/\b(?:cohort|pay\s*\/\s*sign|pay and sign|reapply|re apply)\b/.test(question)) intents.add("cohort");
  if (/\b(?:reschedule|rescheduled|rescheduling|move (?:the )?call|book out)\b/.test(question)) {
    intents.add("reschedule");
  }
  if (isPaymentTimingQuestion(question)) intents.add("payment_timing");
  if (/\b(?:payment plan|installments?|split payments?|payment split|pay in full|pif|monthly payments?)\b/.test(question)) {
    intents.add("payment_plan");
  }
  if (/\b(?:price|pricing|cost|how much|package prices?|package options?)\b/.test(question)) intents.add("pricing");

  return intents;
}

function isPaymentTimingQuestion(question: string) {
  if (
    /\b(?:payment timing|payment date|future payment|initial payment|first payment|initial deposit|funds? unavailable|funds? available|unable to pay|cannot pay|can't pay|cant pay|pay later|continue later|delay payment|defer payment|payment hold|hold (?:the )?(?:spot|payment|opportunity)|need(?:s)? (?:more )?time to pay)\b/.test(
      question,
    )
  ) {
    return true;
  }

  const hasPaymentSubject = /\b(?:pay|payment|deposit|funds?|money)\b/.test(question);
  const hasTimingCondition = /\b(?:when|later|wait|waiting|until|date|timing|delay|delayed|available|availability|hold)\b/.test(question);
  return hasPaymentSubject && hasTimingCondition;
}

function focusPolicyIntents(detected: ReadonlySet<PolicyIntent>) {
  if (detected.has("document_sharing")) return new Set<PolicyIntent>(["document_sharing"]);
  if (detected.has("greenlight_letter")) return new Set<PolicyIntent>(["greenlight_letter"]);
  if (detected.has("upgrade")) return new Set<PolicyIntent>(["upgrade"]);
  if (detected.has("discount")) return new Set<PolicyIntent>(["discount"]);

  const timing = Array.from(detected).filter((intent) => TIMING_INTENTS.has(intent));
  if (timing.length) return new Set<PolicyIntent>(timing);

  return new Set<PolicyIntent>(
    Array.from(detected).filter((intent) => intent === "pricing" || intent === "payment_plan"),
  );
}

function criticalRuleApplies(input: {
  ruleId: string;
  approvedArticleId: string | null;
  frame: AskSalesQuestionFrame;
  focusedIntents: ReadonlySet<PolicyIntent>;
  question: string;
  clarificationRequired: boolean;
}) {
  const criticalArticleId = CRITICAL_RULE_ARTICLE_IDS[input.ruleId];
  if (input.approvedArticleId && criticalArticleId && criticalArticleId !== input.approvedArticleId) return false;

  if (input.ruleId === "pricing-ambiguous-payment-hold-product-check") {
    return input.clarificationRequired && input.frame.scope === "unknown";
  }

  if (input.ruleId.startsWith("dj-nlceo-")) {
    const djAllowed =
      !input.frame.excludedScopes.includes("dj_nlceo") &&
      (input.frame.scope === "dj_nlceo" || input.frame.scope === "comparison");
    return djAllowed && Array.from(input.focusedIntents).some((intent) => TIMING_INTENTS.has(intent));
  }

  if (input.ruleId === "pricing-standard-upgrade-discount") {
    return input.focusedIntents.has("upgrade") && /\bstandard\b/.test(input.question);
  }

  if (input.ruleId === "pricing-vip-upgrade-discount") {
    return input.focusedIntents.has("upgrade") && /\b(?:vip|premium)\b/.test(input.question);
  }

  return true;
}

function resolveFallbackMode(input: {
  selectedPolicyUnits: ApprovedPolicyUnit[];
  clarificationRequired: boolean;
  routeRequired: boolean;
}): AnswerPlanFallbackMode {
  if (input.clarificationRequired) return "clarify";
  if (!input.selectedPolicyUnits.length || input.routeRequired) return "scope_safe_route";
  return "approved_answer";
}

function normalizePlanText(value: string) {
  return value
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function uniqueScopes(values: CanonicalProductScope[]) {
  const scopeOrder: CanonicalProductScope[] = ["main_istv", "dj_nlceo"];
  return scopeOrder.filter((scope) => values.includes(scope));
}
