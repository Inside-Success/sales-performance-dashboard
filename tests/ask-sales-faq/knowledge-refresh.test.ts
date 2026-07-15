import { describe, expect, it } from "vitest";
import registryJson from "@/lib/ask-sales-faq/generated/v3-policy-registry.json";
import {
  buildKnowledgeRefreshAnalysisContext,
  compareKnowledgeRefreshCandidate,
  getKnowledgeRefreshRegistryVersion,
} from "@/lib/ask-sales-faq/knowledge-refresh-governance";
import { KNOWLEDGE_REFRESH_SOURCES, getKnowledgeRefreshSource } from "@/lib/ask-sales-faq/knowledge-refresh-sources";
import {
  buildKnowledgeRefreshAnalysisPayload,
  classifyKnowledgeRefreshCandidateNoise,
} from "@/lib/ask-sales-faq/knowledge-refresh-noise";

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

  it("screens explicit no-change confirmations without approving them", () => {
    expect(classifyKnowledgeRefreshCandidateNoise({
      title: "Show status confirmed",
      proposedPolicy: "No change needed; show remains active.",
      confidence: 0.99,
    })).toEqual({
      status: "duplicate",
      reason: "Automatically screened because the source explicitly says the governed value did not change.",
    });
  });

  it("routes low-confidence candidates to an accountable owner", () => {
    expect(classifyKnowledgeRefreshCandidateNoise({
      title: "Uncertain exception",
      proposedPolicy: "This may be allowed in some cases.",
      confidence: 0.42,
    }).status).toBe("needs_owner");
  });

  it("sends Google sources to AI as a change-only packet after the first snapshot", () => {
    const result = buildKnowledgeRefreshAnalysisPayload({
      kind: "google_doc",
      previousContent: "Package price is $10,000.\n\nThe episode is 15 minutes.",
      currentContent: "Package price is $12,000.\n\nThe episode is 15 minutes.",
    });
    expect(result.mode).toBe("delta");
    expect(result.materialChange).toBe(true);
    expect(result.content).toContain("Package price is $12,000");
    expect(result.content).toContain("Package price is $10,000");
    expect(result.content).not.toContain("The episode is 15 minutes");
  });

  it("does not send formatting-only Google changes to AI", () => {
    const result = buildKnowledgeRefreshAnalysisPayload({
      kind: "google_sheet",
      previousContent: "Show A is active.\n\nShow B is off.",
      currentContent: " Show A is active. \n\n Show B is off. ",
    });
    expect(result).toEqual({ mode: "delta", content: "", materialChange: false });
  });
});
