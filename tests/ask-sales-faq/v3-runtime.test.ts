import { describe, expect, it } from "vitest";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";
import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";

function jsonProvider(handler: (input: { purpose: string; user: string }) => Record<string, unknown>): V3Provider {
  return async <T>(input: Parameters<V3Provider>[0]) => ({
    output: input.parse(JSON.stringify(handler({ purpose: input.purpose, user: input.user }))),
    provider: "deepseek",
    model: "test-model",
    attempts: [{ provider: "deepseek", model: "test-model", purpose: input.purpose, status: "success", latencyMs: 1 }],
  }) as Awaited<ReturnType<V3Provider>> & { output: T };
}

function groundedProvider(): V3Provider {
  return jsonProvider(({ purpose, user }) => {
    if (purpose === "v3_grounding_validation") {
      const payload = JSON.parse(user) as { draft: Record<string, unknown> };
      return {
        verdict: "pass",
        answer: payload.draft.answer,
        summary: payload.draft.summary,
        sections: payload.draft.sections,
        sentence_evidence: payload.draft.sentence_evidence,
        removed_claims: [],
        reason: "Grounded.",
      };
    }
    if (purpose === "v3_conversation") {
      return {
        mode: "conversation",
        answer: "Hi! Happy to help—what sales question are you working through?",
        summary: "Hi! Happy to help—what sales question are you working through?",
        sections: [],
        selected_policy_ids: [],
        rejected_policy_ids: [],
        coverage: [],
        sentence_evidence: [],
        needs_route: false,
        route_key: null,
        route_reason: "",
        confidence_score: 100,
      };
    }
    const payload = JSON.parse(user) as { evidence_cards: Array<{ ref: string; title: string; decision_evidence: string }> };
    const selected = payload.evidence_cards[0];
    return {
      mode: "answer",
      answer: "Yes—use the applicable approved guidance for this exact case.",
      summary: "Use the applicable approved guidance for this case.",
      sections: [],
      selected_policy_ids: [selected.ref],
      rejected_policy_ids: payload.evidence_cards.slice(1).map((card) => card.ref),
      coverage: [{ need: "The user's question", status: "answered", policy_ids: [selected.ref], reason: "Applicable evidence." }],
      sentence_evidence: [{ sentence: "Yes—use the applicable approved guidance for this exact case.", policy_ids: [selected.ref] }],
      needs_route: false,
      route_key: null,
      route_reason: "",
      confidence_score: 88,
    };
  });
}

