import "server-only";

import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  buildKnowledgeRefreshAnalysisContext,
  compareKnowledgeRefreshCandidate,
  getKnowledgeRefreshBlockedTopicContexts,
  getKnowledgeRefreshRegistryVersion,
  type KnowledgeRefreshBlockedTopicContext,
  type KnowledgeRefreshConflictLevel,
  type KnowledgeRefreshPolicyContext,
} from "@/lib/ask-sales-faq/knowledge-refresh-governance";
import {
  KNOWLEDGE_REFRESH_SOURCES,
  getKnowledgeRefreshSource,
  type KnowledgeRefreshSourceKind,
} from "@/lib/ask-sales-faq/knowledge-refresh-sources";
import {
  buildKnowledgeRefreshAnalysisPayload,
  classifyKnowledgeRefreshCandidateNoise,
} from "@/lib/ask-sales-faq/knowledge-refresh-noise";
import {
  assessKnowledgeRefreshReleaseReadiness,
  type KnowledgeRefreshReleaseReadiness,
} from "@/lib/ask-sales-faq/knowledge-refresh-release-readiness";
import {
  buildV3AdminApprovedRelease,
  getMaterializedV3Registry,
  previewV3AdminApprovedRelease,
  type V3AdminApprovedRelease,
  type V3AdminReleaseCandidate,
} from "@/lib/ask-sales-faq/v3/admin-approved-releases";
import {
  compileV3AdminReleaseCandidates,
  type V3AdminReleaseDraft,
} from "@/lib/ask-sales-faq/v3/admin-release-candidate-compiler";

type SqlClient = ReturnType<typeof neon>;

let sqlClient: SqlClient | null = null;
let schemaPromise: Promise<void> | null = null;

export type KnowledgeRefreshCandidateStatus =
  | "needs_review"
  | "needs_owner"
  | "approved_content"
  | "rejected"
  | "deferred"
  | "duplicate"
  | "engineering_required"
  | "preparing_release"
  | "ready_to_publish"
  | "publishing"
  | "deployed"
  | "production_verified"
  | "validation_failed"
  | "deployment_failed"
  | "rolled_back"
  | "stale";

export type KnowledgeRefreshConflictResolution =
  | "supersede"
  | "scoped_coexistence"
  | "existing_remains"
  | "owner_needed"
  | "historical_case"
  | "engineering_required";

export type KnowledgeRefreshSourceRow = {
  id: string;
  kind: KnowledgeRefreshSourceKind;
  label: string;
  external_id: string;
  url: string;
  enabled: boolean;
  availability: "pending" | "available" | "unavailable" | "replacement_active";
  replacement_source_id: string | null;
  last_checked_at: string | null;
  last_changed_at: string | null;
  last_source_updated_at: string | null;
  last_content_hash: string | null;
  last_cursor: Record<string, unknown>;
  last_error: string | null;
};

export type KnowledgeRefreshCandidateRow = {
  id: string;
  source_id: string;
  source_label: string;
  source_url: string;
  snapshot_id: string;
  snapshot_hash: string;
  source_revision: string | null;
  status: KnowledgeRefreshCandidateStatus;
  version: number;
  title: string;
  summary: string;
  proposed_policy: string;
  rationale: string;
  decision_key: string | null;
  product_scopes: string[];
  effective_date: string | null;
  evidence_quotes: string[];
  candidate_kind: KnowledgeRefreshCandidateKind;
  policy_domains: string[];
  policy_actions: string[];
  policy_entities: string[];
  policy_object: string | null;
  policy_conditions: string | null;
  is_durable: boolean;
  is_reusable: boolean;
  answer_impact: KnowledgeRefreshAnswerImpact;
  source_authority: KnowledgeRefreshSourceAuthority;
  authority_name: string | null;
  authority_basis: string | null;
  atomic_decision_count: number;
  ai_model: string;
  ai_confidence: number;
  conflict_level: KnowledgeRefreshConflictLevel;
  conflict_summary: string;
  conflicting_policy_ids: string[];
  related_policies: Array<Record<string, unknown>>;
  blocked_topic_ids: string[];
  blocked_topics: KnowledgeRefreshBlockedTopicContext[];
  change_kind?: "new" | "updated";
  previous_candidate_id?: string | null;
  previous_candidate_title?: string | null;
  conflict_resolution: KnowledgeRefreshConflictResolution | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approved_snapshot_hash: string | null;
  release_id: string | null;
  release_readiness?: KnowledgeRefreshReleaseReadiness;
  created_at: string;
  updated_at: string;
};

export type KnowledgeRefreshReleaseRow = {
  id: string;
  status: string;
  knowledge_version: string;
  candidate_ids: string[];
  manifest: Record<string, unknown>;
  validation: Record<string, unknown>;
  publication: Record<string, unknown>;
  last_error: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
};

export type KnowledgeRefreshAiCandidate = {
  title: string;
  summary: string;
  proposedPolicy: string;
  rationale: string;
  decisionKey?: string | null;
  productScopes: string[];
  effectiveDate?: string | null;
  evidenceQuotes: string[];
  confidence: number;
  candidateKind?: KnowledgeRefreshCandidateKind;
  domains?: string[];
  actions?: string[];
  entities?: string[];
  policyObject?: string | null;
  conditions?: string | null;
  isDurable?: boolean;
  isReusable?: boolean;
  answerImpact?: KnowledgeRefreshAnswerImpact;
  sourceAuthority?: KnowledgeRefreshSourceAuthority;
  authorityName?: string | null;
  authorityBasis?: string | null;
  atomicDecisionCount?: number;
};

