import { describe,it,expect } from "vitest";
import { recoveryLabel,answerStatusLabel } from "../../src/lib/ask-sales-faq/admin/diagnostics";
import { parseFilters, issueLabels } from "../../src/lib/ask-sales-faq/admin/filters";
describe("admin response explanations",()=>{
  it("does not confuse clarification, human actions or source gaps with failure",()=>{
    expect(issueLabels({answer_statuses:["clarification","action_route","knowledge_gap"],unanswered:true})).toEqual(["Asked for clarification","Needs a person to act","Source information missing"]);
    expect(answerStatusLabel("answer")).toBeNull();
  });
  it("retains unknown historical responses instead of inventing a cause",()=>{
    expect(issueLabels({unanswered:true})).toEqual(["Could not fully answer"]);
    expect(recoveryLabel(null,true)).toBe("Recovery detail not recorded");
  });
  it("distinguishes successful recovery from retry exhaustion and non-retried failures",()=>{
    expect(recoveryLabel(1,false)).toBe("Recovered after an automatic retry");
    expect(recoveryLabel(1,true)).toBe("Automatic retry used; answer still failed");
    expect(recoveryLabel(0,true)).toBe("No automatic retry used");
  });
  it.each(["knowledge_gap","clarification","action_route","conflict"])("accepts the %s filter",filter=>{
    expect(parseFilters({filter}).filter).toBe(filter);
  });
});
