import { describe, expect, it } from "vitest";
import { runAskSalesFaqV4 } from "@/lib/ask-sales-faq/v4/runtime";
import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";

function providerFor(
  handler: (input: { purpose: string; payload: Record<string, unknown> }) => Record<string, unknown>,
): V3Provider {
  return async <T>(input: Parameters<V3Provider>[0]) => {
    const payload = JSON.parse(input.user) as Record<string, unknown>;
    const raw = handler({ purpose: input.purpose, payload });
    return {
      output: input.parse(JSON.stringify(raw)),
      provider: "deepseek",
      model: "v4-test-model",
      attempts: [{ provider: "deepseek", model: "v4-test-model", purpose: input.purpose, status: "success", latencyMs: 1 }],
    } as Awaited<ReturnType<V3Provider>> & { output: T };
  };
}

const unavailableProvider: V3Provider = async () => {
  throw new Error("No model credential is configured in this isolated test");
};

function refFor(payload: Record<string, unknown>, policyTitle: string) {
  const candidates = payload.candidates as Array<{ ref: string; title: string }>;
  const target = candidates.find((candidate) => candidate.title === policyTitle);
  expect(target).toBeDefined();
  return target!.ref;
}

function refForDecisionKey(payload: Record<string, unknown>, decisionKey: string) {
  const candidates = payload.candidates as Array<{ ref: string; decision_key: string }>;
  const target = candidates.find((candidate) => candidate.decision_key === decisionKey);
  expect(target).toBeDefined();
  return target!.ref;
}

