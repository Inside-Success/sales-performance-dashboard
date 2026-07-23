import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

import curatedAuthority from "@/lib/ask-sales-faq/v4/systemic/curated-authority-supplement.json";
import { getV4SystemicCorpus } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { retrieveV4SystemicPolicies } from "@/lib/ask-sales-faq/v4/systemic/retrieval";
import { inferV4SystemicPolicyRelations, inferV4SystemicRelation, inferV4SystemicRequestKind } from "@/lib/ask-sales-faq/v4/systemic/relations";
import type { V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { resolveV4Turn } from "@/lib/ask-sales-faq/v4/turn";

const operationalAnswer = getV4SystemicCorpus().find((policy) =>
  policy.systemic.sourceClass === "authoritative_operational_qna" &&
  policy.answerability === "answer_evidence" &&
  policy.question_families[0],
);

describe("V4 systemic generalized retrieval", () => {
  it("retrieves a compiled operational policy without policy-specific matcher code", () => {
    expect(operationalAnswer).toBeDefined();
    const question = operationalAnswer!.question_families[0];
    const turn = resolveV4Turn(question, []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: question,
        retrievalQueries: [question],
        productScope: operationalAnswer!.product_scopes[0] === "main_istv" || operationalAnswer!.product_scopes[0] === "dj_nlceo"
          ? operationalAnswer!.product_scopes[0]
          : "unknown",
        domains: operationalAnswer!.domains,
        actions: operationalAnswer!.actions,
        entities: operationalAnswer!.entities,
        relation: inferV4SystemicPolicyRelations(operationalAnswer!)[0],
        requestKind: inferV4SystemicRequestKind(question),
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const retrieval = retrieveV4SystemicPolicies(turn, plan);
    const rank = retrieval.candidates.find((candidate) => candidate.policy.id === operationalAnswer!.id)?.rank;

    expect(rank).toBeDefined();
    expect(rank).toBeLessThanOrEqual(20);
    expect(retrieval.candidates.find((candidate) => candidate.policy.id === operationalAnswer!.id)?.policy.systemic.sourceClass)
      .toBe("authoritative_operational_qna");
  });

  it("keeps temporal operational records retrievable but structurally unable to answer", () => {
    const temporal = getV4SystemicCorpus().find((policy) =>
      policy.systemic.sourceClass === "authoritative_operational_qna" &&
      policy.systemic.temporalRisk !== "stable" &&
      policy.question_families[0],
    );
    expect(temporal).toBeDefined();
    expect(temporal?.answerability).toBe("route_or_support");
    expect(temporal?.systemic.temporalRisk).not.toBe("stable");
  });

  it("keeps governed answer evidence in the model window after the operational overlay is added", () => {
    const governed = getV4SystemicCorpus().find((policy) =>
      policy.systemic.sourceClass === "governed_policy" &&
      policy.answerability === "answer_evidence" &&
      policy.question_families[0],
    );
    expect(governed).toBeDefined();
    const question = governed!.question_families[0];
    const turn = resolveV4Turn(question, []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: question,
        retrievalQueries: [question],
        productScope: "unknown",
        domains: governed!.domains,
        actions: governed!.actions,
        entities: governed!.entities,
        relation: inferV4SystemicPolicyRelations(governed!)[0],
        requestKind: inferV4SystemicRequestKind(question),
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const rank = retrieveV4SystemicPolicies(turn, plan).candidates.find((candidate) => candidate.policy.id === governed!.id)?.rank;
    expect(rank).toBeDefined();
    expect(rank).toBeLessThanOrEqual(42);
  });

  it("treats governed product-agnostic evidence as compatible with a named product", () => {
    const governedAgnostic = getV4SystemicCorpus().find((policy) =>
      policy.systemic.sourceClass === "governed_policy" &&
      policy.product_scopes.includes("product_agnostic") &&
      policy.answerability === "answer_evidence" &&
      /included in all packages/i.test(policy.decision),
    );
    expect(governedAgnostic).toBeDefined();
    expect(governedAgnostic?.systemic.temporalRisk).toBe("stable");
    const question = "For main ISTV, is Mastermind or red-carpet access included?";
    const turn = resolveV4Turn(question, []);
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: "Confirm whether Mastermind or red-carpet access is included",
        retrievalQueries: [question, "event access included in all packages"],
        productScope: "main_istv",
        domains: ["events"],
        actions: ["confirm access"],
        entities: ["Mastermind", "red carpet"],
        relation: inferV4SystemicRelation(question),
        requestKind: inferV4SystemicRequestKind(question),
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "test",
    };
    const rank = retrieveV4SystemicPolicies(turn, plan).candidates
      .find((candidate) => candidate.policy.id === governedAgnostic!.id)?.rank;
    expect(rank).toBeDefined();
    expect(rank).toBeLessThanOrEqual(20);
  });

  it("contains no question-family-specific asks-functions or embedded policy IDs", () => {
    const source = readFileSync(path.join(process.cwd(), "src/lib/ask-sales-faq/v4/systemic/retrieval.ts"), "utf8");
    expect(source).not.toMatch(/function\s+asks[A-Z]/);
    expect(source).not.toMatch(/claim_[a-f0-9]{8,}|owner-[a-z0-9-]{8,}|operational_[a-f0-9]{8,}/);
  });

  it("accounts for every supplied meeting and screenshot source before curating decisions", () => {
    expect(curatedAuthority.evidence_register).toHaveLength(10);
    expect(curatedAuthority.evidence_register.every((record) => record.sha256.length === 64)).toBe(true);
    expect(curatedAuthority.evidence_register.every((record) => record.disposition && record.note)).toBe(true);
  });

  it("retrieves every curated direct-authority decision through the same generalized path", () => {
    const curatedIds = new Set(curatedAuthority.policies.map((policy) => policy.id));
    const curatedPolicies = getV4SystemicCorpus().filter((policy) => curatedIds.has(policy.id));
    expect(curatedPolicies).toHaveLength(curatedAuthority.policies.length);

    for (const policy of curatedPolicies) {
      const question = policy.question_families[0];
      const turn = resolveV4Turn(question, []);
      const plan: V4SystemicQueryPlan = {
        needs: [{
          id: "N1",
          text: question,
          retrievalQueries: policy.question_families,
          productScope: policy.product_scopes[0] === "main_istv" || policy.product_scopes[0] === "dj_nlceo"
            ? policy.product_scopes[0]
            : "unknown",
          domains: policy.domains,
          actions: policy.actions,
          entities: policy.entities,
          relation: inferV4SystemicPolicyRelations(policy)[0],
          requestKind: inferV4SystemicRequestKind(question),
          ambiguity: "none",
          clarificationQuestion: "",
        }],
        conversationIntent: "answer",
        reasoningSummary: "curated source regression",
      };
      const candidate = retrieveV4SystemicPolicies(turn, plan).candidates.find((item) => item.policy.id === policy.id);
      expect(candidate, policy.id).toBeDefined();
      expect(candidate!.rank, policy.id).toBeLessThanOrEqual(20);
    }
  });

  it("places the Mike and Rich ownership correction after the older contradictory Slack rule", () => {
    const corpus = getV4SystemicCorpus();
    const correction = corpus.find((policy) => policy.id === "curated_9848cdfb2da72c0a");
    const olderRule = corpus.find((policy) => policy.id === "operational_c4d65012f8c4c11d");
    expect(correction?.decision).toMatch(/not a hard requirement/i);
    expect(olderRule?.decision).toMatch(/not a good fit/i);
    expect(Date.parse(correction!.effective_at)).toBeGreaterThan(Date.parse(olderRule!.effective_at));
  });

  it("treats the approved current show catalog as status evidence", () => {
    const policy = getV4SystemicCorpus().find((item) => item.id === "kr_7ace400fcdf68db9");
    expect(policy).toBeDefined();
    expect(inferV4SystemicPolicyRelations(policy!)).toContain("status");
    const question = "Are we still running Kingdom Creators?";
    const plan: V4SystemicQueryPlan = {
      needs: [{
        id: "N1",
        text: question,
        retrievalQueries: [question],
        productScope: "main_istv",
        domains: ["shows", "casting"],
        actions: ["confirm current availability"],
        entities: ["Kingdom Creators"],
        relation: "status",
        requestKind: "knowledge",
        ambiguity: "none",
        clarificationQuestion: "",
      }],
      conversationIntent: "answer",
      reasoningSummary: "current catalog status",
    };
    const retrieval = retrieveV4SystemicPolicies(resolveV4Turn(question, []), plan);
    const rank = retrieval.candidates.find((candidate) => candidate.policy.id === policy!.id)?.rank;
    expect(rank).toBeDefined();
    expect(rank).toBeLessThanOrEqual(10);
  });
});
