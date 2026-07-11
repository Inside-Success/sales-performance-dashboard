import { describe, expect, it } from "vitest";
import { runAskSalesFaqV3 } from "@/lib/ask-sales-faq/v3/runtime";
import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";

function jsonProvider(handler: (input: { purpose: string; user: string }) => Record<string, unknown>): V3Provider {
  return async <T>(input: Parameters<V3Provider>[0]) => {
    const payload = JSON.parse(input.user) as Record<string, unknown>;
    let handled = handler({ purpose: input.purpose, user: input.user });
    if (input.purpose.startsWith("v3_evidence_selection") && !Array.isArray(handled.needs)) {
      const selectedRefs = Array.isArray(handled.selected_refs) ? handled.selected_refs.map(String) : [];
      handled = {
        ...handled,
        needs: [{ text: String(payload.resolved_question || payload.current_question || "The requested decision") }],
        support: selectedRefs.length
          ? [{ need_id: "N1", relation: "direct", refs: selectedRefs, supported_claim: "The selected evidence directly supports the requested decision.", reason: String(handled.reason || "Direct evidence.") }]
          : [],
        unresolved_need_ids: selectedRefs.length ? [] : ["N1"],
      };
    }
    if (input.purpose === "v3_grounding_validation" && !Array.isArray(handled.sentence_checks)) {
      const sentenceClaims = Array.isArray(payload.sentence_claims) ? payload.sentence_claims as Array<Record<string, unknown>> : [];
      const contract = payload.evidence_contract as { needs?: Array<Record<string, unknown>> } | undefined;
      const selectedEvidence = Array.isArray(payload.selected_evidence) ? payload.selected_evidence as Array<Record<string, unknown>> : [];
      const firstRef = String(selectedEvidence[0]?.ref || "V1");
      const rejected = handled.verdict === "reject";
      handled = {
        ...handled,
        sentence_checks: sentenceClaims.map((claim) => ({
          sentence_ref: claim.ref,
          status: rejected ? "unsupported" : "supported",
          evidence_refs: rejected ? [] : (claim.claimed_evidence_refs as string[] | undefined) || [firstRef],
          reason: rejected ? "Not supported in this test case." : "Supported in this test case.",
        })),
        need_checks: (contract?.needs || []).map((need) => ({
          need_ref: need.id,
          status: rejected ? "unresolved" : handled.needs_route ? "partial" : "answered",
          evidence_refs: rejected ? [] : [firstRef],
          reason: rejected ? "Unresolved in this test case." : "Covered in this test case.",
        })),
      };
    }
    return {
      output: input.parse(JSON.stringify(handled)),
      provider: "deepseek",
      model: "test-model",
      attempts: [{ provider: "deepseek", model: "test-model", purpose: input.purpose, status: "success", latencyMs: 1 }],
    } as Awaited<ReturnType<V3Provider>> & { output: T };
  };
}

