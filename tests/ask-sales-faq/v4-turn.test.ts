import { describe, expect, it } from "vitest";
import { extractV4ActionableQuestion, resolveV4Turn, v4DecisionQuestion } from "@/lib/ask-sales-faq/v4/turn";

describe("Ask Sales V4 substantive-turn extraction", () => {
  it("extracts a real sales question after a conversational preface", () => {
    const question = "Can you help me with another qualification question? Is a franchise owner eligible for Next Level CEO?";
    const result = resolveV4Turn(question, []);

    expect(result.kind).toBe("new");
    expect(result.currentQuestion).toBe(question);
    expect(result.actionableQuestion).toBe("Is a franchise owner eligible for Next Level CEO?");
    expect(v4DecisionQuestion(result)).toBe(result.actionableQuestion);
  });

  it("keeps a genuine topic introduction conversational", () => {
    const question = "Can you help me with another qualification question?";
    const result = resolveV4Turn(question, []);

    expect(result.kind).toBe("topic_intro");
    expect(result.actionableQuestion).toBeNull();
  });

  it("carries an explicit product scope from the preface into the extracted question", () => {
    const question = "For main ISTV, I have a few questions about packages. What does VIP cover?";
    const result = resolveV4Turn(question, []);

    expect(result.productScope).toBe("main_istv");
    expect(result.actionableQuestion).toBe("For main ISTV, What does VIP cover?");
  });

  it("does not discard a factual setup before an actionable question", () => {
    const question = "A lead texted STOP. How do I resubscribe or reinstate the subscriber?";
    const extracted = extractV4ActionableQuestion(question);
    const result = resolveV4Turn(question, []);

    expect(extracted.actionableQuestion).toBeNull();
    expect(v4DecisionQuestion(result)).toBe(question);
  });

  it("does not mistake a factual questions-about clause for conversational framing", () => {
    const question = "The client has questions about being employed by a hospital. Can the physician qualify?";
    const extracted = extractV4ActionableQuestion(question);
    const result = resolveV4Turn(question, []);

    expect(extracted.actionableQuestion).toBeNull();
    expect(result.kind).toBe("new");
    expect(result.standaloneQuestion).toBe(question);
    expect(v4DecisionQuestion(result)).toBe(question);
  });

  it("treats a directional product change as a target and exclusion, not a comparison", () => {
    const question = "Switching to main ISTV from Daymond John. What are the prices?";
    const result = resolveV4Turn(question, []);

    expect(result.kind).toBe("new");
    expect(result.productScope).toBe("main_istv");
    expect(result.excludedScopes).toContain("dj_nlceo");
    expect(result.explicitScopeSwitch).toBe(true);
    expect(result.actionableQuestion).toBe("For main ISTV, not Daymond John / Next Level CEO, What are the prices?");
  });

  it.each([
    "Switching from Daymond John to main ISTV: what is the current price?",
    "Moving from Daymond John to Inside Success TV: what are the offers?",
    "We used Daymond John before, but now this is main ISTV. What is the price?",
  ])("resolves from-source-to-target wording as main ISTV rather than a comparison: %s", (question) => {
    const result = resolveV4Turn(question, []);
    expect(result.productScope).toBe("main_istv");
    expect(result.excludedScopes).toContain("dj_nlceo");
    expect(result.explicitScopeSwitch).toBe(true);
    expect(v4DecisionQuestion(result)).toMatch(/^For main ISTV, not Daymond John \/ Next Level CEO,/);
  });

  it.each([
    "Moving from Daymond John to Inside Success TV: offers?",
    "Moving from Daymond John to Inside Success TV: prices?",
    "Switching from Daymond John to main ISTV: payments?",
  ])("keeps a terse object actionable after a directional product switch: %s", (question) => {
    const result = resolveV4Turn(question, []);
    expect(result.productScope).toBe("main_istv");
    expect(result.excludedScopes).toContain("dj_nlceo");
    expect(result.actionableQuestion).toMatch(/^For main ISTV, not Daymond John \/ Next Level CEO,/);
  });

  it("does not narrow a substantive email-review request to its final sentence", () => {
    const question = "Please help me rewrite this client email about Amazon Prime search issues, the ISTV app, and VIP advantages. How can I write it better?";
    const extracted = extractV4ActionableQuestion(question);
    const result = resolveV4Turn(question, []);

    expect(extracted.actionableQuestion).toBeNull();
    expect(v4DecisionQuestion(result)).toBe(question);
  });

  it("keeps a response-style preference conversational", () => {
    const question = "I have several unrelated sales questions. Can you keep your answers short and practical?";
    const result = resolveV4Turn(question, []);

    expect(result.kind).toBe("topic_intro");
    expect(result.actionableQuestion).toBeNull();
    expect(result.conversationalPreface).toBe(question);
  });

  it("does not discard a substantive question merely because it asks for a short answer", () => {
    const question = "Keep it short: what is included in the $20K main ISTV package?";
    const result = resolveV4Turn(question, []);

    expect(result.kind).toBe("new");
    expect(v4DecisionQuestion(result)).toBe(question);
  });

  it.each([
    "Perfect, thank you!",
    "Thanks, that’s everything for now.",
  ])("classifies a natural closing as social rather than a topic introduction: %s", (question) => {
    const result = resolveV4Turn(question, []);

    expect(result.kind).toBe("social");
    expect(result.actionableQuestion).toBeNull();
  });

  it("preserves the immediate policy subject for an explicit actor correction", () => {
    const previousQuestion = "What should I do if a prospect starts taking photos of the Call 1 presentation slides during the call?";
    const correction = "You misunderstood me—I’m asking what the rep should do, not what the prospect should do.";
    const result = resolveV4Turn(correction, [
      { role: "user", content: previousQuestion },
      { role: "assistant", content: "Ask the prospect to stop and delete any photos already taken." },
    ]);

    expect(result.kind).toBe("follow_up");
    expect(result.explicitCorrection).toBe(true);
    expect(result.usedImmediateContext).toBe(true);
    expect(result.standaloneQuestion).toContain(previousQuestion);
    expect(result.standaloneQuestion).toContain(correction);
  });

  it("keeps an explicit product correction scoped to the new product", () => {
    const correction = "Actually, I meant main ISTV instead. What are the total package prices?";
    const result = resolveV4Turn(correction, [
      { role: "user", content: "What are the Daymond John package prices?" },
      { role: "assistant", content: "Daymond John has separate package pricing." },
    ]);

    expect(result.kind).toBe("follow_up");
    expect(result.explicitCorrection).toBe(true);
    expect(result.explicitScopeSwitch).toBe(true);
    expect(result.productScope).toBe("main_istv");
    expect(result.excludedScopes).toContain("dj_nlceo");
    expect(v4DecisionQuestion(result)).toBe(correction);
  });
});
