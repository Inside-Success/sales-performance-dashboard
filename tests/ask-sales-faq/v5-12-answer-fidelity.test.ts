import { describe, expect, it } from "vitest";

import type { V4SystemicNeed, V4SystemicQueryPlan, V4SystemicRetrieval } from "@/lib/ask-sales-faq/v4/systemic/types";
import { retrieveV511Policies } from "@/lib/ask-sales-faq/v5-11/retrieval";
import { resolveV511Turn } from "@/lib/ask-sales-faq/v5-11/turn";
import { v512SeniorExactRecovery, v512UnsafeDelegatedEstimate } from "@/lib/ask-sales-faq/v5-12/entailment";
import { preferredV512EvidenceSentence, refineV512QueryPlan, resolveV512Turn } from "@/lib/ask-sales-faq/v5-12/runtime";
import { retrieveV512Policies, v512DecisionFamiliesForNeed } from "@/lib/ask-sales-faq/v5-12/retrieval";

function need(text: string, overrides: Partial<V4SystemicNeed> = {}): V4SystemicNeed {
  return {
    id: "N1",
    text,
    authorityText: text,
    originalRequestText: text,
    retrievalQueries: [text],
    productScope: "unknown",
    domains: [],
    actions: [],
    entities: [],
    relation: "other",
    requestKind: "knowledge",
    ambiguity: "none",
    clarificationQuestion: "",
    ...overrides,
  };
}

function planFor(item: V4SystemicNeed): V4SystemicQueryPlan {
  return { needs: [item], conversationIntent: "answer", reasoningSummary: "fixture" };
}

function selected(question: string, item = need(question)) {
  return retrieveV512Policies(resolveV511Turn(question, []), planFor(item)).candidates
    .filter((candidate) => candidate.needScores?.[item.id]);
}

