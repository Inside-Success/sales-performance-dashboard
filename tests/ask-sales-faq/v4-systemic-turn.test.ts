import { describe, expect, it } from "vitest";

import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";

describe("V4 systemic conversation scope", () => {
  it("carries the nearest explicit product scope through a multi-turn referential chain", () => {
    const turn = resolveV4SystemicTurn("is it networking or is it to learn marketing", [
      { role: "user", content: "For Next Level CEO, what is the Mastermind access?" },
      { role: "assistant", content: "Which part would you like clarified?" },
      { role: "user", content: "what is it and what's included?" },
      { role: "assistant", content: "I can explain the confirmed parts." },
      { role: "user", content: "is it networking or is it to learn marketing" },
    ]);

    expect(turn.productScope).toBe("dj_nlceo");
    expect(turn.excludedScopes).toContain("main_istv");
    expect(turn.standaloneQuestion).toContain("Inherited conversation product scope");
  });

  it("does not leak an old scope into an unrelated new request", () => {
    const turn = resolveV4SystemicTurn("What is the current annual revenue goal?", [
      { role: "user", content: "For Next Level CEO, what is the Mastermind access?" },
      { role: "assistant", content: "Please verify the current event details." },
      { role: "user", content: "What is the current annual revenue goal?" },
    ]);

    expect(turn.kind).toBe("new");
    expect(turn.productScope).toBe("unknown");
  });

  it("resolves a short selection from the assistant's clarification as a policy subject", () => {
    const turn = resolveV4SystemicTurn("ROI", [
      { role: "user", content: "what's the roe" },
      { role: "assistant", content: "Could you specify the context? ROE could refer to Return on Equity, Record of Employment, or another term." },
      { role: "user", content: "ROI" },
    ]);

    expect(turn.kind).toBe("follow_up");
    expect(turn.explicitCorrection).toBe(true);
    expect(turn.standaloneQuestion).toContain("What company policy applies to ROI?");
    expect(turn.standaloneQuestion).not.toContain("Return on Investment");
  });

  it("resolves a typo correction after the deterministic acronym clarification", () => {
    const turn = resolveV4SystemicTurn("ROI", [
      { role: "user", content: "what's the roe" },
      { role: "assistant", content: "What does ROE refer to in this sales context?" },
      { role: "user", content: "ROI" },
    ]);

    expect(turn.kind).toBe("follow_up");
    expect(turn.standaloneQuestion).toContain("What company policy applies to ROI?");
  });
});
