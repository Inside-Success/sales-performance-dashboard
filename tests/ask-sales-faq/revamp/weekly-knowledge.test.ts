import { describe, expect, it } from "vitest";
import { getRevampKnowledge } from "../../../src/lib/ask-sales-faq/revamp/knowledge";
import { retrieveEvidence } from "../../../src/lib/ask-sales-faq/revamp/retrieval";
import type { Plan } from "../../../src/lib/ask-sales-faq/revamp/types";
const records = getRevampKnowledge();
function retrieve(question: string, scope: Plan["scopes"][number]) {
  return retrieveEvidence(records, question, { intent: "company_question", question, scopes: [scope], queries: [] }).map(r => r.record);
}
describe("September 21 knowledge refresh boundaries", () => {
  it("retires the superseded first-call price exception", () => {
    expect(records.some(r => r.id === "owner-call1-pricing-complete-boundary")).toBe(false);
    expect(records.some(r => r.id === "claim_bc6feb1c60e8c90d__a1")).toBe(false);
    expect(retrieve("Can I mention the price on Call 1 if they have no business and no money?", "main_istv").some(r => r.id === "call1-no-pricing-2026-09-20")).toBe(true);
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
    expect(rows.some(r => r.id === "hubspot-status-cast-score-2026-09-19")).toBe(true);
  });
  it("keeps unresolved package benefits and product payment boundaries intact", () => {
    expect(records.some(r => r.id === "reality-documentary-package-video-2026-09-14")).toBe(true);
    expect(records.some(r => r.id === "current-minimum-first-payment-by-product")).toBe(true);
    expect(retrieve("Can Clean and Thriving accept someone with an old conviction?", "main_istv").some(r => r.id === "background-review-authority-2026-09-18")).toBe(true);
  });
});
