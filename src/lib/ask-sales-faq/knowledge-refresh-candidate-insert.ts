export const KNOWLEDGE_REFRESH_CANDIDATE_INSERT_COLUMNS = [
  "id",
  "source_id",
  "snapshot_id",
  "snapshot_hash",
  "source_revision",
  "candidate_hash",
  "status",
  "title",
  "summary",
  "proposed_policy",
  "rationale",
  "decision_key",
  "product_scopes",
  "effective_date",
  "evidence_quotes",
  "candidate_kind",
  "policy_domains",
  "policy_actions",
  "policy_entities",
  "policy_object",
  "policy_conditions",
  "is_durable",
  "is_reusable",
  "answer_impact",
  "source_authority",
  "authority_name",
  "authority_basis",
  "atomic_decision_count",
  "ai_model",
  "ai_confidence",
  "conflict_level",
  "conflict_summary",
  "conflicting_policy_ids",
  "related_policies",
  "blocked_topic_ids",
  "review_note",
] as const;

export type KnowledgeRefreshCandidateInsertColumn =
  (typeof KNOWLEDGE_REFRESH_CANDIDATE_INSERT_COLUMNS)[number];

const JSON_COLUMNS = new Set<KnowledgeRefreshCandidateInsertColumn>([
  "product_scopes",
  "evidence_quotes",
  "policy_domains",
  "policy_actions",
  "policy_entities",
  "conflicting_policy_ids",
  "related_policies",
  "blocked_topic_ids",
]);

export function buildKnowledgeRefreshCandidateInsert(
  values: Record<KnowledgeRefreshCandidateInsertColumn, unknown>,
) {
  const columns = KNOWLEDGE_REFRESH_CANDIDATE_INSERT_COLUMNS;
  return {
    columnsSql: columns.join(", "),
    valuesSql: columns
      .map((column, index) => `$${index + 1}${JSON_COLUMNS.has(column) ? "::jsonb" : ""}`)
      .join(", "),
    params: columns.map((column) =>
      JSON_COLUMNS.has(column) ? JSON.stringify(values[column]) : values[column],
    ),
  };
}
