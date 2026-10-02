import { describe, expect, it } from "vitest";
import { getRevampKnowledge } from "../../../src/lib/ask-sales-faq/revamp/knowledge";
import { retrieveEvidence } from "../../../src/lib/ask-sales-faq/revamp/retrieval";
import type { Plan } from "../../../src/lib/ask-sales-faq/revamp/types";

const records = getRevampKnowledge();
const retrieve = (question: string, scope: Plan["scopes"][number]) => retrieveEvidence(records, question, {
  intent: "company_question", question, scopes: [scope], queries: [],
}).map(r => r.record);

describe("October 1 knowledge refresh", () => {
  it("retrieves anniversary prices with eligibility and complete benefits", () => {
    const rows = retrieve("What are our current Lite and Standard prices and benefits?", "main_istv");
    expect(rows.map(r => r.id)).toContain("main-anniversary-prices-2026-10-01");
    expect(rows.map(r => r.id)).toContain("main-standard-complete-deliverables");
    expect(records.some(r => r.id === "v514src-current-istv-prices-and-plans")).toBe(false);
    const price = rows.find(r => r.id === "main-anniversary-prices-2026-10-01")!;
    expect(price.text).toContain("NOT currently previous cast members");
    expect(price.text).toContain("No verified expiry date");
    expect(retrieve("What are current reality prices?", "reality").some(r => r.id === price.id)).toBe(false);
  });
  it("keeps current first installments together with the selected offer", () => {
    const rows = retrieve("What is the minimum first payment for Lite?", "main_istv");
    expect(rows.map(r => r.id)).toContain("current-minimum-first-payment-by-product-2026-10-01");
    expect(rows.map(r => r.id)).toContain("main-anniversary-prices-2026-10-01");
    expect(records.some(r => r.id === "current-minimum-first-payment-by-product-2026-09-29")).toBe(false);
  });
  it("retrieves revised training and retires the old six-session schedule", () => {
    const rows = retrieve("When is Mike Wednesday call two training?", "main_istv");
    expect(rows.map(r => r.id)).toContain("new-rep-training-sessions-2026-10-01");
    expect(records.some(r => r.id === "new-rep-six-training-sessions-2026-09-21")).toBe(false);
    expect(rows.find(r => r.id === "new-rep-training-sessions-2026-10-01")?.text).toContain("COMBINED Call 2 Sales Training and Procedural Training with Raul");
  });
  it("carries show-status changes with generic catalog and season questions", () => {
    expect(retrieve("What reality shows do we offer?", "reality").map(r => r.id)).toContain("reality-catalog-status-2026-10-03");
    expect(retrieve("Is Island season one still closed?", "reality").map(r => r.id)).toContain("reality-season-schedule-2026-10-03");
    expect(records.some(r => r.id === "reality-season-schedule-2026-09-29")).toBe(false);
  });
  it("keeps documentary payment-plan filming separate from reality onboarding", () => {
    expect(retrieve("Can I book filming before paying every installment?", "main_istv").map(r => r.id)).toContain("regular-filming-booking-2026-10-01");
    expect(retrieve("How do reality buyers book filming?", "reality").map(r => r.id)).not.toContain("regular-filming-booking-2026-10-01");
    expect(retrieve("What do I send after a reality sale?", "reality").map(r => r.id)).toContain("reality-buyer-welcome-2026-10-01");
  });
});
