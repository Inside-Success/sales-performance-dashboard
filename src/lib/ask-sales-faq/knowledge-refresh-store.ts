import "server-only";

import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import {
  buildKnowledgeRefreshAnalysisContext,
  compareKnowledgeRefreshCandidate,
  getKnowledgeRefreshRegistryVersion,
  type KnowledgeRefreshConflictLevel,
} from "@/lib/ask-sales-faq/knowledge-refresh-governance";
import {
  KNOWLEDGE_REFRESH_SOURCES,
  getKnowledgeRefreshSource,
  type KnowledgeRefreshSourceKind,
} from "@/lib/ask-sales-faq/knowledge-refresh-sources";

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
  ai_model: string;
  ai_confidence: number;
  conflict_level: KnowledgeRefreshConflictLevel;
  conflict_summary: string;
  conflicting_policy_ids: string[];
  related_policies: Array<Record<string, unknown>>;
  blocked_topic_ids: string[];
  conflict_resolution: KnowledgeRefreshConflictResolution | null;
  review_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  approved_snapshot_hash: string | null;
  release_id: string | null;
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
};

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
      created_by text not null,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;

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
  const analysisRequired = !unchanged || !snapshotRows[0]?.analysis_completed_at;

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
    snapshotId: storedSnapshotId,
    snapshotHash: contentHash,
    knowledgeVersion: getKnowledgeRefreshRegistryVersion(),
    governanceContext: analysisRequired ? buildKnowledgeRefreshAnalysisContext(redacted.text) : null,
    content: analysisRequired ? redacted.text : null,
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
  for (const rawCandidate of input.candidates.slice(0, 20)) {
    const candidate = normalizeAiCandidate(rawCandidate);
    if (!candidate) continue;
    const governance = compareKnowledgeRefreshCandidate({
      title: candidate.title,
      proposedPolicy: candidate.proposedPolicy,
      decisionKey: candidate.decisionKey || null,
      productScopes: candidate.productScopes,
    });
    const candidateHash = sha256(JSON.stringify({
      decisionKey: candidate.decisionKey || null,
      productScopes: candidate.productScopes,
      proposedPolicy: candidate.proposedPolicy,
      evidenceQuotes: candidate.evidenceQuotes,
    }));
    const candidateId = `kc_${randomUUID()}`;
    const rows = (await sql.query(
      `insert into ask_sales_faq_refresh_candidates (
         id, source_id, snapshot_id, snapshot_hash, source_revision, candidate_hash, status,
         title, summary, proposed_policy, rationale, decision_key, product_scopes, effective_date,
         evidence_quotes, ai_model, ai_confidence, conflict_level, conflict_summary,
         conflicting_policy_ids, related_policies, blocked_topic_ids
       ) values (
         $1, $2, $3, $4, $5, $6, 'needs_review', $7, $8, $9, $10, $11, $12::jsonb, $13,
         $14::jsonb, $15, $16, $17, $18, $19::jsonb, $20::jsonb, $21::jsonb
       ) on conflict (snapshot_id, candidate_hash) do nothing returning id`,
      [
        candidateId,
        input.sourceId,
        input.snapshotId,
        input.snapshotHash,
        sanitizeOperationalText(input.sourceRevision || "", 200) || null,
        candidateHash,
        candidate.title,
        candidate.summary,
        candidate.proposedPolicy,
        candidate.rationale,
        candidate.decisionKey || null,
        JSON.stringify(candidate.productScopes),
        normalizeDate(candidate.effectiveDate),
        JSON.stringify(candidate.evidenceQuotes),
        sanitizeOperationalText(input.model, 120),
        candidate.confidence,
        governance.conflictLevel,
        governance.conflictSummary,
        JSON.stringify(governance.conflictingPolicyIds),
        JSON.stringify(governance.relatedPolicies),
        JSON.stringify(governance.blockedTopicIds),
      ],
    )) as Array<{ id: string }>;
    if (rows[0]?.id) insertedIds.push(rows[0].id);
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
  });

  return { insertedCandidateIds: insertedIds, insertedCount: insertedIds.length };
}

export async function getKnowledgeRefreshOverview() {
  await ensureKnowledgeRefreshStorage();
  const sql = getSql();
  const [sources, candidates, releases, counts] = await Promise.all([
    listKnowledgeRefreshSources(),
    sql.query(
      `select c.*, s.label as source_label, s.url as source_url
       from ask_sales_faq_refresh_candidates c
       join ask_sales_faq_refresh_sources s on s.id = c.source_id
       order by case c.status when 'needs_review' then 0 when 'needs_owner' then 1 when 'approved_content' then 2 else 3 end,
                c.updated_at desc limit 150`,
    ) as unknown as Promise<KnowledgeRefreshCandidateRow[]>,
    sql.query(`select * from ask_sales_faq_refresh_releases order by created_at desc limit 30`) as unknown as Promise<KnowledgeRefreshReleaseRow[]>,
    sql.query(
      `select
         count(*) filter (where status = 'needs_review')::int as needs_review,
         count(*) filter (where status = 'needs_owner')::int as needs_owner,
         count(*) filter (where status = 'approved_content')::int as approved_content,
         count(*) filter (where status = 'stale')::int as stale
       from ask_sales_faq_refresh_candidates`,
    ) as unknown as Promise<Array<{ needs_review: number; needs_owner: number; approved_content: number; stale: number }>>,
  ]);
  return {
    generatedAt: new Date().toISOString(),
    knowledgeVersion: getKnowledgeRefreshRegistryVersion(),
    publishEnabled: process.env.ASK_SALES_KNOWLEDGE_REFRESH_PUBLISH_ENABLED === "true",
    sources,
    candidates,
    releases,
    summary: counts[0] || { needs_review: 0, needs_owner: 0, approved_content: 0, stale: 0 },
  };
}

