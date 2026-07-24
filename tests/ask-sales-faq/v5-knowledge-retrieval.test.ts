import { describe, expect, it } from "vitest";

import {
  inferV4SystemicRelation,
  inferV4SystemicRequestKind,
  v4SystemicNeedPolicyRelationErrors,
} from "@/lib/ask-sales-faq/v4/systemic/relations";
import { resolveV4SystemicTurn } from "@/lib/ask-sales-faq/v4/systemic/turn";
import type { V4SystemicNeed, V4SystemicQueryPlan } from "@/lib/ask-sales-faq/v4/systemic/types";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { retrieveV5Policies } from "@/lib/ask-sales-faq/v5/retrieval";

function need(text: string, overrides: Partial<V4SystemicNeed> = {}): V4SystemicNeed {
  return {
    id: "N1",
    text,
    authorityText: text,
    originalRequestText: text,
    retrievalQueries: [text],
    productScope: "unknown",
    domains: [],
    actions: [],
    entities: [],
    relation: inferV4SystemicRelation(text),
    requestKind: inferV4SystemicRequestKind(text),
    ambiguity: "none",
    clarificationQuestion: "",
    ...overrides,
  };
}

function retrieve(question: string, overrides: Partial<V4SystemicNeed> = {}) {
  const plannedNeed = need(question, overrides);
  const plan: V4SystemicQueryPlan = {
    needs: [plannedNeed],
    conversationIntent: "answer",
    reasoningSummary: "V5 bounded retrieval regression",
  };
  return { plannedNeed, result: retrieveV5Policies(resolveV4SystemicTurn(question, []), plan) };
}

describe("Ask Sales V5 bounded evidence retrieval", () => {
  it("builds one immutable snapshot from the governed effective corpus", () => {
    const snapshot = getV5KnowledgeSnapshot();
    expect(snapshot.schemaVersion).toBe("ask-sales-v5-knowledge-snapshot-v2");
    expect(snapshot.knowledgeVersion).toMatch(/^[a-f0-9]{16}\+v5_[a-f0-9]{16}$/);
    expect(snapshot.policies.length).toBeGreaterThan(1_000);
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.policies)).toBe(true);
    expect(Object.isFrozen(snapshot.policies[0])).toBe(true);
    expect(new Set(snapshot.policies.map((policy) => policy.id)).size).toBe(snapshot.policies.length);
    expect(snapshot.policies.every((policy) => policy.source.ids.length > 0)).toBe(true);
    expect(snapshot.policies.every((policy) => policy.answerability !== "discovery_only")).toBe(true);
    expect(snapshot.stableOperationalPromotionCount).toBeGreaterThan(0);
  });

  it("never admits a candidate that fails the hard relation or material-condition boundary", () => {
    const cases = [
      "What is the confirmed date of the next Red Carpet event?",
      "Two clients from different companies were on one dummy call. How should I submit that recording for their Greenlight letters?",
      "Do cast members currently receive a dashboard showing their episode-performance statistics?",
      "Where should I check whether a client's live payment actually went through?",
      "Can a mortgage broker qualify without owning a company entity?",
    ];
    for (const question of cases) {
      const { plannedNeed, result } = retrieve(question);
      for (const candidate of result.candidates) {
        expect(v4SystemicNeedPolicyRelationErrors(plannedNeed, candidate.policy), `${question}: ${candidate.policy.id}`).toEqual([]);
      }
      expect(result.diagnostics?.needs[0].selectedPolicyIds).toEqual(result.candidates.map((candidate) => candidate.policy.id));
      expect(result.candidates.length).toBeLessThanOrEqual(10);
    }
  }, 15_000);

  it("rejects the three observed V4.4 wrong-neighbor answers", () => {
    const episodeStats = retrieve("Do cast members currently receive a dashboard showing their episode-performance statistics?", {
      relation: "status",
      domains: ["episode performance"],
      entities: ["cast member dashboard", "episode statistics"],
    }).result;
    expect(episodeStats.candidates.some((candidate) => /residual|company does not make money from the client/i.test(candidate.policy.decision))).toBe(false);

    const sharedRecording = retrieve("Two clients from different companies were on one dummy call. How should I submit that recording for their Greenlight letters?", {
      relation: "procedure",
      domains: ["greenlight"],
      actions: ["submit recording"],
      entities: ["two clients", "different companies", "one dummy call"],
    }).result;
    expect(sharedRecording.candidates.some((candidate) => /keep zoom running.{0,120}calling the client by phone/i.test(candidate.policy.decision))).toBe(false);

    const redCarpetDate = retrieve("What is the confirmed date of the next Red Carpet event?", {
      relation: "timing_start",
      domains: ["events"],
      entities: ["Red Carpet event", "confirmed date"],
    }).result;
    const exactRedCarpet = getV5KnowledgeSnapshot().policies.find((policy) => policy.decision_key === "next-red-carpet-event-date");
    expect(exactRedCarpet).toBeDefined();
    expect(v4SystemicNeedPolicyRelationErrors(need("What is the confirmed date of the next Red Carpet event?", {
      relation: "timing_start",
      domains: ["events"],
      entities: ["Red Carpet event", "confirmed date"],
    }), exactRedCarpet!)).toEqual([]);
    expect(redCarpetDate.candidates.some((candidate) => /vip package includes mastermind event/i.test(candidate.policy.decision))).toBe(false);
    expect(redCarpetDate.candidates[0]?.policy.decision_key).toMatch(/red-carpet-event-date/);
  });

  it("round-robins bounded evidence across compound atomic needs", () => {
    const question = "Where should Finance verify a live payment, and where should I request an urgent Greenlight letter?";
    const needs = [
      need("Where should Finance verify a live payment?", { id: "N1", relation: "routing", domains: ["payments"], entities: ["live payment"] }),
      need("Where should I request an urgent Greenlight letter?", { id: "N2", relation: "routing", domains: ["greenlight"], entities: ["Greenlight letter"] }),
    ];
    const plan: V4SystemicQueryPlan = { needs, conversationIntent: "answer", reasoningSummary: "compound" };
    const result = retrieveV5Policies(resolveV4SystemicTurn(question, []), plan);
    expect(result.candidates.length).toBeLessThanOrEqual(20);
    expect(result.candidates.some((candidate) => candidate.needScores?.N1)).toBe(true);
    expect(result.candidates.some((candidate) => candidate.needScores?.N2)).toBe(true);
    expect(result.diagnostics?.needs).toHaveLength(2);
  });
});
