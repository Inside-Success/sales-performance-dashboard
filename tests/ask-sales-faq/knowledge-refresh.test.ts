import { describe, expect, it } from "vitest";
import registryJson from "@/lib/ask-sales-faq/generated/v3-policy-registry.json";
import {
  buildKnowledgeRefreshAnalysisContext,
  compareKnowledgeRefreshCandidate,
  getKnowledgeRefreshBlockedTopicContexts,
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

  it("turns the episode-delivery blocked ID into a readable evidence comparison", () => {
    const [topic] = getKnowledgeRefreshBlockedTopicContexts(
      ["blocked_3087001020998efa"],
      "Episode delivery timeline is 4-6 months after filming",
    );
    expect(topic).toMatchObject({
      found: true,
      reviewReady: true,
      matchStrength: "strong",
      title: "Episode delivery timing after filming",
      currentPolicies: [],
    });
    expect(topic.explanation).toContain("no current answer has been approved");
    expect(topic.evidence[0]?.text).toContain("3-6 months");
    expect(topic.evidence[0]?.sourceUrl).toContain("C0AUQKNR8CF");
  });

  it("flags broad-wording blocker matches as weak instead of presenting them as proven conflicts", () => {
    const [topic] = getKnowledgeRefreshBlockedTopicContexts(
      ["blocked_cffdc83b9f9bf476"],
      "Reps may take 20 contacts from the dial-out list and 20 contacts from the channel per day.",
    );
    expect(topic).toMatchObject({ found: true, reviewReady: false, matchStrength: "weak", title: "Greenlight cap" });
    expect(topic.explanation).toContain("not the same specific subject");

    const future = compareKnowledgeRefreshCandidate({
      title: "Daily dial-out contact allowance",
      proposedPolicy: "Reps may take 20 contacts from the dial-out list and 20 from the channel per day.",
      decisionKey: null,
      productScopes: ["product_agnostic"],
    });
    expect(future.blockedTopicIds).not.toContain("blocked_cffdc83b9f9bf476");
  });

  it("resolves every deployed blocked ID to a readable topic and keeps IDs out of reviewer summaries", () => {
    const ids = registryJson.blocked_topics.map((topic) => topic.id);
    const contexts = getKnowledgeRefreshBlockedTopicContexts(ids);
    expect(contexts).toHaveLength(39);
    expect(contexts.every((topic) => topic.found && topic.title && !topic.title.startsWith("blocked_"))).toBe(true);

    const result = compareKnowledgeRefreshCandidate({
      title: "Episode delivery timeline is 4-6 months for most shows",
      proposedPolicy: "The standard timeline for episode delivery is approximately 4-6 months after filming.",
      decisionKey: null,
      productScopes: ["product_agnostic"],
    });
    expect(result.conflictLevel).toBe("blocked");
    expect(result.conflictSummary).toContain("Episode delivery timing after filming");
    expect(result.conflictSummary).not.toContain("blocked_");
  });

  it("fails closed when a blocked ID or its comparison evidence cannot be resolved", () => {
    const [unknown] = getKnowledgeRefreshBlockedTopicContexts(["blocked_does_not_exist"]);
    expect(unknown).toMatchObject({ found: false, reviewReady: false });
    expect(unknown.explanation).toContain("Approval must remain unavailable");

    const legacy = getKnowledgeRefreshBlockedTopicContexts(["bankruptcy-qualification", "dual-product-opportunity-ownership", "accessibility-accommodations"]);
    expect(legacy).toHaveLength(3);
    expect(legacy.every((topic) => topic.found && !topic.reviewReady && topic.evidence.length === 0)).toBe(true);
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
