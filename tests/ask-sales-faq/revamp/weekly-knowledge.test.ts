import { describe, expect, it } from "vitest";
import { getRevampKnowledge } from "../../../src/lib/ask-sales-faq/revamp/knowledge";
import { retrieveEvidence } from "../../../src/lib/ask-sales-faq/revamp/retrieval";
import type { Plan } from "../../../src/lib/ask-sales-faq/revamp/types";
const records = getRevampKnowledge();
function retrieve(question: string, scope: Plan["scopes"][number]) {
  return retrieveEvidence(records, question, { intent: "company_question", question, scopes: [scope], queries: [] }).map(r => r.record);
}
describe("September 21 knowledge refresh boundaries", () => {
  it("replaces fragmented first-call policy while retaining the complete main-offer exception", () => {
    expect(records.some(r => r.id === "owner-call1-pricing-complete-boundary")).toBe(false);
    expect(records.some(r => r.id === "claim_bc6feb1c60e8c90d__a1")).toBe(false);
    expect(retrieve("Can I mention the price on Call 1 if they have no business and no money?", "main_istv").some(r => r.id === "call1-no-pricing-2026-09-20")).toBe(true);
  });
  it("keeps the main pricing exception with the default and out of other products", () => {
    for (const question of ["Can we mention pricing in call1?", "What if I feel the prospect has no money?", "They have no business and cannot afford it. Can I disqualify them on call one?"]) {
      const rows = retrieve(question, "main_istv");
      expect(rows.some(r => r.id === "call1-no-pricing-2026-09-20")).toBe(true);
      expect(rows.some(r => r.id === "main-call1-disqualification-exception-2026-09-21")).toBe(true);
    }
    for (const scope of ["reality", "dj_nlceo"] as const) {
      expect(retrieve("Can I quote price on Call 1 when they have no business and no money?", scope).some(r => r.id === "main-call1-disqualification-exception-2026-09-21")).toBe(false);
    }
  });
  it("retrieves schedules and distinguishes Raul's two training contexts", () => {
    for (const question of ["when does the training for new reps happen?", "trainings that are required when getting hired", "Raul hosts training during those two weeks of onboarding", "When is Mike compliance zoom?"]) {
      const ids = retrieve(question, "main_istv").map(r => r.id);
      expect(ids).toContain("new-rep-six-training-sessions-2026-09-21");
      expect(ids).toContain("new-rep-first-two-weeks-qa-2026-09-21");
      expect(ids).not.toContain("operational_7eb701b3cc2f4e99");
    }
  });
  it("retrieves meeting outcome qualifications and practical training access", () => {
    expect(retrieve("Does a cancelled call or no show need a cast score?", "main_istv").some(r => r.id === "hubspot-status-cast-score-2026-09-24")).toBe(true);
    expect(retrieve("How do I book my final mock and go live?", "main_istv").some(r => r.id === "new-rep-training-roadmap-and-mock-2026-09-21")).toBe(true);
    expect(records.some(r => r.id === "current-regular-onboarding-schedule")).toBe(true);
  });
  it("retrieves the new welcome and cohort decisions for natural questions", () => {
    expect(retrieve("Just sold a reality package. What welcome email and onboarding do I send?", "reality").some(r => r.id === "reality-buyer-welcome-2026-09-21")).toBe(true);
    expect(retrieve("Do reality buyers have to pay before the cohort closes?", "reality").some(r => r.id === "reality-no-cohort-2026-09-18")).toBe(true);
    expect(records.some(r => r.id === "reality-current-open-questions")).toBe(false);
  });
  it("does not mix reality onboarding into regular onboarding", () => {
    const rows = retrieve("What are the regular documentary onboarding hours?", "main_istv");
    expect(rows.some(r => r.id === "current-regular-onboarding-schedule")).toBe(true);
    expect(rows.some(r => r.id === "reality-buyer-welcome-2026-09-21")).toBe(false);
  });
  it("retrieves current passoff and meeting requirements together", () => {
    const rows = retrieve("I took a passoff but can't change the HubSpot meeting status or cast score", "main_istv");
    expect(rows.some(r => r.id === "hubspot-passoff-claim-2026-09-19")).toBe(true);
    expect(rows.some(r => r.id === "hubspot-status-cast-score-2026-09-24")).toBe(true);
  });
  it("keeps unresolved package benefits and product payment boundaries intact", () => {
    expect(records.some(r => r.id === "reality-documentary-package-video-2026-09-14")).toBe(true);
    expect(records.some(r => r.id === "current-minimum-first-payment-by-product")).toBe(true);
    expect(retrieve("Can Clean and Thriving accept someone with an old conviction?", "main_istv").some(r => r.id === "background-review-authority-2026-09-18")).toBe(true);
  });
});
