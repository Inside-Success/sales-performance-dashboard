import type { AskSalesFaqOutcome } from "@/lib/ask-sales-faq/types";

const GROUNDED_OUTCOMES = new Set<AskSalesFaqOutcome>([
  "answer_from_approved_article",
  "answer_from_evidence",
]);

const ROUTE_OUTCOMES = new Set<AskSalesFaqOutcome>([
  "route_from_approved_article",
  "route_from_evidence",
  "low_confidence_route",
  "abstain_unapproved",
  "admin_only",
]);

const FAILURE_OUTCOMES = new Set<AskSalesFaqOutcome>([
  "safe_fallback",
  "rate_limited",
  "duplicate_in_progress",
  "feature_disabled",
  "auth_blocked",
  "validation_error",
]);

export function isAskSalesFaqGroundedOutcome(outcome: string | null | undefined) {
  return Boolean(outcome && GROUNDED_OUTCOMES.has(outcome as AskSalesFaqOutcome));
}

export function isAskSalesFaqRouteOutcome(outcome: string | null | undefined) {
  return Boolean(outcome && ROUTE_OUTCOMES.has(outcome as AskSalesFaqOutcome));
}

export function isAskSalesFaqFailureOutcome(outcome: string | null | undefined) {
  return Boolean(outcome && FAILURE_OUTCOMES.has(outcome as AskSalesFaqOutcome));
}

export function shouldCreateAskSalesFaqMiss(input: {
  outcome: string | null | undefined;
  needsRoute: boolean;
  errorClass: string | null | undefined;
}) {
  if (input.outcome === "conversation_reply") return false;
  return Boolean(
    input.errorClass ||
      input.needsRoute ||
      isAskSalesFaqRouteOutcome(input.outcome) ||
      isAskSalesFaqFailureOutcome(input.outcome),
  );
}

export function classifyAskSalesFaqReview(input: {
  rating?: "up" | "down" | null;
  outcome?: string | null;
  needsRoute?: boolean;
  errorClass?: string | null;
}) {
  if (input.rating === "down") {
    return {
      category: "Negative feedback",
      action: "Review the rep comment, answer relevance, and cited evidence before deciding whether this is a content or runtime issue.",
    };
  }

  if (input.errorClass || isAskSalesFaqFailureOutcome(input.outcome)) {
    return {
      category: "Runtime reliability",
      action: "Inspect the provider attempt and runtime diagnostics before creating knowledge-base work.",
    };
  }

  if (input.outcome === "abstain_unapproved" || input.outcome === "admin_only") {
    return {
      category: "Coverage boundary",
      action: "Confirm whether the question should remain safely unanswered or belongs in the governed knowledge backlog.",
    };
  }

  if (input.needsRoute || isAskSalesFaqRouteOutcome(input.outcome)) {
    return {
      category: "Safe route",
      action: "Check that the route is relevant, concise, and points to the correct owner or channel.",
    };
  }

  return {
    category: "Answer audit",
    action: "Spot-check the answer for relevance and source fit; no immediate remediation is implied.",
  };
}

export function normalizeAskSalesFaqAnalyticsDays(value: unknown, fallback = 7) {
  const candidate = Array.isArray(value) ? value[0] : value;
  const parsed = typeof candidate === "string" ? Number.parseInt(candidate, 10) : Number(candidate);
  return parsed === 30 ? 30 : parsed === 90 ? 90 : parsed === 7 ? 7 : fallback;
}

export function percentOf(part: number, total: number) {
  if (!total) return 0;
  return Math.max(0, Math.min(100, Math.round((part / total) * 100)));
}
