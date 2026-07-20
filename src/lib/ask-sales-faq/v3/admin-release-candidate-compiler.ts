import type { KnowledgeRefreshStructuredShowUpdate } from "@/lib/ask-sales-faq/knowledge-refresh-release-readiness";
import type { V3AdminReleaseCandidate } from "@/lib/ask-sales-faq/v3/admin-approved-releases";
import type { V3Policy } from "@/lib/ask-sales-faq/v3/types";

export type V3AdminReleaseDraft = V3AdminReleaseCandidate & {
  structuredShowUpdate?: KnowledgeRefreshStructuredShowUpdate | null;
};

const showCatalogDecisionKey = "current-show-source-latest-approved-show-list-1";
const showCatalogQuoteDecisionKey = "current-show-source-what-reps-can-say-1-a1";

export function compileV3AdminReleaseCandidates(input: {
  drafts: V3AdminReleaseDraft[];
  currentPolicies: V3Policy[];
  preparedBy: string;
}) {
  const showDrafts = input.drafts.filter((draft) => draft.structuredShowUpdate);
  const ordinaryDrafts = input.drafts.filter((draft) => !draft.structuredShowUpdate);
  if (!showDrafts.length) return ordinaryDrafts;

  return [
    ...ordinaryDrafts,
    compileShowCatalogDraft({
      drafts: showDrafts as Array<V3AdminReleaseDraft & { structuredShowUpdate: KnowledgeRefreshStructuredShowUpdate }>,
      currentPolicies: input.currentPolicies,
      preparedBy: input.preparedBy,
    }),
  ];
}

