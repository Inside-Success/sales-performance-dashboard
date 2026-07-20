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
import {
  assessKnowledgeRefreshReleaseReadiness,
  hasUnresolvedPolicyWording,
} from "@/lib/ask-sales-faq/knowledge-refresh-release-readiness";
import {
  buildV3AdminApprovedRelease,
  getMaterializedV3Registry,
  materializeV3Registry,
  type V3AdminApprovedReleaseLedger,
} from "@/lib/ask-sales-faq/v3/admin-approved-releases";
import {
  compileV3AdminReleaseCandidates,
  extractActiveShows,
  type V3AdminReleaseDraft,
} from "@/lib/ask-sales-faq/v3/admin-release-candidate-compiler";

function releaseReadinessFixture(overrides: Record<string, unknown> = {}) {
  return {
    source_id: "google_doc:test",
    status: "approved_content",
    title: "A final approved rule",
    summary: "A final approved rule summary.",
    proposed_policy: "Use the final approved procedure.",
    rationale: "The source states this directly.",
    decision_key: null,
    product_scopes: ["product_agnostic"],
    evidence_quotes: ["Use the final approved procedure."],
    candidate_kind: "new_rule",
    policy_domains: ["general_sales"],
    policy_actions: ["explain"],
    policy_entities: ["procedure"],
    policy_object: "approved procedure",
    atomic_decision_count: 1,
    conflict_level: "none",
    conflict_resolution: null,
    conflicting_policy_ids: [],
    snapshot_hash: "a".repeat(64),
    approved_snapshot_hash: "a".repeat(64),
    approved_by: "admin@example.com",
    approved_at: "2026-07-20T12:00:00.000Z",
    ...overrides,
  };
}

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
    expect(context.authorityRule).toContain("Human approval");
  });

  it("materializes an exact-admin release without changing the frozen base registry", () => {
    const current = getMaterializedV3Registry();
    const entry = buildV3AdminApprovedRelease({
      releaseId: "kr_test_addition",
      preparedAt: "2026-07-18T20:00:00.000Z",
      preparedBy: "admin@example.com",
      baseKnowledgeVersion: current.knowledge_version,
      candidates: [{
        id: "candidate_addition",
        title: "Approved release test policy",
        summary: "A precise durable test policy.",
        proposedPolicy: "Use the approved release test procedure when the exact test condition applies.",
        decisionKey: "test.approved.release",
        productScopes: ["product_agnostic"],
        domains: ["general_sales"],
        actions: ["explain"],
        entities: ["approved_release_test"],
        policyObject: "approved release test procedure",
        conditions: "exact test condition",
        effectiveDate: "2026-07-18",
        answerImpact: "material",
        sourceAuthority: "owner_confirmed",
        authorityName: "Rich",
        authorityBasis: "Owner-confirmed test fixture",
        sourceId: "slack_channel:test",
        sourceLabel: "#test",
        sourceRevision: "123.45",
        evidenceQuotes: ["Use the approved release test procedure."],
        snapshotHash: "a".repeat(64),
        approvedBy: "admin@example.com",
        approvedAt: "2026-07-18T19:55:00.000Z",
        conflictLevel: "none",
        conflictResolution: null,
        conflictingPolicyIds: [],
        blockedTopicIds: [],
      }],
    });
    const ledger: V3AdminApprovedReleaseLedger = { schema_version: 1, description: "test", releases: [entry] };
    const materialized = materializeV3Registry(current, ledger);
    expect(materialized.knowledge_version).toBe(entry.expected_knowledge_version);
    expect(materialized.policies).toContainEqual(expect.objectContaining({
      id: entry.policies[0].id,
      decision_key: "test.approved.release",
      quality_tier: "canonical",
      answerability: "answer_evidence",
    }));
    expect(registryJson.policies.some((policy) => policy.id === entry.policies[0].id)).toBe(false);
  });

  it("applies an explicit admin supersession and rejects a release built for stale knowledge", () => {
    const current = getMaterializedV3Registry();
    const old = current.policies[0];
    const entry = buildV3AdminApprovedRelease({
      releaseId: "kr_test_supersession",
      preparedAt: "2026-07-18T20:10:00.000Z",
      preparedBy: "admin@example.com",
      baseKnowledgeVersion: current.knowledge_version,
      candidates: [{
        id: "candidate_supersession",
        title: "Approved replacement test policy",
        summary: "A precise replacement for one governed test policy.",
        proposedPolicy: "This exact-admin test fixture replaces the selected previous policy.",
        decisionKey: old.decision_key,
        productScopes: old.product_scopes,
        domains: old.domains,
        actions: old.actions,
        entities: old.entities,
        policyObject: old.title,
        conditions: null,
        effectiveDate: "2026-07-18",
        answerImpact: "material",
        sourceAuthority: "owner_confirmed",
        authorityName: "Rich",
        authorityBasis: "Owner-confirmed test fixture",
        sourceId: "google_doc:test",
        sourceLabel: "Test document",
        sourceRevision: "revision-1",
        evidenceQuotes: ["This fixture replaces the selected previous policy."],
        snapshotHash: "b".repeat(64),
        approvedBy: "admin@example.com",
        approvedAt: "2026-07-18T20:05:00.000Z",
        conflictLevel: "direct",
        conflictResolution: "supersede",
        conflictingPolicyIds: [old.id],
        blockedTopicIds: [],
      }],
    });
    const materialized = materializeV3Registry(current, { schema_version: 1, description: "test", releases: [entry] });
    expect(materialized.policies.some((policy) => policy.id === old.id)).toBe(false);
    expect(materialized.superseded_policies?.some((policy) => policy.id === old.id)).toBe(true);
    expect(() => materializeV3Registry(current, {
      schema_version: 1,
      description: "test",
      releases: [{ ...entry, base_knowledge_version: "stale-version" }],
    })).toThrow(/built for knowledge/);
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

  it("does not classify the 20% dial-out SOP as an onboarding-reporting conflict", () => {
    const result = compareKnowledgeRefreshCandidate({
      title: "20% dial-out list: reps must follow exact SOP",
      proposedPolicy: "All reps must read and follow the exact SOP document linked in the daily dial-out list post.",
      decisionKey: null,
      productScopes: ["product_agnostic"],
      domains: ["lead_ownership"],
      actions: ["contact"],
      entities: ["20_percent_dial_out", "sop"],
      policyObject: "20% dial-out SOP",
      conditions: null,
    });
    expect(result.blockedTopicIds).not.toContain("blocked_3ae983b020485f8d");
    expect(result.blockedTopics).toEqual([]);
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
      domains: ["production"],
      actions: ["produce"],
      entities: ["episode_delivery", "filming"],
      policyObject: "episode delivery timing",
      conditions: "after filming",
    });
    expect(result.conflictLevel).toBe("blocked");
    expect(result.conflictSummary).toContain("Episode delivery timing after filming");
    expect(result.conflictSummary).not.toContain("blocked_");
  });

  it("does not create hard conflicts from legacy unstructured wording alone", () => {
    const result = compareKnowledgeRefreshCandidate({
      title: "If client cannot pay full amount due to tech issues, discount can be honored with failed payment proof",
      proposedPolicy: "A failed full payment caused by a technical issue may preserve a discount when proof is supplied.",
      decisionKey: null,
      productScopes: ["product_agnostic"],
    });
    expect(result.blockedTopicIds).toEqual([]);
    expect(result.conflictLevel).toBe("none");
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

  it("does not blindly treat an unnamed or manager-level statement as final authority", () => {
    expect(classifyKnowledgeRefreshCandidateNoise({
      title: "Potential policy update",
      proposedPolicy: "Reps should follow the revised qualification step.",
      confidence: 0.95,
      candidateKind: "rule_change",
      domains: ["qualification"],
      actions: ["qualify"],
      entities: ["qualification_step"],
      isDurable: true,
      isReusable: true,
      answerImpact: "material",
      sourceAuthority: "owner_confirmed",
      atomicDecisionCount: 1,
    }).status).toBe("needs_owner");

    expect(classifyKnowledgeRefreshCandidateNoise({
      title: "Manager guidance",
      proposedPolicy: "Reps should follow the revised qualification step.",
      confidence: 0.95,
      candidateKind: "rule_change",
      domains: ["qualification"],
      actions: ["qualify"],
      entities: ["qualification_step"],
      isDurable: true,
      isReusable: true,
      answerImpact: "material",
      sourceAuthority: "manager_guidance",
      authorityName: "Madeline",
      atomicDecisionCount: 1,
    }).status).toBe("needs_owner");
  });

  it("screens operational noise and keeps unanswered policy gaps non-approvable", () => {
    expect(classifyKnowledgeRefreshCandidateNoise({
      title: "Daily coaching reminder",
      proposedPolicy: "Join today's coaching call.",
      confidence: 0.99,
      candidateKind: "clarification",
      domains: ["onboarding"],
      actions: ["invite_or_attend"],
      entities: ["coaching_call"],
      isDurable: false,
      isReusable: false,
      answerImpact: "none",
      sourceAuthority: "manager_guidance",
      atomicDecisionCount: 1,
    }).status).toBe("duplicate");

    expect(classifyKnowledgeRefreshCandidateNoise({
      title: "Repeated unanswered refund question",
      proposedPolicy: "No governed answer is currently available.",
      confidence: 0.9,
      candidateKind: "knowledge_gap",
      domains: ["payments"],
      actions: ["refund_or_cancel"],
      entities: ["refund_window"],
      isDurable: true,
      isReusable: true,
      answerImpact: "material",
      sourceAuthority: "rep_question",
      atomicDecisionCount: 1,
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

  it("marks a complete structured show row ready and derives governed release metadata", () => {
    const result = assessKnowledgeRefreshReleaseReadiness(releaseReadinessFixture({
      title: "New Show Added: Internet Masters TV (Status: On)",
      proposed_policy: "Add 'Internet Masters TV' to the approved show list as an active show.",
      evidence_quotes: ["Internet Masters TV\thttps://example.com/internet-masters\tINTV\tOn\tOnline entrepreneurs"],
      source_id: "google_sheet:1xIqHh5uAkoKMgYNk1fHox1YfDuBUzGzbn--R7t0_syM",
      policy_domains: [],
      policy_actions: [],
      policy_entities: [],
      policy_object: null,
    }));
    expect(result).toMatchObject({
      ready: true,
      decisionKey: "show-catalog.internet-masters-tv.status",
      decisionKeySource: "derived",
      resolvedDomains: ["shows_offers"],
      structuredShowUpdate: { showName: "Internet Masters TV", status: "on" },
    });
    expect(result.resolvedActions).toContain("use_or_promote");

    const apostropheVariant = assessKnowledgeRefreshReleaseReadiness(releaseReadinessFixture({
      title: "America's Top Trainers is off",
      proposed_policy: "Update the approved list to mark 'America's Top Trainers' as inactive (Off).",
      evidence_quotes: ["Americas Top Trainers\thttps://example.com/trainers\tATT\tOff\tTrainers"],
      source_id: "google_sheet:1xIqHh5uAkoKMgYNk1fHox1YfDuBUzGzbn--R7t0_syM",
    }));
    expect(apostropheVariant.ready).toBe(true);
  });

  it("keeps combined, abbreviated, and unresolved drafts out of release previews", () => {
    const combined = assessKnowledgeRefreshReleaseReadiness(releaseReadinessFixture({
      title: "Multiple shows marked off",
      proposed_policy: "Show A and Show B are inactive and should not be offered.",
      evidence_quotes: [
        "Show A\t...\tA\tOff\tNiche A",
        "Show B\t...\tB\tOff\tNiche B",
      ],
      source_id: "google_sheet:1xIqHh5uAkoKMgYNk1fHox1YfDuBUzGzbn--R7t0_syM",
    }));
    expect(combined.ready).toBe(false);
    expect(combined.reasons.join(" ")).toContain("multiple Sheet rows");

    const unresolved = assessKnowledgeRefreshReleaseReadiness(releaseReadinessFixture({
      title: "Possible show rename",
      proposed_policy: "Clarify whether Show A is Show B. If same, rename it. If different, add it.",
    }));
    expect(unresolved.ready).toBe(false);
    expect(unresolved.reasons.join(" ")).toContain("one final answer");
  });

  it("identifies clarification wording before an admin can accept it", () => {
    expect(hasUnresolvedPolicyWording(
      "Clarify whether Show A is Show B. If same, rename it. If different, add it.",
    )).toBe(true);
    expect(hasUnresolvedPolicyWording(
      "Builders of America is the correct official show name and remains active.",
    )).toBe(false);
  });

  it("does not publish an inferred show replacement that its row evidence does not prove", () => {
    const result = assessKnowledgeRefreshReleaseReadiness(releaseReadinessFixture({
      title: "Couples Empire replaces Couples of America",
      summary: "The row suggests a name change.",
      proposed_policy: "Replace 'Couples of America' with 'Couples Empire'. The show is active.",
      rationale: "This is likely a rebranding.",
      evidence_quotes: ["Couples Empire\thttps://example.com/couples\tCE\tOn\tCouples in business"],
      source_id: "google_sheet:1xIqHh5uAkoKMgYNk1fHox1YfDuBUzGzbn--R7t0_syM",
    }));
    expect(result.ready).toBe(false);
    expect(result.reasons.join(" ")).toContain("does not prove the proposed rename or replacement");
  });

  it("derives a stable policy identity for an otherwise complete new rule", () => {
    const result = assessKnowledgeRefreshReleaseReadiness(releaseReadinessFixture());
    expect(result).toMatchObject({
      ready: true,
      decisionKey: "admin.approved-procedure",
      decisionKeySource: "derived",
    });
  });

  it("compiles accepted Sheet rows into one replacement show catalog with original lineage", () => {
    const current = getMaterializedV3Registry();
    const common: V3AdminReleaseDraft = {
      id: "candidate-internet-masters",
      title: "Internet Masters TV is active",
      summary: "Add the newly active show.",
      proposedPolicy: "Add Internet Masters TV as an active show.",
      decisionKey: "show-catalog.internet-masters-tv.status",
      productScopes: ["product_agnostic"],
      domains: ["shows_offers"],
      actions: ["use_or_promote"],
      entities: ["internet", "masters", "tv"],
      policyObject: "Internet Masters TV show status",
      conditions: null,
      effectiveDate: null,
      answerImpact: "material",
      sourceAuthority: "unknown",
      authorityName: null,
      authorityBasis: null,
      sourceId: "google_sheet:offers",
      sourceLabel: "ISTV Offers",
      sourceRevision: "927",
      evidenceQuotes: ["Internet Masters TV\thttps://example.com/internet\tINTV\tOn\tOnline entrepreneurs"],
      snapshotHash: "c".repeat(64),
      approvedBy: "admin@example.com",
      approvedAt: "2026-07-20T12:00:00.000Z",
      conflictLevel: "none",
      conflictResolution: null,
      conflictingPolicyIds: [],
      blockedTopicIds: [],
      lineageCandidateIds: ["candidate-internet-masters"],
      structuredShowUpdate: { kind: "istv_show_status", showName: "Internet Masters TV", status: "on", url: "https://example.com/internet", acronym: "INTV" },
    };
    const off: V3AdminReleaseDraft = {
      ...common,
      id: "candidate-top-trainers-off",
      title: "America's Top Trainers is inactive",
      proposedPolicy: "Mark America's Top Trainers inactive and do not offer it.",
      decisionKey: "show-catalog.americas-top-trainers.status",
      evidenceQuotes: ["Americas Top Trainers\thttps://example.com/trainers\tATT\tOff\tTrainers"],
      lineageCandidateIds: ["candidate-top-trainers-off"],
      structuredShowUpdate: { kind: "istv_show_status", showName: "Americas Top Trainers", status: "off", url: "https://example.com/trainers", acronym: "ATT" },
    };
    const [compiled] = compileV3AdminReleaseCandidates({ drafts: [common, off], currentPolicies: current.policies, preparedBy: "admin@example.com" });
    const activeShows = extractActiveShows(compiled.proposedPolicy).map((show) => show.toLowerCase().replace(/[^a-z0-9]+/g, ""));
    expect(compiled.decisionKey).toBe("current-show-source-latest-approved-show-list-1");
    expect(compiled.lineageCandidateIds).toEqual(["candidate-internet-masters", "candidate-top-trainers-off"]);
    expect(activeShows).toContain("internetmasterstv");
    expect(activeShows).not.toContain("americastoptrainers");
    expect(compiled.conflictResolution).toBe("supersede");
    expect(compiled.conflictingPolicyIds.length).toBeGreaterThanOrEqual(1);

    const release = buildV3AdminApprovedRelease({
      releaseId: "kr_catalog_test",
      preparedAt: "2026-07-20T12:10:00.000Z",
      preparedBy: "admin@example.com",
      baseKnowledgeVersion: current.knowledge_version,
      candidateIds: ["candidate-internet-masters", "candidate-top-trainers-off"],
      candidates: [compiled],
    });
    expect(release.candidate_ids).toEqual(["candidate-internet-masters", "candidate-top-trainers-off"]);
    expect(release.policies[0].source.ids).toEqual(expect.arrayContaining([
      "knowledge-refresh:kr_catalog_test:candidate-internet-masters",
      "knowledge-refresh:kr_catalog_test:candidate-top-trainers-off",
    ]));
    const materialized = materializeV3Registry(current, { schema_version: 1, description: "test", releases: [release] });
    expect(materialized.policies.some((policy) => policy.id === release.policies[0].id)).toBe(true);
    expect(materialized.policies.some((policy) => compiled.conflictingPolicyIds.includes(policy.id))).toBe(false);
  });
});
