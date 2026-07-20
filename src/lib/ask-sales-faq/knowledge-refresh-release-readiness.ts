export type KnowledgeRefreshStructuredShowUpdate = {
  kind: "istv_show_status";
  showName: string;
  status: "on" | "off";
  url: string | null;
  acronym: string | null;
};

export type KnowledgeRefreshReleaseReadiness = {
  ready: boolean;
  decisionKey: string | null;
  decisionKeySource: "approved_draft" | "governed_policy" | "derived" | "missing";
  reasons: string[];
  summary: string;
  resolvedDomains: string[];
  resolvedActions: string[];
  resolvedEntities: string[];
  resolvedPolicyObject: string | null;
  structuredShowUpdate: KnowledgeRefreshStructuredShowUpdate | null;
};

type ReleaseReadinessCandidate = {
  source_id: string;
  status: string;
  title: string;
  summary: string;
  proposed_policy: string;
  rationale: string;
  decision_key: string | null;
  product_scopes: string[];
  evidence_quotes: string[];
  candidate_kind: string;
  policy_domains: string[];
  policy_actions: string[];
  policy_entities: string[];
  policy_object: string | null;
  atomic_decision_count: number;
  conflict_level: string;
  conflict_resolution: string | null;
  conflicting_policy_ids: string[];
  snapshot_hash: string;
  approved_snapshot_hash: string | null;
  approved_by: string | null;
  approved_at: string | null;
};

type ReleaseReadinessContext = {
  lastContentHash?: string | null;
  decisionKeysByPolicyId?: Readonly<Record<string, string>>;
  activeDecisionKeys?: readonly string[];
};

export function assessKnowledgeRefreshReleaseReadiness(
  candidate: ReleaseReadinessCandidate,
  context: ReleaseReadinessContext = {},
): KnowledgeRefreshReleaseReadiness {
  const reasons: string[] = [];
  const structuredRows = candidate.source_id === "google_sheet:1xIqHh5uAkoKMgYNk1fHox1YfDuBUzGzbn--R7t0_syM"
    ? candidate.evidence_quotes
        .map(parseStructuredShowRow)
        .filter((row): row is KnowledgeRefreshStructuredShowUpdate => Boolean(row))
    : [];
  const structuredShowUpdate = structuredRows.length === 1 ? structuredRows[0] : null;

  if (candidate.status !== "approved_content") reasons.push("This draft is not in the approved queue.");
  if (!candidate.title.trim() || !candidate.proposed_policy.trim()) reasons.push("The approved wording is incomplete.");
  if (!candidate.approved_by || !candidate.approved_at || !candidate.approved_snapshot_hash) {
    reasons.push("The human approval record is incomplete.");
  }
  if (
    candidate.approved_snapshot_hash &&
    candidate.approved_snapshot_hash !== candidate.snapshot_hash
  ) {
    reasons.push("The source changed after this draft was approved.");
  }
  if (context.lastContentHash && candidate.snapshot_hash !== context.lastContentHash) {
    reasons.push("A newer source version is available; review the newer draft instead.");
  }
  if (candidate.atomic_decision_count !== 1) {
    reasons.push("This draft contains more than one policy decision and must be separated.");
  }
  if (!candidate.evidence_quotes.length) reasons.push("No source evidence is attached.");
  if (!candidate.product_scopes.length) reasons.push("No product scope is attached.");
  if (candidate.candidate_kind === "knowledge_gap") {
    reasons.push("This is an unanswered knowledge gap, not a final policy answer.");
  }
  if (
    ["direct", "blocked"].includes(candidate.conflict_level) &&
    !["supersede", "scoped_coexistence"].includes(candidate.conflict_resolution || "")
  ) {
    reasons.push("The conflict does not have a final replace-or-scope decision.");
  }
  if (hasUnresolvedPolicyWording(candidate.proposed_policy)) {
    reasons.push("The wording asks for clarification or gives alternatives instead of one final answer.");
  }
  if (structuredRows.length > 1) {
    reasons.push("This draft combines multiple Sheet rows; each row must be reviewed as its own decision.");
  }
  if (structuredShowUpdate) {
    validateStructuredShowUpdate(candidate, structuredShowUpdate, reasons);
  }

  const governedDecisionKeys = [...new Set(
    candidate.conflicting_policy_ids
      .map((id) => context.decisionKeysByPolicyId?.[id])
      .filter((value): value is string => Boolean(value)),
  )];
  let decisionKey = candidate.decision_key?.trim() || null;
  let decisionKeySource: KnowledgeRefreshReleaseReadiness["decisionKeySource"] = decisionKey
    ? "approved_draft"
    : "missing";

  if (!decisionKey && governedDecisionKeys.length === 1) {
    decisionKey = governedDecisionKeys[0];
    decisionKeySource = "governed_policy";
  } else if (!decisionKey && governedDecisionKeys.length > 1) {
    reasons.push("The draft overlaps more than one governed decision and needs to be separated.");
  }
  if (!decisionKey) {
    decisionKey = structuredShowUpdate
      ? `show-catalog.${slug(structuredShowUpdate.showName)}.status`
      : deriveDecisionKey(candidate.policy_object || candidate.title);
    decisionKeySource = decisionKey ? "derived" : "missing";
  }
  if (!decisionKey) reasons.push("The draft has no stable policy identity.");
  if (
    decisionKey &&
    decisionKeySource === "derived" &&
    context.activeDecisionKeys?.includes(decisionKey) &&
    !candidate.conflicting_policy_ids.length
  ) {
    reasons.push("This policy identity already exists and must be reviewed as an update to the current rule.");
  }

  const resolvedDomains = candidate.policy_domains.length
    ? candidate.policy_domains
    : structuredShowUpdate
      ? ["shows_offers"]
      : ["general_sales"];
  const resolvedActions = candidate.policy_actions.length
    ? candidate.policy_actions
    : structuredShowUpdate?.status === "off"
      ? ["hold_or_pause", "use_or_promote"]
      : structuredShowUpdate
        ? ["use_or_promote"]
        : ["explain"];
  const resolvedEntities = candidate.policy_entities.length
    ? candidate.policy_entities
    : structuredShowUpdate
      ? [...new Set([...tokenize(structuredShowUpdate.showName), structuredShowUpdate.status === "on" ? "active" : "inactive", "show"])]
      : [];
  const resolvedPolicyObject = candidate.policy_object || (
    structuredShowUpdate ? `${structuredShowUpdate.showName} show status` : null
  );
  const ready = reasons.length === 0;

  return {
    ready,
    decisionKey,
    decisionKeySource,
    reasons,
    summary: ready
      ? structuredShowUpdate
        ? "Ready. This accepted row will be compiled into the governed current-show catalog."
        : "Ready for a test preview."
      : "Needs correction before it can enter a release preview.",
    resolvedDomains,
    resolvedActions,
    resolvedEntities,
    resolvedPolicyObject,
    structuredShowUpdate,
  };
}

