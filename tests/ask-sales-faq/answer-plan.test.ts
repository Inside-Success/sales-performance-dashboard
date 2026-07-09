import { describe, expect, it } from "vitest";
import policyUnits from "@/lib/ask-sales-faq/generated/approved-policy-units.json";
import { buildAnswerPlan, type ApprovedPolicyUnitsDocument } from "@/lib/ask-sales-faq/answer-plan";
import { buildQuestionFrame, type QuestionFrameMessage } from "@/lib/ask-sales-faq/question-frame";

const pricingArticle = "istv-nlceo-pricing-and-same-day-discount";
const cohortArticle = "main-istv-call-2-cohort-reschedule-rules";

function plan(question: string, approvedArticleId: string | null = pricingArticle, messages: QuestionFrameMessage[] = []) {
  return buildAnswerPlan({
    questionFrame: buildQuestionFrame(question, messages),
    approvedArticleId,
    policyUnits: policyUnits as ApprovedPolicyUnitsDocument,
  });
}

describe("buildAnswerPlan", () => {
  it("allows only the main timing unit when DJ is explicitly excluded", () => {
    const result = plan(
      "The client cannot make the initial deposit yet after Call 2. This is for main ISTV, not for any DJ show.",
    );

    expect(result.resolvedProductScope).toBe("main_istv");
    expect(result.excludedScopes).toEqual(["dj_nlceo"]);
    expect(result.selectedPolicyUnits.map((unit) => unit.id)).toEqual(["main-istv-payment-timing-exception"]);
    expect(result.applicableCriticalRuleIds).toEqual([]);
    expect(result.allowedArticleIds).toEqual([pricingArticle]);
    expect(result.clarificationRequired).toBe(false);
    expect(result.routeRequired).toBe(true);
    expect(result.fallbackMode).toBe("scope_safe_route");
  });

  it("selects only article-compatible DJ timing guidance", () => {
    const result = plan("For the Daymond John show, can the client delay the first payment and pay later?");

    expect(result.resolvedProductScope).toBe("dj_nlceo");
    expect(result.selectedPolicyUnits.map((unit) => unit.id)).toEqual(["dj-nlceo-timing-no-cohort"]);
    expect(result.applicableCriticalRuleIds).toEqual(["dj-nlceo-pricing-no-cohort-deposit-boundary"]);
    expect(result.selectedPolicyUnits.every((unit) => unit.product_scope !== "main_istv")).toBe(true);
    expect(result.routeRequired).toBe(true);
  });

  it("requires product clarification for unknown payment timing", () => {
    const result = plan("The client needs more time to pay the initial deposit after Call 2. Can we hold it?");

    expect(result.resolvedProductScope).toBe("unknown");
    expect(result.selectedPolicyUnits.map((unit) => unit.id)).toEqual(["pricing-product-clarification"]);
    expect(result.applicableCriticalRuleIds).toEqual(["pricing-ambiguous-payment-hold-product-check"]);
    expect(result.clarificationRequired).toBe(true);
    expect(result.routeRequired).toBe(false);
    expect(result.fallbackMode).toBe("clarify");
  });

  it("allows both compatible timing units for a real comparison", () => {
    const result = plan("Compare payment timing and cohort rules for main ISTV versus Next Level CEO.");

    expect(result.resolvedProductScope).toBe("comparison");
    expect(result.selectedPolicyUnits.map((unit) => unit.id)).toEqual([
      "dj-nlceo-timing-no-cohort",
      "main-istv-payment-timing-exception",
    ]);
    expect(result.applicableCriticalRuleIds).toEqual(["dj-nlceo-pricing-no-cohort-deposit-boundary"]);
    expect(result.routeRequired).toBe(true);
  });

  it("selects pricing for only the resolved product", () => {
    expect(plan("What are the package prices for main ISTV?").selectedPolicyUnits.map((unit) => unit.id)).toEqual([
      "main-istv-pricing-and-plans",
    ]);
    const djResult = plan("What are the package prices for DJ/NLCEO?");
    expect(djResult.selectedPolicyUnits.map((unit) => unit.id)).toEqual(["dj-nlceo-pricing-and-plans"]);
    expect(djResult.applicableCriticalRuleIds).toEqual([]);
  });

  it("constrains allowed articles and critical rules to the routed article", () => {
    const result = plan("For DJ/NLCEO, can Call 2 be rescheduled to a later cohort?", cohortArticle);

    expect(result.selectedPolicyUnits.map((unit) => unit.id)).toEqual(["dj-nlceo-timing-no-cohort"]);
    expect(result.allowedArticleIds).toEqual([cohortArticle]);
    expect(result.applicableCriticalRuleIds).toEqual(["dj-nlceo-no-cohort-deposit-boundary"]);
  });

  it("keeps upgrade eligibility separate from discount math", () => {
    const standard = plan("For main ISTV, can a client upgrade to Standard before filming?");
    const vip = plan("For main ISTV, can a client upgrade to Premium before filming?");
    const unspecified = plan("For main ISTV, can a client upgrade before filming?");

    expect(standard.selectedPolicyUnits.map((unit) => unit.id)).toEqual(["main-istv-upgrade-before-filming"]);
    expect(standard.applicableCriticalRuleIds).toEqual([]);
    expect(vip.applicableCriticalRuleIds).toEqual([]);
    expect(unspecified.applicableCriticalRuleIds).toEqual([]);
  });

  it("selects discount carry-forward rules only when the prior discount is established", () => {
    const standard = plan(
      "A main ISTV Lite client already received the $2,000 same-day discount. What is the upgrade to Standard?",
    );
    const vip = plan(
      "A main ISTV Lite client already received the same-day discount. What is the upgrade to Premium?",
    );

    expect(standard.selectedPolicyUnits.map((unit) => unit.id)).toEqual([
      "main-istv-upgrade-discount-carry-forward",
    ]);
    expect(standard.applicableCriticalRuleIds).toEqual(["pricing-standard-upgrade-discount"]);
    expect(vip.selectedPolicyUnits.map((unit) => unit.id)).toEqual([
      "main-istv-upgrade-discount-carry-forward",
    ]);
    expect(vip.applicableCriticalRuleIds).toEqual(["pricing-vip-upgrade-discount"]);
  });

  it("does not force a product clarification for product-agnostic document guidance", () => {
    const result = plan("Should I send the License Options document to compare packages?");

    expect(result.selectedPolicyUnits.map((unit) => unit.id)).toEqual(["license-options-document"]);
    expect(result.resolvedProductScope).toBe("unknown");
    expect(result.clarificationRequired).toBe(false);
    expect(result.fallbackMode).toBe("approved_answer");
  });

  it("selects the grounded lead-ownership unit instead of generic sales advice", () => {
    const result = plan(
      "Another rep says this is their 20% lead, but I reached the prospect. What should I check?",
      "twenty-percent-dial-out-sop",
    );

    expect(result.selectedPolicyUnits.map((unit) => unit.id)).toEqual(["twenty-percent-lead-ownership"]);
    expect(result.applicableCriticalRuleIds).toEqual(["lead-ownership-keap-window-boundary"]);
    expect(result.routeRequired).toBe(true);
  });

  it("fails closed when there is no compatible approved unit", () => {
    const result = plan("How do I reset my dashboard password?", null);

    expect(result.selectedPolicyUnits).toEqual([]);
    expect(result.allowedArticleIds).toEqual([]);
    expect(result.applicableCriticalRuleIds).toEqual([]);
    expect(result.fallbackMode).toBe("scope_safe_route");
  });
});
