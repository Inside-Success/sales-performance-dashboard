import { describe, expect, it } from "vitest";

import {
  parseV4AdjudicationProvenance,
  parseV4GoldNeeds,
  type V4GoldReferenceCatalog,
} from "@/lib/ask-sales-faq/v4/adjudication";

const catalog: V4GoldReferenceCatalog = {
  policies: [
    { id: "policy-price", decisionKey: "main-price", policyKey: "price" },
    { id: "policy-payment", decisionKey: "main-payment", policyKey: "payment" },
  ],
  blockedTopics: [{ id: "block-discount" }],
  routeKeys: ["sales_policy", "sales_tech"],
};

describe("Ask Sales V4 adjudicated gold schema", () => {
  it("requires independent, snapshot-bound provenance", () => {
    const parsed = parseV4AdjudicationProvenance({
      schemaVersion: 1,
      adjudicatorId: "reviewer-1",
      adjudicatedAt: "2026-07-21T18:00:00.000Z",
      methodology: "Atomic need review against governed current sources.",
      sourceRefs: ["owner-price-table"],
      independentFromSystems: true,
      knowledgeVersion: "knowledge-1",
    }, "knowledge-1");
    expect(parsed?.knowledgeVersion).toBe("knowledge-1");
    expect(() => parseV4AdjudicationProvenance({ ...parsed, knowledgeVersion: "old" }, "knowledge-1")).toThrow(/does not match current knowledge/);
    expect(() => parseV4AdjudicationProvenance({ ...parsed, independentFromSystems: false }, "knowledge-1")).toThrow(/independentFromSystems/);
  });

  it("resolves every policy and blocker reference while preserving atomic outcomes", () => {
    const needs = parseV4GoldNeeds([
      {
        id: "price",
        text: "State the current main ISTV price.",
        atomic: true,
        expectedDisposition: "answer",
        expectedRouteKey: null,
        policyIds: ["main-price"],
        blockedTopicIds: [],
        goldContext: [],
        blockedContext: [],
      },
      {
        id: "discount",
        text: "Resolve the unapproved crossover discount.",
        atomic: true,
        expectedDisposition: "route",
        expectedRouteKey: "sales_policy",
        policyIds: [],
        blockedTopicIds: ["block-discount"],
        goldContext: [],
        blockedContext: [],
      },
    ], catalog);
    expect(needs[0].policyIds).toEqual(["policy-price"]);
    expect(needs[1].blockedTopicIds).toEqual(["block-discount"]);
  });

  it("rejects non-atomic needs, unresolved references, and evidence-free dispositions", () => {
    const base = {
      id: "price",
      text: "State the price.",
      atomic: true,
      expectedDisposition: "answer",
      policyIds: ["policy-price"],
      blockedTopicIds: [],
      goldContext: [],
      blockedContext: [],
    };
    expect(() => parseV4GoldNeeds([{ ...base, atomic: false }], catalog)).toThrow(/atomic must be true/);
    expect(() => parseV4GoldNeeds([{ ...base, policyIds: ["missing"] }], catalog)).toThrow(/does not resolve/);
    expect(() => parseV4GoldNeeds([{ ...base, policyIds: [] }], catalog)).toThrow(/requires answer evidence/);
  });

  it("rejects ambiguous policy aliases instead of choosing one silently", () => {
    const ambiguousCatalog: V4GoldReferenceCatalog = {
      ...catalog,
      policies: [...catalog.policies, { id: "policy-price-legacy", policyKey: "price" }],
    };
    expect(() => parseV4GoldNeeds([{
      id: "price",
      text: "State the price.",
      atomic: true,
      expectedDisposition: "answer",
      policyIds: ["price"],
      blockedTopicIds: [],
      goldContext: [],
      blockedContext: [],
    }], ambiguousCatalog)).toThrow(/ambiguous/);
  });

  it("validates route keys against the governed catalog and the gold disposition", () => {
    const routed = {
      id: "discount",
      text: "Resolve the unapproved discount.",
      atomic: true,
      expectedDisposition: "route",
      expectedRouteKey: "sales_policy",
      policyIds: [],
      blockedTopicIds: ["block-discount"],
      goldContext: [],
      blockedContext: [],
    };
    expect(parseV4GoldNeeds([routed], catalog)[0].expectedRouteKey).toBe("sales_policy");
    expect(() => parseV4GoldNeeds([{ ...routed, expectedRouteKey: "invented_team" }], catalog)).toThrow(/governed route catalog/);
    expect(() => parseV4GoldNeeds([{ ...routed, expectedRouteKey: null }], catalog)).toThrow(/required for route/);
    expect(() => parseV4GoldNeeds([{
      ...routed,
      expectedDisposition: "answer",
      expectedRouteKey: "sales_policy",
      policyIds: ["policy-price"],
    }], catalog)).toThrow(/must be null for answer/);
  });
});
