import { describe, expect, it } from "vitest";

import type { V3Provider } from "@/lib/ask-sales-faq/v3/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { runAskSalesFaqV5 } from "@/lib/ask-sales-faq/v5/runtime";

function providerFor(handler: (purpose: string, payload: Record<string, unknown>) => Record<string, unknown>): V3Provider {
  return async <T>(input: Parameters<V3Provider>[0]) => ({
    output: input.parse(JSON.stringify(handler(input.purpose, JSON.parse(input.user) as Record<string, unknown>))),
    provider: "deepseek",
    model: "v5-test-model",
    attempts: [{ provider: "deepseek", model: "v5-test-model", purpose: input.purpose, status: "success", latencyMs: 1 }],
  }) as Awaited<ReturnType<V3Provider>> & { output: T };
}

describe("Ask Sales V5 bounded runtime", () => {
  it("answers through the bounded source planner and sentence validator", async () => {
    const policy = getV5KnowledgeSnapshot().policies.find(
      (candidate) => candidate.id === "claim_e30857cfce9af5e5",
    );
    expect(policy).toBeDefined();
    let selectedRef = "";
    const provider = providerFor((purpose, payload) => {
      if (purpose === "v4_systemic_query_plan") return {
        needs: [{
          text: "For main ISTV, can reps create a custom payment plan when a client asks?",
          retrieval_queries: ["custom payment plan approved spreadsheet"],
          product_scope: "main_istv",
          domains: ["payments"],
          actions: ["offer payment plan"],
          entities: ["custom payment plan"],
          relation: "payment_option",
          request_kind: "knowledge",
          ambiguity: "none",
          clarification_question: "",
        }],
        reasoning_summary: "One atomic payment-option decision.",
      };
      if (purpose === "v4_systemic_source_plan") {
        const cards = payload.candidateCards as Array<{ ref: string; id: string }>;
        const card = cards.find((candidate) => candidate.id === policy!.id);
        expect(card).toBeDefined();
        selectedRef = card!.ref;
        return {
          needs: [{
            need_id: "N1",
            direct_refs: [selectedRef],
            conflicts: [],
            preferred_refs: [selectedRef],
            disposition: "answer",
            reason: "Rich's direct payment-plan rule controls.",
          }],
          reasoning_summary: "Selected the direct authoritative rule.",
        };
      }
      if (purpose === "v4_systemic_evidence_answer" || purpose === "v4_systemic_evidence_answer_retry") {
        const cards = payload.candidateCards as Array<{ ref: string; id: string; decision: string }>;
        const card = cards.find((candidate) => candidate.id === policy!.id);
        expect(card).toBeDefined();
        selectedRef = card!.ref;
        return {
          needs: [{
            need_id: "N1",
            lane: "answer",
            evidence_refs: [selectedRef],
            answer_sentences: [{ text: card!.decision, evidence_refs: [selectedRef] }],
            route_key: null,
            clarification_question: "",
            confidence: 0.97,
            reason: "Direct source evidence.",
          }],
          natural_answer: "",
          reasoning_summary: "Used only the preferred source.",
        };
      }
      const sentences = payload.sentences as Array<{ sentence_id: string; need_id: string; evidence_refs: string[] }>;
      return {
        checks: sentences.map((sentence) => ({
          sentence_id: sentence.sentence_id,
          status: "supported",
          evidence_refs: sentence.evidence_refs,
          answered_need_ids: [sentence.need_id],
          reason: "The sentence is exact source evidence.",
        })),
      };
    });

    const result = await runAskSalesFaqV5("For main ISTV, can reps create a custom payment plan when a client asks?", [], { provider, validatorProvider: provider });
    expect(result.lane, JSON.stringify({
      answer: result.answer,
      selectedPolicyIds: result.selectedPolicyIds,
      retrieval: result.runtimeMetadata.retrieval,
      attempts: result.runtimeMetadata.providerAttempts.map((attempt) => attempt.purpose),
    })).toBe("answer");
    expect(result.answer).toMatch(/should not suggest, create, or promise|only the approved listed/i);
    expect(result.selectedPolicyIds).toContain(policy!.id);
    expect(result.runtimeMetadata).toMatchObject({
      pipelineVersion: "v5-isolated",
      isolation: { productionSelectorChanged: false, databaseWrites: false, historyPersistence: false },
      knowledgeVersion: getV5KnowledgeSnapshot().knowledgeVersion,
    });
    expect(result.runtimeMetadata.retrieval.candidateCount).toBeLessThanOrEqual(10);
    expect(result.runtimeMetadata.retrieval.diagnostics?.needs[0].hardCompatible).toBeGreaterThan(0);
  });

  it("routes an unknown named decision without falling through to a similarity answer", async () => {
    const purposes: string[] = [];
    const provider = providerFor((purpose) => {
      purposes.push(purpose);
      if (purpose === "v4_systemic_query_plan") return {
        needs: [{
          text: "What is the ZQXV-991 lunar referral override?",
          retrieval_queries: ["ZQXV-991 lunar referral override"],
          product_scope: "unknown",
          domains: ["unknown"],
          actions: ["confirm"],
          entities: ["ZQXV-991 lunar referral override"],
          relation: "definition",
          request_kind: "knowledge",
          ambiguity: "none",
          clarification_question: "",
        }],
        reasoning_summary: "One unknown named decision.",
      };
      if (purpose === "v4_systemic_evidence_answer") return {
        needs: [{
          need_id: "N1",
          lane: "route",
          evidence_refs: [],
          answer_sentences: [],
          route_key: "sales_policy",
          clarification_question: "",
          confidence: 0.1,
          reason: "No approved evidence exists for the named decision.",
        }],
        natural_answer: "",
        reasoning_summary: "Routed without guessing.",
      };
      throw new Error(`Unexpected provider stage ${purpose}`);
    });

    const result = await runAskSalesFaqV5("What is the ZQXV-991 lunar referral override?", [], { provider, validatorProvider: provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.retrieval.candidateCount).toBe(0);
    expect(result.answer).toContain("#sales-questions-requests");
    expect(purposes).toEqual(["v4_systemic_query_plan", "v4_systemic_evidence_answer"]);
  });

  it("fails closed instead of falling back to a broader runtime when source adjudication fails", async () => {
    const policy = getV5KnowledgeSnapshot().policies.find(
      (candidate) => candidate.id === "claim_e30857cfce9af5e5",
    );
    expect(policy).toBeDefined();
    const purposes: string[] = [];
    const provider: V3Provider = async <T>(input: Parameters<V3Provider>[0]) => {
      purposes.push(input.purpose);
      if (input.purpose === "v4_systemic_query_plan") {
        const output = input.parse(JSON.stringify({
          needs: [{
            text: "For main ISTV, can reps create a custom payment plan?",
            retrieval_queries: ["main ISTV custom payment plan"],
            product_scope: "main_istv",
            domains: ["payments"],
            actions: ["create payment plan"],
            entities: ["custom payment plan"],
            relation: "payment_option",
            request_kind: "knowledge",
            ambiguity: "none",
            clarification_question: "",
          }],
          reasoning_summary: "One payment decision.",
        }));
        return {
          output,
          provider: "deepseek",
          model: "v5-test-model",
          attempts: [{ provider: "deepseek", model: "v5-test-model", purpose: input.purpose, status: "success", latencyMs: 1 }],
        } as Awaited<ReturnType<V3Provider>> & { output: T };
      }
      if (input.purpose === "v4_systemic_source_plan") throw new Error("source planner unavailable");
      if (input.purpose === "v4_systemic_evidence_answer") {
        const output = input.parse(JSON.stringify({
          needs: [{
            need_id: "N1",
            lane: "route",
            evidence_refs: [],
            answer_sentences: [],
            route_key: "sales_policy",
            clarification_question: "",
            confidence: 0.1,
            reason: "Source adjudication failed closed.",
          }],
          natural_answer: "",
          reasoning_summary: "No unadjudicated answer.",
        }));
        return {
          output,
          provider: "deepseek",
          model: "v5-test-model",
          attempts: [{ provider: "deepseek", model: "v5-test-model", purpose: input.purpose, status: "success", latencyMs: 1 }],
        } as Awaited<ReturnType<V3Provider>> & { output: T };
      }
      throw new Error(`Unexpected provider stage ${input.purpose}`);
    };

    const result = await runAskSalesFaqV5("For main ISTV, can reps create a custom payment plan?", [{
      role: "user",
      content: "For main ISTV, can reps create a custom payment plan?",
    }], { provider, validatorProvider: provider });
    expect(result.lane).toBe("route");
    expect(result.selectedPolicyIds).toEqual([]);
    expect(result.runtimeMetadata.pipelineVersion).toBe("v5-isolated");
    expect(result.runtimeMetadata.sourcePlan?.reasoningSummary).toContain("failed closed");
    expect(purposes).toEqual(["v4_systemic_query_plan", "v4_systemic_source_plan", "v4_systemic_evidence_answer"]);
  });
});