function validateStructuredShowUpdate(
  candidate: ReleaseReadinessCandidate,
  update: KnowledgeRefreshStructuredShowUpdate,
  reasons: string[],
) {
  const proposal = normalizeSubject(candidate.proposed_policy);
  const showName = normalizeSubject(update.showName);
  if (!proposal.includes(showName)) {
    reasons.push("The proposed policy and its Sheet evidence refer to different shows.");
  }
  if (update.status === "on" && !/\b(active|status on|marked on|add|approved show|available for sales|currently available)\b/i.test(candidate.proposed_policy)) {
    reasons.push("The proposal does not clearly state the Sheet's active status.");
  }
  if (update.status === "off" && !/\b(inactive|status off|marked off|not active|should not be offered|paused)\b/i.test(candidate.proposed_policy)) {
    reasons.push("The proposal does not clearly state the Sheet's inactive status.");
  }
  if (update.url === "...") reasons.push("The attached Sheet evidence is abbreviated and is not enough for publication.");
  if (
    /\b(replace|replaces|renam|rebrand|same (?:show|as))\b/i.test(candidate.proposed_policy) &&
    /\b(likely|suggests?|may|might|possibly|possibility)\b/i.test(`${candidate.summary} ${candidate.rationale}`)
  ) {
    reasons.push("The Sheet proves the listed show status, but it does not prove the proposed rename or replacement.");
  }
}

function parseStructuredShowRow(value: string): KnowledgeRefreshStructuredShowUpdate | null {
  const fields = value.split("\t").map((field) => field.trim());
  if (fields.length < 4 || !/^(on|off)$/i.test(fields[3] || "")) return null;
  const showName = fields[0] || "";
  if (!showName) return null;
  return {
    kind: "istv_show_status",
    showName,
    url: fields[1] || null,
    acronym: fields[2] || null,
    status: fields[3].toLowerCase() as "on" | "off",
  };
}

export function hasUnresolvedPolicyWording(value: string) {
  return [
    /\bclarify whether\b/i,
    /\bneeds? (?:to be )?(?:confirmed|clarified|verified)\b/i,
    /\bnot (?:yet )?(?:confirmed|clear|decided)\b/i,
    /\bif same\b[\s\S]*\bif different\b/i,
    /\bif (?:it is|they are) the same\b[\s\S]*\bif (?:it is|they are) different\b/i,
  ].some((pattern) => pattern.test(value));
}

function deriveDecisionKey(value: string) {
  const normalized = slug(value);
  return normalized ? `admin.${normalized}` : null;
}

function slug(value: string) {
  return normalizeComparable(value).replace(/\s+/g, "-").slice(0, 100).replace(/-+$/g, "");
}

function tokenize(value: string) {
  return normalizeComparable(value).split(" ").filter((token) => token.length > 1);
}

function normalizeComparable(value: string) {
  return value
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeSubject(value: string) {
  return value.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "");
}
