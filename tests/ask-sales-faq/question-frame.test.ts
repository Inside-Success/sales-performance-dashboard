import { describe, expect, it } from "vitest";
import {
  buildQuestionFrame,
  classifyRewriteIntent,
  type QuestionFrameMessage,
} from "@/lib/ask-sales-faq/question-frame";

const paymentQuestion =
  "Just got off a good Call 2. Funds are unavailable until August 15 and the payment is holding them back. Can they continue later?";

describe("buildQuestionFrame", () => {
  it("treats an explicitly negated DJ mention as an exclusion, not a positive scope", () => {
    const frame = buildQuestionFrame(`${paymentQuestion} This is for main ISTV, not for any DJ show.`);

    expect(frame.scope).toBe("main_istv");
    expect(frame.includedScopes).toEqual(["main_istv"]);
    expect(frame.excludedScopes).toEqual(["dj_nlceo"]);
    expect(frame.relation).toBe("new");
  });

  it("preserves both canonical scopes for a product comparison", () => {
    const frame = buildQuestionFrame("Compare the payment timing rules for main ISTV versus Next Level CEO.");

    expect(frame.scope).toBe("comparison");
    expect(frame.includedScopes).toEqual(["main_istv", "dj_nlceo"]);
    expect(frame.excludedScopes).toEqual([]);
  });

  it("rehydrates a scope correction from the last substantive user question", () => {
    const messages: QuestionFrameMessage[] = [
      { role: "user", content: paymentQuestion },
      { role: "assistant", content: "First confirm whether this is main ISTV or DJ/NLCEO." },
    ];

    const frame = buildQuestionFrame("What if my previous question was for main ISTV?", messages);

    expect(frame.relation).toBe("context_follow_up");
    expect(frame.isScopeCorrection).toBe(true);
    expect(frame.scope).toBe("main_istv");
    expect(frame.scopeSource).toBe("current");
    expect(frame.rehydratedFromUserQuestion).toBe(paymentQuestion);
    expect(frame.effectiveQuestion).toContain(paymentQuestion);
    expect(frame.effectiveQuestion).toContain("What if my previous question was for main ISTV?");
  });

  it("skips an earlier scope-only correction when the user repeats the correction", () => {
    const messages: QuestionFrameMessage[] = [
      { role: "user", content: paymentQuestion },
      { role: "assistant", content: "Which product is this for?" },
      { role: "user", content: "This is for main ISTV." },
      { role: "assistant", content: "Please repeat the full question." },
    ];

    const frame = buildQuestionFrame("I already told you this is for main ISTV.", messages);

    expect(frame.relation).toBe("context_follow_up");
    expect(frame.isScopeCorrection).toBe(true);
    expect(frame.scope).toBe("main_istv");
    expect(frame.previousSubstantiveUserQuestion).toBe(paymentQuestion);
    expect(frame.rehydratedFromUserQuestion).toBe(paymentQuestion);
    expect(frame.effectiveQuestion).not.toContain("Please repeat the full question.");
  });

  it("never rehydrates a scope statement from prior assistant content", () => {
    const messages: QuestionFrameMessage[] = [
      { role: "assistant", content: paymentQuestion },
      { role: "assistant", content: "The prior product may have been DJ/NLCEO." },
    ];

    const frame = buildQuestionFrame("This is for main ISTV.", messages);

    expect(frame.relation).toBe("new");
    expect(frame.isScopeCorrection).toBe(false);
    expect(frame.scope).toBe("main_istv");
    expect(frame.previousSubstantiveUserQuestion).toBeNull();
    expect(frame.rehydratedFromUserQuestion).toBeNull();
    expect(frame.effectiveQuestion).toBe("This is for main ISTV.");
  });

  it("returns unknown when no product scope is stated or available", () => {
    const frame = buildQuestionFrame("Can I send the contract before Call 2?");

    expect(frame.scope).toBe("unknown");
    expect(frame.includedScopes).toEqual([]);
    expect(frame.excludedScopes).toEqual([]);
    expect(frame.scopeSource).toBe("none");
    expect(frame.relation).toBe("new");
  });

  it("classifies social and rewrite turns without treating them as new policy questions", () => {
    const messages: QuestionFrameMessage[] = [{ role: "user", content: paymentQuestion }];

    expect(buildQuestionFrame("Thank you!", messages).relation).toBe("social");
    expect(buildQuestionFrame("Can you make that answer shorter?", messages).relation).toBe("rewrite");
    expect(buildQuestionFrame("Format these properly as bullets.", messages).relation).toBe("rewrite");
    expect(classifyRewriteIntent("Format these properly as bullets.")).toBe("format_list");
  });

  it("classifies greetings and conversational introductions as social without swallowing a real question", () => {
    expect(buildQuestionFrame("Hey there!").relation).toBe("social");
    expect(buildQuestionFrame("Hi, I'll be asking a few sales questions today.").relation).toBe("social");
    expect(buildQuestionFrame("Hi! I’m checking a few sales questions today.").relation).toBe("social");
    expect(buildQuestionFrame("Hey there! Hope you’re doing well—can you help me with a few qualification questions?").relation).toBe("social");
    expect(buildQuestionFrame("Thanks. I’m switching to payments, contracts, and content rights now.").relation).toBe("social");
    expect(buildQuestionFrame("Appreciate it. Next I have questions about calls, greenlights, and recordings.").relation).toBe("social");
    expect(buildQuestionFrame("Last section—I have questions about production, resources, and events.").relation).toBe("social");
    expect(buildQuestionFrame("I have several unrelated sales questions. Can you keep your answers short and practical?").relation).toBe("social");
    expect(buildQuestionFrame("Hi, can I send the payment link by text?").relation).toBe("new");
  });

  it("treats a self-contained request for a formatted list as a new question", () => {
    const frame = buildQuestionFrame("Give me the list of shows properly formatted.");
    expect(frame.relation).toBe("new");
  });

  it("keeps a new list question independent even when an older question exists", () => {
    const messages: QuestionFrameMessage[] = [
      { role: "user", content: "Can a hospital-employed doctor qualify?" },
      { role: "assistant", content: "Yes. Hospital employment alone does not disqualify a doctor." },
    ];
    const frame = buildQuestionFrame("List the main ISTV payment plans.", messages);

    expect(frame.relation).toBe("new");
    expect(classifyRewriteIntent("List the main ISTV payment plans.")).toBeNull();
  });

  it("does not treat a new named prospect as a follow-up just because the sentence uses their", () => {
    const messages: QuestionFrameMessage[] = [
      { role: "user", content: "Would a registered nurse qualify as a doctor for America's Best Doctors?" },
      { role: "assistant", content: "No. A registered nurse does not qualify as a doctor for that show." },
    ];

    const frame = buildQuestionFrame("A prospect wants their entire episode filmed in Spanish. Can we offer that?", messages);

    expect(frame.relation).toBe("new");
    expect(frame.previousSubstantiveUserQuestion).toContain("registered nurse");
    expect(frame.rehydratedFromUserQuestion).toBeNull();
    expect(frame.effectiveQuestion).toBe("A prospect wants their entire episode filmed in Spanish. Can we offer that?");
  });

  it("still recognizes a genuinely dependent short pronoun follow-up", () => {
    const messages: QuestionFrameMessage[] = [
      { role: "user", content: "Can a hospital-employed doctor qualify?" },
      { role: "assistant", content: "Yes, hospital employment alone does not disqualify a doctor." },
    ];

    expect(buildQuestionFrame("Can they qualify without owning the practice?", messages).relation).toBe("context_follow_up");
  });
});