describe("Ask Sales V4 isolated runtime", () => {
  it("answers the VIP platform boundary and does not amplify one platform to all three", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return {
          needs: [{ id: "N1", text: "How many Tier-1 platforms", lane: "answer", evidence_refs: [selectedRef], supported_claim: "VIP includes submission to one Tier-1 platform, and placement is not guaranteed.", reason: "Direct match.", route_key: null, clarification_question: "" }],
          confidence_score: 96,
          reasoning_summary: "Direct controlling boundary.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "VIP covers one platform.", sentences: [{ id: "S1", text: "VIP includes submission to one Tier-1 platform, and the platform decides placement, so placement is not guaranteed.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" }] };
      }
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "Fully entailed." }], need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }], reason: "Grounded." };
    });

    const result = await runAskSalesFaqV4("For VIP, do I submit the client to one Tier-1 platform or all three?", [], { provider });
    expect(result.lane).toBe("answer");
    expect(result.answer).toContain("one Tier-1 platform");
    expect(result.answer).not.toContain("all three");
    expect(result.selectedPolicyIds).toContain("owner-vip-tier-one-platform-boundary");
  });

  it("preserves a grounded part and routes only an unresolved payment exception", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "Minimum first payment / lower deposit request");
        return {
          needs: [
            { id: "N1", text: "Minimum first payment", lane: "answer", evidence_refs: [selectedRef], supported_claim: "The minimum first payment is $2,500.", reason: "Direct evidence.", route_key: null, clarification_question: "" },
            { id: "N2", text: "Whether an unlisted Lite-to-VIP upgrade schedule can be promised", lane: "route", evidence_refs: [], supported_claim: "", reason: "No exact controlling schedule.", route_key: "finance", clarification_question: "" },
          ],
          confidence_score: 87,
          reasoning_summary: "One need is answerable and one is not.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "The minimum is $2.5k.", sentences: [{ id: "S1", text: "The minimum first payment is $2.5k.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" }] };
      }
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "$2.5k is equivalent to $2,500." }], need_checks: [{ need_id: "N1", status: "answered", reason: "The minimum is answered." }], reason: "Grounded partial." };
    });

    const result = await runAskSalesFaqV4("Can they put $2.5k down on Lite now and use a special schedule to upgrade to VIP later?", [], { provider });
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("partial");
    expect(result.answer).toContain("$2.5k");
    expect(result.answer).toContain("#sales-finance-requests");
    expect(result.runtimeMetadata.validation.removedSentences).toEqual([]);
  });

  it("removes only a rejected sentence instead of replacing the whole answer", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return {
          needs: [
            { id: "N1", text: "Tier-1 submission count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "One Tier-1 platform.", reason: "Direct.", route_key: null, clarification_question: "" },
            { id: "N2", text: "Submission deadline", lane: "answer", evidence_refs: [selectedRef], supported_claim: "Submit Monday.", reason: "Purported support.", route_key: null, clarification_question: "" },
          ],
          confidence_score: 80,
          reasoning_summary: "Two proposed needs.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "Two facts.", sentences: [
          { id: "S1", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" },
          { id: "S2", text: "Submitting on Monday is approved.", need_ids: ["N2"], evidence_refs: [selectedRef], kind: "answer" },
        ] };
      }
      return { sentence_checks: [
        { sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "Entailed." },
        { sentence_id: "S2", status: "unsupported", evidence_refs: [selectedRef], reason: "No Monday permission." },
      ], need_checks: [{ need_id: "N1", status: "answered", reason: "Count answered." }, { need_id: "N2", status: "unresolved", reason: "No Monday permission." }], reason: "One sentence is unsupported." };
    });

    const result = await runAskSalesFaqV4("For VIP, how many platforms do we submit to, and is Monday definitely approved?", [], { provider });
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("partial");
    expect(result.answer).toContain("one Tier-1 platform");
    expect(result.answer).not.toContain("Monday is approved");
    expect(result.runtimeMetadata.validation.removedSentences).toEqual(["Submitting on Monday is approved."]);
  });

  it("returns social messages without policy retrieval or a provider call", async () => {
    const provider = providerFor(() => { throw new Error("Provider should not run for a greeting"); });
    const result = await runAskSalesFaqV4("Hi!", [], { provider });
    expect(result.lane).toBe("conversation");
    expect(result.needsRoute).toBe(false);
    expect(result.runtimeMetadata.retrieval.candidateCount).toBe(0);
  });

  it.each([
    "Perfect, thank you!",
    "Thanks, that’s everything for now.",
  ])("returns a natural closing without retrieval or a provider call: %s", async (question) => {
    const provider = providerFor(() => { throw new Error("Provider should not run for a closing"); });
    const result = await runAskSalesFaqV4(question, [], { provider });

    expect(result.lane).toBe("conversation");
    expect(result.answer).toMatch(/you(?:’|')re welcome/i);
    expect(result.answer).not.toMatch(/^Hi!/);
    expect(result.provider).toBeNull();
    expect(result.runtimeMetadata.turn.kind).toBe("social");
    expect(result.runtimeMetadata.retrieval.candidateCount).toBe(0);
  });

  it("acknowledges only whitelisted topics named in a topic switch", async () => {
    const provider = providerFor(() => { throw new Error("Provider should not run for a topic switch"); });
    const result = await runAskSalesFaqV4("Thanks. I’m switching to payments, contracts, and content rights now.", [], { provider });

    expect(result.lane).toBe("conversation");
    expect(result.answer).toContain("payments and contracts");
    expect(result.answer).toContain("content rights");
    expect(result.answer).not.toContain("qualification");
    expect(result.answer).not.toContain("production");
    expect(result.provider).toBeNull();
    expect(result.runtimeMetadata.retrieval.candidateCount).toBe(0);
  });

  it("assigns unique internal sentence IDs so a duplicate model ID cannot release a rejected sentence", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return { needs: [{ id: "N1", text: "Tier-1 platform count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "One platform.", reason: "Direct.", route_key: null, clarification_question: "" }], confidence_score: 90, reasoning_summary: "Direct." };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "Two sentences.", sentences: [
          { id: "DUPLICATE", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" },
          { id: "DUPLICATE", text: "VIP guarantees all three platforms.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" },
        ] };
      }
      return { sentence_checks: [
        { sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "Entailed." },
        { sentence_id: "S2", status: "unsupported", evidence_refs: [selectedRef], reason: "Not entailed." },
      ], need_checks: [{ need_id: "N1", status: "answered", reason: "The supported sentence answers it." }], reason: "One rejected." };
    });
    const result = await runAskSalesFaqV4("Does VIP cover one Tier-1 platform or all three?", [], { provider });
    expect(result.answer).toContain("one Tier-1 platform");
    expect(result.answer).not.toContain("guarantees all three");
    expect(result.runtimeMetadata.validation.removedSentences).toEqual(["VIP guarantees all three platforms."]);
  });

  it("requires a validator answer check for every atomic answer need", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return { needs: [
          { id: "N1", text: "Tier-1 count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "One platform.", reason: "Direct.", route_key: null, clarification_question: "" },
          { id: "N2", text: "Exact submission timing", lane: "answer", evidence_refs: [selectedRef], supported_claim: "Timing.", reason: "Purported.", route_key: null, clarification_question: "" },
        ], confidence_score: 90, reasoning_summary: "Two needs." };
      }
      if (purpose === "v4_claim_composition") return { summary: "One fact.", sentences: [{ id: "S1", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1", "N2"], evidence_refs: [selectedRef], kind: "answer" }] };
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "Sentence is supported." }], need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }, { need_id: "N2", status: "unresolved", reason: "Timing is absent." }], reason: "Second need unresolved." };
    });
    const result = await runAskSalesFaqV4("How many Tier-1 platforms and exactly when is submission?", [], { provider });
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("partial");
    expect(result.answer).toContain("one Tier-1 platform");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toContain("N2");
  });

  it("fails closed when the validator omits the required need checks", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return {
          needs: [{ id: "N1", text: "Tier-1 platform count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "VIP includes submission to one Tier-1 platform.", reason: "Direct.", route_key: null, clarification_question: "" }],
          confidence_score: 95,
          reasoning_summary: "Direct evidence.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "One platform.", sentences: [{ id: "S1", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" }] };
      }
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "Entailed." }], reason: "Need checks were omitted." };
    });

    const result = await runAskSalesFaqV4("For VIP, is it one Tier-1 platform?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.validation.reason).toMatch(/retained 1 unresolved need/i);
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toEqual(["N1"]);
  });

  it("fails closed when the validator uses a sentence status for an atomic need", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return {
          needs: [{ id: "N1", text: "Tier-1 platform count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "VIP includes submission to one Tier-1 platform.", reason: "Direct.", route_key: null, clarification_question: "" }],
          confidence_score: 95,
          reasoning_summary: "Direct evidence.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "One platform.", sentences: [{ id: "S1", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" }] };
      }
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "Entailed." }],
        need_checks: [{ need_id: "N1", status: "supported", reason: "Invalid need status." }],
        reason: "Invalid enum.",
      };
    });

    const result = await runAskSalesFaqV4("For VIP, is it one Tier-1 platform?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.validation.reason).toMatch(/retained 1 unresolved need/i);
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toEqual(["N1"]);
  });

  it("hard-routes a matching open governance topic even when the planner tries to answer", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("Composition must not run for a blocked topic");
      const first = (payload.candidates as Array<{ ref: string }>)[0];
      return { needs: [{ id: "N1", text: "Whether a 50% cross-product discount is allowed when moving from NLCEO to ISTV", lane: "answer", evidence_refs: [first.ref], supported_claim: "The discount is allowed.", reason: "Planner guessed.", route_key: null, clarification_question: "" }], confidence_score: 99, reasoning_summary: "Attempted answer." };
    });
    const result = await runAskSalesFaqV4("If someone has a $20K NLCEO license and wants an ISTV episode, is it 50% off?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.runtimeMetadata.plan.needs[0].reason).toMatch(/explicitly unresolved/);
  });

  it("preserves an omitted Apple TV promise clause as unresolved instead of trusting a narrowed model plan", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return {
          needs: [{ id: "COUNT_ONLY", text: "VIP Tier-1 platform count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "VIP includes submission to one Tier-1 platform.", reason: "Count only.", route_key: null, clarification_question: "" }],
          confidence_score: 99,
          reasoning_summary: "The planner omitted the promise clause.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "One platform.", sentences: [{ id: "COUNT", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" }] };
      }
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "The count is supported." }], need_checks: [{ need_id: "N1", status: "answered", reason: "The count is answered." }], reason: "The narrowed need passed." };
    });

    const result = await runAskSalesFaqV4("For VIP, is it one Tier-1 platform, and can I promise Apple TV placement?", [], { provider });
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation, candidates: result.runtimeMetadata.retrieval.candidates.slice(0, 8) })).toBe("partial");
    expect(result.needsRoute, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe(true);
    expect(result.answer).toContain("one Tier-1 platform");
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/promise Apple TV placement/i), reason: expect.stringMatching(/did not account/) }),
    ]));
  });

  it("injects the omitted crossover-discount blocker when a model plans only the ordinary price clause", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("No substantive answer should be composed for this adversarial plan");
      const first = (payload.candidates as Array<{ ref: string }>)[0];
      return {
        needs: [{ id: "PRICE_ONLY", text: "The ordinary NLCEO package price", lane: "answer", evidence_refs: [first.ref], supported_claim: "$20,000 is the package price.", reason: "The planner considered only price.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "The blocked crossover clause was omitted.",
      };
    });

    const result = await runAskSalesFaqV4("For a $20K NLCEO client adding an ISTV episode: what is the price, and is the crossover 50% off?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/crossover 50% off/i) }),
    ]));
  });

  it("keeps a clarification lane distinct inside a grounded partial answer", async () => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return { needs: [
          { id: "N1", text: "Tier-1 count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "One platform.", reason: "Direct.", route_key: null, clarification_question: "" },
          { id: "N2", text: "Which product the second pricing question means", lane: "clarify", evidence_refs: [], supported_claim: "", reason: "Product is ambiguous.", route_key: null, clarification_question: "Do you mean main ISTV or Daymond John / NLCEO for the pricing part?" },
        ], confidence_score: 85, reasoning_summary: "Answer plus clarification." };
      }
      if (purpose === "v4_claim_composition") return { summary: "One fact.", sentences: [{ id: "S1", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" }] };
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "Entailed." }], need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }], reason: "Grounded plus clarification." };
    });
    const result = await runAskSalesFaqV4("How many Tier-1 platforms, and what is the price for the other program?", [], { provider });
    expect(result.lane).toBe("partial");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toContain("Do you mean main ISTV or Daymond John / NLCEO");
    expect(result.answer).not.toContain("#sales-");
  });

  it("uses exact canonical price cards when the model is unavailable", async () => {
    const result = await runAskSalesFaqV4(
      "What are the current main ISTV prices and payment plans?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("answer");
    expect(result.answer).toContain("$12,000");
    expect(result.answer).toContain("4 x $3,000");
    expect(result.selectedPolicyIds).toEqual(expect.arrayContaining(["claim_c9e50172a4cd057b", "claim_28235f97538aac88"]));
    expect(result.runtimeMetadata.executionMode.planning).toBe("deterministic_fallback");
  });

  it("fails closed instead of answering an unrelated retrieval match without a model", async () => {
    const result = await runAskSalesFaqV4(
      "Which award categories have we won?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toMatch(/Keap|package|pre-promo/i);
  });

  it("routes requests for exact viewer statistics instead of substituting package numbers", async () => {
    const result = await runAskSalesFaqV4(
      "What is the average viewership per episode?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("route");
    expect(result.answer).not.toContain("100,000");
    expect(result.answer).not.toContain("150,000");
  });

  it("uses the owner-reviewed one-platform boundary in the no-model fallback", async () => {
    const result = await runAskSalesFaqV4(
      "For VIP, is submission to one Tier-1 platform or all three, and can the client pay extra for Apple TV?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("answer");
    expect(result.answer).toContain("one Tier-1 streaming platform");
    expect(result.answer).toContain("cannot pay extra");
    expect(result.selectedPolicyIds).toEqual(["owner-vip-tier-one-platform-boundary"]);
  });

  it("does not let the first deterministic whitelist family hide a second requested family", async () => {
    const result = await runAskSalesFaqV4(
      "For VIP, is it one Tier-1 platform, and what is the current main ISTV price?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).not.toBe("answer");
    expect(result.needsRoute).toBe(true);
    expect(result.answer).toContain("one Tier-1 streaming platform");
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/current main ISTV price/i) }),
    ]));
  });

  it("does not label a pricing-plus-qualification compound question fully answered in deterministic fallback", async () => {
    const result = await runAskSalesFaqV4(
      "What are the current main ISTV prices, and can a hospital-employed doctor qualify?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).not.toBe("answer");
    expect(result.needsRoute).toBe(true);
    expect(result.answer).toContain("$12,000");
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/hospital-employed doctor qualify/i) }),
    ]));
  });

  it("checks a specific open blocker before releasing any deterministic Tier-1 fallback", async () => {
    const result = await runAskSalesFaqV4(
      "If someone has a $20K NLCEO license and wants an ISTV episode, is the crossover 50% off; for VIP, is Tier-1 coverage one platform?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toContain("one Tier-1 streaming platform");
    expect(result.runtimeMetadata.plan.needs[0].reason).toMatch(/explicitly unresolved/);
  });

  it("does not bypass entailment validation when composition fails for a model-produced plan", async () => {
    let selectedRef = "";
    let validatorCalls = 0;
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return {
          needs: [{ id: "MODEL-ID", text: "VIP Tier-1 platform count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "One Tier-1 platform.", reason: "Direct.", route_key: null, clarification_question: "" }],
          confidence_score: 95,
          reasoning_summary: "Model plan.",
        };
      }
      throw new Error("Composer unavailable");
    });
    const validatorProvider: V3Provider = async () => {
      validatorCalls += 1;
      throw new Error("Validator unavailable");
    };

    const result = await runAskSalesFaqV4("For VIP, is it one Tier-1 platform?", [], { provider, validatorProvider });
    expect(validatorCalls).toBe(1);
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.executionMode).toMatchObject({ planning: "model", composition: "exact_evidence", validation: "model_and_deterministic" });
  });

  it("rejects a sentence that pools evidence across two atomic needs", async () => {
    let tierRef = "";
    let appRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        tierRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        appRef = refFor(payload, "Download the ISTV app on supported devices");
        return {
          needs: [
            { id: "TIER", text: "Main ISTV VIP Tier-1 coverage", lane: "answer", evidence_refs: [tierRef], supported_claim: "One Tier-1 platform.", reason: "Direct.", route_key: null, clarification_question: "" },
            { id: "APP", text: "Main ISTV app devices", lane: "answer", evidence_refs: [appRef], supported_claim: "Roku, Fire Stick, or Apple TV.", reason: "Direct.", route_key: null, clarification_question: "" },
          ],
          confidence_score: 94,
          reasoning_summary: "Two atomic needs.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return {
          summary: "Combined answer.",
          sentences: [{ id: "POOLED", text: "VIP includes one Tier-1 platform and the ISTV app is available on Roku.", need_ids: ["N1", "N2"], evidence_refs: [tierRef, appRef], kind: "answer" }],
        };
      }
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [tierRef, appRef], reason: "The pooled cards contain both clauses." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }, { need_id: "N2", status: "answered", reason: "Answered." }],
        reason: "Attempted cross-need approval.",
      };
    });

    const result = await runAskSalesFaqV4("For main ISTV, what does VIP cover and which devices support the app?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.answer).not.toContain("available on Roku");
    expect(result.runtimeMetadata.validation.sentenceChecks.length, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBeGreaterThan(0);
    expect(result.runtimeMetadata.validation.sentenceChecks[0].deterministicErrors).toEqual(expect.arrayContaining([
      "sentence cites evidence outside need N1",
      "sentence cites evidence outside need N2",
    ]));
  });

  it.each([
    { label: "empty", validatorRefs: [] as string[] },
    { label: "out-of-sentence", validatorRefs: ["C99"] },
  ])("rejects and retries a supported validator check with $label evidence refs", async ({ validatorRefs }) => {
    let selectedRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        selectedRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return { needs: [{ id: "N1", text: "VIP Tier-1 count", lane: "answer", evidence_refs: [selectedRef], supported_claim: "One platform.", reason: "Direct.", route_key: null, clarification_question: "" }], confidence_score: 90, reasoning_summary: "Direct." };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "One fact.", sentences: [{ id: "S1", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1"], evidence_refs: [selectedRef], kind: "answer" }] };
      }
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: validatorRefs, reason: "Claimed support." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "Claimed answer." }],
        reason: "Adversarial validator citation.",
      };
    });

    const result = await runAskSalesFaqV4("For VIP, is it one Tier-1 platform?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.validation.reason).toMatch(/retained 1 unresolved need/i);
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toEqual(["N1"]);
  });

  it("overwrites duplicate planner IDs and preserves each unresolved action and route", async () => {
    const provider = providerFor(({ purpose }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("No composition should run for route needs");
      return {
        needs: [
          { id: "DUPLICATE", text: "Confirm the invoice exception", lane: "route", evidence_refs: [], supported_claim: "", reason: "Finance-owned.", route_key: "finance", clarification_question: "" },
          { id: "DUPLICATE", text: "Fix the Keap login access", lane: "route", evidence_refs: [], supported_claim: "", reason: "Sales-tech-owned.", route_key: "sales_tech", clarification_question: "" },
        ],
        confidence_score: 20,
        reasoning_summary: "Two unresolved actions.",
      };
    });

    const result = await runAskSalesFaqV4("Can finance confirm an invoice exception while sales tech fixes my Keap login?", [], { provider });
    expect(result.runtimeMetadata.plan.needs.map((need) => need.id)).toEqual(["N1", "N2"]);
    expect(result.routeChannels).toEqual(["#sales-finance-requests", "#sales-tech-requests"]);
    expect(result.answer).toMatch(/invoice exception/i);
    expect(result.answer).toMatch(/Keap login access/i);
    expect(result.answer).toContain("#sales-finance-requests");
    expect(result.answer).toContain("#sales-tech-requests");
  });

  it("fails closed on an unknown product instead of releasing a product-sensitive model answer", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("Unsafe product-sensitive composition must not run");
      const pricingRef = refFor(payload, "ISTV, Next Level CEO Pricing, And Same-Day Discount: Answer");
      return {
        needs: [{ id: "PRICE", text: "Premium VIP price", lane: "answer", evidence_refs: [pricingRef], supported_claim: "Premium VIP costs $30,000.", reason: "Selected one product.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Unsafe unknown-scope answer.",
      };
    });

    const result = await runAskSalesFaqV4("What does the Premium VIP package cost?", [], { provider });
    expect(["clarify", "route"]).toContain(result.lane);
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toContain("$30,000");
  });

  it("routes a comparison plan that does not bind its product-sensitive need to a named product", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("Unsafe comparison composition must not run");
      const pricingRef = refFor(payload, "ISTV, Next Level CEO Pricing, And Same-Day Discount: Answer");
      return {
        needs: [{ id: "COMPARE", text: "Which one costs less?", lane: "answer", evidence_refs: [pricingRef], supported_claim: "One costs less.", reason: "Ambiguous comparison.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Unsafe comparison answer.",
      };
    });

    const result = await runAskSalesFaqV4("Which costs less: main ISTV or Daymond John / NLCEO?", [], { provider });
    expect(result.runtimeMetadata.turn.productScope).toBe("comparison");
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
  });

  it("formats a prior answer as bullets without calling a model or changing its facts", async () => {
    const provider = providerFor(() => { throw new Error("Provider should not run for a deterministic rewrite"); });
    const previous = "VIP includes submission to one Tier-1 platform. Placement is not guaranteed.";
    const result = await runAskSalesFaqV4("Format that as bullet points.", [
      { role: "user", content: "What does VIP include?" },
      { role: "assistant", content: previous },
    ], { provider });
    expect(result.lane).toBe("conversation");
    expect(result.answer).toBe("• VIP includes submission to one Tier-1 platform. • Placement is not guaranteed.");
    expect(result.provider).toBeNull();
  });

  it("removes only a repeated route note when the user asks for the confirmed answer", async () => {
    const provider = providerFor(() => { throw new Error("Provider should not run for a deterministic rewrite"); });
    const previous = "VIP includes submission to one Tier-1 platform. Placement is not guaranteed. For current Apple TV availability, please check #sales-questions-requests before replying.";
    const result = await runAskSalesFaqV4("Can you give me that answer without repeating the route note?", [
      { role: "user", content: "What can I say about VIP Tier-1 placement?" },
      { role: "assistant", content: previous },
    ], { provider });
    expect(result.lane).toBe("conversation");
    expect(result.answer).toBe("VIP includes submission to one Tier-1 platform. Placement is not guaranteed.");
    expect(result.answer).not.toContain("#sales-");
    expect(result.provider).toBeNull();
  });

  it("removes a malformed question-shaped route note without leaving a dangling fragment", async () => {
    const provider = providerFor(() => { throw new Error("Provider should not run for a deterministic rewrite"); });
    const previous = "The CEO Day upgrade is available for Next Level CEO at $5,000. The CEO Day upgrade is paid in full only. Please check #sales-questions-requests to confirm what turnaround terms apply to the $5,000 CEO Day upgrade for Next Level CEO? before replying.";
    const result = await runAskSalesFaqV4("That’s helpful. Can you give me the answer without repeating the route note?", [
      { role: "user", content: "What payment and turnaround terms apply to the CEO Day upgrade?" },
      { role: "assistant", content: previous },
    ], { provider });

    expect(result.lane).toBe("conversation");
    expect(result.answer).toBe("The CEO Day upgrade is available for Next Level CEO at $5,000. The CEO Day upgrade is paid in full only. No approved turnaround terms are confirmed for the $5,000 CEO Day upgrade for Next Level CEO.");
    expect(result.answer).not.toContain("#sales-");
    expect(result.answer).not.toMatch(/before replying/i);
    expect(result.provider).toBeNull();
  });

  it("does not turn the channel tail of a malformed artifact answer into its own checklist item", async () => {
    const provider = providerFor(() => { throw new Error("Provider should not run for a deterministic rewrite"); });
    const previous = "Get the current controlled resource or file for where can I find the document that explains the complete production process, including pre-production, filming, post-production, and expected scheduling timelines? from #sales-questions-requests.";
    const result = await runAskSalesFaqV4("Please turn your previous answer into a short checklist.", [
      { role: "user", content: "Where can I find the complete production-process document?" },
      { role: "assistant", content: previous },
    ], { provider });

    expect(result.lane).toBe("conversation");
    expect(result.answer).toMatch(/^• /);
    expect(result.answer).not.toMatch(/•\s*from\s+#/i);
    expect(result.answer).not.toMatch(/\?\s+from\s+#/i);
    expect(result.provider).toBeNull();
  });

  it("keeps fresh route grammar intact when the unresolved need is phrased as a question", async () => {
    const question = "What turnaround terms apply to the $5,000 CEO Day upgrade for Next Level CEO?";
    const provider = providerFor(({ purpose }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A route-only answer must not be composed");
      return {
        needs: [{ id: "TURNAROUND", text: question, lane: "route", evidence_refs: [], supported_claim: "", reason: "No current turnaround is governed.", route_key: "sales_policy", clarification_question: "" }],
        confidence_score: 90,
        reasoning_summary: "Current turnaround terms require confirmation.",
      };
    });
    const result = await runAskSalesFaqV4(question, [], { provider });

    expect(result.lane).toBe("route");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.answer).not.toMatch(/\?\s+before replying/i);
    expect(result.answer).not.toMatch(/\?\s+from\s+#/i);
  });

  it("shortens duplicate and route boilerplate without paraphrasing factual sentences", async () => {
    const provider = providerFor(() => { throw new Error("Provider should not run for a deterministic rewrite"); });
    const previous = "VIP includes submission to one Tier-1 platform. VIP includes submission to one Tier-1 platform. For current Apple TV availability, please check #sales-questions-requests before replying.";
    const result = await runAskSalesFaqV4("Make that shorter and simpler.", [
      { role: "user", content: "What can I say about VIP Tier-1 placement?" },
      { role: "assistant", content: previous },
    ], { provider });
    expect(result.lane).toBe("conversation");
    expect(result.answer).toBe("VIP includes submission to one Tier-1 platform. Current Apple TV availability: check #sales-questions-requests.");
    expect(result.provider).toBeNull();
  });

  it("answers the catalog but routes only its unknown maintained location", async () => {
    const result = await runAskSalesFaqV4(
      "Where do I check the current active show list?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("partial");
    expect(result.answer).toContain("Internet Masters TV");
    expect(result.answer).toContain("currently watchable");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.answer).not.toMatch(/aired or\.$/);
  });

  it("recognizes a plain list-of-shows request and preserves the complete governed catalog", async () => {
    const result = await runAskSalesFaqV4(
      "What are the list of shows we have?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("answer");
    expect(result.answer).toContain("Legacy Makers");
    expect(result.answer).toContain("currently watchable");
  });

  it("does not infer that the Apple TV paid-guarantee rule decides a paid all-three option", async () => {
    const result = await runAskSalesFaqV4(
      "Can they pay extra to go on all 3 Tier-1 platforms?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("partial");
    expect(result.answer).toContain("one Tier-1 streaming platform");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/pay extra.*all three/i) }),
    ]));
  });

  it("answers only the confirmed multiple-season fact when an exact season count is absent", async () => {
    const result = await runAskSalesFaqV4(
      "And how many seasons?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("partial");
    expect(result.answer).toContain("multiple seasons");
    expect(result.answer).toContain("#sales-questions-requests");
  });

  it("answers the governed 15-episodes-per-season fact without inventing a season count", async () => {
    const result = await runAskSalesFaqV4(
      "How many episodes do we normally do for a show?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("answer");
    expect(result.answer).toContain("15 per season");
  });

  it("uses the negative catalog boundary for a conceptual watchability question", async () => {
    const result = await runAskSalesFaqV4(
      "So being on the approved show list does not mean it is currently watchable, right?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane, JSON.stringify({ answer: result.answer, blocked: result.runtimeMetadata.retrieval.blockedTopicIds, plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("answer");
    expect(result.answer).toContain("does not by itself confirm");
    expect(result.answer).not.toContain("#sales-");
    expect(result.runtimeMetadata.retrieval.blockedTopicIds).not.toContain("accessibility-accommodations");
  });

  it("keeps exact show watchability as a bounded live lookup and uses the policy route", async () => {
    const result = await runAskSalesFaqV4(
      "Is Mompreneurs currently on air and where can a customer watch it?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane, JSON.stringify({ answer: result.answer, blocked: result.runtimeMetadata.retrieval.blockedTopicIds, plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("partial");
    expect(result.answer).toContain("does not by itself confirm");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
  });

  it.each([
    ["What is the approved guidance for Call 1 Flow?", "Call 1", "Save pricing and closing mechanics for Call 2"],
    ["What is the approved guidance for Post-Sale Handoff After Close?", "post-sale", "Book the onboarding call for the next day"],
  ])("answers the exact named %s article from its canonical answer cards", async (question, _label, expected) => {
    const result = await runAskSalesFaqV4(question, [], { provider: unavailableProvider, validatorProvider: unavailableProvider });
    expect(result.lane, JSON.stringify({ question, answer: result.answer, blocked: result.runtimeMetadata.retrieval.blockedTopicIds, plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("answer");
    expect(result.answer).toContain(expected);
    expect(result.selectedPolicyIds.length).toBeGreaterThan(1);
  });

  it("routes STOP subscriber reinstatement to sales tech when a model is unavailable", async () => {
    const result = await runAskSalesFaqV4(
      "A lead texted STOP. How do I resubscribe or reinstate the subscriber?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.needsRoute, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe(true);
    expect(result.routeChannels).toEqual(["#sales-tech-requests"]);
    expect(result.answer, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toMatch(/sales tech has cleared/i);
    expect(result.answer).not.toContain("#sales-questions-requests");
    expect(result.runtimeMetadata.plan.needs.filter((need) => need.lane !== "answer")).toHaveLength(1);
  });

  it("does not label a compound client-email fact check and rewrite complete from one platform policy", async () => {
    const result = await runAskSalesFaqV4(
      "Please help me rewrite this client email about Amazon Prime search issues, the ISTV app, and the VIP advantages. How can I better write the email?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("partial");
    expect(result.answer).toContain("one Tier-1 streaming platform");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.answer).not.toContain("#sales-finance-requests");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expect(result.runtimeMetadata.plan.needs.filter((need) => need.lane !== "answer")).toHaveLength(1);
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/client-message fact check and rewrite/i) }),
    ]));
  });

  it("routes an episode airing timeline without substituting the catalog-watchability boundary", async () => {
    const result = await runAskSalesFaqV4(
      "How long does it take to get an episode aired on ISTV?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expect(result.answer).not.toContain("show list");
  });

  it("answers the exact contract-before-Call-2 review boundary without an unrelated media-pack blocker", async () => {
    const result = await runAskSalesFaqV4(
      "Can I send a copy of the license contract to their legal team to review before Call 2?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("answer");
    expect(result.answer).toContain("can send the contract before Call 2");
    expect(result.answer).not.toMatch(/^"|"\.$/);
    expect(result.runtimeMetadata.retrieval.blockedTopicIds).not.toContain("blocked_c709bc9eb8678e91");
  });

  it("returns the exact STOP reinstatement instruction and routes confirmation to sales tech", async () => {
    const result = await runAskSalesFaqV4(
      "A prospect texted STOP but replied six days later and wants to book. Can I contact her?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("partial");
    expect(result.answer).toContain("Post in the tech channel");
    expect(result.answer).toMatch(/sales tech has cleared/i);
    expect(result.routeChannels).toEqual(["#sales-tech-requests"]);
    expect(result.answer).not.toContain("#sales-questions-requests");
    expect(result.runtimeMetadata.plan.needs.filter((need) => need.lane !== "answer")).toHaveLength(1);
  });

  it.each([
    ["Where can I download ISTV?", "Roku"],
    ["Which major streaming plaforms are we on?", "Amazon Prime Video"],
  ])("handles a common terse or misspelled governed request: %s", async (question, expected) => {
    const result = await runAskSalesFaqV4(question, [], { provider: unavailableProvider, validatorProvider: unavailableProvider });
    expect(result.lane).toBe("answer");
    expect(result.answer).toContain(expected);
  });

  it.each([
    { family: "main prices", question: "What are the current main ISTV prices?", decisionKey: "istv-nlceo-pricing-and-same-day-discount-answer-1" },
    { family: "main payments", question: "What payment plans are listed for main ISTV?", decisionKey: "istv-nlceo-pricing-and-same-day-discount-answer-2" },
    { family: "same-day discount", question: "For main ISTV, what is the same-day discount rule?", decisionKeyPrefix: "istv-nlceo-pricing-and-same-day-discount-answer-4-", policyIdPrefix: "claim_170a9cfe81cce514__" },
    { family: "DJ/NLCEO offers", question: "What are the current Daymond John / NLCEO prices?", decisionKey: "dj-nlceo-current-offer-overview" },
    { family: "Tier-1 boundary", question: "For VIP, is it one Tier-1 platform or all three?", decisionKey: "vip-license-platform-coverage" },
    { family: "app devices", question: "Where can I download the ISTV app?", decisionKey: "istv-app-download-devices" },
    { family: "current show list", question: "What is the current approved main ISTV show list?", decisionKey: "current-show-source-latest-approved-show-list-1", policyIdPrefix: "kr_7ace400fcdf68db9" },
    { family: "watchability boundary", question: "Does being on the main ISTV show list mean an episode is currently watchable?", decisionKey: "current-show-list-watchability-boundary" },
    { family: "ROI boundary", question: "Can main ISTV guarantee ROI?", decisionKey: "roi-questions" },
    { family: "language boundary", question: "Can main ISTV film the full episode in Spanish?", decisionKeyPrefix: "production-language-and-translation-boundary-what-reps-can-say-1-", policyIdPrefix: "claim_c4d5b6e53d0ee393__" },
    { family: "season capacity", question: "How many seasons can a main ISTV show have?", decisionKey: "show-season-capacity" },
  ])("resolves the stable $family fallback family without a model", async ({ question, decisionKey, decisionKeyPrefix, policyIdPrefix }) => {
    const result = await runAskSalesFaqV4(question, [], { provider: unavailableProvider, validatorProvider: unavailableProvider });
    const candidates = result.runtimeMetadata.retrieval.candidates;
    const decisionKeys = candidates.map((candidate) => candidate.decisionKey);
    expect(result.runtimeMetadata.executionMode.planning).toBe("deterministic_fallback");
    if (decisionKey) expect(decisionKeys).toContain(decisionKey);
    if (decisionKeyPrefix) expect(decisionKeys.some((key) => key.startsWith(decisionKeyPrefix))).toBe(true);
    if (policyIdPrefix) expect(candidates.some((candidate) => candidate.id.startsWith(policyIdPrefix))).toBe(true);
  });

  it("does not apply the non-English partner rule to an unrelated veteran-partner question", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A rejected special-condition answer must not be composed");
      const wrongRef = refFor(payload, "Spanish/non-English lead");
      return {
        needs: [{ id: "WRONG", text: "Whether a non-veteran qualifies through a veteran business partner", lane: "answer", evidence_refs: [wrongRef], supported_claim: "A partner can be auditioned.", reason: "The planner confused two partner rules.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Adversarial prerequisite mismatch.",
      };
    });

    const result = await runAskSalesFaqV4("Can a non-veteran qualify for America's Heroes if their business partner is a veteran?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toContain("partner can be auditioned");
  });

  it("does not apply the canceled-Call-2 waiting period to an existing customer without that prerequisite", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A rejected special-condition answer must not be composed");
      const wrongRef = refFor(payload, "Main ISTV reapplication for a different show after a canceled Call 2");
      return {
        needs: [{ id: "WRONG", text: "Whether an existing ISTV customer can apply to another show now", lane: "answer", evidence_refs: [wrongRef], supported_claim: "They must wait three months.", reason: "The planner ignored the cancellation prerequisite.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Adversarial prerequisite mismatch.",
      };
    });

    const result = await runAskSalesFaqV4("An existing ISTV customer wants to apply to another show. Can they apply now?", [], { provider });
    expect(result.lane).toBe("answer");
    expect(result.selectedPolicyIds).toContain("claim_606e9d59e3cd964f");
    expect(result.selectedPolicyIds).not.toContain("owner-main-istv-cross-show-reapply-wait");
    expect(result.answer).toMatch(/may purchase another show.*do not automatically skip/i);
    expect(result.answer).not.toContain("wait three months");
  });

  it("answers two recurring-invoice needs collectively from product-agnostic evidence", async () => {
    let recurringRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        recurringRef = refFor(payload, "Recurring invoices, ledger entries, and rep commission invoices");
        return {
          needs: [
            { id: "INVOICE", text: "Whether recurring client invoices are automated", lane: "answer", evidence_refs: [recurringRef], supported_claim: "Client invoices are automated.", reason: "Direct.", route_key: null, clarification_question: "" },
            { id: "LEDGER", text: "Whether recurring payments should appear in the ledger", lane: "answer", evidence_refs: [recurringRef], supported_claim: "Recurring payments should appear in the ledger.", reason: "Direct.", route_key: null, clarification_question: "" },
          ],
          confidence_score: 96,
          reasoning_summary: "Both clauses are governed by one product-agnostic policy.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return { summary: "Both are confirmed.", sentences: [
          { id: "AUTO", text: "Client invoices for recurring payments are automated.", need_ids: ["N1"], evidence_refs: [recurringRef], kind: "answer" },
          { id: "LEDGER", text: "Recurring payments should appear in the ledger.", need_ids: ["N2"], evidence_refs: [recurringRef], kind: "answer" },
        ] };
      }
      return {
        sentence_checks: [
          { sentence_id: "S1", status: "supported", evidence_refs: [recurringRef], reason: "Entailed." },
          { sentence_id: "S2", status: "supported", evidence_refs: [recurringRef], reason: "Entailed." },
        ],
        need_checks: [
          { need_id: "N1", status: "answered", reason: "Answered." },
          { need_id: "N2", status: "answered", reason: "Answered." },
        ],
        reason: "Both needs are grounded.",
      };
    });

    const result = await runAskSalesFaqV4("Are recurring-payment invoices automated, and should those payments appear in the ledger?", [], { provider });
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toContain("automated");
    expect(result.answer).toContain("appear in the ledger");
    expect(result.runtimeMetadata.plan.needs).toHaveLength(2);
  });

  it("uses the V4-only fulfillment destination for current scriptwriter scheduling", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A route-only plan must not invoke composition");
      const fulfillmentRef = refFor(payload, "Scriptwriter scheduling when no times are available");
      return {
        needs: [{ id: "SCRIPT", text: "Where to send a scriptwriter scheduling issue when no times are available", lane: "route", evidence_refs: [fulfillmentRef], supported_claim: "", reason: "Current fulfillment owns this scheduling issue.", route_key: null, clarification_question: "" }],
        confidence_score: 95,
        reasoning_summary: "Exact owner-backed route.",
      };
    });

    const result = await runAskSalesFaqV4("A client cannot find any scriptwriter-call times. Where should I send this?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.routeChannels).toEqual(["the fulfillment hotline"]);
    expect(result.answer).toContain("the fulfillment hotline");
    expect(result.answer).not.toContain("#sales-questions-requests");
  });

  it("allows the owner-approved six-month training status to answer its exact question", async () => {
    let trainingRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        trainingRef = refFor(payload, "Six-month weekly training status");
        return {
          needs: [{ id: "TRAINING", text: "Whether cast members still receive weekly training for six months", lane: "answer", evidence_refs: [trainingRef], supported_claim: "The six-month weekly training program has been discontinued.", reason: "Exact owner-approved status.", route_key: null, clarification_question: "" }],
          confidence_score: 96,
          reasoning_summary: "Direct governed instruction.",
        };
      }
      if (purpose === "v4_claim_composition") return { summary: "The old program is discontinued.", sentences: [{ id: "STATUS", text: "The six-month weekly training program has been discontinued.", need_ids: ["N1"], evidence_refs: [trainingRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [trainingRef], reason: "Exact status." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }],
        reason: "Grounded.",
      };
    });

    const result = await runAskSalesFaqV4("Do cast members still get weekly training for six months after they join?", [], { provider });
    expect(result.lane).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toContain("has been discontinued");
    expect(result.selectedPolicyIds).toContain("owner-six-month-training-discontinued");
  });

  it("collectively covers an existing-customer cross-show question without injecting a false route", async () => {
    let existingClientRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        existingClientRef = refFor(payload, "Existing client buying another show");
        return {
          needs: [
            { id: "PURCHASE", text: "Whether an existing ISTV customer may buy another show's license", lane: "answer", evidence_refs: [existingClientRef], supported_claim: "Yes, an existing cast member can buy another show.", reason: "Direct.", route_key: null, clarification_question: "" },
            { id: "OWNER", text: "Whether the current rep should proceed with the new application", lane: "answer", evidence_refs: [existingClientRef], supported_claim: "Check Keap for the original assignment; if that rep is inactive, the current rep can take it.", reason: "Direct.", route_key: null, clarification_question: "" },
          ],
          confidence_score: 96,
          reasoning_summary: "Both requested parts are covered.",
        };
      }
      if (purpose === "v4_claim_composition") return { summary: "Proceed after checking ownership.", sentences: [
        { id: "BUY", text: "An existing cast member can buy another show's license.", need_ids: ["N1"], evidence_refs: [existingClientRef], kind: "answer" },
        { id: "OWNER", text: "Check Keap scheduled appointments for the original assignment; if the original rep is inactive, the current rep can take it.", need_ids: ["N2"], evidence_refs: [existingClientRef], kind: "answer" },
      ] };
      return {
        sentence_checks: [
          { sentence_id: "S1", status: "supported", evidence_refs: [existingClientRef], reason: "Entailed." },
          { sentence_id: "S2", status: "supported", evidence_refs: [existingClientRef], reason: "Entailed." },
        ],
        need_checks: [
          { need_id: "N1", status: "answered", reason: "Answered." },
          { need_id: "N2", status: "answered", reason: "Answered." },
        ],
        reason: "Grounded.",
      };
    });

    const result = await runAskSalesFaqV4("If someone is already an ISTV customer but applies for a different ISTV show, should I proceed with the new application or skip the call?", [], { provider });
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.runtimeMetadata.plan.needs).toHaveLength(2);
    expect(result.selectedPolicyIds).toContain("claim_606e9d59e3cd964f");
    expect(result.answer).toContain("Check Keap");
    expect(result.answer).not.toContain("three months");
  });

  it("rejects a bank-block contract exception when the corrected question has no failed payment", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A rejected bank-block exception must not be composed");
      const wrongRef = refForDecisionKey(payload, "main-istv-call-2-cohort-reschedule-rules-answer-2-a4");
      return {
        needs: [{ id: "WRONG", text: "How to verify that the main ISTV contract was signed", lane: "answer", evidence_refs: [wrongRef], supported_claim: "The contract should still be signed.", reason: "The planner confused verification with a payment exception.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Adversarial prerequisite mismatch.",
      };
    });
    const history = [
      { role: "user" as const, content: "Where do I verify whether a Daymond John / NLCEO contract has been signed?" },
      { role: "assistant" as const, content: "Please verify it in the approved system." },
    ];

    const result = await runAskSalesFaqV4("Correction: I mean the main ISTV contract, not NLCEO. Where do I verify that it was signed?", history, { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toContain("contract should still be signed");
  });

  it("answers the named-show reapplication rule when all cancellation prerequisites are present", async () => {
    let waitRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        waitRef = refFor(payload, "Main ISTV reapplication for a different show after a canceled Call 2");
        return {
          needs: [{ id: "WAIT", text: "Whether the applicant may switch from Legacy Makers to America's Authors immediately after canceling Call 2 because they could not invest", lane: "answer", evidence_refs: [waitRef], supported_claim: "They must wait three months before reapplying, even for a different show.", reason: "Exact governed condition.", route_key: null, clarification_question: "" }],
          confidence_score: 97,
          reasoning_summary: "All prerequisites match.",
        };
      }
      if (purpose === "v4_claim_composition") return { summary: "The waiting period applies.", sentences: [{ id: "WAIT", text: "They must wait three months before reapplying, even for a different main ISTV show.", need_ids: ["N1"], evidence_refs: [waitRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [waitRef], reason: "Exact condition." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }],
        reason: "Grounded.",
      };
    });

    const result = await runAskSalesFaqV4("A Legacy Makers applicant canceled Call 2 because they could not make the investment and now wants America's Authors. Can they apply now?", [], { provider });
    expect(result.lane).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toContain("wait three months");
    expect(result.selectedPolicyIds).toContain("owner-main-istv-cross-show-reapply-wait");
  });

  it("answers the exact owner-approved response to photographing confidential slides", async () => {
    let slideRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        slideRef = refFor(payload, "Photographing confidential slides during a call");
        return {
          needs: [{ id: "SLIDES", text: "What to do when a prospect photographs confidential call slides", lane: "answer", evidence_refs: [slideRef], supported_claim: "Ask them to stop, explain confidentiality, and delete the photos.", reason: "Exact governed action.", route_key: null, clarification_question: "" }],
          confidence_score: 97,
          reasoning_summary: "Direct governed instruction.",
        };
      }
      if (purpose === "v4_claim_composition") return { summary: "Stop and delete the photos.", sentences: [{ id: "SLIDES", text: "Ask the prospect to stop, explain that the slides are confidential, and ask them to delete any photos already taken.", need_ids: ["N1"], evidence_refs: [slideRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [slideRef], reason: "Exact action." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }],
        reason: "Grounded.",
      };
    });

    const result = await runAskSalesFaqV4("What should I do if a prospect starts photographing the slides during the sales call?", [], { provider });
    expect(result.lane).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toContain("Ask the prospect to stop");
    expect(result.answer).toContain("delete any photos");
    expect(result.selectedPolicyIds).toContain("claim_d8f7bb6d2647ddd3");
  });

  it("re-grounds the qa-7-4 actor correction against the immediate slide-photo subject", async () => {
    let slideRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        const candidates = payload.candidates as Array<{ ref: string; title: string; v4_support_mode: string }>;
        const slide = candidates.find((candidate) => candidate.title === "Photographing confidential slides during a call");
        expect(slide).toBeDefined();
        expect(slide!.v4_support_mode).toBe("direct_governed_instruction");
        slideRef = slide!.ref;
        return {
          needs: [{ id: "REP", text: "What the rep should do when a prospect photographs confidential Call 1 slides", lane: "answer", evidence_refs: [slideRef], supported_claim: "The rep should ask the prospect to stop, explain confidentiality, and ask for deletion of the photos.", reason: "Exact immediate subject and governed action.", route_key: null, clarification_question: "" }],
          confidence_score: 97,
          reasoning_summary: "The correction changes perspective, not the underlying slide-photo decision.",
        };
      }
      if (purpose === "v4_claim_composition") return { summary: "The rep should intervene.", sentences: [{ id: "REP", text: "The rep should ask the prospect to stop, explain that the slides are confidential, and ask them to delete any photos already taken.", need_ids: ["N1"], evidence_refs: [slideRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [slideRef], reason: "Exact governed action." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "The rep actions are stated." }],
        reason: "Grounded correction.",
      };
    });
    const previousQuestion = "What should I do if a prospect starts taking photos of the Call 1 presentation slides during the call?";
    const result = await runAskSalesFaqV4("You misunderstood me—I’m asking what the rep should do, not what the prospect should do.", [
      { role: "user", content: previousQuestion },
      { role: "assistant", content: "Ask the prospect to stop, explain that the slides are confidential, and ask them to delete any photos already taken." },
    ], { provider });

    expect(result.runtimeMetadata.turn.kind).toBe("follow_up");
    expect(result.runtimeMetadata.turn.explicitCorrection).toBe(true);
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation })).toBe("conversation");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toMatch(/^Those are the rep’s actions:/i);
    expect(result.answer).toMatch(/ask the prospect to stop/i);
    expect(result.selectedPolicyIds).toEqual([]);
  });

  it("does not let an unrelated correction reuse the prior slide-photo policy", async () => {
    let slideRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        slideRef = refFor(payload, "Photographing confidential slides during a call");
        return {
          needs: [{ id: "EVENT", text: "Whether event access should be explained during Call 2 or onboarding", lane: "answer", evidence_refs: [slideRef], supported_claim: "Ask the prospect to stop photographing slides.", reason: "Adversarially reused the prior subject.", route_key: null, clarification_question: "" }],
          confidence_score: 99,
          reasoning_summary: "Unsafe stale-context reuse.",
        };
      }
      if (purpose === "v4_claim_composition") return { summary: "Stop the photos.", sentences: [{ id: "WRONG", text: "Ask the prospect to stop photographing the slides.", need_ids: ["N1"], evidence_refs: [slideRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [slideRef], reason: "Adversarial validator approval." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "Adversarial validator approval." }],
        reason: "Adversarial approval.",
      };
    });
    const result = await runAskSalesFaqV4("You misunderstood me—I’m asking whether event access is explained on Call 2 or during onboarding, not what to do about slide photos.", [
      { role: "user", content: "What should I do if a prospect photographs the Call 1 slides?" },
      { role: "assistant", content: "Ask the prospect to stop and delete the photos." },
    ], { provider });

    expect(result.selectedPolicyIds).not.toContain("claim_d8f7bb6d2647ddd3");
    expect(result.answer).not.toContain("stop photographing");
    expect(result.answer).toMatch(/event|Mastermind|onboarding/i);
  });

  it("does not reuse prior DJ-only pricing evidence after a correction to main ISTV", async () => {
    let djRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        djRef = refFor(payload, "Current Daymond John and Next Level CEO offer overview");
        return {
          needs: [{ id: "MAIN", text: "The current main ISTV package prices", lane: "answer", evidence_refs: [djRef], supported_claim: "The Daymond John package is $25,000.", reason: "Adversarially retained the previous product.", route_key: null, clarification_question: "" }],
          confidence_score: 99,
          reasoning_summary: "Unsafe prior-product reuse.",
        };
      }
      if (purpose === "v4_claim_composition") return { summary: "$25,000.", sentences: [{ id: "WRONG", text: "The package is $25,000.", need_ids: ["N1"], evidence_refs: [djRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [djRef], reason: "Adversarial validator approval." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "Adversarial validator approval." }],
        reason: "Adversarial approval.",
      };
    });
    const result = await runAskSalesFaqV4("Actually, I meant main ISTV instead. What are the total package prices?", [
      { role: "user", content: "What are the Daymond John package prices?" },
      { role: "assistant", content: "Daymond John has separate package pricing." },
    ], { provider });

    expect(result.runtimeMetadata.turn.productScope).toBe("main_istv");
    expect(result.runtimeMetadata.turn.excludedScopes).toContain("dj_nlceo");
    expect(result.lane).not.toBe("answer");
    expect(result.selectedPolicyIds).not.toContain("owner-dj-nlceo-current-offer-overview");
    expect(result.answer).not.toContain("$25,000");
  });

  it("does not preserve a false validator abstention when a supported sentence deterministically answers the need", async () => {
    let tierRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        tierRef = refFor(payload, "VIP Tier-1 platform coverage and Apple TV paid-submission boundary");
        return { needs: [{ id: "TIER", text: "VIP includes submission to one Tier-1 platform", lane: "answer", evidence_refs: [tierRef], supported_claim: "VIP includes submission to one Tier-1 platform.", reason: "Direct.", route_key: null, clarification_question: "" }], confidence_score: 96, reasoning_summary: "Direct." };
      }
      if (purpose === "v4_claim_composition") return { summary: "One platform.", sentences: [{ id: "TIER", text: "VIP includes submission to one Tier-1 platform.", need_ids: ["N1"], evidence_refs: [tierRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [tierRef], reason: "Entailed." }],
        need_checks: [{ need_id: "N1", status: "unresolved", reason: "Incorrect abstention." }],
        reason: "Overly conservative need check.",
      };
    });

    const result = await runAskSalesFaqV4("For VIP, is submission to one Tier-1 platform?", [], { provider });
    expect(result.lane).toBe("answer");
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).not.toContain("N1");
    expect(result.answer).toContain("one Tier-1 platform");
  });

  it("answers the exact Friday deadline without reviving a broad blocker", async () => {
    let fridayRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        fridayRef = refFor(payload, "Friday Call 1 and Sunday cohort deadline");
        return { needs: [{ id: "DEADLINE", text: "Whether a Friday Call 1 may have Call 2 on Monday after the Sunday deadline", lane: "answer", evidence_refs: [fridayRef], supported_claim: "No; Call 2 must happen before the Sunday deadline.", reason: "Exact decision.", route_key: null, clarification_question: "" }], confidence_score: 97, reasoning_summary: "Direct." };
      }
      if (purpose === "v4_claim_composition") return { summary: "Before Sunday.", sentences: [{ id: "DEADLINE", text: "Call 2 must happen before the Sunday deadline for both outbound and inbound Friday Call 1s.", need_ids: ["N1"], evidence_refs: [fridayRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [fridayRef], reason: "Exact decision." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }],
        reason: "Grounded.",
      };
    });

    const result = await runAskSalesFaqV4("If Call 1 happens Friday, can Call 2 happen Monday after the Sunday cohort closes?", [], { provider });
    expect(result.runtimeMetadata.retrieval.blockedTopicIds).not.toContain("blocked_45abaf241abea0b6");
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, blocked: result.runtimeMetadata.retrieval.blockedTopicIds })).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.routeChannels).toEqual([]);
    expect(result.answer).toContain("before the Sunday deadline");
  });

  it("keeps the one-platform fact but routes an unapproved cast-member selection right", async () => {
    const result = await runAskSalesFaqV4(
      "Can a cast member choose which Tier 1 streaming platform their show will be submitted to?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, validation: result.runtimeMetadata.validation, candidates: result.runtimeMetadata.retrieval.candidates.slice(0, 8) })).toBe("partial");
    expect(result.answer).toContain("one Tier-1 streaming platform");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.answer).not.toMatch(/cast member (?:can|may) choose/i);
    expect(result.runtimeMetadata.plan.needs).toEqual(expect.arrayContaining([
      expect.objectContaining({ lane: "route", text: expect.stringMatching(/controls which (?:eligible )?Tier-1 platform/i) }),
    ]));
  });

  it("does not let an unrelated six-month training policy suppress the six-month reapplication blocker", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("Blocked reapplication guidance must not be composed");
      const trainingRef = refFor(payload, "Six-month weekly training status");
      return {
        needs: [{ id: "WRONG", text: "Whether declining a greenlight requires six-month reapplication", lane: "answer", evidence_refs: [trainingRef], supported_claim: "The six-month weekly training program is discontinued.", reason: "The planner matched only six-month wording.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Adversarial near-match.",
      };
    });

    const result = await runAskSalesFaqV4("Can reps tell greenlit leads that declining is not an open invitation and requires six-month reapplication?", [], { provider });
    expect(result.runtimeMetadata.retrieval.blockedTopicIds).toContain("blocked_69ff9de4eff992ed");
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toContain("weekly training program");
    expect(result.runtimeMetadata.plan.needs[0].reason).toMatch(/explicitly unresolved/i);
  });

  it("keeps a validator abstention when a supported sentence omits the requested Friday time", async () => {
    let fridayRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        fridayRef = refFor(payload, "Friday Call 1 and Sunday cohort deadline");
        return { needs: [{ id: "TIME", text: "What time on Friday is Call 1", lane: "answer", evidence_refs: [fridayRef], supported_claim: "A Friday Call 1 requires Call 2 before Sunday.", reason: "The planner confused a related deadline with the requested time.", route_key: null, clarification_question: "" }], confidence_score: 99, reasoning_summary: "Adversarial overlap." };
      }
      if (purpose === "v4_claim_composition") return { summary: "Related deadline only.", sentences: [{ id: "DEADLINE", text: "A Friday Call 1 must have Call 2 before the Sunday deadline.", need_ids: ["N1"], evidence_refs: [fridayRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [fridayRef], reason: "The sentence itself is entailed." }],
        need_checks: [{ need_id: "N1", status: "unresolved", reason: "No Friday time was provided." }],
        reason: "The requested time remains unresolved.",
      };
    });

    const result = await runAskSalesFaqV4("What time on Friday is Call 1?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toContain("N1");
    expect(result.answer).not.toContain("must have Call 2 before");
  });

  it("keeps a validator abstention when a status sentence does not answer why training ended", async () => {
    let trainingRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        trainingRef = refFor(payload, "Six-month weekly training status");
        return { needs: [{ id: "WHY", text: "Why was the six-month weekly training discontinued", lane: "answer", evidence_refs: [trainingRef], supported_claim: "The six-month weekly training program was discontinued.", reason: "The planner confused status with reason.", route_key: null, clarification_question: "" }], confidence_score: 99, reasoning_summary: "Adversarial why question." };
      }
      if (purpose === "v4_claim_composition") return { summary: "Status only.", sentences: [{ id: "STATUS", text: "The six-month weekly training program has been discontinued.", need_ids: ["N1"], evidence_refs: [trainingRef], kind: "answer" }] };
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [trainingRef], reason: "The status sentence is entailed." }],
        need_checks: [{ need_id: "N1", status: "unresolved", reason: "The evidence gives no reason why." }],
        reason: "The reason remains unresolved.",
      };
    });

    const result = await runAskSalesFaqV4("Why was the six-month weekly training discontinued?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toContain("N1");
    expect(result.answer).not.toContain("training program has been discontinued");
  });

  it("does not infer that separate financial difficulty caused a scheduling cancellation", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A causally mismatched waiting-period answer must not be composed");
      const waitRef = refFor(payload, "Main ISTV reapplication for a different show after a canceled Call 2");
      return {
        needs: [{ id: "WRONG", text: "Whether the scheduling cancellation triggers the three-month wait", lane: "answer", evidence_refs: [waitRef], supported_claim: "They must wait three months.", reason: "The planner treated separate financial difficulty as the cause.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Adversarial causal mismatch.",
      };
    });

    const result = await runAskSalesFaqV4("They canceled Call 2 for a scheduling conflict; because they could not afford a different add-on, they declined that add-on. Must they wait three months before applying to another main ISTV show?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toContain("must wait three months");
  });

  it.each([
    {
      label: "hospital employment is negated",
      question: "The physician is not employed by a hospital. Can they qualify?",
      title: "Hospital-employed doctors and nurse distinction",
      decisionKey: null,
      claim: "A hospital-employed doctor must own the private practice.",
    },
    {
      label: "the bank block is negated",
      question: "The bank did not block the payment. Should the main ISTV contract still be signed before payment?",
      title: null,
      decisionKey: "main-istv-call-2-cohort-reschedule-rules-answer-2-a4",
      claim: "The contract should still be signed.",
    },
    {
      label: "cancellation was not caused by inability to invest",
      question: "They could afford it but canceled Call 2 for a scheduling conflict. Must they wait three months to apply to another main ISTV show?",
      title: "Main ISTV reapplication for a different show after a canceled Call 2",
      decisionKey: null,
      claim: "They must wait three months.",
    },
  ])("rejects a special-condition policy when $label", async ({ question, title, decisionKey, claim }) => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A negated prerequisite answer must not be composed");
      const wrongRef = title ? refFor(payload, title) : refForDecisionKey(payload, decisionKey!);
      return {
        needs: [{ id: "WRONG", text: question, lane: "answer", evidence_refs: [wrongRef], supported_claim: claim, reason: "The planner ignored negation.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Adversarial negation.",
      };
    });

    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(["route", "clarify"]).toContain(result.lane);
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toContain(claim);
  });

  it("treats a style-only request as conversation without retrieval or model calls", async () => {
    const provider = providerFor(() => { throw new Error("A style-only request must not call a provider"); });
    const result = await runAskSalesFaqV4("I have several unrelated sales questions. Can you keep your answers short and practical?", [], { provider });

    expect(result.lane).toBe("conversation");
    expect(result.answer).toBe("Yes—I’ll keep the answers short and practical.");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.retrieval.candidateCount).toBe(0);
  });

  it("does not apply a two-people episode rule to one applicant's two businesses", async () => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A rejected decision-object analogy must not be composed");
      const wrongRef = refFor(payload, "Two people in one episode");
      return {
        needs: [{ id: "WRONG", text: "Whether the applicant may mention both separate businesses in one Operation CEO episode", lane: "answer", evidence_refs: [wrongRef], supported_claim: "The applicant can mention both businesses.", reason: "The planner confused two people with two businesses.", route_key: null, clarification_question: "" }],
        confidence_score: 99,
        reasoning_summary: "Adversarial entity analogy.",
      };
    });

    const result = await runAskSalesFaqV4("For Operation CEO, can an applicant with two different businesses mention both in one episode?", [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.answer).not.toMatch(/can mention both businesses/i);
  });

  it("still allows the governed two-business-partners episode rule for two people", async () => {
    let partnerRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        partnerRef = refFor(payload, "Couple/business partners on same episode");
        return { needs: [{ id: "PARTNERS", text: "Whether two business partners may share one episode", lane: "answer", evidence_refs: [partnerRef], supported_claim: "Typically two people at most can share an episode.", reason: "Exact people/partner rule.", route_key: null, clarification_question: "" }], confidence_score: 96, reasoning_summary: "Exact governed actor match." };
      }
      if (purpose === "v4_claim_composition") return { summary: "Two people may share.", sentences: [{ id: "PARTNERS", text: "Typically two people at most can share an episode.", need_ids: ["N1"], evidence_refs: [partnerRef], kind: "answer" }] };
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [partnerRef], reason: "Entailed." }], need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }], reason: "Grounded." };
    });

    const result = await runAskSalesFaqV4("Can two business partners share one episode?", [], { provider });
    expect(result.lane).toBe("answer");
    expect(result.answer).toContain("two people at most");
  });

  it.each([
    {
      label: "unlisted payment split",
      question: "My lead wants the $20K license but wants to make a $3K first payment now and pay the remaining $17K in three weeks. Which contract should they sign?",
      policyIds: ["owner-unlisted-payment-split-boundary"],
      answer: /custom split|listed payment plan/i,
    },
    {
      label: "freelancer qualification",
      question: "Should freelancers move to Call 2, or do they need an established business to qualify?",
      policyIds: ["claim_59be9c344b9359a4"],
      answer: /freelancing by itself should not be treated as entrepreneurship/i,
    },
    {
      label: "public-calendar fallback",
      question: "If my public calendar only allows bookings within two days but an outbound lead is available next week, what is the correct booking process?",
      policyIds: ["claim_d93982445e426907", "claim_5af708598311071c"],
      answer: /use Google/i,
    },
    {
      label: "previously claimed lead",
      question: "If a dial-out lead no-showed Call 1 with another rep, may I rebook the lead on my calendar, or should I contact the original rep?",
      policyIds: ["v3src_previously_claimed_twenty_percent_lead"],
      answer: /Contact the original rep first/i,
    },
    {
      label: "six-month training alternatives",
      question: "Do we have any additional material that explains the six-month training program really well?",
      policyIds: ["owner-six-month-training-discontinued"],
      answer: /Rudy's call videos.*Media Kit/i,
    },
  ])("uses the exact deterministic governed path for $label", async ({ question, policyIds, answer }) => {
    const result = await runAskSalesFaqV4(question, [], { provider: unavailableProvider, validatorProvider: unavailableProvider });
    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.needsRoute).toBe(false);
    expect(result.answer).toMatch(answer);
    expect(result.selectedPolicyIds).toEqual(expect.arrayContaining(policyIds));
    expect(result.runtimeMetadata.executionMode).toMatchObject({ planning: "deterministic_governed", composition: "exact_evidence", validation: "deterministic_exact_evidence" });
  });

  it("routes ACH authorization mechanics only to finance", async () => {
    const question = "If someone splits $20K into four payments and makes the first payment by ACH, will the remaining payments draft automatically by ACH? Do they need to approve each payment, or do we need a credit card for future payments?";
    const provider = providerFor(({ purpose }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A route-only answer must not be composed");
      return {
        needs: [
          { id: "DRAFT", text: "Will future installments automatically draft by ACH?", lane: "route", evidence_refs: [], supported_claim: "", reason: "Finance-owned ACH mechanics.", route_key: "sales_policy", clarification_question: "" },
          { id: "APPROVE", text: "Must the payer approve each future ACH payment?", lane: "route", evidence_refs: [], supported_claim: "", reason: "Finance-owned authorization mechanics.", route_key: "sales_policy", clarification_question: "" },
          { id: "CARD", text: "Is a card required for future payments?", lane: "route", evidence_refs: [], supported_claim: "", reason: "Finance-owned future-card requirement.", route_key: "sales_policy", clarification_question: "" },
        ],
        confidence_score: 90,
        reasoning_summary: "All three needs require finance.",
      };
    });
    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(result.lane).toBe("route");
    expect(result.routeChannels).toEqual(["#sales-finance-requests"]);
  });

  it("routes signed-agreement visibility to sales tech even when ACH appears in the setup", async () => {
    const question = "A client paid through the link by ACH, but the contract did not appear; it only said ACH in progress. I sent the agreement separately, and the client says they signed it. Where can I see the signed agreement?";
    const provider = providerFor(({ purpose }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A route-only answer must not be composed");
      return { needs: [{ id: "AGREEMENT", text: question, lane: "route", evidence_refs: [], supported_claim: "", reason: "The signed agreement location is unresolved.", route_key: "finance", clarification_question: "" }], confidence_score: 90, reasoning_summary: "Visibility requires the contract tool owner." };
    });
    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(result.routeChannels).toEqual(["#sales-tech-requests"]);
    expect(result.answer).not.toContain("#sales-finance-requests");
  });

  it("classifies an unresolved production-process document as an artifact through sales policy", async () => {
    const question = "Where can I find the document that explains the complete production process, including pre-production, filming, post-production, and expected scheduling timelines?";
    const provider = providerFor(({ purpose }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("An artifact-only answer must not be composed");
      return { needs: [{ id: "DOC", text: question, lane: "route", evidence_refs: [], supported_claim: "", reason: "The current governed document location is unresolved.", route_key: "fulfillment", clarification_question: "" }], confidence_score: 90, reasoning_summary: "Current artifact location required." };
    });
    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(result.lane, JSON.stringify({ plan: result.runtimeMetadata.plan, routes: result.routeChannels })).toBe("artifact");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expect(result.answer).toMatch(/^Request the current controlled resource or file for the document/i);
    expect(result.answer).not.toMatch(/\?\s+from\s+#/i);
    expect(result.answer).not.toMatch(/for where can (?:i|we) find/i);
    expect(result.answer).not.toContain("fulfillment hotline");
  });

  it("does not append a duplicate route after an exact PayMe answer", async () => {
    let payMeRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        payMeRef = refFor(payload, "Recurring payments do not need a second PayMe post");
        return { needs: [{ id: "PAYME", text: "Whether another PayMe entry is required for the recurring payment", lane: "answer", evidence_refs: [payMeRef], supported_claim: "A second PayMe post is not required for a recurring payment on the same sale.", reason: "Exact decision.", route_key: null, clarification_question: "" }], confidence_score: 97, reasoning_summary: "Exact governed answer." };
      }
      if (purpose === "v4_claim_composition") return { summary: "No second post.", sentences: [{ id: "PAYME", text: "A second PayMe post is not required for a recurring payment on the same sale.", need_ids: ["N1"], evidence_refs: [payMeRef], kind: "answer" }] };
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [payMeRef], reason: "Entailed." }], need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }], reason: "Grounded." };
    });
    const result = await runAskSalesFaqV4("Do I need to submit another PayMe entry when a recurring payment appears in the payment feed?", [], { provider });
    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.runtimeMetadata.plan.needs).toHaveLength(1);
    expect(result.routeChannels).toEqual([]);
  });

  it("does not mistake an opt-out process answer for an unresolved Keap access issue", async () => {
    let optOutRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        optOutRef = refFor(payload, "Opt-out when the rep cannot reach the person again");
        return { needs: [{ id: "OPTOUT", text: "How to complete the opt-out process when the rep can no longer contact the person", lane: "answer", evidence_refs: [optOutRef], supported_claim: "Use the official opt-out channel and complete the internal steps.", reason: "Exact process.", route_key: null, clarification_question: "" }], confidence_score: 97, reasoning_summary: "Exact governed answer." };
      }
      if (purpose === "v4_claim_composition") return { summary: "Use the internal process.", sentences: [{ id: "OPTOUT", text: "Put the person's information into the official opt-out channel and complete the internal opt-out steps rather than trying to contact the person again.", need_ids: ["N1"], evidence_refs: [optOutRef], kind: "answer" }] };
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [optOutRef], reason: "Entailed." }], need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }], reason: "Grounded." };
    });
    const result = await runAskSalesFaqV4("If a client opts out and I can no longer text them in Zoom Phone or email them through Keap, how do I complete the opt-out process?", [], { provider });
    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.runtimeMetadata.plan.needs).toHaveLength(1);
    expect(result.routeChannels).toEqual([]);
  });

  it("does not let an exact governed shortcut swallow an appended unrelated request", async () => {
    const question = "Should freelancers move to Call 2, or do they need an established business to qualify? And what is the current main ISTV VIP price?";
    const result = await runAskSalesFaqV4(question, [], { provider: unavailableProvider, validatorProvider: unavailableProvider });

    expect(result.runtimeMetadata.executionMode.planning).not.toBe("deterministic_governed");
    expect(result.lane).not.toBe("answer");
    expect(result.runtimeMetadata.plan.needs.some((need) => /freelanc|qualif|business/i.test(need.text))).toBe(true);
    expect(result.runtimeMetadata.plan.needs.some((need) => /price|vip/i.test(need.text))).toBe(true);
  });

  it.each([
    {
      label: "unlisted split plus Mastermind attendance",
      question: "Can I offer $3,000 now and $17,000 later, and can they attend Mastermind?",
      policyTitle: "Unlisted payment amounts and split proposals",
      claim: "Treat any combination of payment amounts or dates that is not one of the current listed plans as a custom split. Do not offer or suggest it. Use the listed payment plan that fits, the matching contract, and the current official payment link.",
      unresolvedPattern: /attend|mastermind/i,
      answeredClausePattern: /\$3,?000|\$17,?000|payment amounts?|custom split/i,
    },
    {
      label: "freelancer qualification plus red-carpet attendance",
      question: "Should freelancers move to Call 2, and can they attend the red-carpet event?",
      policyTitle: "Freelancing alone is not treated as entrepreneurship",
      claim: "Freelancing by itself should not be treated as entrepreneurship for qualification. Evaluate whether the person has a genuine business, offer, ownership, and broader fit rather than qualifying them solely because they take freelance jobs.",
      unresolvedPattern: /attend|red-carpet|event/i,
      answeredClausePattern: /freelanc|call\s*2|qualif/i,
    },
    {
      label: "unlisted split plus guest invitation",
      question: "Can I offer $3,000 now and $17,000 later, and should I use the contract for a guest invitation?",
      policyTitle: "Unlisted payment amounts and split proposals",
      claim: "Treat any combination of payment amounts or dates that is not one of the current listed plans as a custom split. Do not offer or suggest it. Use the listed payment plan that fits, the matching contract, and the current official payment link.",
      unresolvedPattern: /guest|invitation|invite/i,
      answeredClausePattern: /\$3,?000|\$17,?000|payment amounts?|custom split/i,
    },
  ])("routes the uncovered second clause when a planner overstates one answer need: $label", async ({
    question,
    policyTitle,
    claim,
    unresolvedPattern,
    answeredClausePattern,
  }) => {
    let evidenceRef = "";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose === "v4_atomic_plan") {
        evidenceRef = refFor(payload, policyTitle);
        return {
          needs: [{
            id: "WHOLE_QUESTION",
            text: question,
            lane: "answer",
            evidence_refs: [evidenceRef],
            supported_claim: claim,
            reason: "The planner copied the whole question even though its evidence supports only the first clause.",
            route_key: null,
            clarification_question: "",
          }],
          confidence_score: 99,
          reasoning_summary: "Adversarial whole-question answer need.",
        };
      }
      if (purpose === "v4_claim_composition") {
        return {
          summary: claim,
          sentences: [{ id: "FIRST_CLAUSE_ONLY", text: claim, need_ids: ["N1"], evidence_refs: [evidenceRef], kind: "answer" }],
        };
      }
      return {
        sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [evidenceRef], reason: "The first-clause sentence is entailed." }],
        need_checks: [{ need_id: "N1", status: "answered", reason: "The adversarial validator accepts the overbroad need." }],
        reason: "The runtime must still preserve the uncovered second clause.",
      };
    });

    const result = await runAskSalesFaqV4(question, [], { provider, validatorProvider: provider });
    const unresolvedNeeds = result.runtimeMetadata.plan.needs.filter((need) => need.lane !== "answer");
    const diagnostic = JSON.stringify({ lane: result.lane, needs: result.runtimeMetadata.plan.needs, answer: result.answer });

    expect(result.lane, diagnostic).toBe("partial");
    expect(unresolvedNeeds.some((need) => unresolvedPattern.test(need.text)), diagnostic).toBe(true);
    expect(unresolvedNeeds.some((need) => answeredClausePattern.test(need.text)), diagnostic).toBe(false);
  });

  it("does not let an irrelevant scriptwriter-policy citation force fulfillment routing", async () => {
    const question = "A cast member has a scriptwriter, but where can I find the complete production-process document?";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("An artifact-only answer must not be composed");
      const irrelevantRef = refFor(payload, "Scriptwriter scheduling when no times are available");
      return { needs: [{ id: "DOC", text: "Where to find the complete production-process document", lane: "route", evidence_refs: [irrelevantRef], supported_claim: "", reason: "The planner cited a scriptwriter route for an unrelated document lookup.", route_key: "fulfillment", clarification_question: "" }], confidence_score: 90, reasoning_summary: "Adversarial route citation." };
    });

    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(result.lane).toBe("artifact");
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expect(result.answer).not.toContain("fulfillment hotline");
  });

  it("does not let an artifact need swallow a separate scriptwriter-scheduling request", async () => {
    const question = "Where can I find the complete production-process document? And what should I do if the scriptwriter has no booking times?";
    const provider = providerFor(({ purpose }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("This plan has no answer lane");
      return { needs: [{ id: "DOC", text: "Where to find the complete production-process document", lane: "route", evidence_refs: [], supported_claim: "", reason: "The current document location is unresolved.", route_key: "sales_policy", clarification_question: "" }], confidence_score: 70, reasoning_summary: "The planner omitted the scheduling request." };
    });

    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(result.runtimeMetadata.plan.needs).toHaveLength(2);
    expect(result.runtimeMetadata.plan.needs.some((need) => /scriptwriter|booking times/i.test(need.text))).toBe(true);
  });

  it("does not route an unrelated legal need to fulfillment from scriptwriter setup text", async () => {
    const question = "Scriptwriter scheduling is working normally; which team approves a legal exception?";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("This plan has no answer lane");
      const irrelevantRef = refFor(payload, "Scriptwriter scheduling when no times are available");
      return { needs: [{ id: "LEGAL", text: "Which team approves a legal exception?", lane: "route", evidence_refs: [irrelevantRef], supported_claim: "", reason: "A legal owner is required.", route_key: "fulfillment", clarification_question: "" }], confidence_score: 70, reasoning_summary: "Adversarial compound setup." };
    });

    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(result.routeChannels).not.toContain("the fulfillment hotline");
    expect(result.answer).not.toContain("fulfillment hotline");
  });

  it("does not let an irrelevant ordinary route-policy citation choose the destination", async () => {
    const question = "The Keap issue is resolved; which team approves a legal exception?";
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("This plan has no answer lane");
      const irrelevantRef = refFor(payload, "Keap access and Thryv confusion");
      return { needs: [{ id: "LEGAL", text: "Which team approves a legal exception?", lane: "route", evidence_refs: [irrelevantRef], supported_claim: "", reason: "The legal owner is unresolved.", route_key: "sales_tech", clarification_question: "" }], confidence_score: 70, reasoning_summary: "Adversarial route-policy citation." };
    });

    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(result.runtimeMetadata.plan.needs).toHaveLength(1);
    expect(result.routeChannels).toEqual(["#sales-questions-requests"]);
    expect(result.answer).not.toContain("#sales-tech-requests");
  });

  it.each([
    {
      question: "Can reps mention the minimum investment on Call 1 when vetting a prospect?",
      policyTitle: "License pricing PDF before Call 2",
      claim: "Reps should not mention the minimum investment on Call 1.",
      blockedId: "blocked_5bd0a1e1f41418c9",
    },
    {
      question: "Which shows are paused or still casting?",
      policyTitle: "Is Love Experts still casting?",
      claim: "Love Experts is still casting.",
      blockedId: "blocked_a64c7c206c741940",
    },
  ])("hard-routes a canonical open conflict before an adjacent policy can answer", async ({ question, policyTitle, claim, blockedId }) => {
    const provider = providerFor(({ purpose, payload }) => {
      if (purpose !== "v4_atomic_plan") throw new Error("A hard blocker must stop composition");
      const wrongRef = refFor(payload, policyTitle);
      return { needs: [{ id: "N", text: question, lane: "answer", evidence_refs: [wrongRef], supported_claim: claim, reason: "Adjacent evidence.", route_key: null, clarification_question: "" }], confidence_score: 95, reasoning_summary: "Adversarial answer." };
    });

    const result = await runAskSalesFaqV4(question, [], { provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.retrieval.blockedTopicIds).toContain(blockedId);
  });

  it.each([
    { question: "Does bankruptcy disqualify an applicant from Call 2?", blockedId: "bankruptcy-qualification" },
    { question: "Who owns the opportunity when a prospect is considering both main ISTV and Daymond John?", blockedId: "dual-product-opportunity-ownership" },
    { question: "Can we promise audio-description accessibility accommodations?", blockedId: "accessibility-accommodations" },
  ])("hard-routes a narrowly reviewed legacy blocker without asking the model: $blockedId", async ({ question, blockedId }) => {
    const result = await runAskSalesFaqV4(question, [], { provider: unavailableProvider, validatorProvider: unavailableProvider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.retrieval.blockedTopicIds).toContain(blockedId);
  });

  it.each([
    "Should a freelancer with a violent felony move to Call 2?",
    "They are not a freelancer but do own a business; should they qualify for Call 2?",
    "Can I offer $3,000 now and $17,000 later with a guaranteed refund?",
    "The client did not ask for $3,000 first and $17,000 later; can I use the listed contract split?",
    "Where do I change OnceHub so later booking times appear?",
    "OnceHub is not unavailable and later times are visible; may I book the appointment?",
    "This is not a previously claimed 20% dial-out lead from another rep; may I rebook it?",
    "When exactly was the six-month weekly training discontinued?",
    "Who decided to discontinue the six-month weekly training?",
    "Can they pay $3,000 now and $17,000 later, and can they attend Mastermind?",
    "Should freelancers move to Call 2, and can they attend the red-carpet event?",
    "If OnceHub only shows times for two days, what is the booking process, and may I record the call?",
    "If a 20% dial-out lead no-showed with another rep, should I contact the original rep, and can I offer a veteran discount?",
    "Do we have material for the six-month training program, and may the client invite a guest?",
    "Should a freelancer move to Call 2, or can they attend the red-carpet event?",
    "Should a freelancer move to Call 2 plus attend the red-carpet event?",
    "Should a freelancer move to Call 2 as well as receive a veteran discount?",
    "Is the six-month training discontinued but may the client bring a guest?",
    "If a 20% dial-out lead no-showed another rep, should I contact the original rep, and should the original rep record the call?",
    "Can I offer $3,000 now and $17,000 later, and should I use the contract for a guest invitation?",
    "Is six-month training discontinued, and is the media kit available for guest invitations?",
  ])("does not use deterministic governed evidence for an adjacent, compound, or negated decision", async (question) => {
    const result = await runAskSalesFaqV4(question, [], { provider: unavailableProvider, validatorProvider: unavailableProvider });
    expect(result.runtimeMetadata.executionMode.planning).not.toBe("deterministic_governed");
    expect(result.lane).not.toBe("answer");
  });

  it.each([
    { question: "Moving from Daymond John to Inside Success TV: offers?", policyId: "claim_c9e50172a4cd057b" },
    { question: "Moving from Daymond John to Inside Success TV: prices?", policyId: "claim_c9e50172a4cd057b" },
    { question: "Switching from Daymond John to main ISTV: payments?", policyId: "claim_28235f97538aac88" },
  ])("answers a terse main ISTV object after an explicit switch away from DJ", async ({ question, policyId }) => {
    const result = await runAskSalesFaqV4(question, [], { provider: unavailableProvider, validatorProvider: unavailableProvider });
    expect(result.lane, JSON.stringify(result.runtimeMetadata.plan)).toBe("answer");
    expect(result.runtimeMetadata.turn.productScope).toBe("main_istv");
    expect(result.runtimeMetadata.turn.excludedScopes).toContain("dj_nlceo");
    expect(result.selectedPolicyIds).toContain(policyId);
  });
});