function compileShowCatalogDraft(input: {
  drafts: Array<V3AdminReleaseDraft & { structuredShowUpdate: KnowledgeRefreshStructuredShowUpdate }>;
  currentPolicies: V3Policy[];
  preparedBy: string;
}): V3AdminReleaseCandidate {
  const sourceIds = [...new Set(input.drafts.map((draft) => draft.sourceId))];
  const snapshotHashes = [...new Set(input.drafts.map((draft) => draft.snapshotHash))];
  if (sourceIds.length !== 1 || snapshotHashes.length !== 1) {
    throw new Error("Show-catalog updates from different sources or snapshots must be previewed separately");
  }

  const catalogPolicies = input.currentPolicies
    .filter((policy) => policy.decision_key === showCatalogDecisionKey)
    .sort((left, right) => right.authority - left.authority);
  const basePolicy = catalogPolicies.find((policy) => extractActiveShows(policy.decision).length > 0);
  if (!basePolicy) throw new Error("The current governed show catalog could not be resolved");

  let activeShows = extractActiveShows(basePolicy.decision);
  const originalShows = [...activeShows];
  const inactiveShows: string[] = [];

  for (const draft of input.drafts) {
    const update = draft.structuredShowUpdate;
    const existingIndex = activeShows.findIndex((show) => normalizeShowName(show) === normalizeShowName(update.showName));
    if (update.status === "on") {
      if (existingIndex < 0) {
        activeShows.push(update.showName);
      }
    } else {
      if (existingIndex >= 0) activeShows = activeShows.filter((_, index) => index !== existingIndex);
      inactiveShows.push(update.showName);
    }
  }

  const changed = JSON.stringify(activeShows.map(normalizeShowName)) !== JSON.stringify(originalShows.map(normalizeShowName));
  if (!changed && !inactiveShows.length) {
    throw new Error("The selected show update does not change the current governed catalog");
  }

  const staleListPolicyIds = input.currentPolicies
    .filter((policy) =>
      policy.decision_key === showCatalogDecisionKey ||
      policy.decision_key === showCatalogQuoteDecisionKey,
    )
    .map((policy) => policy.id);
  const approvedByAll = [...new Set(input.drafts.flatMap((draft) => draft.approvedByAll?.length
    ? draft.approvedByAll
    : [draft.approvedBy]))];
  const latestApproval = input.drafts
    .map((draft) => draft.approvedAt)
    .sort()
    .at(-1) || new Date().toISOString();
  const lineageCandidateIds = input.drafts.flatMap((draft) => draft.lineageCandidateIds?.length
    ? draft.lineageCandidateIds
    : [draft.id]);
  const decision = buildCatalogDecision(activeShows, inactiveShows);

  return {
    id: `compiled_show_catalog:${[...lineageCandidateIds].sort().join(",")}`,
    title: "Current approved ISTV show catalog",
    summary: `Compiled from ${input.drafts.length} individually accepted show-status update${input.drafts.length === 1 ? "" : "s"}.`,
    proposedPolicy: decision,
    decisionKey: showCatalogDecisionKey,
    productScopes: ["product_agnostic"],
    domains: ["shows_offers"],
    actions: ["use_or_promote", "hold_or_pause", "verify"],
    entities: [...new Set([
      "current",
      "approved",
      "show",
      "list",
      ...activeShows.flatMap(tokenize),
      ...inactiveShows.flatMap(tokenize),
    ])],
    policyObject: "current approved ISTV show catalog",
    conditions: "Use list membership only for current sales/casting availability; it does not prove that an episode has aired or is watchable.",
    effectiveDate: input.drafts.map((draft) => draft.effectiveDate).filter(Boolean).sort().at(-1) || null,
    answerImpact: "material",
    sourceAuthority: input.drafts.some((draft) => draft.sourceAuthority === "owner_confirmed")
      ? "owner_confirmed"
      : input.drafts.some((draft) => draft.sourceAuthority === "manager_guidance")
        ? "manager_guidance"
        : "unknown",
    authorityName: input.drafts.map((draft) => draft.authorityName).find(Boolean) || null,
    authorityBasis: `Exact-admin approval of ${input.drafts.length} structured row update${input.drafts.length === 1 ? "" : "s"}.`,
    sourceId: sourceIds[0],
    sourceLabel: input.drafts[0].sourceLabel,
    sourceRevision: input.drafts.map((draft) => draft.sourceRevision).find(Boolean) || null,
    evidenceQuotes: [...new Set(input.drafts.flatMap((draft) => draft.evidenceQuotes))],
    snapshotHash: snapshotHashes[0],
    approvedBy: approvedByAll[0] || input.preparedBy,
    approvedByAll,
    approvedAt: latestApproval,
    conflictLevel: "direct",
    conflictResolution: "supersede",
    conflictingPolicyIds: [...new Set(staleListPolicyIds)],
    blockedTopicIds: [...new Set(input.drafts.flatMap((draft) => draft.blockedTopicIds))],
    lineageCandidateIds: [...new Set(lineageCandidateIds)],
  };
}

function buildCatalogDecision(activeShows: string[], inactiveShows: string[]) {
  const sections = [
    "Use the following as the current approved ISTV sales/casting show list:",
    ...activeShows.map((show) => `- ${show}`),
  ];
  if (inactiveShows.length) {
    sections.push(
      "",
      "The following accepted source updates are inactive and must not be offered to new applicants:",
      ...[...new Set(inactiveShows)].map((show) => `- ${show}`),
    );
  }
  sections.push(
    "",
    "List membership confirms only current sales/casting availability. It does not by itself confirm that an episode has aired or is currently watchable.",
  );
  return sections.join("\n");
}

export function extractActiveShows(decision: string) {
  const lines = decision.split("\n");
  const activeHeading = lines.findIndex((line) => /current approved .*show list/i.test(line));
  if (activeHeading >= 0) {
    const result: string[] = [];
    for (const line of lines.slice(activeHeading + 1)) {
      if (/^the following .*inactive/i.test(line.trim())) break;
      const match = line.match(/^\s*-\s+(.+?)\s*$/);
      if (match) result.push(match[1]);
    }
    if (result.length) return result;
  }
  return decision
    .split(/\s+-\s+/)
    .map((item) => item.replace(/^\s*-\s*/, "").trim())
    .filter(Boolean);
}

function normalizeShowName(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "").replace(/tv$/, "");
}

function tokenize(value: string) {
  return value.toLowerCase().replace(/&/g, " and ").replace(/[^a-z0-9]+/g, " ").split(/\s+/).filter((token) => token.length > 1);
}