export async function transitionKnowledgeRefreshCandidate(input: {
  candidateId: string;
  expectedVersion: number;
  action: "approve_content" | "reject" | "defer" | "needs_owner" | "duplicate" | "engineering_required";
  actor: string;
  note?: string | null;
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
  if (!["needs_review", "needs_owner", "deferred"].includes(candidate.status)) {
    throw new KnowledgeRefreshConflictError(`Candidate cannot be reviewed from status ${candidate.status}`);
  }

  const targetStatus = actionTargetStatus(input.action);
  const conflictResolution = input.conflictResolution || null;
  if (input.action === "approve_content" && ["direct", "blocked"].includes(candidate.conflict_level)) {
    if (!conflictResolution || !["supersede", "scoped_coexistence"].includes(conflictResolution)) {
      throw new KnowledgeRefreshValidationError("Direct or blocked conflicts require an explicit supersede or scoped-coexistence decision");
    }
  }

  const updateRows = (await sql.query(
    `update ask_sales_faq_refresh_candidates
     set status = $2, version = version + 1, review_note = $3, conflict_resolution = $4,
         reviewed_by = $5, reviewed_at = now(),
         approved_by = case when $2 = 'approved_content' then $5 else approved_by end,
         approved_at = case when $2 = 'approved_content' then now() else approved_at end,
         approved_snapshot_hash = case when $2 = 'approved_content' then snapshot_hash else approved_snapshot_hash end,
         updated_at = now()
     where id = $1 and version = $6
     returning version`,
    [
      input.candidateId,
      targetStatus,
      sanitizeOperationalText(input.note || "", 2000) || null,
      conflictResolution,
      input.actor,
      input.expectedVersion,
    ],
  )) as Array<{ version: number }>;
  if (!updateRows.length) throw new KnowledgeRefreshConflictError("Candidate changed during review");
  await writeAudit("candidate", input.candidateId, input.action, input.actor, candidate.status, targetStatus, {
    expectedVersion: input.expectedVersion,
    conflictResolution,
    note: sanitizeOperationalText(input.note || "", 2000) || null,
  });
  return { id: input.candidateId, status: targetStatus, version: updateRows[0].version };
}

export async function prepareKnowledgeRefreshRelease(input: { candidateIds: string[]; actor: string }) {
  await ensureKnowledgeRefreshStorage();
  const candidateIds = Array.from(new Set(input.candidateIds)).slice(0, 50);
  if (!candidateIds.length) throw new KnowledgeRefreshValidationError("Select at least one approved candidate");
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
  for (const candidate of rows) {
    if (candidate.status !== "approved_content") throw new KnowledgeRefreshValidationError(`${candidate.title} is not content-approved`);
    if (candidate.approved_snapshot_hash !== candidate.snapshot_hash || candidate.snapshot_hash !== candidate.last_content_hash) {
      throw new KnowledgeRefreshConflictError(`${candidate.title} is stale and must be reviewed again`);
    }
  }

  const releaseId = `kr_${randomUUID()}`;
  const manifest = {
    schemaVersion: 1,
    releaseId,
    knowledgeVersionBefore: getKnowledgeRefreshRegistryVersion(),
    preparedAt: new Date().toISOString(),
    preparedBy: input.actor,
    publicationMode: "reviewed_git_release",
    publicationSafety:
      "This manifest is not runtime authority. Apply it to the FAQ governance repo, run all compilers and tests, review the generated registry diff, deploy the dashboard artifact, and production-smoke-test before marking verified.",
    candidates: rows.map((candidate) => ({
      id: candidate.id,
      source: { id: candidate.source_id, label: candidate.source_label, url: candidate.source_url, revision: candidate.source_revision },
      decisionKey: candidate.decision_key,
      productScopes: candidate.product_scopes,
      effectiveDate: candidate.effective_date,
      proposedPolicy: candidate.proposed_policy,
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
  await sql.query(
    `insert into ask_sales_faq_refresh_releases (id, status, knowledge_version, candidate_ids, manifest, validation, created_by)
     values ($1, 'awaiting_implementation', $2, $3::jsonb, $4::jsonb, $5::jsonb, $6)`,
    [releaseId, getKnowledgeRefreshRegistryVersion(), JSON.stringify(candidateIds), JSON.stringify(manifest), JSON.stringify({ requiredChecks: releaseValidationChecks() }), input.actor],
  );
  await sql.query(
    `update ask_sales_faq_refresh_candidates
     set status = 'preparing_release', release_id = $1, version = version + 1, updated_at = now()
     where id in (${candidateIds.map((_, index) => `$${index + 2}`).join(", ")})`,
    [releaseId, ...candidateIds],
  );
  await writeAudit("release", releaseId, "release_prepared", input.actor, null, "awaiting_implementation", { candidateIds });
  return { releaseId, status: "awaiting_implementation", manifest };
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
  };
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