describe("Ask Sales FAQ V3 runtime", () => {
  it("responds naturally to a greeting through the conversation path", async () => {
    const result = await runAskSalesFaqV3("Hi!", [], { provider: groundedProvider() });
    expect(result.outcome).toBe("conversation_reply");
    expect(result.answer).toContain("Happy to help");
    expect(result.runtimeMetadata.pipelineVersion).toBe("v3");
    expect(result.runtimeMetadata.v3?.turn.kind).toBe("social");
  });

  it("does not return a raw policy when the model selects an invalid policy ID", async () => {
    const provider = jsonProvider(({ purpose, user }) => {
      if (purpose === "v3_grounding_validation") throw new Error("Verifier should not be reached without valid evidence");
      const payload = JSON.parse(user) as { evidence_cards: Array<{ decision_evidence: string }> };
      return {
        mode: "answer",
        answer: payload.evidence_cards[0]?.decision_evidence || "raw claim",
        summary: "raw",
        sections: [],
        selected_policy_ids: ["not-a-candidate"],
        rejected_policy_ids: [],
        coverage: [],
        sentence_evidence: [{ sentence: "raw", policy_ids: ["not-a-candidate"] }],
        needs_route: false,
        route_key: null,
        route_reason: "",
        confidence_score: 99,
      };
    });

    const result = await runAskSalesFaqV3("Can we offer a payment exception?", [], { provider });
    expect(result.outcome).toBe("route_from_evidence");
    expect(result.answer).not.toContain("Decision evidence:");
    expect(result.answer).toMatch(/don’t want to guess|reliable|confident/i);
    expect(result.answer).toContain("#sales-finance-requests");
    expect(result.runtimeMetadata.v3?.validation.verdict).toBe("reject");
  });

  it("keeps V3 metadata, selected evidence, and validation trace together", async () => {
    const result = await runAskSalesFaqV3("Can a hospital-employed physician qualify without a private practice?", [], {
      provider: groundedProvider(),
    });
    expect(result.outcome).toBe("answer_from_evidence");
    expect(result.runtimeMetadata.v3?.retrieval.candidateCount).toBeGreaterThan(0);
    expect(result.runtimeMetadata.v3?.selection.selectedPolicyIds.length).toBe(1);
    expect(result.runtimeMetadata.v3?.validation.verdict).toBe("pass");
  });

  it("passes every bounded retrieval candidate to the composer", async () => {
    const provider = jsonProvider(({ purpose, user }) => {
      const payload = JSON.parse(user) as {
        draft?: Record<string, unknown>;
        evidence_cards?: Array<{ ref: string; policy_key: string }>;
      };
      if (purpose === "v3_grounding_validation") {
        return {
          verdict: "pass",
          answer: payload.draft?.answer,
          summary: payload.draft?.summary,
          sections: payload.draft?.sections,
          sentence_evidence: payload.draft?.sentence_evidence,
          removed_claims: [],
          reason: "Grounded.",
        };
      }
      const target = payload.evidence_cards?.find((card) => card.policy_key === "franchise-owners");
      expect(target).toBeDefined();
      return {
        mode: "answer",
        answer: "Yes. A franchise owner counts if they are an owner or part owner.",
        summary: "A franchise owner can count.",
        sections: [],
        selected_policy_ids: [target?.ref],
        rejected_policy_ids: [],
        coverage: [{ need: "Franchise eligibility", status: "answered", policy_ids: [target?.ref], reason: "Direct evidence." }],
        sentence_evidence: [{ sentence: "Yes. A franchise owner counts if they are an owner or part owner.", policy_ids: [target?.ref] }],
        needs_route: false,
        route_key: null,
        route_reason: "",
        confidence_score: 88,
      };
    });

    const result = await runAskSalesFaqV3("Is a franchise owner eligible for Next Level CEO?", [], { provider });
    expect(result.outcome).toBe("answer_from_evidence");
    expect(result.runtimeMetadata.v3?.selection.selectedPolicyIds).toContain("claim_c068cf9ac8f5d089");
  });

  it("retries structured presentation rewrites when the first response drops the list", async () => {
    let conversationCalls = 0;
    const provider = jsonProvider(({ purpose }) => {
      if (purpose === "v3_conversation") {
        conversationCalls += 1;
        return conversationCalls === 1
          ? { answer: "Here is the list.", summary: "Here is the list.", sections: [] }
          : { answer: "Here is the list: - Show A - Show B", summary: "Here is the list: - Show A - Show B", sections: [{ title: "Shows", items: ["Show A", "Show B"] }] };
      }
      throw new Error("Policy validation should not run for a presentation rewrite.");
    });
    const result = await runAskSalesFaqV3(
      "Please format that as a clean bullet list.",
      [
        { role: "user", content: "What shows are available?" },
        { role: "assistant", content: "Show A, Show B" },
      ],
      { provider },
    );
    expect(conversationCalls).toBe(2);
    expect(result.answer).toBe("Here’s the requested list.");
    expect(result.structuredAnswer?.sections[0]?.items).toEqual(["Show A", "Show B"]);
  });

  it("does not retain adjacent process facts when a corrected scope remains unresolved", async () => {
    const provider = jsonProvider(({ purpose, user }) => {
      if (purpose === "v3_grounding_validation") {
        const validationPayload = JSON.parse(user) as { question: string; immediate_previous_question: string };
        expect(validationPayload.question).toContain("How do I verify");
        expect(validationPayload.immediate_previous_question).toContain("How do I verify");
        return {
          verdict: "repair",
          mode: "partial",
          answer: "Getting the contract signed is part of the generic close flow.",
          summary: "Generic close flow.",
          sections: [],
          sentence_evidence: [],
          coverage: [{ need: "Main ISTV verification", status: "unresolved", policy_ids: [], reason: "No direct verification evidence." }],
          needs_route: true,
          route_key: "sales_tech",
          route_reason: "Verification steps are unresolved.",
          removed_claims: [],
          reason: "The corrected action is unresolved.",
        };
      }
      const payload = JSON.parse(user) as { evidence_cards: Array<{ ref: string; route_channel?: string }> };
      const selected = payload.evidence_cards.find((card) => card.route_channel === "#sales-tech-requests") || payload.evidence_cards[0];
      return {
        mode: "partial",
        answer: "Getting the contract signed is part of the generic close flow.",
        summary: "Generic close flow.",
        sections: [],
        selected_policy_ids: [selected.ref],
        rejected_policy_ids: [],
        coverage: [{ need: "Main ISTV verification", status: "unresolved", policy_ids: [], reason: "No direct verification evidence." }],
        sentence_evidence: [],
        needs_route: true,
        route_key: "sales_tech",
        route_reason: "Verification steps are unresolved.",
        confidence_score: 20,
      };
    });
    const result = await runAskSalesFaqV3(
      "Actually, my previous question was about main ISTV, not Next Level CEO. Does that change your answer?",
      [
        { role: "user", content: "How do I verify that a Next Level CEO contract has been signed?" },
        { role: "assistant", content: "I cannot confirm that exact process." },
      ],
      { provider },
    );
    expect(result.answer).not.toContain("generic close flow");
    expect(result.answer).toMatch(/check|confirm|verify/i);
    expect(result.needsRoute).toBe(true);
  });
});
