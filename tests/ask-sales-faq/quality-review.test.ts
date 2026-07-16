import { describe, expect, it } from "vitest";
import {
  applyAskSalesQualityAuditGuardrails,
  type AskSalesQualityAuditEvaluation,
  validateAskSalesQualityReviewDecision,
} from "@/lib/ask-sales-faq/quality-review-store";

const evaluation: AskSalesQualityAuditEvaluation = {
  messageId: "message-1",
  verdict: "knowledge_gap",
  issueType: "knowledge_gap",
  severity: "medium",
  confidence: 0.9,
  summary: "No governed policy answers the question.",
  rationale: "The safe route is appropriate.",
  expectedBehavior: "Route for confirmation.",
};

describe("Ask Sales quality-review safety", () => {
  it("does not turn a deliberate grounding rejection into a technical runtime failure", () => {
    expect(applyAskSalesQualityAuditGuardrails(evaluation, {
      error_class: "v3_grounding_rejected",
      feedback_rating: null,
    })).toMatchObject({
      verdict: "knowledge_gap",
      issueType: "knowledge_gap",
      severity: "medium",
    });
  });

  it("still forces genuine provider/runtime failures into high-priority runtime review", () => {
    expect(applyAskSalesQualityAuditGuardrails(evaluation, {
      error_class: "v3_provider_failure",
      feedback_rating: null,
    })).toMatchObject({
      verdict: "runtime_issue",
      issueType: "runtime_reliability",
      severity: "high",
    });
  });

  it("cannot label positive or absent feedback as negative feedback", () => {
    expect(applyAskSalesQualityAuditGuardrails({
      ...evaluation,
      verdict: "needs_review",
      issueType: "negative_feedback",
    }, {
      feedback_rating: "up",
      error_class: null,
    })).toMatchObject({
      verdict: "needs_review",
      issueType: "wrong_or_incomplete_answer",
    });
  });

  it("always keeps explicit negative feedback in human review", () => {
    expect(applyAskSalesQualityAuditGuardrails({
      ...evaluation,
      verdict: "looks_correct",
      issueType: "presentation",
      severity: "low",
    }, {
      feedback_rating: "down",
      error_class: null,
    })).toMatchObject({
      verdict: "needs_review",
      issueType: "negative_feedback",
      severity: "medium",
    });
  });

  it("requires server-side notes for confirmed gaps, runtime issues, and owner decisions", () => {
    for (const action of ["knowledge_gap", "runtime_issue", "needs_owner"] as const) {
      expect(() => validateAskSalesQualityReviewDecision(action, "  ")).toThrow(/reviewer note/i);
      expect(() => validateAskSalesQualityReviewDecision(action, "Confirmed against the governed source.")).not.toThrow();
    }
    expect(() => validateAskSalesQualityReviewDecision("answer_correct", null)).not.toThrow();
    expect(() => validateAskSalesQualityReviewDecision("defer", null)).not.toThrow();
  });
});
