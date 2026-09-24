import { describe, expect, it } from "vitest";
import { getRevampKnowledge } from "../../../src/lib/ask-sales-faq/revamp/knowledge";
import { retrieveEvidence } from "../../../src/lib/ask-sales-faq/revamp/retrieval";
import type { Plan } from "../../../src/lib/ask-sales-faq/revamp/types";

const records = getRevampKnowledge();
function retrieve(question: string, scope: Plan["scopes"][number]) {
  return retrieveEvidence(records, question, { intent: "company_question", question, scopes: [scope], queries: [] }).map(r => r.record);
}
describe("September 24 source context and exceptions", () => {
  it("keeps the Island exception alongside the generic VIP guest allowance", () => {
    for (const question of ["What do I get with reality VIP?", "Can I bring my wife on Entrepreneurs Island?", "How many guests can a reality participant bring?"]) {
      const ids = retrieve(question, "reality").map(r => r.id);
      expect(ids).toContain("reality-island-guest-accommodation-2026-09-23");
    }
  });
  it("retires obsolete cancellation and time-off instructions", () => {
    expect(records.some(r => r.id === "hubspot-status-cast-score-2026-09-19")).toBe(false);
    expect(records.some(r => r.id === "time-off-notification")).toBe(false);
    const rows=retrieve("cancelled call2 vs rescheduled call cast score", "main_istv");
    const rule=rows.find(r=>r.id === "hubspot-status-cast-score-2026-09-24")!;
    expect(rule.text).toContain("skip");
    expect(rule.text).toContain("zero for a cancelled Call 2");
  });
  it("retrieves current texting and Call 2 coaching without importing product entitlements", () => {
    expect(retrieve("Do I still text from Google Voice?", "main_istv").map(r=>r.id)).toContain("hubspot-sms-2026-09-23");
    expect(retrieve("How do I discuss their story and Green Light letter on Call 2?", "main_istv").find(r=>r.id === "call2-greenlight-value-framework-2026-09-24")?.kind).toBe("coaching");
    expect(retrieve("Call2 Green Light documentary benefits", "reality").map(r=>r.id)).not.toContain("call2-greenlight-value-framework-2026-09-24");
  });
});
