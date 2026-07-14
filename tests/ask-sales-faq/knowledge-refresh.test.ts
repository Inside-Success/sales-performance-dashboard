import { describe, expect, it } from "vitest";
import registryJson from "@/lib/ask-sales-faq/generated/v3-policy-registry.json";
import {
  buildKnowledgeRefreshAnalysisContext,
  compareKnowledgeRefreshCandidate,
  getKnowledgeRefreshRegistryVersion,
} from "@/lib/ask-sales-faq/knowledge-refresh-governance";
import { KNOWLEDGE_REFRESH_SOURCES, getKnowledgeRefreshSource } from "@/lib/ask-sales-faq/knowledge-refresh-sources";

describe("Ask Sales knowledge-refresh governance", () => {
  it("monitors only the two approved Slack channels plus the governed Google corpus", () => {
    expect(KNOWLEDGE_REFRESH_SOURCES).toHaveLength(43);
    expect(KNOWLEDGE_REFRESH_SOURCES.filter((source) => source.kind === "slack_channel").map((source) => source.externalId)).toEqual([
      "C0AUQKNR8CF",
      "C09AF0NQJE7",
    ]);
    expect(KNOWLEDGE_REFRESH_SOURCES.some((source) => source.externalId === "1Hu48qQNGy0C0K8gGxymHczAEk9GhDqTTl9ZgHvHE7oQ")).toBe(false);
    expect(getKnowledgeRefreshSource("slack_channel:C0AUQKNR8CF")?.label).toBe("#sales-questions-requests");
  });

  it("uses the deployed registry version and never grants raw discovery sources authority", () => {
    const context = buildKnowledgeRefreshAnalysisContext("Roku Fire Stick Apple TV availability");
    expect(context.knowledgeVersion).toBe(getKnowledgeRefreshRegistryVersion());
    expect(context.knowledgeVersion).toBe(registryJson.knowledge_version);
    expect(context.authorityRule).toContain("Human approval");
  });

  it("requires explicit conflict handling when a decision key already exists", () => {
    const current = registryJson.policies[0];
    const result = compareKnowledgeRefreshCandidate({
      title: current.title,
      proposedPolicy: current.decision,
      decisionKey: current.decision_key,
      productScopes: current.product_scopes,
    });
    expect(["direct", "blocked"]).toContain(result.conflictLevel);
    expect(result.conflictingPolicyIds).toContain(current.id);
  });

  it("still requires human review when no close policy is found", () => {
    const result = compareKnowledgeRefreshCandidate({
      title: "Zyxqv qplmn trvwx",
      proposedPolicy: "Bcxzr fjkpt nvwqx.",
      decisionKey: null,
      productScopes: ["zyxqv"],
    });
    expect(result.conflictLevel).toBe("none");
    expect(result.conflictSummary).toContain("Human review");
  });
});