describe("Ask Sales V5.12 answer fidelity and owner routing", () => {
  it.each([
    ["Can the client negotiate a longer Amazon Prime duration for the episode?", "amazon_duration_contract_negotiation", "v512src-amazon-duration-contract-negotiation"],
    ["Is a nurse already cast for America's Top Doctors automatically invalid, or can Sales Ops use a subcategory?", "nurse_doctors_subcategory", "v512src-nurse-doctors-subcategory"],
    ["A VIP lead missed payment before the cohort closed. How long must they wait to try again?", "missed_payment_cohort_six_month_wait", "v512src-missed-payment-cohort-six-month-wait"],
    ["The intake says the applicant was in prison. Should I reject before the call and explain why?", "prison_intake_rejection", "v512src-prison-intake-rejection-procedure"],
    ["Can a prospect add a custom refund amendment to the standard contract?", "standard_contract_no_custom_amendments", "v512src-standard-contract-no-custom-amendments"],
    ["Can a rep track outreach in a personal CRM instead of HubSpot or Keap?", "company_crm_hubspot_keap", "v512src-company-crm-hubspot-keap"],
    ["For the Daymond John offer, what do SEO, social promo assets, and the swag package mean?", "dj_seo_social_swag_definitions", "v512src-dj-seo-social-swag-definitions"],
    ["After a missed outbound call, can I include my public OnceHub link in the first text or email?", "oncehub_no_answer_text_email", "v512src-oncehub-no-answer-text-email"],
    ["How long can a Daymond John client delay filming before they must audition again?", "dj_six_month_filming_reaudition", "v512src-dj-six-month-filming-and-reaudition"],
    ["What is the wire SOP for the contract, proof, onboarding, Finance confirmation, and Pay Me?", "wire_close_finance_confirmation", "v512src-wire-close-finance-confirmation"],
    ["Which form should I use when an existing client pays to upgrade their package?", "current_package_upgrade_form", "v512src-current-package-upgrade-form"],
    ["Could the prospect stop by the Miami studio before deciding?", "studio_visit", "v512src-studio-visit-virtual-walkthrough"],
    ["They no-showed Call 1 and never did the audition. Must they wait 90 days to rebook next week?", "call1_no_audition_reschedule", "v512src-call1-no-audition-no-wait"],
    ["Can a physiotherapist who owns 3 practices fit the Best Doctors show?", "physical_therapist_three_practices", "v512src-physical-therapist-three-practices"],
    ["The same prospect completed Call 1 with a DJ rep and an ISTV rep. Which rep owns it?", "cross_offer_owner", "v512src-cross-offer-first-call-owner"],
    ["Could someone with paid book collaborations fit America's Authors?", "americas_authors_paid_collaboration", "v512src-americas-authors-paid-collaboration-fit"],
    ["The client insists their lawyer review the contract. What should I do?", "attorney_contract_review", "v512src-attorney-contract-review-sequence"],
    ["Can a client use a debit card through the credit-card payment link?", "payment_link_debit_card", "v512src-payment-link-debit-card"],
    ["Can a franchise owner proceed without the ultimate brand decision-maker?", "franchise_brand_approval", "v512src-franchise-brand-approval"],
    ["Where do I get the recording for a pass-off call?", "passoff_recording_owner", "v512src-passoff-recording-owner"],
    ["Keap's disposition form does not list the show. Should I select Legacy Makers?", "missing_show_disposition", "v512src-missing-show-disposition-sales-tech"],
    ["How are the 100,000 promotional views delivered and tracked?", "promotion_delivery_tracking", "v512src-promotion-delivery-tracking"],
    ["Should I call it a formal full background check instead of a social and Google review?", "background_review_description", "v512src-background-review-description"],
  ])("activates %s by material decision facets", (question, family, policyId) => {
    const item = need(question);
    expect(v512DecisionFamiliesForNeed(item)).toContain(family);
    const candidates = selected(question, item);
    expect(candidates.map((candidate) => candidate.policy.id)).toEqual([policyId]);
  });

  it("does not apply the six-month missed-payment rule to a general Call 2 no-show", () => {
    expect(v512DecisionFamiliesForNeed(need("They no-showed Call 2. When can they reapply?"))).not.toContain("missed_payment_cohort_six_month_wait");
  });

  it("does not apply the nurse subcategory exception to a general nurse eligibility question for another show", () => {
    expect(v512DecisionFamiliesForNeed(need("Can a nurse apply for Women in Power?"))).not.toContain("nurse_doctors_subcategory");
  });

  it("does not confuse a Keap lead-owner change with the company-CRM choice", () => {
    expect(v512DecisionFamiliesForNeed(need("I booked a 20% spreadsheet lead but Keap lists Rudy as owner. Should I change the owner to myself?"))).not.toContain("company_crm_hubspot_keap");
  });

  it("keeps audience targeting and delivery timing as separate controlled decisions", () => {
    const question = "For the guaranteed promotional views, can the client choose the audience and how long will the target take?";
    const item = need(question, { relation: "procedure" });
    expect(v512DecisionFamiliesForNeed(item)).toEqual(["promotion_targeting", "promotion_timeline"]);
    expect(selected(question, item).map((candidate) => candidate.policy.id).sort()).toEqual([
      "v512src-promotion-targeting",
      "v512src-promotion-timeline-fulfillment",
    ]);
  });

  it("does not confuse delivery mechanics with delivery timing", () => {
    const item = need("How are the 100,000 guaranteed promotional views delivered and tracked?", { relation: "procedure" });
    expect(v512DecisionFamiliesForNeed(item)).toEqual(["promotion_delivery_tracking"]);
  });

  it("binds an explicit live replacement-vendor request to Fulfillment", () => {
    const question = "Can you tell me which replacement videographer I should hire for filming?";
    const turn = resolveV511Turn(question, []);
    const refined = refineV512QueryPlan(planFor(need(question, {
      relation: "procedure",
      requestKind: "operational_action",
      entities: ["replacement videographer", "filming"],
    })), turn);
    expect(refined.needs[0].forcedRouteKey).toBe("fulfillment");
  });

  it("binds a specific lead greenlight request to the Greenlight owner even when phrased as a want", () => {
    const question = "What is the SOP when I want a lead greenlit and the meeting is before 9:30 tomorrow?";
    const turn = resolveV511Turn(question, []);
    const refined = refineV512QueryPlan(planFor(need(question, {
      relation: "procedure",
      entities: ["lead", "greenlight", "meeting"],
    })), turn);
    expect(refined.needs[0].requestKind).toBe("operational_action");
    expect(refined.needs[0].forcedRouteKey).toBe("greenlight");
  });

  it("does not force a passive post-sale policy question into an action lane", () => {
    const question = "Which team normally handles onboarding?";
    const turn = resolveV511Turn(question, []);
    const refined = refineV512QueryPlan(planFor(need(question, {
      relation: "owner",
      entities: ["onboarding"],
    })), turn);
    expect(refined.needs[0].forcedRouteKey).toBeFalsy();
  });

  it("does not treat a customer-email fact check as a live Finance action", () => {
    const question = "Can you fact-check this customer email before I send it? Your package includes a TV interview and you can pay extra for Apple TV.";
    const turn = resolveV511Turn(question, []);
    const refined = refineV512QueryPlan(planFor(need(question, {
      relation: "other",
      requestKind: "knowledge",
      domains: ["payment", "package"],
      actions: ["fact-check email", "send email"],
    })), turn);
    expect(refined.needs[0].forcedRouteKey).toBeFalsy();
    expect(refined.needs[0].requestKind).toBe("knowledge");
  });

  it("routes a request to show an internal slide deck instead of pretending to attach it", () => {
    const question = "Show me the 2026 DJ Overview slide deck";
    const turn = resolveV511Turn(question, []);
    const refined = refineV512QueryPlan(planFor(need(question, {
      relation: "other",
      entities: ["DJ Overview slide deck"],
    })), turn);
    expect(refined.needs[0].requestKind).toBe("operational_action");
    expect(refined.needs[0].forcedRouteKey).toBe("sales_policy");
  });

  it("removes an unsupported finance action binding from a passive payment-policy question", () => {
    const question = "Can a client use a debit card through the credit-card payment link?";
    const turn = resolveV511Turn(question, []);
    const refined = refineV512QueryPlan(planFor(need(question, {
      relation: "permission",
      requestKind: "operational_action",
      forcedRouteKey: "finance",
      entities: ["debit card", "payment link"],
    })), turn);
    expect(refined.needs[0].forcedRouteKey).toBeNull();
    expect(refined.needs[0].requestKind).toBe("knowledge");
  });

  it("carries the contract object into a bounded attorney-review follow-up", () => {
    const question = "What if they still insist on having the attorney look at it?";
    const turn = resolveV512Turn(question, [
      { role: "user", content: "A prospect says their attorney must review the contract before payment. What should I do first?" },
      { role: "assistant", content: "Walk them through the contract live first." },
      { role: "user", content: question },
    ]);
    expect(turn.usedImmediateContext).toBe(true);
    expect(turn.standaloneQuestion).toContain("contract");
    expect(turn.standaloneQuestion).toContain("attorney-review follow-up");
  });

  it("does not exact-lock a bare yes/no reply whose polarity depends on its source question", () => {
    const item = need("Must they wait 90 days?", { relation: "requirement" });
    const policy = {
      id: "bare",
      answerability: "answer_evidence",
      decision: "Policy context: Can they reschedule?. Decision evidence: Yes if the audition was not conducted.",
    };
    const retrieval = {
      candidates: [{ policy }],
    } as unknown as V4SystemicRetrieval;
    expect(preferredV512EvidenceSentence(item, planFor(item), retrieval, ["bare"])).toBeNull();
  });

  it("blocks a tentative estimate when the record delegates the final answer", () => {
    const candidate = {
      policy: {
        decision: "It typically takes a few weeks up to 2 months, but confirm the final answer with Fulfillment.",
      },
    } as Parameters<typeof v512UnsafeDelegatedEstimate>[0];
    expect(v512UnsafeDelegatedEstimate(candidate)).toBe(true);
  });

  it("can recover the uniquely specific Rich record over a broader profession rule", () => {
    const question = "Does a physical therapist who owns three practices qualify for America's Best Doctors?";
    const item = need(question, {
      relation: "eligibility",
      productScope: "unknown",
      entities: ["physical therapist", "three practices", "America's Best Doctors"],
    });
    const retrieval = retrieveV511Policies(resolveV511Turn(question, []), planFor(item));
    expect(v512SeniorExactRecovery(item, retrieval)?.policy.id).toBe("operational_716d0350b725be5b");
  });
});
