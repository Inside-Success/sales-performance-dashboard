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
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "$2.5k is equivalent to $2,500." }], need_checks: [{ need_id: "N1", status: "answered", reason: "The minimum is answered." }, { need_id: "N2", status: "unresolved", reason: "The schedule is unresolved." }], reason: "Grounded partial." };
    });

    const result = await runAskSalesFaqV4("Can they put $2.5k down on Lite now and use a special schedule to upgrade to VIP later?", [], { provider });
    expect(result.lane).toBe("partial");
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
    expect(result.lane).toBe("partial");
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
    expect(result.lane).toBe("partial");
    expect(result.answer).toContain("one Tier-1 platform");
    expect(result.answer).toContain("#sales-questions-requests");
    expect(result.runtimeMetadata.validation.unresolvedNeedIds).toContain("N2");
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
    expect(result.lane).toBe("partial");
    expect(result.needsRoute).toBe(true);
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
      return { sentence_checks: [{ sentence_id: "S1", status: "supported", evidence_refs: [selectedRef], reason: "Entailed." }], need_checks: [{ need_id: "N1", status: "answered", reason: "Answered." }, { need_id: "N2", status: "unresolved", reason: "Clarification required." }], reason: "Grounded plus clarification." };
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
    expect(result.runtimeMetadata.validation.sentenceChecks[0].deterministicErrors).toEqual(expect.arrayContaining([
      "sentence cites evidence outside need N1",
      "sentence cites evidence outside need N2",
    ]));
  });

  it.each([
    { label: "empty", validatorRefs: [] as string[], expectedError: "validator supplied no evidence reference" },
    { label: "out-of-sentence", validatorRefs: ["C99"], expectedError: "validator cited evidence outside the sentence" },
  ])("rejects a supported validator check with $label evidence refs", async ({ validatorRefs, expectedError }) => {
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
    expect(result.runtimeMetadata.validation.sentenceChecks[0].deterministicErrors).toContain(expectedError);
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
    expect(result.answer).toContain("Confirm the invoice exception");
    expect(result.answer).toContain("Fix the Keap login access");
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
    expect(result.needsRoute).toBe(true);
    expect(result.routeChannels).toEqual(["#sales-tech-requests"]);
    expect(result.answer).toContain("confirm whether sales tech has cleared");
    expect(result.answer).not.toContain("#sales-questions-requests");
    expect(result.runtimeMetadata.plan.needs.filter((need) => need.lane !== "answer")).toHaveLength(1);
  });

  it("does not label a compound client-email fact check and rewrite complete from one platform policy", async () => {
    const result = await runAskSalesFaqV4(
      "Please help me rewrite this client email about Amazon Prime search issues, the ISTV app, and the VIP advantages. How can I better write the email?",
      [],
      { provider: unavailableProvider, validatorProvider: unavailableProvider },
    );
    expect(result.lane).toBe("partial");
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
    expect(result.answer).toContain("confirm whether sales tech has cleared");
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
});
