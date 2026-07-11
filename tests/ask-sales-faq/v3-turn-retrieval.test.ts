import { describe, expect, it } from "vitest";
import { getV3Registry, retrieveV3Policies } from "@/lib/ask-sales-faq/v3/retrieval";
import { resolveV3Turn } from "@/lib/ask-sales-faq/v3/turn-resolver";

describe("Ask Sales FAQ V3 turn resolution", () => {
  it("prefers an explicit approved channel over negated neighboring route words", () => {
    const policy = getV3Registry().policies.find(({ id }) => id === "claim_0c6e9ed6b0bf5d04");
    expect(policy?.route_key).toBe("sales_policy");
    expect(policy?.route_channel).toBe("#sales-questions-requests");
  });

  it("uses the immediate previous question for a follow-up", () => {
    const messages = [
      { role: "user" as const, content: "What are the recurring payment rules?" },
      { role: "assistant" as const, content: "Finance follows up first." },
      { role: "user" as const, content: "What are the contract rules?" },
      { role: "assistant" as const, content: "Use the standard contract without edits." },
    ];
    const turn = resolveV3Turn("Can you explain that more simply?", messages);

    expect(turn.kind).toBe("follow_up");
    expect(turn.immediatePreviousUserQuestion).toBe("What are the contract rules?");
    expect(turn.standaloneQuestion).toContain("What are the contract rules?");
    expect(turn.standaloneQuestion).not.toContain("recurring payment");
  });

  it("treats a confirmed-only short request as a rewrite of the immediate answer", () => {
    const turn = resolveV3Turn("Please explain only what is confirmed and keep it short.", [
      { role: "user", content: "Why is there a commercial reuse license, and what happens if someone declines it?" },
      { role: "assistant", content: "The license covers approved reuse. The decline scenario is unresolved." },
    ]);
    expect(turn.kind).toBe("rewrite");
    expect(turn.usedImmediateContext).toBe(true);
    expect(turn.immediatePreviousAssistantAnswer).toContain("decline scenario");
  });

  it("answers previous-question memory from the immediate user turn", () => {
    const turn = resolveV3Turn("What was my previous question?", [
      { role: "user", content: "Can I send a payment link by text?" },
      { role: "assistant", content: "Use email." },
    ]);
    expect(turn.kind).toBe("memory");
    expect(turn.memoryAnswer).toContain("Can I send a payment link by text?");
  });

  it("treats meta greetings and topic transitions as conversation rather than policy retrieval", () => {
    expect(resolveV3Turn("Hey there! Hope you’re doing well—can you help me with a few qualification questions?", []).kind).toBe("social");
    expect(resolveV3Turn("Thanks. I’m switching to payments and contracts now.", []).kind).toBe("social");
    expect(resolveV3Turn("Perfect, thank you!", []).kind).toBe("social");
    expect(resolveV3Turn("Appreciate it. Now I have some questions about calls and compliance.", []).kind).toBe("social");
    expect(resolveV3Turn("Hi, can you help me with another sales question?", []).kind).toBe("social");
    expect(resolveV3Turn("Could you help me with a sales question?", []).kind).toBe("social");
    expect(resolveV3Turn("Can you help me with an ACH payment that is still pending?", []).kind).toBe("new");
  });

  it("treats explicit corrections and presentation requests as immediate-context turns", () => {
    const messages = [
      { role: "user" as const, content: "What should the prospect do if they photograph the slides?" },
      { role: "assistant" as const, content: "They should stop taking photos." },
    ];
    const correction = resolveV3Turn("You misunderstood me—I’m asking what the rep should do, not the prospect.", messages);
    const rewrite = resolveV3Turn("Can you give me that answer without repeating the route note?", messages);
    expect(correction.kind).toBe("follow_up");
    expect(correction.explicitCorrection).toBe(true);
    expect(correction.standaloneQuestion).toContain("Immediate prior subject");
    expect(rewrite.kind).toBe("rewrite");
  });

  it("handles a request for missing details as a clarification turn", () => {
    const turn = resolveV3Turn("I’m not sure which show this applies to. What information do you need from me?", [
      { role: "user", content: "A business partner is paying for the cast member. How should I handle it?" },
      { role: "assistant", content: "I need one detail before I can answer." },
    ]);
    expect(turn.kind).toBe("clarification");
    expect(turn.immediatePreviousUserQuestion).toContain("business partner");
  });

  it("honors explicit main ISTV scope and DJ negation before retrieval", () => {
    const turn = resolveV3Turn(
      "Can a main ISTV client hold the payment until Call 2? This is not a DJ or NLCEO show.",
      [],
    );
    const retrieval = retrieveV3Policies(turn);

    expect(turn.productScope).toBe("main_istv");
    expect(turn.excludedScopes).toContain("dj_nlceo");
    expect(
      retrieval.candidates.some(
        ({ policy }) => policy.product_scopes.includes("dj_nlceo") && !policy.product_scopes.includes("main_istv"),
      ),
    ).toBe(false);
  });

  it("retrieves semantically related policy cards without an exact test-question match", () => {
    const turn = resolveV3Turn("The applicant works as a physician for a medical center and has no private clinic. Are they eligible?", []);
    const retrieval = retrieveV3Policies(turn);
    const combined = retrieval.candidates.map(({ policy }) => `${policy.title} ${policy.decision}`).join(" ").toLowerCase();

    expect(combined).toMatch(/doctor|physician|hospital|practice/);
  });

  it("does not borrow a neighboring show's two-business policy when a show is named", () => {
    const turn = resolveV3Turn(
      "For Operation CEO, can an applicant with two businesses mention both in one episode?",
      [],
    );
    const retrieval = retrieveV3Policies(turn);
    expect(retrieval.candidates.length).toBeGreaterThan(0);
    expect(retrieval.candidates.some(({ policy }) => policy.policy_key === "power-couples-second-episode-discount")).toBe(false);
  });

  it("keeps a generic canonical policy available when the named show is only in the question", () => {
    const turn = resolveV3Turn("Can an author with a real book but no company qualify for America’s Authors?", []);
    const retrieval = retrieveV3Policies(turn);
    expect(retrieval.candidates.some(({ policy }) => policy.id === "owner-authors-legitimate-book-business-fit")).toBe(true);
  });

  it("keeps a directly matching generic franchise policy above named-product pricing noise", () => {
    const turn = resolveV3Turn("Is a franchise owner eligible for Next Level CEO?", []);
    const retrieval = retrieveV3Policies(turn);
    expect(retrieval.candidates.some(({ policy }) => policy.id === "claim_c068cf9ac8f5d089")).toBe(true);
  });

  it("rehydrates a main-ISTV correction without requiring the negated DJ entity", () => {
    const messages = [
      { role: "user" as const, content: "How do I verify that a Next Level CEO contract has been signed?" },
      { role: "assistant" as const, content: "Use the DJ contract channel." },
    ];
    const turn = resolveV3Turn("Actually, my previous question was about main ISTV, not Next Level CEO. Does that change your answer?", messages);
    const retrieval = retrieveV3Policies(turn);
    expect(turn.productScope).toBe("main_istv");
    expect(retrieval.candidates.some(({ policy }) => policy.domains.includes("contracts"))).toBe(true);
    expect(retrieval.candidates.some(({ policy }) => policy.product_scopes.includes("dj_nlceo") && !policy.product_scopes.includes("main_istv"))).toBe(false);
  });

  it("treats complete interrogative questions as new turns even when a chat has prior context", () => {
    const messages = [
      { role: "user" as const, content: "Does a real-estate agent need brokerage approval?" },
      { role: "assistant" as const, content: "Confirm the brokerage requirement." },
    ];
    const questions = [
      "Why is there a commercial reuse license?",
      "When Call 1 happens on a Friday, should Call 2 happen before Sunday?",
      "Where can I find a client’s show name if it is missing from Keap?",
      "How do I verify that a Next Level CEO contract has been signed?",
      "Should freelancers move to Call 2, or do they need an established business?",
      "Can I cancel an audition for a recently disqualified applicant?",
    ];
    for (const question of questions) {
      const turn = resolveV3Turn(question, messages);
      expect(turn.kind, question).toBe("new");
      expect(turn.usedImmediateContext, question).toBe(false);
    }
  });

  it("uses prior policy context for a genuinely elliptical follow-up without injecting the prior answer into retrieval", () => {
    const messages = [
      { role: "user" as const, content: "Should freelancers move to Call 2, or do they need an established business?" },
      { role: "assistant" as const, content: "A long unrelated answer that must not enter the retrieval query." },
    ];
    const turn = resolveV3Turn("Can you explain that more simply?", messages);
    const retrieval = retrieveV3Policies(turn);
    expect(turn.kind).toBe("follow_up");
    expect(turn.standaloneQuestion).toContain("Should freelancers move to Call 2");
    expect(turn.standaloneQuestion).not.toContain("long unrelated answer");
    expect(retrieval.query).not.toContain("long unrelated answer");
    expect(retrieval.candidates.some(({ policy }) => policy.id === "claim_59be9c344b9359a4")).toBe(true);
  });

  it("retrieves the approved freelancer policy for a standalone question after unrelated context", () => {
    const turn = resolveV3Turn("Should freelancers move to Call 2, or do they need an established business to qualify?", [
      { role: "user", content: "Does an agent need brokerage approval?" },
      { role: "assistant", content: "Confirm it with compliance." },
    ]);
    const retrieval = retrieveV3Policies(turn);
    expect(turn.kind).toBe("new");
    expect(retrieval.candidates.some(({ policy }) => policy.id === "claim_59be9c344b9359a4")).toBe(true);
  });
});
