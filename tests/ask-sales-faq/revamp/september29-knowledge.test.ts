import { describe, expect, it } from "vitest";
import { getRevampKnowledge } from "../../../src/lib/ask-sales-faq/revamp/knowledge";
import { retrieveEvidence } from "../../../src/lib/ask-sales-faq/revamp/retrieval";
import type { Plan } from "../../../src/lib/ask-sales-faq/revamp/types";

const records = getRevampKnowledge();
const ids = (question: string, scope: Plan["scopes"][number]) => retrieveEvidence(records, question, {
  intent: "company_question", question, scopes: [scope], queries: [],
}).map(r => r.record.id);

describe("September 29 knowledge refresh", () => {
  it("retrieves current Island guest guidance through the generic package relationship", () => {
    expect(ids("What does reality VIP include?", "reality")).toContain("reality-guests-and-accommodation-2026-10-03");
    expect(records.some(r => r.id === "reality-island-guest-accommodation-2026-09-23")).toBe(false);
    for (const id of ["reality-faq-3", "reality-faq-13"]) {
      expect(records.find(r => r.id === id)?.text).not.toContain("permits NO plus-one");
    }
  });
  it("keeps the season being sold with the older January planning window", () => {
    expect(ids("When does Entrepreneurs Island film?", "reality")).toContain("reality-season-schedule-2026-10-03");
    expect(ids("Is Business Race UK available?", "reality")).toContain("reality-expansion-plans-2026-09-29");
    expect(records.some(r => r.id === "reality-expansion-plans-2026-09-24")).toBe(false);
  });
  it("retrieves concrete SMS help and replacement rescheduled UI guidance", () => {
    expect(ids("Where can I see all HubSpot texts together?", "main_istv")).toContain("hubspot-shortcuts-sms-2026-09-29");
    expect(ids("How do I score a rescheduled call?", "main_istv")).toContain("hubspot-status-cast-score-2026-10-01");
    expect(records.some(r => r.id === "hubspot-status-cast-score-2026-09-24")).toBe(false);
  });
  it("keeps product-specific payment rules within their scopes", () => {
    expect(ids("Previous Daymond client wants reality for half price", "reality")).toContain("reality-no-returning-client-discount-2026-09-29");
    expect(ids("Can I split the reality deposit?", "reality")).not.toContain("regular-deposit-no-split-across-days-2026-09-29");
    expect(ids("Which reality video do I show on call one now?", "reality")).toContain("reality-call1-video-2026-10-03");
  });
});
