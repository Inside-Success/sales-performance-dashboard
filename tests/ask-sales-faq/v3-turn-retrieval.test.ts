import { describe, expect, it } from "vitest";
import { getV3Registry, retrieveV3Policies } from "@/lib/ask-sales-faq/v3/retrieval";
import { applyV3TurnIntentRefinement, resolveV3Turn } from "@/lib/ask-sales-faq/v3/turn-resolver";

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

  it("treats a natural concise explanation request as a rewrite, not a policy follow-up", () => {
    const turn = resolveV3Turn("Can you explain that more naturally and keep only what I need to do?", [
      { role: "user", content: "Can I change the confirmation wording myself?" },
      { role: "assistant", content: "Leave the wording unchanged and ask the current owner to update it." },
    ]);
    expect(turn.kind).toBe("rewrite");
    expect(turn.immediatePreviousAssistantAnswer).toContain("Leave the wording unchanged");
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
    expect(resolveV3Turn("Hey there! Hope you’re doing well—can you help me with a few qualification questions?", []).kind).toBe("topic_intro");
    expect(resolveV3Turn("Thanks. I’m switching to payments and contracts now.", []).kind).toBe("topic_intro");
    expect(resolveV3Turn("Perfect, thank you!", []).kind).toBe("social");
    expect(resolveV3Turn("Appreciate it. Now I have some questions about calls and compliance.", []).kind).toBe("topic_intro");
    expect(resolveV3Turn("Hi, can you help me with another sales question?", []).kind).toBe("topic_intro");
    expect(resolveV3Turn("Could you help me with a sales question?", []).kind).toBe("topic_intro");
    expect(resolveV3Turn("Can you help me with an ACH payment that is still pending?", []).kind).toBe("new");
    expect(resolveV3Turn("Hi, can you help me check a few unusual qualification cases?", []).kind).toBe("topic_intro");
    expect(resolveV3Turn("Hi there. Can you help me check a few qualification situations?", []).kind).toBe("topic_intro");
    expect(resolveV3Turn("Could you help me review several payment scenarios?", []).kind).toBe("topic_intro");
    expect(resolveV3Turn("Hello again. I need help with payments and contracts now.", []).kind).toBe("topic_intro");
  });

  it("allows the intent refinement stage to recover a natural acknowledgment", () => {
    const turn = resolveV3Turn("Got it, thanks for being careful.", [
      { role: "user", content: "Can a recently bankrupt applicant qualify?" },
      { role: "assistant", content: "Please confirm that case before replying." },
    ]);
    const refined = applyV3TurnIntentRefinement(turn, {
      kind: "social",
      resolvedQuestion: "",
      reason: "This is a pure acknowledgment.",
    });
    expect(refined.kind).toBe("social");
    expect(refined.usedImmediateContext).toBe(false);
  });

  it("uses immediate no-show and greenlight context for natural continuations", () => {
    const noShow = resolveV3Turn("If the prospect suddenly says they can join after I have left, do I have to take the meeting immediately?", [
      { role: "user", content: "For a no-show, is it correct to make two calls, send two texts, wait ten minutes, and then leave?" },
      { role: "assistant", content: "Yes, then leave if there is no response." },
    ]);
    const greenlight = resolveV3Turn("So should I mark the greenlight letter as do not send?", [
      { role: "user", content: "The candidate shows Passed social check: Fail. What should I do?" },
      { role: "assistant", content: "Check with the Greenlight team." },
    ]);
    expect(noShow.kind).toBe("follow_up");
    expect(noShow.standaloneQuestion).toContain("no-show");
    expect(greenlight.kind).toBe("follow_up");
    expect(greenlight.standaloneQuestion).toContain("Passed social check");
  });

  it("does not treat every complete should-I question as a follow-up", () => {
    const messages = [
      { role: "user" as const, content: "The contract is signed, the ACH failed, and the client now wants out. Which team needs to be notified?" },
      { role: "assistant" as const, content: "Notify the fulfillment hotline." },
    ];
    expect(resolveV3Turn("Should I automatically disqualify every applicant who served time years ago?", messages).kind).toBe("new");
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
    expect(turn.excludedScopes).toContain("dj_nlceo");
    expect(retrieval.candidates.some(({ policy }) => policy.domains.includes("contracts"))).toBe(true);
    expect(retrieval.candidates.some(({ policy }) => policy.product_scopes.includes("dj_nlceo") && !policy.product_scopes.includes("main_istv"))).toBe(false);
  });

  it("treats an assigned-rep reference as an immediate follow-up", () => {
    const turn = resolveV3Turn("Should I contact the assigned rep first before taking the next step?", [
      { role: "user", content: "A 20% lead is assigned to another rep, but I spoke with them before. What should I do?" },
      { role: "assistant", content: "Do not dial until ownership is clear." },
    ]);
    expect(turn.kind).toBe("follow_up");
    expect(turn.standaloneQuestion).toContain("20% lead");
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

  it("retrieves atomic canonical evidence that was previously buried in broad articles", () => {
    const turn = resolveV3Turn("Two young business owners have their mother present and she consents. Can the minors be considered?", []);
    const retrieval = retrieveV3Policies(turn);
    const minor = retrieval.candidates.find(({ policy }) => /minors can be considered/i.test(policy.decision));
    expect(minor?.policy.answerability).toBe("answer_evidence");
  });

  it("uses current specific decisions and excludes superseded or broader conflicting cards", () => {
    const filming = retrieveV3Policies(resolveV3Turn("Can a client film before the payment plan is paid in full if payments are current?", []), 20);
    expect(filming.candidates.some(({ policy }) => policy.id === "claim_2c2ff8fc9358ae9d")).toBe(true);
    expect(filming.candidates.some(({ policy }) => policy.id === "claim_abbd4c9d00643b31")).toBe(false);

    const calendars = retrieveV3Policies(resolveV3Turn("What should I do when the same prospect is booked on two reps' calendars?", []), 20);
    expect(calendars.candidates.some(({ policy }) => policy.id === "v3src_two_calendar_engagement")).toBe(true);
    expect(calendars.candidates.some(({ policy }) => policy.id === "claim_662ca1f66e1306e4")).toBe(false);
  });

  it("ranks a self-contained option table above a dangling cross-reference", () => {
    const retrieval = retrieveV3Policies(resolveV3Turn(
      "For DJ/NLCEO, what are the approved PIF and split-payment options?",
      [],
    ), 20);
    const tableIndex = retrieval.candidates.findIndex(({ policy }) => policy.id === "claim_26780013d013e10b");
    const danglingIndex = retrieval.candidates.findIndex(({ policy }) => policy.id === "claim_028cf371215a8cc5__a2");
    expect(tableIndex).toBeGreaterThanOrEqual(0);
    expect(danglingIndex < 0 || tableIndex < danglingIndex).toBe(true);
  });

  it("does not apply a product-specific qualification decision when the product is unknown", () => {
    const unknown = retrieveV3Policies(resolveV3Turn(
      "Should we cast someone who was recently released from prison and now runs a business?",
      [],
    ), 20);
    expect(unknown.candidates.some(({ policy }) => policy.id === "claim_bcef5f3f480f6531")).toBe(false);

    const scoped = retrieveV3Policies(resolveV3Turn(
      "Should Next Level CEO cast someone who was recently released from prison and now runs a business?",
      [],
    ), 20);
    expect(scoped.candidates.some(({ policy }) => policy.id === "claim_bcef5f3f480f6531")).toBe(true);
  });

  it("retrieves current operational decisions without exact source wording", () => {
    const cases = [
      ["What is the deadline for moving a Standard client to VIP?", "v3src_main_istv_upgrade_window"],
      ["Where should I look in Keap to find the rep already attached to an appointment?", "v3src_find_booked_rep_keap"],
      ["Should I mention trailer promotion when pitching the lowest Daymond John package?", "v3src_dj_lite_trailer_positioning"],
      ["How long do I wait and how many times do I contact a no-show?", "v3src_no_show_attempts_and_late_join"],
      ["Where is the approved page of cast reviews I can share?", "v3src_testimonials_landing_page"],
    ] as const;
    for (const [question, expectedId] of cases) {
      const retrieval = retrieveV3Policies(resolveV3Turn(question, []), 20);
      expect(retrieval.candidates.some(({ policy }) => policy.id === expectedId), question).toBe(true);
    }
  });
});