export type KnowledgeRefreshCandidateKind = "new_rule" | "rule_change" | "conflict" | "clarification" | "knowledge_gap";
export type KnowledgeRefreshAnswerImpact = "material" | "possible" | "none";
export type KnowledgeRefreshSourceAuthority = "owner_confirmed" | "manager_guidance" | "rep_answer" | "rep_question" | "unknown";

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export function hasKnowledgeRefreshDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export function isKnowledgeRefreshServiceToken(value: string | null | undefined) {
  const expected = process.env.ASK_SALES_KNOWLEDGE_REFRESH_TOKEN;
  if (!expected || !value) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(value);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function ensureKnowledgeRefreshStorage() {
  if (!hasKnowledgeRefreshDatabase()) throw new Error("DATABASE_URL is not configured");
  if (!schemaPromise) {
    schemaPromise = buildKnowledgeRefreshSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

async function buildKnowledgeRefreshSchema() {
  const sql = getSql();
  await sql`
    create table if not exists ask_sales_faq_refresh_sources (
      id text primary key,
      kind text not null check (kind in ('slack_channel', 'google_doc', 'google_sheet')),
      label text not null,
      external_id text not null,
      url text not null,
      enabled boolean not null default true,
      availability text not null default 'pending' check (availability in ('pending', 'available', 'unavailable', 'replacement_active')),
      replacement_source_id text,
      last_checked_at timestamptz,
      last_changed_at timestamptz,
      last_source_updated_at timestamptz,
      last_content_hash text,
      last_cursor jsonb not null default '{}'::jsonb,
      last_error text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists ask_sales_faq_refresh_sources_kind_idx on ask_sales_faq_refresh_sources (kind, enabled)`;

  await sql`
    create table if not exists ask_sales_faq_refresh_snapshots (
      id text primary key,
      source_id text not null references ask_sales_faq_refresh_sources(id),
      content_hash text not null,
      source_revision text,
      source_updated_at timestamptz,
      content_redacted text not null,
      redactions jsonb not null default '[]'::jsonb,
      metadata jsonb not null default '{}'::jsonb,
      run_id text,
      analysis_completed_at timestamptz,
      analysis_model text,
      created_at timestamptz not null default now(),
      unique (source_id, content_hash)
    )
  `;
  await sql`alter table ask_sales_faq_refresh_snapshots add column if not exists analysis_completed_at timestamptz`;
  await sql`alter table ask_sales_faq_refresh_snapshots add column if not exists analysis_model text`;
  await sql`create index if not exists ask_sales_faq_refresh_snapshots_source_created_idx on ask_sales_faq_refresh_snapshots (source_id, created_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_refresh_candidates (
      id text primary key,
      source_id text not null references ask_sales_faq_refresh_sources(id),
      snapshot_id text not null references ask_sales_faq_refresh_snapshots(id),
      snapshot_hash text not null,
      source_revision text,
      candidate_hash text not null,
      status text not null default 'needs_review',
      version integer not null default 1,
      title text not null,
      summary text not null,
      proposed_policy text not null,
      rationale text not null,
      decision_key text,
      product_scopes jsonb not null default '[]'::jsonb,
      effective_date date,
      evidence_quotes jsonb not null default '[]'::jsonb,
      candidate_kind text not null default 'new_rule',
      policy_domains jsonb not null default '[]'::jsonb,
      policy_actions jsonb not null default '[]'::jsonb,
      policy_entities jsonb not null default '[]'::jsonb,
      policy_object text,
      policy_conditions text,
      is_durable boolean not null default true,
      is_reusable boolean not null default true,
      answer_impact text not null default 'possible',
      source_authority text not null default 'unknown',
      authority_name text,
      authority_basis text,
      atomic_decision_count integer not null default 1,
      ai_model text not null,
      ai_confidence numeric not null default 0,
      conflict_level text not null default 'none',
      conflict_summary text not null default '',
      conflicting_policy_ids jsonb not null default '[]'::jsonb,
      related_policies jsonb not null default '[]'::jsonb,
      blocked_topic_ids jsonb not null default '[]'::jsonb,
      conflict_resolution text,
      review_note text,
      reviewed_by text,
      reviewed_at timestamptz,
      approved_by text,
      approved_at timestamptz,
      approved_snapshot_hash text,
      release_id text,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now(),
      unique (snapshot_id, candidate_hash)
    )
  `;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists candidate_kind text not null default 'new_rule'`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists policy_domains jsonb not null default '[]'::jsonb`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists policy_actions jsonb not null default '[]'::jsonb`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists policy_entities jsonb not null default '[]'::jsonb`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists policy_object text`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists policy_conditions text`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists is_durable boolean not null default true`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists is_reusable boolean not null default true`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists answer_impact text not null default 'possible'`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists source_authority text not null default 'unknown'`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists authority_name text`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists authority_basis text`;
  await sql`alter table ask_sales_faq_refresh_candidates add column if not exists atomic_decision_count integer not null default 1`;
  await sql`create index if not exists ask_sales_faq_refresh_candidates_status_idx on ask_sales_faq_refresh_candidates (status, updated_at desc)`;
  await sql`create index if not exists ask_sales_faq_refresh_candidates_source_idx on ask_sales_faq_refresh_candidates (source_id, created_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_refresh_releases (
      id text primary key,
      status text not null,
      knowledge_version text not null,
      candidate_ids jsonb not null default '[]'::jsonb,
      manifest jsonb not null default '{}'::jsonb,
      validation jsonb not null default '{}'::jsonb,
      publication jsonb not null default '{}'::jsonb,
      action_token_hash text,
      action_token_expires_at timestamptz,
      action_type text,
      action_started_at timestamptz,
      last_error text,
      created_by text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`alter table ask_sales_faq_refresh_releases add column if not exists publication jsonb not null default '{}'::jsonb`;
  await sql`alter table ask_sales_faq_refresh_releases add column if not exists action_token_hash text`;
  await sql`alter table ask_sales_faq_refresh_releases add column if not exists action_token_expires_at timestamptz`;
  await sql`alter table ask_sales_faq_refresh_releases add column if not exists action_type text`;
  await sql`alter table ask_sales_faq_refresh_releases add column if not exists action_started_at timestamptz`;
  await sql`alter table ask_sales_faq_refresh_releases add column if not exists last_error text`;

  await sql`
    create table if not exists ask_sales_faq_refresh_audit (
      id bigserial primary key,
      entity_type text not null,
      entity_id text not null,
      event_type text not null,
      actor text not null,
      from_status text,
      to_status text,
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists ask_sales_faq_refresh_audit_entity_idx on ask_sales_faq_refresh_audit (entity_type, entity_id, created_at desc)`;
  await sql`
    update ask_sales_faq_refresh_snapshots snapshot
    set analysis_completed_at = completed.created_at,
        analysis_model = coalesce(snapshot.analysis_model, completed.model)
    from (
      select distinct on (entity_id)
             entity_id, created_at, details ->> 'model' as model
      from ask_sales_faq_refresh_audit
      where entity_type = 'snapshot' and event_type = 'analysis_completed'
      order by entity_id, created_at desc
    ) completed
    where snapshot.id = completed.entity_id and snapshot.analysis_completed_at is null
  `;

  await seedKnowledgeRefreshSources();
}

async function seedKnowledgeRefreshSources() {
  const sql = getSql();
  for (const source of KNOWLEDGE_REFRESH_SOURCES) {
    await sql.query(
      `
        insert into ask_sales_faq_refresh_sources (
          id, kind, label, external_id, url, enabled, replacement_source_id, updated_at
        ) values ($1, $2, $3, $4, $5, $6, $7, now())
        on conflict (id) do update set
          kind = excluded.kind,
          external_id = excluded.external_id,
          url = excluded.url,
          enabled = excluded.enabled,
          replacement_source_id = excluded.replacement_source_id,
          label = case
            when ask_sales_faq_refresh_sources.last_checked_at is null then excluded.label
            else ask_sales_faq_refresh_sources.label
          end,
          updated_at = now()
      `,
      [source.id, source.kind, source.label, source.externalId, source.url, source.enabled, source.replacementSourceId || null],
    );
  }
}

export async function listKnowledgeRefreshSources() {
  await ensureKnowledgeRefreshStorage();
  return (await getSql().query(
    `select id, kind, label, external_id, url, enabled, availability, replacement_source_id,
            last_checked_at, last_changed_at, last_source_updated_at, last_content_hash,
            last_cursor, last_error
     from ask_sales_faq_refresh_sources
     order by case kind when 'slack_channel' then 0 when 'google_doc' then 1 else 2 end, label`,
  )) as KnowledgeRefreshSourceRow[];
}

export async function recordKnowledgeRefreshSourceFailure(input: {
  sourceId: string;
  label?: string;
  error: string;
  cursor?: Record<string, unknown>;
  runId?: string | null;
}) {
  await ensureKnowledgeRefreshStorage();
  const source = getKnowledgeRefreshSource(input.sourceId);
  if (!source) throw new Error("Unknown knowledge refresh source");
  const safeError = sanitizeOperationalText(input.error, 500);
  await getSql().query(
    `update ask_sales_faq_refresh_sources
     set label = coalesce(nullif($2, ''), label), availability = 'unavailable', last_checked_at = now(),
         last_cursor = coalesce($3::jsonb, last_cursor), last_error = $4, updated_at = now()
     where id = $1`,
    [input.sourceId, sanitizeOperationalText(input.label || "", 180), input.cursor ? JSON.stringify(input.cursor) : null, safeError],
  );
  await writeAudit("source", input.sourceId, "source_unavailable", "n8n:ask-sales-knowledge-refresh", null, "unavailable", {
    error: safeError,
    runId: input.runId || null,
  });
}

export async function recordKnowledgeRefreshSnapshot(input: {
  sourceId: string;
  label?: string;
  sourceRevision?: string | null;
  sourceUpdatedAt?: string | null;
  content: string;
  metadata?: Record<string, unknown>;
  cursor?: Record<string, unknown>;
  runId?: string | null;
}) {
  await ensureKnowledgeRefreshStorage();
  const source = getKnowledgeRefreshSource(input.sourceId);
  if (!source) throw new Error("Unknown knowledge refresh source");
  const redacted = redactKnowledgeRefreshContent(input.content);
  if (!redacted.text.trim()) throw new Error("Source content is empty after normalization");
  const contentHash = sha256(redacted.text);
  const sql = getSql();
  const previousSnapshots = (await sql.query(
    `select content_redacted
     from ask_sales_faq_refresh_snapshots
     where source_id = $1
     order by created_at desc
     limit 1`,
    [input.sourceId],
  )) as Array<{ content_redacted: string }>;
  let analysisPayload = buildKnowledgeRefreshAnalysisPayload({
    kind: source.kind,
    currentContent: redacted.text,
    previousContent: previousSnapshots[0]?.content_redacted || null,
  });
  const currentRows = (await sql.query(
    `select last_content_hash from ask_sales_faq_refresh_sources where id = $1 limit 1`,
    [input.sourceId],
  )) as Array<{ last_content_hash: string | null }>;
  const unchanged = currentRows[0]?.last_content_hash === contentHash;
  const snapshotId = `ks_${randomUUID()}`;

  const snapshotRows = (await sql.query(
    `insert into ask_sales_faq_refresh_snapshots (
       id, source_id, content_hash, source_revision, source_updated_at, content_redacted,
       redactions, metadata, run_id
     ) values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, $9)
     on conflict (source_id, content_hash) do update set
       source_revision = coalesce(excluded.source_revision, ask_sales_faq_refresh_snapshots.source_revision),
       source_updated_at = coalesce(excluded.source_updated_at, ask_sales_faq_refresh_snapshots.source_updated_at),
       metadata = ask_sales_faq_refresh_snapshots.metadata || excluded.metadata
     returning id, analysis_completed_at`,
    [
      snapshotId,
      input.sourceId,
      contentHash,
      sanitizeOperationalText(input.sourceRevision || "", 200) || null,
      normalizeTimestamp(input.sourceUpdatedAt),
      redacted.text,
      JSON.stringify(redacted.redactions),
      JSON.stringify(sanitizeMetadata(input.metadata || {})),
      sanitizeOperationalText(input.runId || "", 100) || null,
    ],
  )) as Array<{ id: string; analysis_completed_at: string | null }>;
  const storedSnapshotId = snapshotRows[0]?.id || snapshotId;
  const analysisWasIncomplete = !snapshotRows[0]?.analysis_completed_at;
  if (unchanged && analysisWasIncomplete) {
    analysisPayload = { mode: "full", content: redacted.text, materialChange: true };
  }
  const analysisRequired = (!unchanged || analysisWasIncomplete) && analysisPayload.materialChange;

  await sql.query(
    `update ask_sales_faq_refresh_sources
     set label = coalesce(nullif($2, ''), label), availability = 'available', last_checked_at = now(),
         last_changed_at = case when last_content_hash is distinct from $3 then now() else last_changed_at end,
         last_source_updated_at = coalesce($4, last_source_updated_at), last_content_hash = $3,
         last_cursor = coalesce($5::jsonb, last_cursor), last_error = null, updated_at = now()
     where id = $1`,
    [
      input.sourceId,
      sanitizeOperationalText(input.label || "", 180),
      contentHash,
      normalizeTimestamp(input.sourceUpdatedAt),
      input.cursor ? JSON.stringify(input.cursor) : null,
    ],
  );

  if (!unchanged) {
    await sql.query(
      `update ask_sales_faq_refresh_candidates
       set status = 'stale', version = version + 1, updated_at = now(),
           review_note = coalesce(review_note || E'\n', '') || 'Source changed after this candidate was created.'
       where source_id = $1 and snapshot_hash <> $2
         and status in ('needs_review', 'needs_owner', 'approved_content', 'deferred', 'preparing_release', 'ready_to_publish')`,
      [input.sourceId, contentHash],
    );
  }

  if (!analysisRequired && analysisWasIncomplete) {
    await sql.query(
      `update ask_sales_faq_refresh_snapshots
       set analysis_completed_at = now(), analysis_model = 'deterministic-no-material-change'
       where id = $1`,
      [storedSnapshotId],
    );
    await writeAudit("snapshot", storedSnapshotId, "analysis_skipped_no_material_change", "dashboard:deterministic-screen", null, null, {
      sourceId: input.sourceId,
      contentHash,
      analysisMode: analysisPayload.mode,
    });
  }

  await writeAudit("snapshot", storedSnapshotId, unchanged ? "source_unchanged" : "source_changed", "n8n:ask-sales-knowledge-refresh", null, null, {
    sourceId: input.sourceId,
    contentHash,
    runId: input.runId || null,
    redactions: redacted.redactions,
    analysisRequired,
  });

  return {
    unchanged,
    analysisRequired,
    analysisMode: analysisPayload.mode,
    snapshotId: storedSnapshotId,
    snapshotHash: contentHash,
    knowledgeVersion: getKnowledgeRefreshRegistryVersion(),
    governanceContext: analysisRequired ? buildKnowledgeRefreshAnalysisContext(redacted.text) : null,
    content: analysisRequired ? analysisPayload.content : null,
    redactions: redacted.redactions,
  };
}

export async function recordKnowledgeRefreshCandidates(input: {
  sourceId: string;
  snapshotId: string;
  snapshotHash: string;
  sourceRevision?: string | null;
  model: string;
  candidates: KnowledgeRefreshAiCandidate[];
}) {
  await ensureKnowledgeRefreshStorage();
  if (!getKnowledgeRefreshSource(input.sourceId)) throw new Error("Unknown knowledge refresh source");
  const sql = getSql();
  const snapshotRows = (await sql.query(
    `select s.id, s.content_hash, r.last_content_hash
     from ask_sales_faq_refresh_snapshots s
     join ask_sales_faq_refresh_sources r on r.id = s.source_id
     where s.id = $1 and s.source_id = $2 limit 1`,
    [input.snapshotId, input.sourceId],
  )) as Array<{ id: string; content_hash: string; last_content_hash: string | null }>;
  const snapshot = snapshotRows[0];
  if (!snapshot || snapshot.content_hash !== input.snapshotHash || snapshot.last_content_hash !== input.snapshotHash) {
    throw new Error("Snapshot is stale or does not match the current source version");
  }

  const insertedIds: string[] = [];
  const insertedStatuses: KnowledgeRefreshCandidateStatus[] = [];
  for (const rawCandidate of input.candidates.slice(0, 20)) {
    const candidate = normalizeAiCandidate(rawCandidate);
    if (!candidate) continue;
    const governance = compareKnowledgeRefreshCandidate({
      title: candidate.title,
      proposedPolicy: candidate.proposedPolicy,
      decisionKey: candidate.decisionKey || null,
      productScopes: candidate.productScopes,
      domains: candidate.domains,
      actions: candidate.actions,
      entities: candidate.entities,
      policyObject: candidate.policyObject,
      conditions: candidate.conditions,
    });
    const candidateHash = sha256(JSON.stringify({
      decisionKey: candidate.decisionKey || null,
      productScopes: candidate.productScopes,
      proposedPolicy: candidate.proposedPolicy,
      evidenceQuotes: candidate.evidenceQuotes,
      candidateKind: candidate.candidateKind,
      domains: candidate.domains,
      actions: candidate.actions,
      entities: candidate.entities,
      policyObject: candidate.policyObject,
      conditions: candidate.conditions,
      isDurable: candidate.isDurable,
      isReusable: candidate.isReusable,
      answerImpact: candidate.answerImpact,
      sourceAuthority: candidate.sourceAuthority,
      authorityName: candidate.authorityName,
      authorityBasis: candidate.authorityBasis,
      atomicDecisionCount: candidate.atomicDecisionCount,
    }));
    const duplicateRows = (await sql.query(
      `select id
       from ask_sales_faq_refresh_candidates
       where source_id = $1
         and (
           candidate_hash = $2
           or (decision_key is not distinct from $3 and proposed_policy = $4)
         )
       order by created_at desc
       limit 1`,
      [input.sourceId, candidateHash, candidate.decisionKey || null, candidate.proposedPolicy],
    )) as Array<{ id: string }>;
    const noise = classifyKnowledgeRefreshCandidateNoise({
      title: candidate.title,
      proposedPolicy: candidate.proposedPolicy,
      confidence: candidate.confidence,
      duplicateOfCandidateId: duplicateRows[0]?.id || null,
      candidateKind: candidate.candidateKind,
      domains: candidate.domains,
      actions: candidate.actions,
      entities: candidate.entities,
      isDurable: candidate.isDurable,
      isReusable: candidate.isReusable,
      answerImpact: candidate.answerImpact,
      sourceAuthority: candidate.sourceAuthority,
      authorityName: candidate.authorityName,
      atomicDecisionCount: candidate.atomicDecisionCount,
    });
    const candidateId = `kc_${randomUUID()}`;
    const rows = (await sql.query(
      `insert into ask_sales_faq_refresh_candidates (
         id, source_id, snapshot_id, snapshot_hash, source_revision, candidate_hash, status,
         title, summary, proposed_policy, rationale, decision_key, product_scopes, effective_date,
         evidence_quotes, candidate_kind, policy_domains, policy_actions, policy_entities,
         policy_object, policy_conditions, is_durable, is_reusable, answer_impact, source_authority,
         authority_name, authority_basis, atomic_decision_count, ai_model, ai_confidence, conflict_level, conflict_summary,
         conflicting_policy_ids, related_policies, blocked_topic_ids, review_note
       ) values (
         $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14,
         $15::jsonb, $16, $17::jsonb, $18::jsonb, $19::jsonb, $20, $21, $22, $23,
         $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35::jsonb, $36::jsonb, $37::jsonb, $38
       ) on conflict (snapshot_id, candidate_hash) do nothing returning id`,
      [
        candidateId,
        input.sourceId,
        input.snapshotId,
        input.snapshotHash,
        sanitizeOperationalText(input.sourceRevision || "", 200) || null,
        candidateHash,
        noise.status,
        candidate.title,
        candidate.summary,
        candidate.proposedPolicy,
        candidate.rationale,
        candidate.decisionKey || null,
        JSON.stringify(candidate.productScopes),
        normalizeDate(candidate.effectiveDate),
        JSON.stringify(candidate.evidenceQuotes),
        candidate.candidateKind,
        JSON.stringify(candidate.domains),
        JSON.stringify(candidate.actions),
        JSON.stringify(candidate.entities),
        candidate.policyObject,
        candidate.conditions,
        candidate.isDurable,
        candidate.isReusable,
        candidate.answerImpact,
        candidate.sourceAuthority,
        candidate.authorityName,
        candidate.authorityBasis,
        candidate.atomicDecisionCount,
        sanitizeOperationalText(input.model, 120),
        candidate.confidence,
        governance.conflictLevel,
        governance.conflictSummary,
        JSON.stringify(governance.conflictingPolicyIds),
        JSON.stringify(governance.relatedPolicies),
        JSON.stringify(governance.blockedTopicIds),
        noise.reason,
      ],
    )) as Array<{ id: string }>;
    if (rows[0]?.id) {
      insertedIds.push(rows[0].id);
      insertedStatuses.push(noise.status);
      if (noise.status !== "needs_review") {
        await writeAudit("candidate", candidateId, "candidate_screened", "dashboard:deterministic-screen", null, noise.status, {
          reason: noise.reason,
          sourceId: input.sourceId,
          snapshotId: input.snapshotId,
        });
      }
    }
  }

  await sql.query(
    `update ask_sales_faq_refresh_snapshots
     set analysis_completed_at = now(), analysis_model = $2
     where id = $1`,
    [input.snapshotId, sanitizeOperationalText(input.model, 120)],
  );

  await writeAudit("snapshot", input.snapshotId, "analysis_completed", "n8n:ask-sales-knowledge-refresh", null, null, {
    sourceId: input.sourceId,
    model: sanitizeOperationalText(input.model, 120),
    candidateCount: insertedIds.length,
    needsReviewCount: insertedStatuses.filter((status) => status === "needs_review").length,
    screenedCount: insertedStatuses.filter((status) => status !== "needs_review").length,
  });

  return { insertedCandidateIds: insertedIds, insertedCount: insertedIds.length };
}

export type KnowledgeRefreshQueueView = "actionable" | "approved" | "resolved" | "stale" | "all";

export type KnowledgeRefreshOverviewFilters = {
  view?: KnowledgeRefreshQueueView;
  query?: string;
  sourceKind?: KnowledgeRefreshSourceKind | "all";
  conflictLevel?: KnowledgeRefreshConflictLevel | "all";
  page?: number;
  pageSize?: number;
};

export async function getKnowledgeRefreshOverview(input: KnowledgeRefreshOverviewFilters = {}) {
  await ensureKnowledgeRefreshStorage();
  const sql = getSql();
  const view = input.view || "actionable";
  const query = sanitizeOperationalText(input.query || "", 160);
  const sourceKind = input.sourceKind || "all";
  const conflictLevel = input.conflictLevel || "all";
  const pageSize = Math.max(10, Math.min(50, Math.trunc(input.pageSize || 20)));
  const page = Math.max(1, Math.trunc(input.page || 1));
  const values: unknown[] = [];
  const clauses: string[] = [];
  const statuses = queueViewStatuses(view);
  if (statuses.length) {
    values.push(statuses);
    clauses.push(`c.status = any($${values.length}::text[])`);
  }
  if (sourceKind !== "all") {
    values.push(sourceKind);
    clauses.push(`s.kind = $${values.length}`);
  }
  if (conflictLevel !== "all") {
    values.push(conflictLevel);
    clauses.push(`c.conflict_level = $${values.length}`);
  }
  if (query) {
    values.push(`%${query}%`);
    clauses.push(`(c.title ilike $${values.length} or c.summary ilike $${values.length} or c.proposed_policy ilike $${values.length} or s.label ilike $${values.length})`);
  }
  const where = clauses.length ? `where ${clauses.join(" and ")}` : "";
  const countValues = [...values];
  values.push(pageSize, (page - 1) * pageSize);
  const [sources, candidateRows, releases, counts, latestRunRows] = await Promise.all([
    listKnowledgeRefreshSources(),
    sql.query(
      `select c.*, s.label as source_label, s.url as source_url, s.last_content_hash
       from ask_sales_faq_refresh_candidates c
       join ask_sales_faq_refresh_sources s on s.id = c.source_id
       ${where}
       order by case c.status when 'needs_review' then 0 when 'needs_owner' then 1 when 'approved_content' then 2 else 3 end,
                c.updated_at desc
       limit $${values.length - 1} offset $${values.length}`,
      values,
    ) as unknown as Promise<Array<KnowledgeRefreshCandidateRow & { last_content_hash: string | null }>>,
    sql.query(`select * from ask_sales_faq_refresh_releases order by created_at desc limit 30`) as unknown as Promise<KnowledgeRefreshReleaseRow[]>,
    sql.query(
      `select
         count(*) filter (where status = 'needs_review')::int as needs_review,
         count(*) filter (where status = 'needs_owner')::int as needs_owner,
         count(*) filter (where status = 'approved_content')::int as approved_content,
         count(*) filter (where status = 'deferred')::int as deferred,
         count(*) filter (where status = 'duplicate')::int as duplicate,
         count(*) filter (where status = 'rejected')::int as rejected,
         count(*) filter (where status = 'stale')::int as stale,
         count(*)::int as total
       from ask_sales_faq_refresh_candidates`,
    ) as unknown as Promise<Array<{ needs_review: number; needs_owner: number; approved_content: number; deferred: number; duplicate: number; rejected: number; stale: number; total: number }>>,
    sql.query(
      `
        with latest_run as (
          select run_id, min(created_at) as started_at, max(created_at) as completed_at
          from ask_sales_faq_refresh_snapshots
          where run_id is not null and run_id <> ''
          group by run_id
          order by max(created_at) desc
          limit 1
        )
        select
          latest_run.run_id,
          latest_run.started_at::text,
          latest_run.completed_at::text,
          count(distinct audit.entity_id) filter (where audit.event_type = 'source_changed')::int as changed_sources,
          count(distinct audit.entity_id) filter (where audit.event_type = 'source_unchanged')::int as unchanged_sources,
          count(distinct audit.entity_id) filter (where audit.event_type = 'source_unavailable')::int as unavailable_sources,
          (
            select count(*)::int
            from ask_sales_faq_refresh_candidates candidate
            join ask_sales_faq_refresh_snapshots snapshot on snapshot.id = candidate.snapshot_id
            where snapshot.run_id = latest_run.run_id
          ) as new_proposals,
          (
            select count(*)::int
            from ask_sales_faq_refresh_candidates candidate
            where candidate.status = 'stale'
              and candidate.updated_at >= latest_run.started_at - interval '1 minute'
              and candidate.updated_at <= latest_run.completed_at + interval '5 minutes'
          ) as prior_drafts_replaced
        from latest_run
        left join ask_sales_faq_refresh_audit audit
          on audit.details ->> 'runId' = latest_run.run_id
        group by latest_run.run_id, latest_run.started_at, latest_run.completed_at
      `,
    ) as unknown as Promise<Array<{
      run_id: string;
      started_at: string;
      completed_at: string;
      changed_sources: number;
      unchanged_sources: number;
      unavailable_sources: number;
      new_proposals: number;
      prior_drafts_replaced: number;
    }>>,
  ]);
  const sourceIds = Array.from(new Set(candidateRows.map((candidate) => candidate.source_id)));
  const history = sourceIds.length
    ? await sql.query(
        `
          select id, source_id, title, proposed_policy, created_at::text as created_at
          from ask_sales_faq_refresh_candidates
          where source_id = any($1::text[])
          order by created_at asc
        `,
        [sourceIds],
      ) as Array<{ id: string; source_id: string; title: string; proposed_policy: string; created_at: string }>
    : [];
  const registry = getMaterializedV3Registry();
  const decisionKeysByPolicyId = Object.fromEntries(registry.policies.map((policy) => [policy.id, policy.decision_key]));
  const activeDecisionKeys = registry.policies.map((policy) => policy.decision_key);
  const candidates = candidateRows.map((candidate) => {
    const previous = findPreviousCandidate(candidate, history);
    return {
      ...candidate,
      blocked_topics: getKnowledgeRefreshBlockedTopicContexts(
        candidate.blocked_topic_ids || [],
        `${candidate.title} ${candidate.proposed_policy} ${candidate.decision_key || ""} ${candidate.product_scopes.join(" ")}`,
      ),
      change_kind: previous ? "updated" as const : "new" as const,
      previous_candidate_id: previous?.id || null,
      previous_candidate_title: previous?.title || null,
      release_readiness: assessKnowledgeRefreshReleaseReadiness(candidate, {
        lastContentHash: candidate.last_content_hash,
        decisionKeysByPolicyId,
        activeDecisionKeys,
      }),
    };
  });
  const filteredRows = (await sql.query(
    `select count(*)::int as total
     from ask_sales_faq_refresh_candidates c
     join ask_sales_faq_refresh_sources s on s.id = c.source_id
     ${where}`,
    countValues,
  )) as Array<{ total: number }>;
  const filteredTotal = filteredRows[0]?.total || 0;
  return {
    generatedAt: new Date().toISOString(),
    knowledgeVersion: getKnowledgeRefreshRegistryVersion(),
    publishEnabled: process.env.ASK_SALES_KNOWLEDGE_REFRESH_PUBLISH_ENABLED === "true",
    sources,
    candidates,
    releases,
    latestRun: latestRunRows[0] || null,
    summary: counts[0] || { needs_review: 0, needs_owner: 0, approved_content: 0, deferred: 0, duplicate: 0, rejected: 0, stale: 0, total: 0 },
    filters: { view, query, sourceKind, conflictLevel },
    pagination: {
      page,
      pageSize,
      total: filteredTotal,
      totalPages: Math.max(1, Math.ceil(filteredTotal / pageSize)),
    },
  };
}

function queueViewStatuses(view: KnowledgeRefreshQueueView): KnowledgeRefreshCandidateStatus[] {
  if (view === "actionable") return ["needs_review", "needs_owner"];
  if (view === "approved") return ["approved_content", "preparing_release", "ready_to_publish", "publishing", "deployed", "production_verified"];
  if (view === "resolved") return ["deferred", "duplicate", "rejected", "engineering_required", "validation_failed", "deployment_failed", "rolled_back"];
  if (view === "stale") return ["stale"];
  return [];
}

export async function transitionKnowledgeRefreshCandidate(input: {
  candidateId: string;
  expectedVersion: number;
  action: "approve_content" | "reject" | "defer" | "needs_owner" | "duplicate" | "engineering_required";
  actor: string;
  note?: string | null;
  editedPolicy?: string | null;
  conflictResolution?: KnowledgeRefreshConflictResolution | null;
}) {
  await ensureKnowledgeRefreshStorage();
  const sql = getSql();
  const rows = (await sql.query(
    `select c.*, s.last_content_hash
     from ask_sales_faq_refresh_candidates c
     join ask_sales_faq_refresh_sources s on s.id = c.source_id
     where c.id = $1 limit 1`,
    [input.candidateId],
  )) as Array<KnowledgeRefreshCandidateRow & { last_content_hash: string | null }>;
  const candidate = rows[0];
  if (!candidate) throw new KnowledgeRefreshConflictError("Candidate not found");
  if (candidate.version !== input.expectedVersion) throw new KnowledgeRefreshConflictError("Candidate changed; refresh before reviewing it again");
  if (candidate.snapshot_hash !== candidate.last_content_hash) throw new KnowledgeRefreshConflictError("The source changed after this candidate was created");
  const note = sanitizeOperationalText(input.note || "", 2000) || null;
  const editedPolicy = sanitizeOperationalText(input.editedPolicy || "", 6000) || null;
  const policyWasEdited = Boolean(editedPolicy && editedPolicy !== candidate.proposed_policy);
  const amendingApprovedDraft = candidate.status === "approved_content" && input.action === "approve_content" && policyWasEdited;
  const resolvingApprovedDraft = candidate.status === "approved_content" && ["needs_owner", "defer", "reject"].includes(input.action);
  if (!["needs_review", "needs_owner", "deferred"].includes(candidate.status) && !amendingApprovedDraft && !resolvingApprovedDraft) {
    throw new KnowledgeRefreshConflictError(`Candidate cannot be reviewed from status ${candidate.status}`);
  }
  if (candidate.status === "approved_content" && input.action === "approve_content" && !amendingApprovedDraft) {
    throw new KnowledgeRefreshValidationError("Change the Final chatbot rule before saving a correction to an approved draft");
  }
  if (resolvingApprovedDraft && !note) {
    throw new KnowledgeRefreshValidationError("Add an audit note before removing an approved draft from the release queue");
  }

  const targetStatus = actionTargetStatus(input.action);
  const conflictResolution = input.conflictResolution || null;
  if (editedPolicy && input.action !== "approve_content") {
    throw new KnowledgeRefreshValidationError("Edited wording can only be saved when accepting an update");
  }
  if (editedPolicy && !note) {
    throw new KnowledgeRefreshValidationError("Add a note explaining why the accepted wording was edited");
  }
  const governance = editedPolicy
    ? compareKnowledgeRefreshCandidate({
        title: candidate.title,
        proposedPolicy: editedPolicy,
        decisionKey: candidate.decision_key,
        productScopes: candidate.product_scopes,
        domains: candidate.policy_domains,
        actions: candidate.policy_actions,
        entities: candidate.policy_entities,
        policyObject: candidate.policy_object,
        conditions: candidate.policy_conditions,
      })
    : {
        conflictLevel: candidate.conflict_level,
        conflictSummary: candidate.conflict_summary,
        conflictingPolicyIds: candidate.conflicting_policy_ids,
        relatedPolicies: candidate.related_policies as KnowledgeRefreshPolicyContext[],
        blockedTopicIds: candidate.blocked_topic_ids,
      };
  if (input.action === "approve_content" && ["direct", "blocked"].includes(governance.conflictLevel)) {
    if (!conflictResolution || !["supersede", "scoped_coexistence"].includes(conflictResolution)) {
      throw new KnowledgeRefreshValidationError("Direct or blocked conflicts require an explicit supersede or scoped-coexistence decision");
    }
    if (!note) {
      throw new KnowledgeRefreshValidationError("Conflict approval requires a reviewer note describing the authority, scope, and any exceptions");
    }
  }
  if (input.action === "approve_content" && candidate.candidate_kind === "knowledge_gap") {
    throw new KnowledgeRefreshValidationError("A knowledge-gap record cannot be approved as policy. An accountable owner must provide the missing rule first.");
  }
  if (input.action === "approve_content" && governance.conflictLevel === "blocked") {
    const blockedTopics = getKnowledgeRefreshBlockedTopicContexts(
      governance.blockedTopicIds || [],
      {
        text: `${candidate.title} ${editedPolicy || candidate.proposed_policy}`,
        decisionKey: candidate.decision_key,
        productScopes: candidate.product_scopes,
        domains: candidate.policy_domains,
        actions: candidate.policy_actions,
        entities: candidate.policy_entities,
        policyObject: candidate.policy_object,
        conditions: candidate.policy_conditions,
      },
    );
    if (!blockedTopics.length || blockedTopics.some((topic) => !topic.reviewReady)) {
      throw new KnowledgeRefreshValidationError("This blocked conflict does not have enough readable governed evidence for approval. Use Needs owner or Defer.");
    }
    if (blockedTopics.length > 1) {
      throw new KnowledgeRefreshValidationError("This proposal combines more than one governed policy decision. It must be separated into one decision per proposal before approval.");
    }
  }
  if (input.action === "approve_content") {
    const registry = getMaterializedV3Registry();
    const decisionKeysByPolicyId = Object.fromEntries(
      registry.policies.map((policy) => [policy.id, policy.decision_key]),
    );
    const approvalCandidate: KnowledgeRefreshCandidateRow = {
      ...candidate,
      status: "approved_content",
      proposed_policy: editedPolicy || candidate.proposed_policy,
      conflict_level: governance.conflictLevel,
      conflict_summary: governance.conflictSummary,
      conflicting_policy_ids: governance.conflictingPolicyIds,
      related_policies: governance.relatedPolicies,
      blocked_topic_ids: governance.blockedTopicIds,
      conflict_resolution: conflictResolution,
      review_note: note,
      approved_by: input.actor,
      approved_at: new Date().toISOString(),
      approved_snapshot_hash: candidate.snapshot_hash,
    };
    const readiness = assessKnowledgeRefreshReleaseReadiness(approvalCandidate, {
      lastContentHash: candidate.last_content_hash,
      decisionKeysByPolicyId,
      activeDecisionKeys: registry.policies.map((policy) => policy.decision_key),
    });
    if (!readiness.ready) {
      throw new KnowledgeRefreshValidationError(
        `This draft cannot enter the approved queue yet. ${readiness.reasons.join(" ")} Edit Final chatbot rule, choose Keep current answer, or request confirmation.`,
      );
    }
  }

  const updateRows = (await sql.query(
    `update ask_sales_faq_refresh_candidates
     set status = $2, version = version + 1, review_note = $3, conflict_resolution = $4,
         proposed_policy = coalesce($7, proposed_policy),
         conflict_level = $8, conflict_summary = $9,
         conflicting_policy_ids = $10::jsonb, related_policies = $11::jsonb,
         blocked_topic_ids = $12::jsonb,
         reviewed_by = $5, reviewed_at = now(),
         approved_by = case when $2 = 'approved_content' then $5 when status = 'approved_content' then null else approved_by end,
         approved_at = case when $2 = 'approved_content' then now() when status = 'approved_content' then null else approved_at end,
         approved_snapshot_hash = case when $2 = 'approved_content' then snapshot_hash when status = 'approved_content' then null else approved_snapshot_hash end,
         release_id = case when status = 'approved_content' and $2 <> 'approved_content' then null else release_id end,
         updated_at = now()
     where id = $1 and version = $6
     returning version`,
    [
      input.candidateId,
      targetStatus,
      note,
      conflictResolution,
      input.actor,
      input.expectedVersion,
      editedPolicy,
      governance.conflictLevel,
      governance.conflictSummary,
      JSON.stringify(governance.conflictingPolicyIds),
      JSON.stringify(governance.relatedPolicies),
      JSON.stringify(governance.blockedTopicIds),
    ],
  )) as Array<{ version: number }>;
  if (!updateRows.length) throw new KnowledgeRefreshConflictError("Candidate changed during review");
  const auditEvent = amendingApprovedDraft
    ? "correct_approved_content"
    : candidate.status === "approved_content" && input.action === "reject"
      ? "keep_current_answer"
      : input.action;
  await writeAudit("candidate", input.candidateId, auditEvent, input.actor, candidate.status, targetStatus, {
    expectedVersion: input.expectedVersion,
    conflictResolution,
    editedPolicy,
    note,
  });
  return { id: input.candidateId, status: targetStatus, version: updateRows[0].version };
}

export async function transitionKnowledgeRefreshCandidatesBatch(input: {
  candidates: Array<{ candidateId: string; expectedVersion: number }>;
  action: "reject" | "defer" | "needs_owner" | "duplicate" | "engineering_required";
  actor: string;
  note?: string | null;
}) {
  await ensureKnowledgeRefreshStorage();
  const candidates = Array.from(
    new Map(input.candidates.slice(0, 100).map((candidate) => [candidate.candidateId, candidate])).values(),
  );
  if (!candidates.length) throw new KnowledgeRefreshValidationError("Select at least one proposal");
  const targetStatus = actionTargetStatus(input.action);
  const note = sanitizeOperationalText(input.note || "", 2000) || null;
  const payload = JSON.stringify(candidates);
  const rows = (await getSql().query(
    `with requested as (
       select "candidateId" as candidate_id, "expectedVersion" as expected_version
       from jsonb_to_recordset($1::jsonb) as item("candidateId" text, "expectedVersion" integer)
     ), eligible as (
       select c.id, c.status as from_status, c.version
       from ask_sales_faq_refresh_candidates c
       join ask_sales_faq_refresh_sources s on s.id = c.source_id
       join requested r on r.candidate_id = c.id and r.expected_version = c.version
       where c.status in ('needs_review', 'needs_owner', 'deferred')
         and c.snapshot_hash = s.last_content_hash
     ), guard as (
       select (select count(*) from requested) = (select count(*) from eligible) as all_eligible
     ), updated as (
       update ask_sales_faq_refresh_candidates c
       set status = $2, version = c.version + 1, review_note = $3,
           reviewed_by = $4, reviewed_at = now(), updated_at = now()
       from eligible e, guard g
       where g.all_eligible and c.id = e.id
       returning c.id, c.status, c.version, e.from_status
     ), audited as (
       insert into ask_sales_faq_refresh_audit (
         entity_type, entity_id, event_type, actor, from_status, to_status, details
       )
       select 'candidate', u.id, $5, $4, u.from_status, u.status,
              jsonb_build_object('expectedVersion', u.version - 1, 'note', $3, 'batch', true)
       from updated u
     )
     select id, status, version from updated order by id`,
    [payload, targetStatus, note, input.actor, input.action],
  )) as Array<{ id: string; status: KnowledgeRefreshCandidateStatus; version: number }>;
  if (rows.length !== candidates.length) {
    throw new KnowledgeRefreshConflictError("One or more proposals changed or became stale; refresh before applying a batch decision");
  }
  return { updatedCount: rows.length, candidates: rows };
}

export async function recomputeActionableKnowledgeRefreshGovernance(input: { actor: string }) {
  await ensureKnowledgeRefreshStorage();
  const rows = (await getSql().query(
    `select id, title, proposed_policy, decision_key, product_scopes,
            policy_domains, policy_actions, policy_entities, policy_object, policy_conditions,
            conflict_level, conflict_summary, conflicting_policy_ids, related_policies, blocked_topic_ids
     from ask_sales_faq_refresh_candidates
     where status in ('needs_review', 'needs_owner', 'approved_content', 'deferred')
     order by id`,
  )) as Array<KnowledgeRefreshCandidateRow>;
  const changes: Array<{
    id: string;
    previousConflictLevel: KnowledgeRefreshConflictLevel;
    conflictLevel: KnowledgeRefreshConflictLevel;
    conflictSummary: string;
    conflictingPolicyIds: string[];
    relatedPolicies: KnowledgeRefreshPolicyContext[];
    blockedTopicIds: string[];
    previousBlockedTopicIds: string[];
  }> = [];
  for (const candidate of rows) {
    const governance = compareKnowledgeRefreshCandidate({
      title: candidate.title,
      proposedPolicy: candidate.proposed_policy,
      decisionKey: candidate.decision_key,
      productScopes: candidate.product_scopes,
      domains: candidate.policy_domains,
      actions: candidate.policy_actions,
      entities: candidate.policy_entities,
      policyObject: candidate.policy_object,
      conditions: candidate.policy_conditions,
    });
    if (
      candidate.conflict_level === governance.conflictLevel &&
      candidate.conflict_summary === governance.conflictSummary &&
      JSON.stringify(candidate.conflicting_policy_ids) === JSON.stringify(governance.conflictingPolicyIds) &&
      JSON.stringify(candidate.blocked_topic_ids) === JSON.stringify(governance.blockedTopicIds)
    ) continue;
    changes.push({
      id: candidate.id,
      previousConflictLevel: candidate.conflict_level,
      conflictLevel: governance.conflictLevel,
      conflictSummary: governance.conflictSummary,
      conflictingPolicyIds: governance.conflictingPolicyIds,
      relatedPolicies: governance.relatedPolicies,
      blockedTopicIds: governance.blockedTopicIds,
      previousBlockedTopicIds: candidate.blocked_topic_ids,
    });
  }
  if (!changes.length) return { reviewedCount: rows.length, updatedCount: 0 };
  const updateRows = (await getSql().query(
    `with changes as (
       select * from jsonb_to_recordset($1::jsonb) as item(
         id text,
         "previousConflictLevel" text,
         "conflictLevel" text,
         "conflictSummary" text,
         "conflictingPolicyIds" jsonb,
         "relatedPolicies" jsonb,
         "blockedTopicIds" jsonb,
         "previousBlockedTopicIds" jsonb
       )
     ), updated as (
       update ask_sales_faq_refresh_candidates c
       set conflict_level = changes."conflictLevel",
           conflict_summary = changes."conflictSummary",
           conflicting_policy_ids = changes."conflictingPolicyIds",
           related_policies = changes."relatedPolicies",
           blocked_topic_ids = changes."blockedTopicIds",
           version = c.version + 1,
           updated_at = now()
       from changes
       where c.id = changes.id and c.status in ('needs_review', 'needs_owner', 'approved_content', 'deferred')
       returning c.id
     ), audited as (
       insert into ask_sales_faq_refresh_audit (
         entity_type, entity_id, event_type, actor, from_status, to_status, details
       )
       select 'candidate', changes.id, 'governance_recomputed', $2,
              changes."previousConflictLevel", changes."conflictLevel",
              jsonb_build_object(
                'previousBlockedTopicIds', changes."previousBlockedTopicIds",
                'blockedTopicIds', changes."blockedTopicIds"
              )
       from changes
       join updated on updated.id = changes.id
     )
     select count(*)::int as updated_count from updated`,
    [JSON.stringify(changes), input.actor],
  )) as Array<{ updated_count: number }>;
  return { reviewedCount: rows.length, updatedCount: updateRows[0]?.updated_count || 0 };
}

export async function prepareKnowledgeRefreshRelease(input: { candidateIds: string[]; actor: string }) {
  await ensureKnowledgeRefreshStorage();
  const candidateIds = Array.from(new Set(input.candidateIds)).slice(0, 50);
  if (!candidateIds.length) throw new KnowledgeRefreshValidationError("Select at least one draft marked Ready for preview");
  const sql = getSql();
  const placeholders = candidateIds.map((_, index) => `$${index + 1}`).join(", ");
  const rows = (await sql.query(
    `select c.*, s.label as source_label, s.url as source_url, s.last_content_hash
     from ask_sales_faq_refresh_candidates c
     join ask_sales_faq_refresh_sources s on s.id = c.source_id
     where c.id in (${placeholders})
     order by c.created_at`,
    candidateIds,
  )) as Array<KnowledgeRefreshCandidateRow & { last_content_hash: string | null }>;
  if (rows.length !== candidateIds.length) throw new KnowledgeRefreshValidationError("One or more candidates no longer exist");
  const registry = getMaterializedV3Registry();
  const decisionKeysByPolicyId = Object.fromEntries(registry.policies.map((policy) => [policy.id, policy.decision_key]));
  const activeDecisionKeys = registry.policies.map((policy) => policy.decision_key);
  const assessed = rows.map((candidate) => ({
    candidate,
    readiness: assessKnowledgeRefreshReleaseReadiness(candidate, {
      lastContentHash: candidate.last_content_hash,
      decisionKeysByPolicyId,
      activeDecisionKeys,
    }),
  }));
  const failures = assessed.filter(({ readiness }) => !readiness.ready);
  if (failures.length) {
    const details = failures.slice(0, 3).map(({ candidate, readiness }) =>
      `${candidate.title}: ${readiness.reasons.join(" ")}`,
    ).join(" ");
    throw new KnowledgeRefreshValidationError(
      `Preview not built. ${details}${failures.length > 3 ? ` ${failures.length - 3} more selected draft(s) need correction.` : ""}`,
    );
  }

  const releaseId = `kr_${randomUUID()}`;
  const preparedAt = new Date().toISOString();
  const knowledgeVersionBefore = getKnowledgeRefreshRegistryVersion();
  const releaseDrafts = assessed.map(({ candidate, readiness }): V3AdminReleaseDraft => ({
    id: candidate.id,
    title: candidate.title,
    summary: candidate.summary,
    proposedPolicy: candidate.proposed_policy,
    decisionKey: readiness.decisionKey || "",
    productScopes: candidate.product_scopes,
    domains: readiness.resolvedDomains,
    actions: readiness.resolvedActions,
    entities: readiness.resolvedEntities,
    policyObject: readiness.resolvedPolicyObject,
    conditions: candidate.policy_conditions,
    effectiveDate: candidate.effective_date,
    answerImpact: candidate.answer_impact,
    sourceAuthority: candidate.source_authority,
    authorityName: candidate.authority_name,
    authorityBasis: candidate.authority_basis,
    sourceId: candidate.source_id,
    sourceLabel: candidate.source_label,
    sourceRevision: candidate.source_revision,
    evidenceQuotes: candidate.evidence_quotes,
    snapshotHash: candidate.snapshot_hash,
    approvedBy: candidate.approved_by || input.actor,
    approvedByAll: [candidate.approved_by || input.actor],
    approvedAt: candidate.approved_at || preparedAt,
    conflictLevel: candidate.conflict_level,
    conflictResolution: ["supersede", "scoped_coexistence"].includes(candidate.conflict_resolution || "")
      ? candidate.conflict_resolution as V3AdminReleaseCandidate["conflictResolution"]
      : null,
    conflictingPolicyIds: candidate.conflicting_policy_ids,
    blockedTopicIds: candidate.blocked_topic_ids,
    lineageCandidateIds: [candidate.id],
    structuredShowUpdate: readiness.structuredShowUpdate,
  }));
  let compiledCandidates: V3AdminReleaseCandidate[];
  let publicationRelease: V3AdminApprovedRelease;
  let compiledPreview: ReturnType<typeof previewV3AdminApprovedRelease>;
  try {
    compiledCandidates = compileV3AdminReleaseCandidates({
      drafts: releaseDrafts,
      currentPolicies: registry.policies,
      preparedBy: input.actor,
    });
    const duplicateCompiledKeys = compiledCandidates
      .map((candidate) => candidate.decisionKey)
      .filter((value, index, all) => all.indexOf(value) !== index);
    if (duplicateCompiledKeys.length) {
      throw new KnowledgeRefreshValidationError("Two selected drafts resolve to the same policy decision. Preview them separately.");
    }
    publicationRelease = buildV3AdminApprovedRelease({
      releaseId,
      preparedAt,
      preparedBy: input.actor,
      baseKnowledgeVersion: knowledgeVersionBefore,
      candidates: compiledCandidates,
      candidateIds,
    });
    compiledPreview = previewV3AdminApprovedRelease(publicationRelease);
  } catch (error) {
    if (error instanceof KnowledgeRefreshValidationError) throw error;
    console.error("Ask Sales release compiler rejected an approved draft", error instanceof Error ? error.message : "unknown error");
    throw new KnowledgeRefreshValidationError(
      error instanceof Error && /^The (current governed show catalog|selected show update)/.test(error.message)
        ? error.message
        : "The approved drafts could not be compiled into one safe release. Production remains unchanged.",
    );
  }
  const manifest = {
    schemaVersion: 2,
    releaseId,
    knowledgeVersionBefore,
    knowledgeVersionAfter: compiledPreview.knowledge_version,
    preparedAt,
    preparedBy: input.actor,
    publicationMode: "reviewed_git_release",
    publicationSafety:
      "This preview is not runtime authority. A separate exact-admin action must create synchronized Git pull requests, both repository release checks must pass, and a second exact-admin action must merge the verified dashboard release before production can change.",
    publicationRelease,
    compilation: {
      approvedDraftCount: rows.length,
      compiledPolicyCount: compiledCandidates.length,
      structuredShowCatalog: releaseDrafts.some((draft) => draft.structuredShowUpdate),
    },
    releasePreview: compiledCandidates.map((candidate) => ({
      title: candidate.title,
      proposedAnswer: candidate.proposedPolicy,
      currentOfficialAnswers: candidate.conflictingPolicyIds
        .map((policyId) => registry.policies.find((policy) => policy.id === policyId))
        .filter((policy) => Boolean(policy))
        .map((policy) => ({ id: policy?.id, title: policy?.title, decision: policy?.decision })),
      sourceCandidateIds: candidate.lineageCandidateIds?.length ? candidate.lineageCandidateIds : [candidate.id],
    })),
    candidates: assessed.map(({ candidate, readiness }) => ({
      id: candidate.id,
      source: { id: candidate.source_id, label: candidate.source_label, url: candidate.source_url, revision: candidate.source_revision },
      decisionKey: readiness.decisionKey,
      decisionKeySource: readiness.decisionKeySource,
      productScopes: candidate.product_scopes,
      candidateKind: candidate.candidate_kind,
      domains: candidate.policy_domains,
      actions: candidate.policy_actions,
      entities: candidate.policy_entities,
      policyObject: candidate.policy_object,
      conditions: candidate.policy_conditions,
      effectiveDate: candidate.effective_date,
      proposedPolicy: candidate.proposed_policy,
      preview: {
        currentOfficialAnswers: candidate.related_policies
          .filter((policy) => candidate.conflicting_policy_ids.includes(String(policy.id || "")))
          .map((policy) => ({ id: policy.id, title: policy.title, decision: policy.decision })),
        proposedAnswer: candidate.proposed_policy,
      },
      evidenceQuotes: candidate.evidence_quotes,
      conflict: {
        level: candidate.conflict_level,
        resolution: candidate.conflict_resolution,
        summary: candidate.conflict_summary,
        policyIds: candidate.conflicting_policy_ids,
        blockedTopicIds: candidate.blocked_topic_ids,
      },
      approval: { approvedBy: candidate.approved_by, approvedAt: candidate.approved_at, snapshotHash: candidate.approved_snapshot_hash },
    })),
  };
  const validationChecks = {
    currentSnapshot: true,
    oneDecisionPerDraft: assessed.every(({ readiness }) => readiness.ready),
    compiledPolicyIdentityPresent: compiledCandidates.every((candidate) => candidate.decisionKey && candidate.proposedPolicy),
    sourceEvidencePresent: rows.every((candidate) => candidate.evidence_quotes.length > 0),
    productScopePresent: rows.every((candidate) => candidate.product_scopes.length > 0),
    duplicateDecisionKeysAbsent: new Set(compiledCandidates.map((candidate) => candidate.decisionKey)).size === compiledCandidates.length,
    conflictsHaveExplicitResolution: compiledCandidates.every((candidate) =>
      !["direct", "blocked"].includes(candidate.conflictLevel) ||
      ["supersede", "scoped_coexistence"].includes(candidate.conflictResolution || ""),
    ),
  };
  const validation = {
    passed: Object.values(validationChecks).every(Boolean),
    performedAt: new Date().toISOString(),
    checks: validationChecks,
    publication: {
      baseKnowledgeVersion: knowledgeVersionBefore,
      expectedKnowledgeVersion: publicationRelease.expected_knowledge_version,
      compiledKnowledgeVersion: compiledPreview.knowledge_version,
      policyIds: publicationRelease.policies.map((policy) => policy.id),
      supersededPolicyIds: publicationRelease.supersessions.flatMap((item) => item.superseded_policy_ids),
      resolvedBlockedTopicIds: publicationRelease.resolved_blocked_topics.map((topic) => topic.id),
      ledgerEntryHash: sha256(JSON.stringify(publicationRelease)),
      compiledPolicyCount: compiledPreview.policies.length,
      compiledBlockedTopicCount: compiledPreview.blocked_topics.length,
    },
    requiredPublishChecks: releaseValidationChecks(),
  };
  if (!validation.passed) {
    throw new KnowledgeRefreshValidationError("The preview did not pass every required safety check. Production remains unchanged.");
  }
  const requested = rows.map((candidate) => ({
    candidate_id: candidate.id,
    expected_version: candidate.version,
    snapshot_hash: candidate.snapshot_hash,
  }));
  const stored = (await sql.query(
    `with requested as (
       select candidate_id, expected_version, snapshot_hash
       from jsonb_to_recordset($1::jsonb) as item(candidate_id text, expected_version integer, snapshot_hash text)
     ), eligible as (
       select c.id
       from ask_sales_faq_refresh_candidates c
       join ask_sales_faq_refresh_sources s on s.id = c.source_id
       join requested r on r.candidate_id = c.id
       where c.status = 'approved_content'
         and c.version = r.expected_version
         and c.snapshot_hash = r.snapshot_hash
         and c.approved_snapshot_hash = c.snapshot_hash
         and s.last_content_hash = c.snapshot_hash
     ), guard as (
       select (select count(*) from requested) = (select count(*) from eligible) as all_eligible
     ), inserted_release as (
       insert into ask_sales_faq_refresh_releases (
         id, status, knowledge_version, candidate_ids, manifest, validation, publication, created_by
       )
       select $2, 'awaiting_final_publish', $3, $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8
       from guard where all_eligible
       returning id
     ), updated as (
       update ask_sales_faq_refresh_candidates c
       set status = 'ready_to_publish', release_id = $2, version = c.version + 1, updated_at = now()
       from requested r, inserted_release
       where c.id = r.candidate_id and c.version = r.expected_version
       returning c.id
     ), audited as (
       insert into ask_sales_faq_refresh_audit (
         entity_type, entity_id, event_type, actor, from_status, to_status, details
       )
       select 'release', id, 'release_prepared', $8, null, 'awaiting_final_publish', $9::jsonb
       from inserted_release
     )
     select id,
            (select count(*)::int from updated) as updated_count,
            1 / case
              when (select count(*) from updated) = (select count(*) from requested) then 1
              else 0
            end as write_guard
     from inserted_release`,
    [
      JSON.stringify(requested),
      releaseId,
      knowledgeVersionBefore,
      JSON.stringify(candidateIds),
      JSON.stringify(manifest),
      JSON.stringify(validation),
      JSON.stringify({ phase: "awaiting_final_publish" }),
      input.actor,
      JSON.stringify({ candidateIds, validation }),
    ],
  )) as Array<{ id: string; updated_count: number; write_guard: number }>;
  if (!stored.length || stored[0].updated_count !== candidateIds.length) {
    throw new KnowledgeRefreshConflictError("One or more approved drafts changed. Refresh the page and build the preview again.");
  }
  return { releaseId, status: "awaiting_final_publish", manifest, validation };
}

export type KnowledgeRefreshReleaseAction = "create_pull_requests" | "publish_verified_release";

export async function queueKnowledgeRefreshReleaseAction(input: {
  releaseId: string;
  action: KnowledgeRefreshReleaseAction;
  actor: string;
}) {
  await ensureKnowledgeRefreshStorage();
  if (process.env.ASK_SALES_KNOWLEDGE_REFRESH_PUBLISH_ENABLED !== "true") {
    throw new KnowledgeRefreshValidationError("The governed Git publisher is not enabled");
  }
  const webhookUrl = getKnowledgeRefreshPublisherWebhookUrl();
  const token = randomBytes(32).toString("base64url");
  const tokenHash = sha256(token);
  const attemptId = randomUUID();
  const allowedStatuses = input.action === "create_pull_requests"
    ? ["awaiting_final_publish", "publication_failed"]
    : ["prs_ready", "deployment_failed"];
  const nextStatus = input.action === "create_pull_requests" ? "creating_pull_requests" : "publishing";
  const rows = (await getSql().query(
    `update ask_sales_faq_refresh_releases
     set status = $2,
         action_token_hash = $3,
         action_token_expires_at = now() + interval '10 minutes',
         action_type = $4,
         action_started_at = now(),
         last_error = null,
         publication = publication || $5::jsonb,
         updated_at = now()
     where id = $1 and status = any($6::text[])
     returning id, status`,
    [input.releaseId, nextStatus, tokenHash, input.action, JSON.stringify({
      phase: nextStatus,
      attemptId,
      requestedBy: input.actor,
      requestedAt: new Date().toISOString(),
    }), allowedStatuses],
  )) as Array<{ id: string; status: string }>;
  if (!rows.length) throw new KnowledgeRefreshConflictError("This release is not in a state that allows that action. Refresh the page before trying again.");
  if (input.action === "publish_verified_release") {
    await getSql().query(
      `update ask_sales_faq_refresh_candidates
       set status = 'publishing', version = version + 1, updated_at = now()
       where release_id = $1 and status in ('ready_to_publish', 'deployment_failed')`,
      [input.releaseId],
    );
  }
  await writeAudit("release", input.releaseId, "release_action_queued", input.actor, allowedStatuses.join("|"), nextStatus, {
    action: input.action,
    attemptId,
  });
  return { releaseId: input.releaseId, action: input.action, token, attemptId, webhookUrl, status: nextStatus };
}

export async function failQueuedKnowledgeRefreshReleaseAction(input: {
  releaseId: string;
  action: KnowledgeRefreshReleaseAction;
  actor: string;
  message: string;
}) {
  await ensureKnowledgeRefreshStorage();
  const fromStatus = input.action === "create_pull_requests" ? "creating_pull_requests" : "publishing";
  const toStatus = input.action === "create_pull_requests" ? "publication_failed" : "prs_ready";
  await getSql().query(
    `update ask_sales_faq_refresh_releases
     set status = $2, action_token_hash = null, action_token_expires_at = null, action_type = null,
         last_error = $3, publication = publication || $4::jsonb, updated_at = now()
     where id = $1 and status = $5`,
    [input.releaseId, toStatus, sanitizeOperationalText(input.message, 1000), JSON.stringify({ phase: toStatus }), fromStatus],
  );
  if (input.action === "publish_verified_release") {
    await getSql().query(
      `update ask_sales_faq_refresh_candidates
       set status = 'ready_to_publish', version = version + 1, updated_at = now()
       where release_id = $1 and status = 'publishing'`,
      [input.releaseId],
    );
  }
  await writeAudit("release", input.releaseId, "release_action_queue_failed", input.actor, fromStatus, toStatus, {
    action: input.action,
    message: sanitizeOperationalText(input.message, 500),
  });
}

export async function claimKnowledgeRefreshReleaseAction(input: {
  releaseId: string;
  action: KnowledgeRefreshReleaseAction;
  token: string;
}) {
  await ensureKnowledgeRefreshStorage();
  const rows = (await getSql().query(
    `select id, status, knowledge_version, candidate_ids, manifest, validation, publication,
            action_token_hash, action_token_expires_at::text, action_type
     from ask_sales_faq_refresh_releases where id = $1`,
    [input.releaseId],
  )) as Array<KnowledgeRefreshReleaseRow & {
    action_token_hash: string | null;
    action_token_expires_at: string | null;
    action_type: string | null;
  }>;
  const release = rows[0];
  if (!release || !release.action_token_hash || !release.action_token_expires_at) throw new KnowledgeRefreshValidationError("Release action token is missing or expired");
  if (release.action_type !== input.action || new Date(release.action_token_expires_at).getTime() <= Date.now()) {
    throw new KnowledgeRefreshValidationError("Release action token is missing or expired");
  }
  const expected = Buffer.from(release.action_token_hash);
  const actual = Buffer.from(sha256(input.token));
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) throw new KnowledgeRefreshValidationError("Release action token is invalid");
  const expectedStatus = input.action === "create_pull_requests" ? "creating_pull_requests" : "publishing";
  if (release.status !== expectedStatus) throw new KnowledgeRefreshConflictError("Release action is no longer current");

  const cleared = (await getSql().query(
    `update ask_sales_faq_refresh_releases
     set action_token_hash = null, action_token_expires_at = null,
         publication = publication || $2::jsonb, updated_at = now()
     where id = $1 and action_token_hash = $3
     returning id`,
    [input.releaseId, JSON.stringify({ claimedAt: new Date().toISOString() }), release.action_token_hash],
  )) as Array<{ id: string }>;
  if (!cleared.length) throw new KnowledgeRefreshConflictError("Release action was already claimed");

  const publicationRelease = (release.manifest as { publicationRelease?: V3AdminApprovedRelease }).publicationRelease;
  if (!publicationRelease || publicationRelease.release_id !== release.id) throw new KnowledgeRefreshValidationError("Release publication entry is missing");
  await writeAudit("release", release.id, "release_action_claimed", "n8n:ask-sales-knowledge-publisher", expectedStatus, expectedStatus, { action: input.action });
  return {
    releaseId: release.id,
    action: input.action,
    publicationRelease,
    validation: release.validation,
    publication: release.publication,
    repositories: {
      faq: { owner: "Inside-Success", repo: "faq-chatbot", ledgerPath: "runtime/v3-admin-approved-releases.json", baseBranch: "main" },
      dashboard: { owner: "Inside-Success", repo: "sales-performance-dashboard", ledgerPath: "src/lib/ask-sales-faq/generated/v3-admin-approved-releases.json", baseBranch: "main" },
    },
  };
}

export async function completeKnowledgeRefreshReleaseAction(input: {
  releaseId: string;
  action: KnowledgeRefreshReleaseAction;
  outcome: "success" | "failure";
  details: Record<string, unknown>;
  message?: string | null;
}) {
  await ensureKnowledgeRefreshStorage();
  const sql = getSql();
  const rows = (await sql.query(`select status, manifest, publication from ask_sales_faq_refresh_releases where id = $1`, [input.releaseId])) as Array<{
    status: string;
    manifest: Record<string, unknown>;
    publication: Record<string, unknown>;
  }>;
  const release = rows[0];
  if (!release) throw new KnowledgeRefreshValidationError("Unknown release");
  const expectedStatus = input.action === "create_pull_requests" ? "creating_pull_requests" : "publishing";
  if (release.status !== expectedStatus) throw new KnowledgeRefreshConflictError("Release action is no longer current");
  const safeMessage = sanitizeOperationalText(input.message || "", 1000) || null;
  const failureStage = typeof input.details.stage === "string" ? input.details.stage : "unknown";
  const toStatus = input.outcome === "success"
    ? input.action === "create_pull_requests" ? "prs_ready" : "production_verified"
    : input.action === "create_pull_requests"
      ? "publication_failed"
      : failureStage === "preflight" ? "prs_ready" : "deployment_failed";
  const publication = { ...release.publication, ...sanitizePublicationDetails(input.details), phase: toStatus, completedAt: new Date().toISOString() };
  await sql.query(
    `update ask_sales_faq_refresh_releases
     set status = $2, publication = $3::jsonb, last_error = $4, action_type = null, updated_at = now()
     where id = $1 and status = $5`,
    [input.releaseId, toStatus, JSON.stringify(publication), input.outcome === "failure" ? safeMessage : null, expectedStatus],
  );
  const candidateStatus = input.outcome === "success" && input.action === "publish_verified_release"
    ? "production_verified"
    : "ready_to_publish";
  await sql.query(
    `update ask_sales_faq_refresh_candidates
     set status = $2, version = version + 1, updated_at = now()
     where release_id = $1 and status in ('ready_to_publish', 'publishing')`,
    [input.releaseId, candidateStatus],
  );
  await writeAudit("release", input.releaseId, input.outcome === "success" ? "release_action_completed" : "release_action_failed", "n8n:ask-sales-knowledge-publisher", expectedStatus, toStatus, {
    action: input.action,
    message: safeMessage,
    details: sanitizePublicationDetails(input.details),
  });
  return { releaseId: input.releaseId, status: toStatus };
}

export async function getKnowledgeRefreshReleaseHealth(releaseId: string) {
  await ensureKnowledgeRefreshStorage();
  const rows = (await getSql().query(`select manifest from ask_sales_faq_refresh_releases where id = $1`, [releaseId])) as Array<{ manifest: Record<string, unknown> }>;
  const releaseEntry = (rows[0]?.manifest as { publicationRelease?: V3AdminApprovedRelease } | undefined)?.publicationRelease;
  if (!releaseEntry) throw new KnowledgeRefreshValidationError("Unknown or incomplete release");
  const registry = getMaterializedV3Registry();
  const activeIds = new Set(registry.policies.map((policy) => policy.id));
  const blockedIds = new Set(registry.blocked_topics.map((topic) => topic.id));
  const missingPolicyIds = releaseEntry.policies.map((policy) => policy.id).filter((id) => !activeIds.has(id));
  const stillActiveSupersededPolicyIds = releaseEntry.supersessions.flatMap((item) => item.superseded_policy_ids).filter((id) => activeIds.has(id));
  const stillBlockedTopicIds = releaseEntry.resolved_blocked_topics.map((item) => item.id).filter((id) => blockedIds.has(id));
  const ready = registry.knowledge_version === releaseEntry.expected_knowledge_version && !missingPolicyIds.length && !stillActiveSupersededPolicyIds.length && !stillBlockedTopicIds.length;
  return {
    ready,
    releaseId,
    knowledgeVersion: registry.knowledge_version,
    expectedKnowledgeVersion: releaseEntry.expected_knowledge_version,
    policyIds: releaseEntry.policies.map((policy) => policy.id),
    missingPolicyIds,
    stillActiveSupersededPolicyIds,
    stillBlockedTopicIds,
  };
}

function getKnowledgeRefreshPublisherWebhookUrl() {
  const raw = process.env.ASK_SALES_KNOWLEDGE_PUBLISHER_WEBHOOK_URL;
  if (!raw) throw new KnowledgeRefreshValidationError("The governed Git publisher webhook is not configured");
  let url: URL;
  try { url = new URL(raw); } catch { throw new KnowledgeRefreshValidationError("The governed Git publisher webhook is invalid"); }
  if (url.protocol !== "https:" || url.hostname !== "insidesuccess.app.n8n.cloud" || url.pathname !== "/webhook/ask-sales-knowledge-publisher") {
    throw new KnowledgeRefreshValidationError("The governed Git publisher webhook is outside the approved Inside Success endpoint");
  }
  return url.toString();
}

function sanitizePublicationDetails(details: Record<string, unknown>) {
  const allowed = ["attemptId", "faq", "dashboard", "knowledgeVersion", "policyIds", "stage", "checks"];
  return Object.fromEntries(allowed.filter((key) => key in details).map((key) => [key, details[key]]));
}

function releaseValidationChecks() {
  return [
    "FAQ governance compiler and all claim/source/supersession validators",
    "Dashboard Ask Sales test suite and static safety validator",
    "TypeScript, scoped ESLint, git diff --check, secret scan, optimized production build",
    "Generated V3 registry and dashboard copy synchronization",
    "Vercel deployment READY and production alias confirmation",
    "Signed-in exact, paraphrase, follow-up, superseded-rule, and unrelated control questions",
    "Runtime error-log review and rollback readiness",
  ];
}

function actionTargetStatus(action: Parameters<typeof transitionKnowledgeRefreshCandidate>[0]["action"]): KnowledgeRefreshCandidateStatus {
  if (action === "approve_content") return "approved_content";
  if (action === "needs_owner") return "needs_owner";
  if (action === "engineering_required") return "engineering_required";
  if (action === "duplicate") return "duplicate";
  if (action === "defer") return "deferred";
  return "rejected";
}

async function writeAudit(
  entityType: string,
  entityId: string,
  eventType: string,
  actor: string,
  fromStatus: string | null,
  toStatus: string | null,
  details: Record<string, unknown>,
) {
  await getSql().query(
    `insert into ask_sales_faq_refresh_audit (entity_type, entity_id, event_type, actor, from_status, to_status, details)
     values ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [entityType, entityId, eventType, actor, fromStatus, toStatus, JSON.stringify(details)],
  );
}

function normalizeAiCandidate(value: KnowledgeRefreshAiCandidate) {
  const title = sanitizeOperationalText(value.title, 180);
  const summary = sanitizeOperationalText(value.summary, 1200);
  const proposedPolicy = sanitizeOperationalText(value.proposedPolicy, 6000);
  const rationale = sanitizeOperationalText(value.rationale, 2000);
  const productScopes = Array.from(new Set((value.productScopes || []).map((item) => normalizeScope(item)).filter(Boolean))) as string[];
  const evidenceQuotes = Array.from(new Set((value.evidenceQuotes || []).map((item) => sanitizeOperationalText(item, 800)).filter(Boolean))).slice(0, 8);
  if (!title || !summary || !proposedPolicy || !rationale || !productScopes.length || !evidenceQuotes.length) return null;
  return {
    title,
    summary,
    proposedPolicy,
    rationale,
    decisionKey: normalizeDecisionKey(value.decisionKey),
    productScopes,
    effectiveDate: value.effectiveDate || null,
    evidenceQuotes,
    confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
    candidateKind: normalizeCandidateKind(value.candidateKind),
    domains: normalizeClassificationValues(value.domains, 8),
    actions: normalizeClassificationValues(value.actions, 8),
    entities: normalizeClassificationValues(value.entities, 16),
    policyObject: sanitizeOperationalText(value.policyObject || "", 300) || null,
    conditions: sanitizeOperationalText(value.conditions || "", 800) || null,
    isDurable: value.isDurable !== false,
    isReusable: value.isReusable !== false,
    answerImpact: normalizeAnswerImpact(value.answerImpact),
    sourceAuthority: normalizeSourceAuthority(value.sourceAuthority),
    authorityName: sanitizeOperationalText(value.authorityName || "", 120) || null,
    authorityBasis: sanitizeOperationalText(value.authorityBasis || "", 600) || null,
    atomicDecisionCount: Math.max(1, Math.min(20, Math.trunc(Number(value.atomicDecisionCount) || 1))),
  };
}

function normalizeCandidateKind(value: KnowledgeRefreshCandidateKind | undefined): KnowledgeRefreshCandidateKind {
  return ["new_rule", "rule_change", "conflict", "clarification", "knowledge_gap"].includes(value || "")
    ? value as KnowledgeRefreshCandidateKind
    : "new_rule";
}

function normalizeAnswerImpact(value: KnowledgeRefreshAnswerImpact | undefined): KnowledgeRefreshAnswerImpact {
  return ["material", "possible", "none"].includes(value || "") ? value as KnowledgeRefreshAnswerImpact : "possible";
}

function normalizeSourceAuthority(value: KnowledgeRefreshSourceAuthority | undefined): KnowledgeRefreshSourceAuthority {
  return ["owner_confirmed", "manager_guidance", "rep_answer", "rep_question", "unknown"].includes(value || "")
    ? value as KnowledgeRefreshSourceAuthority
    : "unknown";
}

function normalizeClassificationValues(values: string[] | undefined, limit: number) {
  return Array.from(new Set((values || []).map(normalizeScope).filter(Boolean))).slice(0, limit);
}

function findPreviousCandidate(
  candidate: KnowledgeRefreshCandidateRow,
  history: Array<{ id: string; source_id: string; title: string; proposed_policy: string; created_at: string }>,
) {
  const currentTime = new Date(candidate.created_at).getTime();
  return history
    .filter((item) => item.source_id === candidate.source_id && item.id !== candidate.id && new Date(item.created_at).getTime() < currentTime)
    .map((item) => ({
      ...item,
      score: Math.max(
        refreshTextSimilarity(candidate.title, item.title),
        refreshTextSimilarity(`${candidate.title} ${candidate.proposed_policy}`, `${item.title} ${item.proposed_policy}`),
      ),
    }))
    .filter((item) => item.score >= 0.42)
    .sort((left, right) => right.score - left.score || new Date(right.created_at).getTime() - new Date(left.created_at).getTime())[0] || null;
}

function refreshTextSimilarity(left: string, right: string) {
  const leftTokens = new Set(left.toLowerCase().replace(/[^a-z0-9%$]+/g, " ").split(" ").filter((token) => token.length > 2));
  const rightTokens = new Set(right.toLowerCase().replace(/[^a-z0-9%$]+/g, " ").split(" ").filter((token) => token.length > 2));
  if (!leftTokens.size || !rightTokens.size) return 0;
  let overlap = 0;
  for (const token of leftTokens) if (rightTokens.has(token)) overlap += 1;
  return overlap / Math.sqrt(leftTokens.size * rightTokens.size);
}

function normalizeScope(value: string) {
  const normalized = value.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
  return normalized.slice(0, 80);
}

function normalizeDecisionKey(value: string | null | undefined) {
  if (!value) return null;
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 160) || null;
}

function redactKnowledgeRefreshContent(value: string) {
  const redactions: string[] = [];
  let text = value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").slice(0, 250_000);
  const patterns: Array<[string, RegExp]> = [
    ["api_key", /\b(?:sk|xai)-[A-Za-z0-9_-]{20,}\b/g],
    ["ssn", /\b\d{3}-\d{2}-\d{4}\b/g],
    ["payment_number", /\b(?:\d[ -]*?){13,19}\b/g],
  ];
  for (const [label, pattern] of patterns) {
    if (pattern.test(text)) redactions.push(label);
    pattern.lastIndex = 0;
    text = text.replace(pattern, `[redacted ${label}]`);
  }
  return { text: text.trim(), redactions: Array.from(new Set(redactions)).sort() };
}

function sanitizeOperationalText(value: string, max: number) {
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function sanitizeMetadata(value: Record<string, unknown>) {
  const allowed = ["mimeType", "messageCount", "threadCount", "pageCount", "modifiedTime", "version", "channelId", "fileId"];
  return Object.fromEntries(allowed.filter((key) => key in value).map((key) => [key, value[key]]));
}

function normalizeTimestamp(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function normalizeDate(value: string | null | undefined) {
  if (!value) return null;
  const match = value.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return match || null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export class KnowledgeRefreshConflictError extends Error {}
export class KnowledgeRefreshValidationError extends Error {}