function groundedProvider(): V3Provider {
  return jsonProvider(({ purpose, user }) => {
    if (purpose === "v3_evidence_selection") {
      const payload = JSON.parse(user) as { candidates: Array<{ ref: string }> };
      return { selected_refs: payload.candidates.slice(0, 1).map((card) => card.ref), reason: "The strongest bounded card directly applies." };
    }
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

  it("does not expose an unrelated prior answer to the composer for a complete new question", async () => {
    let inspected = false;
    const base = groundedProvider();
    const provider = (async (input: Parameters<V3Provider>[0]) => {
      if (input.purpose === "v3_evidence_answer") {
        const payload = JSON.parse(input.user) as {
          resolved_turn: { kind: string; immediate_previous_user_question: string | null; immediate_previous_assistant_answer: string | null };
        };
        expect(payload.resolved_turn.kind).toBe("new");
        expect(payload.resolved_turn.immediate_previous_user_question).toBeNull();
        expect(payload.resolved_turn.immediate_previous_assistant_answer).toBeNull();
        inspected = true;
      }
      return base(input);
    }) as V3Provider;

    await runAskSalesFaqV3(
      "Should freelancers move to Call 2, or do they need an established business to qualify?",
      [
        { role: "user", content: "Does an agent need brokerage approval?" },
        { role: "assistant", content: "An unrelated brokerage answer." },
      ],
      { provider },
    );
    expect(inspected).toBe(true);
  });

  it("adds a semantically selected policy that lexical wording alone can miss", async () => {
    let selectionCalls = 0;
    const provider = jsonProvider(({ purpose, user }) => {
      const payload = JSON.parse(user) as Record<string, unknown>;
      if (purpose === "v3_semantic_recall") {
        expect(payload).not.toHaveProperty("catalog");
        return { queries: ["Can an existing client buy another show and who owns the relationship?"] };
      }
      if (purpose === "v3_evidence_selection") {
        selectionCalls += 1;
        const candidates = payload.candidates as Array<{ ref: string; title: string; example_context: string; decision_evidence: string }>;
        const target = candidates.find((card) => card.title === "Existing client buying another show");
        expect(target).toBeDefined();
        expect(target?.example_context).toContain("Legacy Makers");
        expect(target?.decision_evidence).toMatch(/^Yes\./);
        expect(target?.decision_evidence).not.toContain("Policy context:");
        return { selected_refs: [target?.ref], reason: "This card directly answers the cross-show purchase and ownership question." };
      }
      if (purpose === "v3_grounding_validation") {
        const draft = payload.draft as Record<string, unknown>;
        return {
          verdict: "pass",
          answer: draft.answer,
          summary: draft.summary,
          sections: draft.sections,
          sentence_evidence: draft.sentence_evidence,
          removed_claims: [],
          reason: "Grounded.",
        };
      }
      const cards = payload.evidence_cards as Array<{ ref: string; title: string; example_context: string; decision_evidence: string }>;
      expect(payload.strict_selection).toMatchObject({
        applied: true,
        rationale: "This card directly answers the cross-show purchase and ownership question.",
      });
      const target = cards.find((card) => card.title === "Existing client buying another show");
      expect(target).toBeDefined();
      expect(target?.example_context).toContain("Legacy Makers");
      expect(target?.decision_evidence).toMatch(/^Yes\./);
      return {
        mode: "answer",
        answer: "Yes—an existing client can buy a different show (E1); check the original assignment before taking ownership.",
        summary: "An existing client can buy another show.",
        sections: [],
        selected_policy_ids: [target?.ref],
        rejected_policy_ids: [],
        coverage: [{ need: "Cross-show purchase", status: "answered", policy_ids: [target?.ref], reason: "Direct evidence." }],
        sentence_evidence: [{ sentence: "Yes—an existing client can buy a different show; check the original assignment before taking ownership.", policy_ids: [target?.ref] }],
        needs_route: false,
        route_key: null,
        route_reason: "",
        confidence_score: 88,
      };
    });
    const result = await runAskSalesFaqV3(
      "If someone is already an ISTV customer but applies for a different ISTV show, should I proceed with the new application or skip the call?",
      [],
      { provider },
    );
    expect(result.outcome).toBe("answer_from_evidence");
    expect(result.answer).not.toMatch(/\bE\d+\b/);
    expect(result.runtimeMetadata.v3?.selection.selectedPolicyIds).toContain("claim_606e9d59e3cd964f");
    expect(result.runtimeMetadata.v3?.retrieval.semanticQueries).toEqual([
      "Can an existing client buy another show and who owns the relationship?",
    ]);
    expect(result.runtimeMetadata.v3?.retrieval.preselectionCandidateCount).toBeGreaterThan(
      result.runtimeMetadata.v3?.retrieval.candidateCount || 0,
    );
    expect(selectionCalls).toBe(1);
  });

  it("reconsiders an empty selection once for a separable multi-part answer", async () => {
    let firstSelectionCalls = 0;
    let retrySelectionCalls = 0;
    const provider = jsonProvider(({ purpose, user }) => {
      const payload = JSON.parse(user) as Record<string, unknown>;
      if (purpose === "v3_semantic_recall") return { queries: ["what the commercial reuse license covers"] };
      if (purpose === "v3_evidence_selection") {
        firstSelectionCalls += 1;
        return { selected_refs: [], reason: "No single card answers the whole question." };
      }
      if (purpose === "v3_evidence_selection_retry") {
        retrySelectionCalls += 1;
        const candidates = payload.candidates as Array<{ ref: string; title: string }>;
        const target = candidates.find((card) => card.title === "Prospect already owns a TV production license");
        expect(target).toBeDefined();
        return { selected_refs: [target?.ref], reason: "This card answers why the license exists, while the decline scenario remains unresolved." };
      }
      if (purpose === "v3_grounding_validation") {
        const draft = payload.draft as Record<string, unknown>;
        return {
          verdict: "pass",
          mode: "partial",
          answer: draft.answer,
          summary: draft.summary,
          sections: draft.sections,
          sentence_evidence: draft.sentence_evidence,
          coverage: draft.coverage,
          needs_route: true,
          route_key: "greenlight",
          route_reason: "The decline scenario is unresolved.",
          removed_claims: [],
          reason: "The supported separable part is grounded.",
        };
      }
      const cards = payload.evidence_cards as Array<{ ref: string; title: string }>;
      const target = cards.find((card) => card.title === "Prospect already owns a TV production license");
      expect(target).toBeDefined();
      return {
        mode: "partial",
        answer: "The license covers reuse of company-produced content, plus the time, energy, and promised deliverables. The decline scenario is not confirmed.",
        summary: "The license covers company-produced content and promised deliverables.",
        sections: [],
        selected_policy_ids: [target?.ref],
        rejected_policy_ids: [],
        coverage: [
          { need: "Why the license exists", status: "answered", policy_ids: [target?.ref], reason: "Direct evidence." },
          { need: "Decline scenario", status: "unresolved", policy_ids: [], reason: "No evidence." },
        ],
        sentence_evidence: [{ sentence: "The license covers reuse of company-produced content, plus the time, energy, and promised deliverables.", policy_ids: [target?.ref] }],
        needs_route: true,
        route_key: "greenlight",
        route_reason: "The decline scenario is unresolved.",
        confidence_score: 80,
      };
    });

    const result = await runAskSalesFaqV3(
      "Why is there a commercial reuse license? If someone declines it, what does that mean for both sides?",
      [],
      { provider },
    );
    expect(firstSelectionCalls).toBe(1);
    expect(retrySelectionCalls).toBe(1);
    expect(result.outcome).toBe("route_from_evidence");
    expect(result.answer).toContain("covers reuse");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.answer).not.toContain("#greenlight-requests");
  });

  it("passes every bounded retrieval candidate to the composer", async () => {
    let validationCalls = 0;
    const provider = jsonProvider(({ purpose, user }) => {
      const payload = JSON.parse(user) as {
        candidates?: Array<{ ref: string; id: string }>;
        draft?: Record<string, unknown>;
        evidence_cards?: Array<{ ref: string; policy_key: string }>;
      };
      if (purpose === "v3_evidence_selection") {
        const target = payload.candidates?.find((card) => card.id === "claim_c068cf9ac8f5d089");
        return { selected_refs: target ? [target.ref] : [], reason: "The franchise eligibility card directly applies." };
      }
      if (purpose === "v3_grounding_validation") {
        validationCalls += 1;
        const draftEvidence = payload.draft?.sentence_evidence as Array<{ sentence: string }> | undefined;
        return {
          verdict: "pass",
          answer: payload.draft?.answer,
          summary: payload.draft?.summary,
          sections: payload.draft?.sections,
          sentence_evidence: [{ sentence: draftEvidence?.[0]?.sentence || "", policy_ids: ["V1"] }],
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
    expect(result.runtimeMetadata.v3?.validation.verdict).toBe("pass");
    expect(validationCalls).toBe(1);
  });

  it("treats hyphenated and pluralized time units as the same grounded number", async () => {
    const provider = jsonProvider(({ purpose, user }) => {
      const payload = JSON.parse(user) as {
        candidates?: Array<{ ref: string; title: string }>;
        evidence_cards?: Array<{ ref: string; policy_key: string }>;
        draft?: Record<string, unknown>;
      };
      if (purpose === "v3_semantic_recall") return { queries: ["first booking wins lead ownership window"] };
      if (purpose === "v3_evidence_selection") {
        const selected = payload.candidates?.filter((card) => /first-contact ownership|20 percent dial-out/i.test(card.title));
        return { selected_refs: selected?.map((card) => card.ref) || [], reason: "These cards directly define lead ownership." };
      }
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
      const target = payload.evidence_cards?.find((card) => card.policy_key === "twenty-percent-dial-out-sop-answer-3");
      expect(target).toBeDefined();
      return {
        mode: "answer",
        answer: "The first booking wins, and the original rep keeps a 30 days ownership window from their last logged communication.",
        summary: "The first booking wins during the 30 days ownership window.",
        sections: [],
        selected_policy_ids: [target?.ref],
        rejected_policy_ids: [],
        coverage: [{ need: "Lead ownership", status: "answered", policy_ids: [target?.ref], reason: "Direct evidence." }],
        sentence_evidence: [{ sentence: "The first booking wins, and the original rep keeps a 30 days ownership window from their last logged communication.", policy_ids: [target?.ref] }],
        needs_route: false,
        route_key: null,
        route_reason: "",
        confidence_score: 90,
      };
    });

    const result = await runAskSalesFaqV3("If a client books calls with two different reps, which rep owns the client?", [], { provider });
    expect(result.outcome).toBe("answer_from_evidence");
    expect(result.answer).toContain("30 days");
    expect(result.runtimeMetadata.v3?.validation.verdict).toBe("pass");
  });

  it("treats K shorthand and expanded currency amounts as the same grounded numbers", async () => {
    const provider = jsonProvider(({ purpose, user }) => {
      const payload = JSON.parse(user) as {
        candidates?: Array<{ ref: string; id: string }>;
        evidence_cards?: Array<{ ref: string; policy_key: string }>;
        draft?: Record<string, unknown>;
      };
      if (purpose === "v3_semantic_recall") return { queries: ["unlisted custom payment split matching contract"] };
      if (purpose === "v3_evidence_selection") {
        const selected = payload.candidates?.filter((card) => card.id === "owner-unlisted-payment-split-boundary") || [];
        return { selected_refs: selected.map((card) => card.ref), reason: "The custom-split boundary directly applies." };
      }
      if (purpose === "v3_grounding_validation") {
        return {
          verdict: "pass",
          answer: payload.draft?.answer,
          summary: payload.draft?.summary,
          sections: payload.draft?.sections,
          sentence_evidence: payload.draft?.sentence_evidence,
          removed_claims: [],
          reason: "The amounts repeat the user's proposal and the selected policy supplies the decision.",
        };
      }
      const target = payload.evidence_cards?.find((card) => card.policy_key === "payments-unlisted-split-and-amounts");
      expect(target).toBeDefined();
      return {
        mode: "answer",
        answer: "The proposed $3,000 now and $17,000 later is a custom split, so use a listed plan and its matching contract instead.",
        summary: "Use a listed plan and its matching contract.",
        sections: [],
        selected_policy_ids: [target?.ref],
        rejected_policy_ids: [],
        coverage: [{ need: "Custom split", status: "answered", policy_ids: [target?.ref], reason: "Direct boundary." }],
        sentence_evidence: [{ sentence: "The proposed $3,000 now and $17,000 later is a custom split, so use a listed plan and its matching contract instead.", policy_ids: [target?.ref] }],
        needs_route: false,
        route_key: null,
        route_reason: "",
        confidence_score: 90,
      };
    });

    const result = await runAskSalesFaqV3(
      "Can the lead pay $3K now and $17K later, and which contract should they use?",
      [],
      { provider },
    );
    expect(result.outcome).toBe("answer_from_evidence");
    expect(result.runtimeMetadata.v3?.validation.verdict).toBe("pass");
  });

  it("uses the DeepSeek validation stage to reject an unsupported verification method", async () => {
    let validationCalls = 0;
    let selectionCalls = 0;
    const provider = jsonProvider(({ purpose, user }) => {
      const payload = JSON.parse(user) as {
        evidence_cards?: Array<{ ref: string; title: string }>;
        draft?: Record<string, unknown>;
      };
      if (purpose === "v3_evidence_selection") {
        selectionCalls += 1;
        const candidates = JSON.parse(user) as { candidates: Array<{ ref: string; title: string }> };
        const target = candidates.candidates.find((card) => /contract/i.test(card.title)) || candidates.candidates[0];
        return { selected_refs: target ? [target.ref] : [], reason: "Only the contract card is potentially applicable." };
      }
      if (purpose === "v3_grounding_validation") {
        validationCalls += 1;
        return {
          verdict: "reject",
          answer: "",
          summary: "",
          sections: [],
          sentence_evidence: [],
          removed_claims: ["The evidence covers sending the correct contract, not verifying signature status."],
          reason: "The proposed method is not supported by the selected evidence.",
        };
      }
      const selected = payload.evidence_cards?.[0];
      return {
        mode: "answer",
        answer: "Check the signing-status channel to verify the contract.",
        summary: "Check the signing-status channel.",
        sections: [],
        selected_policy_ids: [selected?.ref],
        rejected_policy_ids: [],
        coverage: [{ need: "Signature verification", status: "answered", policy_ids: [selected?.ref], reason: "Proposed method." }],
        sentence_evidence: [{ sentence: "Check the signing-status channel to verify the contract.", policy_ids: [selected?.ref] }],
        needs_route: false,
        route_key: null,
        route_reason: "",
        confidence_score: 90,
      };
    });
    const result = await runAskSalesFaqV3("How do I verify that a Next Level CEO contract has been signed?", [], { provider });
    expect(selectionCalls).toBe(1);
    expect(validationCalls).toBe(1);
    expect(result.outcome).toBe("route_from_evidence");
    expect(result.answer).not.toContain("signing-status channel");
  });

  it("derives a useful partial from structured checks instead of trusting a contradictory verdict", async () => {
    const provider = jsonProvider(({ purpose, user }) => {
      const payload = JSON.parse(user) as {
        candidates?: Array<{ ref: string; id: string }>;
        evidence_cards?: Array<{ ref: string; policy_key: string }>;
        draft?: Record<string, unknown>;
      };
      if (purpose === "v3_semantic_recall") return { queries: ["VIP ISTV second episode discount and media outlet list"] };
      if (purpose === "v3_evidence_selection") {
        const target = payload.candidates?.find((card) => card.id === "claim_c02aa623dd33f7bd");
        return {
          needs: [{ text: "Discount for a second VIP ISTV episode" }, { text: "Where to find the included media outlet list" }],
          support: target ? [{ need_id: "N1", relation: "direct", refs: [target.ref], supported_claim: "A VIP ISTV client can get another VIP ISTV episode at half off.", reason: "Direct discount evidence." }] : [],
          unresolved_need_ids: ["N2"],
          reason: "The discount is supported; the resource location is unresolved.",
        };
      }
      if (purpose === "v3_grounding_validation") {
        return {
          verdict: "reject",
          mode: "route",
          answer: payload.draft?.answer,
          summary: payload.draft?.summary,
          sections: [],
          sentence_evidence: payload.draft?.sentence_evidence,
          sentence_checks: [{ sentence_ref: "S1", status: "supported", evidence_refs: ["V1"], reason: "V1 directly states half off." }],
          need_checks: [
            { need_ref: "N1", status: "answered", evidence_refs: ["V1"], reason: "The discount is fully answered." },
            { need_ref: "N2", status: "unresolved", evidence_refs: [], reason: "No selected evidence gives the list location." },
          ],
          needs_route: true,
          route_key: "sales_policy",
          route_reason: "The media outlet list location is unresolved.",
          removed_claims: [],
          reason: "Raw verdict intentionally contradicts the structured checks.",
        };
      }
      const target = payload.evidence_cards?.find((card) => card.policy_key === "power-couples-second-episode-discount");
      expect(target).toBeDefined();
      return {
        mode: "partial",
        answer: "A VIP ISTV client can get a second VIP ISTV episode at half off.",
        summary: "The second VIP ISTV episode is half off.",
        sections: [],
        selected_policy_ids: [target?.ref],
        rejected_policy_ids: [],
        coverage: [],
        sentence_evidence: [{ sentence: "A VIP ISTV client can get a second VIP ISTV episode at half off.", policy_ids: [target?.ref] }],
        needs_route: true,
        route_key: "sales_policy",
        route_reason: "The media outlet list location is unresolved.",
        confidence_score: 85,
      };
    });

    const result = await runAskSalesFaqV3(
      "What discount is available to a VIP client who buys a second VIP ISTV episode, and where is the included media outlet list?",
      [],
      { provider },
    );
    expect(result.outcome).toBe("route_from_evidence");
    expect(result.errorClass).toBeNull();
    expect(result.answer).toContain("half off");
    expect(result.runtimeMetadata.v3?.validation.verdict).toBe("repair");
    expect(result.runtimeMetadata.v3?.selection.coverage.map((item) => item.status)).toEqual(["answered", "unresolved"]);
  });

  it("honors a presentation-only request to omit a repeated route note", async () => {
    const provider = jsonProvider(({ purpose }) => {
      expect(purpose).toBe("v3_conversation");
      return {
        answer: "The CEO Day upgrade is available. Turnaround is not confirmed. Use #sales-questions-requests for the unresolved part.",
        summary: "The CEO Day upgrade is available. Use #sales-questions-requests for the unresolved part.",
        sections: [],
      };
    });
    const result = await runAskSalesFaqV3(
      "Can you give me that answer without repeating the route note?",
      [
        { role: "user", content: "Is the CEO Day upgrade available, and what is the turnaround?" },
        { role: "assistant", content: "The CEO Day upgrade is available. Turnaround is not confirmed. Use #sales-questions-requests for the unresolved part." },
      ],
      { provider },
    );
    expect(result.outcome).toBe("conversation_reply");
    expect(result.answer).toBe("The CEO Day upgrade is available. Turnaround is not confirmed.");
    expect(result.structuredAnswer?.summary).not.toContain("#sales-questions-requests");
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
    let selectionCalls = 0;
    const provider = jsonProvider(({ purpose, user }) => {
      if (purpose === "v3_evidence_selection") {
        selectionCalls += 1;
        const selectionPayload = JSON.parse(user) as { candidates: Array<{ ref: string; title: string }> };
        const target = selectionPayload.candidates.find((card) => /contract|post-sale/i.test(card.title)) || selectionPayload.candidates[0];
        return { selected_refs: target ? [target.ref] : [], reason: "Keep only the closest contract evidence for validation." };
      }
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
    expect(selectionCalls).toBe(1);
  });
});
