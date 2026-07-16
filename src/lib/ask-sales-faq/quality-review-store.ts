import "server-only";

import { createHash, randomUUID } from "node:crypto";
import { neon } from "@neondatabase/serverless";
import registryJson from "@/lib/ask-sales-faq/generated/v3-policy-registry.json";
import { parseEmailAllowlist } from "@/lib/ask-sales-faq/access";
import {
  classifyPolicyDecisionRelation,
  policyDecisionProfile,
  type PolicyDecisionRelation,
} from "@/lib/ask-sales-faq/policy-relevance";
import type { V3Policy, V3PolicyRegistry } from "@/lib/ask-sales-faq/v3/types";

type SqlClient = ReturnType<typeof neon>;

const registry = registryJson as V3PolicyRegistry;
const QUALITY_AUDIT_START = "2026-07-13T13:00:00.000Z";
const STOPWORDS = new Set([
  "about", "after", "again", "also", "and", "are", "because", "been", "before", "being", "but", "can",
  "could", "does", "for", "from", "have", "into", "just", "more", "not", "only", "our", "should", "that",
  "the", "their", "then", "there", "these", "they", "this", "those", "through", "was", "were", "what",
  "when", "where", "which", "while", "who", "will", "with", "would", "you", "your",
]);

let sqlClient: SqlClient | null = null;
let schemaPromise: Promise<void> | null = null;

export type AskSalesQualityVerdict =
  | "looks_correct"
  | "needs_review"
  | "knowledge_gap"
  | "runtime_issue"
  | "needs_owner";

export type AskSalesQualityIssueType =
  | "negative_feedback"
  | "unnecessary_route"
  | "knowledge_gap"
  | "wrong_or_incomplete_answer"
  | "stale_or_conflicting_policy"
  | "conversation_context"
  | "runtime_reliability"
  | "presentation"
  | "needs_owner";

export type AskSalesQualityCaseStatus =
  | "needs_review"
  | "confirmed_knowledge_gap"
  | "confirmed_runtime_issue"
  | "needs_owner"
  | "deferred"
  | "resolved_correct"
  | "fixed"
  | "ignored";

export type AskSalesQualityReviewAction =
  | "answer_correct"
  | "knowledge_gap"
  | "runtime_issue"
  | "needs_owner"
  | "defer"
  | "mark_fixed"
  | "ignore";

export type AskSalesQualityAuditEvaluation = {
  messageId: string;
  verdict: AskSalesQualityVerdict;
  issueType: AskSalesQualityIssueType;
  severity: "low" | "medium" | "high";
  confidence: number;
  summary: string;
  rationale: string;
  expectedBehavior?: string | null;
};

export type AskSalesQualityAuditPacket = {
  messageId: string;
  topicKey: string;
  question: string;
  answer: string;
  recentContext: Array<{ role: "user" | "assistant"; content: string }>;
  outcome: string | null;
  needsRoute: boolean;
  routeReason: string | null;
  errorClass: string | null;
  feedback: { rating: "up" | "down"; comment: string | null } | null;
  validationVerdict: string | null;
  selectedPolicyCount: number;
  currentPolicies: Array<{
    id: string;
    decisionKey: string;
    title: string;
    decision: string;
    productScopes: string[];
    effectiveAt: string;
    applicability: PolicyDecisionRelation;
    selectedByRuntime: boolean;
    matchReason: string;
  }>;
  deterministicSignals: string[];
  createdAt: string;
};

export type AskSalesQualityCaseRow = {
  id: string;
  cluster_key: string;
  status: AskSalesQualityCaseStatus;
  version: number;
  issue_type: AskSalesQualityIssueType;
  severity: "low" | "medium" | "high";
  title: string;
  summary: string;
  rationale: string;
  expected_behavior: string | null;
  representative_message_id: string;
  message_ids: string[];
  viewer_hashes: string[];
  occurrence_count: number;
  affected_rep_count: number;
  first_seen_at: string;
  last_seen_at: string;
  reviewer_note: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
  question: string | null;
  answer: string;
  outcome: string | null;
  needs_route: boolean;
  route_reason: string | null;
  error_class: string | null;
  feedback_rating: "up" | "down" | null;
  feedback_comment: string | null;
  evaluation_confidence: number;
  related_candidates: Array<{ id: string; title: string; status: string }>;
};

function getSql() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is not configured");
  if (!sqlClient) sqlClient = neon(process.env.DATABASE_URL);
  return sqlClient;
}

export function hasAskSalesQualityReviewDatabase() {
  return Boolean(process.env.DATABASE_URL);
}

export async function ensureAskSalesQualityReviewStorage() {
  if (!schemaPromise) {
    schemaPromise = buildSchema().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  await schemaPromise;
}

async function buildSchema() {
  const sql = getSql();
  await sql`
    create table if not exists ask_sales_faq_quality_audits (
      message_id text primary key references ask_sales_faq_messages(id) on delete cascade,
      knowledge_version text not null,
      topic_key text not null,
      verdict text not null,
      issue_type text not null,
      severity text not null,
      confidence numeric not null default 0,
      summary text not null,
      rationale text not null,
      expected_behavior text,
      model text not null,
      audited_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists ask_sales_faq_quality_audits_verdict_idx on ask_sales_faq_quality_audits (verdict, audited_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_quality_cases (
      id text primary key,
      cluster_key text not null unique,
      status text not null default 'needs_review',
      version integer not null default 1,
      issue_type text not null,
      severity text not null,
      title text not null,
      summary text not null,
      rationale text not null,
      expected_behavior text,
      representative_message_id text not null references ask_sales_faq_messages(id) on delete cascade,
      message_ids jsonb not null default '[]'::jsonb,
      viewer_hashes jsonb not null default '[]'::jsonb,
      first_seen_at timestamptz not null,
      last_seen_at timestamptz not null,
      reviewer_note text,
      reviewed_by text,
      reviewed_at timestamptz,
      created_at timestamptz not null default now(),
      updated_at timestamptz not null default now()
    )
  `;
  await sql`create index if not exists ask_sales_faq_quality_cases_status_idx on ask_sales_faq_quality_cases (status, last_seen_at desc)`;

  await sql`
    create table if not exists ask_sales_faq_quality_audit_log (
      id bigserial primary key,
      case_id text not null,
      event_type text not null,
      actor text not null,
      from_status text,
      to_status text,
      details jsonb not null default '{}'::jsonb,
      created_at timestamptz not null default now()
    )
  `;
}

export async function getPendingAskSalesQualityAuditPackets(limit = 50) {
  await ensureAskSalesQualityReviewStorage();
  const adminEmails = Array.from(parseEmailAllowlist(process.env.ASK_SALES_FAQ_ADMIN_EMAILS));
  const rows = (await getSql().query(
    `
      select
        a.id,
        a.content_redacted as answer,
        a.outcome,
        a.needs_route,
        a.route_reason,
        a.error_class,
        a.answer_payload,
        a.created_at::text as created_at,
        a.viewer_email,
        (
          select coalesce(
            jsonb_agg(
              jsonb_build_object('role', recent.role, 'content', recent.content_redacted)
              order by recent.created_at
            ),
            '[]'::jsonb
          )
          from (
            select m.role, m.content_redacted, m.created_at
            from ask_sales_faq_messages m
            where m.conversation_id = a.conversation_id
              and m.created_at < a.created_at
              and m.role in ('user', 'assistant')
            order by m.created_at desc
            limit 6
          ) recent
        ) as recent_context,
        f.rating as feedback_rating,
        f.comment as feedback_comment,
        (
          select u.content_redacted
          from ask_sales_faq_messages u
          where u.conversation_id = a.conversation_id
            and u.role = 'user'
            and u.created_at <= a.created_at
          order by u.created_at desc
          limit 1
        ) as question
      from ask_sales_faq_messages a
      left join lateral (
        select rating, comment
        from ask_sales_faq_feedback
        where message_id = a.id
        order by created_at desc
        limit 1
      ) f on true
      left join ask_sales_faq_quality_audits audit on audit.message_id = a.id
      where a.role = 'assistant'
        and a.created_at >= $1::timestamptz
        and audit.message_id is null
        and not (a.viewer_email = any($2::text[]))
      order by a.created_at asc
      limit $3
    `,
    [QUALITY_AUDIT_START, adminEmails, Math.max(1, Math.min(limit, 100))],
  )) as Array<Record<string, unknown>>;

  return rows.map(buildAuditPacket);
}

function buildAuditPacket(row: Record<string, unknown>): AskSalesQualityAuditPacket {
  const payload = (row.answer_payload && typeof row.answer_payload === "object" ? row.answer_payload : {}) as Record<string, unknown>;
  const runtimeMetadata = objectValue(payload.runtimeMetadata);
  const v3 = objectValue(runtimeMetadata.v3);
  const selection = objectValue(v3.selection);
  const validation = objectValue(v3.validation);
  const selectedIds = stringArray(selection.selectedPolicyIds);
  const question = String(row.question || "");
  const currentPolicies = selectCurrentPolicies(question, selectedIds);
  const applicablePolicies = currentPolicies.filter((policy) => policy.applicability === "same_decision");
  const topicKey = applicablePolicies[0]?.decisionKey || `question-${sha256(normalizeTopic(question)).slice(0, 16)}`;
  const signals: string[] = [];
  if (row.feedback_rating === "down") signals.push("explicit_negative_feedback");
  if (row.error_class) signals.push(`runtime_error:${row.error_class}`);
  if (row.needs_route) signals.push("safe_route_returned");
  if (row.error_class === "v3_grounding_rejected") signals.push("grounding_validation_rejected");
  if (!applicablePolicies.length) signals.push("no_current_policy_supplied");
  if (currentPolicies.some((policy) => policy.selectedByRuntime && policy.applicability !== "same_decision")) {
    signals.push("runtime_selected_irrelevant_policy");
  }
  if (looksLikeCorrection(question)) signals.push("possible_correction_or_repeat");

  return {
    messageId: String(row.id),
    topicKey,
    question,
    answer: String(row.answer || ""),
    recentContext: recentContextValue(row.recent_context),
    outcome: nullableString(row.outcome),
    needsRoute: Boolean(row.needs_route),
    routeReason: nullableString(row.route_reason),
    errorClass: nullableString(row.error_class),
    feedback: row.feedback_rating
      ? { rating: row.feedback_rating as "up" | "down", comment: nullableString(row.feedback_comment) }
      : null,
    validationVerdict: nullableString(validation.verdict),
    selectedPolicyCount: selectedIds.length,
    currentPolicies,
    deterministicSignals: signals,
    createdAt: String(row.created_at),
  };
}

function selectCurrentPolicies(question: string, selectedIds: string[]) {
  const selected = registry.policies.filter((policy) => selectedIds.includes(policy.id));
  const relevant = topPolicies(question, 6);
  const policies = Array.from(
    new Map([...selected, ...relevant].map((policy) => [policy.id, policy])).values(),
  );
  const questionProfile = policyDecisionProfile({ text: question });
  return policies
    .map((policy) => {
      const match = classifyPolicyDecisionRelation(questionProfile, policyProfile(policy));
      return {
        id: policy.id,
        decisionKey: policy.decision_key,
        title: policy.title,
        decision: policy.decision,
        productScopes: policy.product_scopes,
        effectiveAt: policy.effective_at,
        applicability: match.relation,
        selectedByRuntime: selectedIds.includes(policy.id),
        matchReason: match.reasons.join(" "),
      };
    })
    .filter((policy) => policy.selectedByRuntime || policy.applicability === "same_decision")
    .sort((left, right) =>
      Number(right.applicability === "same_decision") - Number(left.applicability === "same_decision") ||
      Number(right.selectedByRuntime) - Number(left.selectedByRuntime),
    )
    .slice(0, 10);
}

function topPolicies(value: string, limit: number) {
  const query = policyDecisionProfile({ text: value });
  return registry.policies
    .map((policy) => ({ policy, match: classifyPolicyDecisionRelation(query, policyProfile(policy)) }))
    .filter((item) => item.match.relation === "same_decision" && item.match.sharedPolicyObjects.length > 0)
    .sort((left, right) => right.match.score - left.match.score || right.policy.authority - left.policy.authority)
    .slice(0, limit)
    .map((item) => item.policy);
}

export async function recordAskSalesQualityAuditEvaluations(input: {
  model: string;
  evaluations: AskSalesQualityAuditEvaluation[];
}) {
  await ensureAskSalesQualityReviewStorage();
  const adminEmails = Array.from(parseEmailAllowlist(process.env.ASK_SALES_FAQ_ADMIN_EMAILS));
  let recorded = 0;
  let casesCreatedOrUpdated = 0;

  for (const raw of input.evaluations.slice(0, 100)) {
    const evaluation = normalizeEvaluation(raw);
    if (!evaluation) continue;
    const messageRows = (await getSql().query(
      `
        select
          a.id, a.viewer_email, a.created_at::text as created_at, a.error_class,
          a.content_redacted as answer, a.outcome, a.needs_route, a.route_reason, a.answer_payload,
          (
            select coalesce(
              jsonb_agg(
                jsonb_build_object('role', recent.role, 'content', recent.content_redacted)
                order by recent.created_at
              ),
              '[]'::jsonb
            )
            from (
              select m.role, m.content_redacted, m.created_at
              from ask_sales_faq_messages m
              where m.conversation_id = a.conversation_id
                and m.created_at < a.created_at
                and m.role in ('user', 'assistant')
              order by m.created_at desc
              limit 6
            ) recent
          ) as recent_context,
          f.rating as feedback_rating,
          f.comment as feedback_comment,
          (
            select u.content_redacted
            from ask_sales_faq_messages u
            where u.conversation_id = a.conversation_id
              and u.role = 'user'
              and u.created_at <= a.created_at
            order by u.created_at desc
            limit 1
          ) as question
        from ask_sales_faq_messages a
        left join lateral (
          select rating, comment from ask_sales_faq_feedback where message_id = a.id order by created_at desc limit 1
        ) f on true
        where a.id = $1 and a.role = 'assistant' and a.created_at >= $2::timestamptz
          and not (a.viewer_email = any($3::text[]))
        limit 1
      `,
      [evaluation.messageId, QUALITY_AUDIT_START, adminEmails],
    )) as Array<Record<string, unknown>>;
    const message = messageRows[0];
    if (!message) continue;

    const packet = buildAuditPacket(message);
    const enforced = enforceDeterministicSignals(evaluation, message);
    const inserted = (await getSql().query(
      `
        insert into ask_sales_faq_quality_audits (
          message_id, knowledge_version, topic_key, verdict, issue_type, severity,
          confidence, summary, rationale, expected_behavior, model, audited_at
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,now())
        on conflict (message_id) do nothing
        returning message_id
      `,
      [
        enforced.messageId,
        registry.knowledge_version,
        packet.topicKey,
        enforced.verdict,
        enforced.issueType,
        enforced.severity,
        enforced.confidence,
        enforced.summary,
        enforced.rationale,
        enforced.expectedBehavior,
        sanitize(input.model, 120) || "deepseek-quality-audit",
      ],
    )) as Array<{ message_id: string }>;
    if (!inserted.length) continue;
    recorded += 1;
    if (enforced.verdict === "looks_correct") continue;

    await upsertQualityCase({
      evaluation: enforced,
      topicKey: packet.topicKey,
      viewerEmail: String(message.viewer_email),
      createdAt: String(message.created_at),
      question: String(message.question || ""),
    });
    casesCreatedOrUpdated += 1;
  }

  return { recorded, casesCreatedOrUpdated };
}

async function upsertQualityCase(input: {
  evaluation: AskSalesQualityAuditEvaluation;
  topicKey: string;
  viewerEmail: string;
  createdAt: string;
  question: string;
}) {
  const clusterKey = `${input.evaluation.issueType}:${input.topicKey}`;
  const viewerHash = sha256(input.viewerEmail.toLowerCase()).slice(0, 20);
  const title = qualityCaseTitle(input.evaluation.issueType, input.question);
  await getSql().query(
    `
      insert into ask_sales_faq_quality_cases (
        id, cluster_key, status, issue_type, severity, title, summary, rationale,
        expected_behavior, representative_message_id, message_ids, viewer_hashes,
        first_seen_at, last_seen_at
      ) values ($1,$2,'needs_review',$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::timestamptz,$12::timestamptz)
      on conflict (cluster_key) do update set
        status = case
          when ask_sales_faq_quality_cases.status in ('resolved_correct','fixed','ignored')
            and not (ask_sales_faq_quality_cases.message_ids ? $9)
          then 'needs_review'
          else ask_sales_faq_quality_cases.status
        end,
        version = ask_sales_faq_quality_cases.version + 1,
        severity = case
          when excluded.severity = 'high' then 'high'
          when excluded.severity = 'medium' and ask_sales_faq_quality_cases.severity = 'low' then 'medium'
          else ask_sales_faq_quality_cases.severity
        end,
        title = excluded.title,
        summary = excluded.summary,
        rationale = excluded.rationale,
        expected_behavior = coalesce(excluded.expected_behavior, ask_sales_faq_quality_cases.expected_behavior),
        representative_message_id = excluded.representative_message_id,
        message_ids = case
          when ask_sales_faq_quality_cases.message_ids ? $9 then ask_sales_faq_quality_cases.message_ids
          else ask_sales_faq_quality_cases.message_ids || $10::jsonb
        end,
        viewer_hashes = case
          when ask_sales_faq_quality_cases.viewer_hashes ? $13 then ask_sales_faq_quality_cases.viewer_hashes
          else ask_sales_faq_quality_cases.viewer_hashes || $11::jsonb
        end,
        first_seen_at = least(ask_sales_faq_quality_cases.first_seen_at, excluded.first_seen_at),
        last_seen_at = greatest(ask_sales_faq_quality_cases.last_seen_at, excluded.last_seen_at),
        updated_at = now()
    `,
    [
      `qc_${randomUUID()}`,
      clusterKey,
      input.evaluation.issueType,
      input.evaluation.severity,
      title,
      input.evaluation.summary,
      input.evaluation.rationale,
      input.evaluation.expectedBehavior || null,
      input.evaluation.messageId,
      JSON.stringify([input.evaluation.messageId]),
      JSON.stringify([viewerHash]),
      input.createdAt,
      viewerHash,
    ],
  );
}

export async function getAskSalesQualityReviewOverview(input?: {
  status?: AskSalesQualityCaseStatus | "active" | "resolved" | "all";
  page?: number;
}) {
  if (!hasAskSalesQualityReviewDatabase()) return emptyOverview();
  await ensureAskSalesQualityReviewStorage();
  const status = input?.status || "active";
  const page = Math.max(1, input?.page || 1);
  const pageSize = 12;
  const statuses = qualityViewStatuses(status);
  const values: unknown[] = [];
  let where = "";
  if (statuses.length) {
    values.push(statuses);
    where = `where c.status = any($${values.length}::text[])`;
  }
  values.push(pageSize, (page - 1) * pageSize);
  const rows = (await getSql().query(
    `
      select
        c.*,
        jsonb_array_length(c.message_ids)::int as occurrence_count,
        jsonb_array_length(c.viewer_hashes)::int as affected_rep_count,
        a.content_redacted as answer,
        a.outcome,
        a.needs_route,
        a.route_reason,
        a.error_class,
        (
          select u.content_redacted
          from ask_sales_faq_messages u
          where u.conversation_id = a.conversation_id
            and u.role = 'user'
            and u.created_at <= a.created_at
          order by u.created_at desc
          limit 1
        ) as question,
        f.rating as feedback_rating,
        f.comment as feedback_comment,
        audit.confidence::float as evaluation_confidence
      from ask_sales_faq_quality_cases c
      join ask_sales_faq_messages a on a.id = c.representative_message_id
      join ask_sales_faq_quality_audits audit on audit.message_id = c.representative_message_id
      left join lateral (
        select rating, comment
        from ask_sales_faq_feedback
        where message_id = a.id
        order by created_at desc
        limit 1
      ) f on true
      ${where}
      order by
        case c.severity when 'high' then 0 when 'medium' then 1 else 2 end,
        c.last_seen_at desc
      limit $${values.length - 1} offset $${values.length}
    `,
    values,
  )) as AskSalesQualityCaseRow[];
  const countValues = statuses.length ? [statuses] : [];
  const countRows = (await getSql().query(
    `select count(*)::int as total from ask_sales_faq_quality_cases c ${statuses.length ? "where c.status = any($1::text[])" : ""}`,
    countValues,
  )) as Array<{ total: number }>;
  const summaryRows = (await getSql().query(
    `
      select
        count(*) filter (where status = 'needs_review')::int as needs_review,
        count(*) filter (where status = 'confirmed_knowledge_gap')::int as confirmed_knowledge_gap,
        count(*) filter (where status = 'confirmed_runtime_issue')::int as confirmed_runtime_issue,
        count(*) filter (where status = 'needs_owner')::int as needs_owner,
        count(*) filter (where status = 'deferred')::int as deferred,
        count(*) filter (where status in ('resolved_correct','fixed','ignored'))::int as resolved,
        count(*)::int as total
      from ask_sales_faq_quality_cases
    `,
  )) as Array<Record<string, number>>;
  const auditRows = (await getSql().query(
    `
      select
        count(*)::int as audited,
        count(*) filter (where verdict = 'looks_correct')::int as looks_correct,
        max(audited_at)::text as last_audited_at
      from ask_sales_faq_quality_audits
    `,
  )) as Array<Record<string, number | string | null>>;
  const relatedCandidates = await getRelatedRefreshCandidates(rows);
  const hydrated = rows.map((row) => ({
    ...row,
    related_candidates: relatedCandidates.get(row.id) || [],
  }));
  const total = countRows[0]?.total || 0;

  return {
    generatedAt: new Date().toISOString(),
    auditStart: QUALITY_AUDIT_START,
    knowledgeVersion: registry.knowledge_version,
    cases: hydrated,
    summary: {
      needsReview: Number(summaryRows[0]?.needs_review || 0),
      confirmedKnowledgeGap: Number(summaryRows[0]?.confirmed_knowledge_gap || 0),
      confirmedRuntimeIssue: Number(summaryRows[0]?.confirmed_runtime_issue || 0),
      needsOwner: Number(summaryRows[0]?.needs_owner || 0),
      deferred: Number(summaryRows[0]?.deferred || 0),
      resolved: Number(summaryRows[0]?.resolved || 0),
      total: Number(summaryRows[0]?.total || 0),
      audited: Number(auditRows[0]?.audited || 0),
      looksCorrect: Number(auditRows[0]?.looks_correct || 0),
      lastAuditedAt: typeof auditRows[0]?.last_audited_at === "string" ? auditRows[0].last_audited_at : null,
    },
    filters: { status },
    pagination: { page, pageSize, total, totalPages: Math.max(1, Math.ceil(total / pageSize)) },
  };
}

export async function transitionAskSalesQualityCase(input: {
  caseId: string;
  expectedVersion: number;
  action: AskSalesQualityReviewAction;
  actor: string;
  note?: string | null;
}) {
  validateAskSalesQualityReviewDecision(input.action, input.note);
  await ensureAskSalesQualityReviewStorage();
  const target = qualityActionTarget(input.action);
  const rows = (await getSql().query(
    `select status, version from ask_sales_faq_quality_cases where id = $1 limit 1`,
    [input.caseId],
  )) as Array<{ status: AskSalesQualityCaseStatus; version: number }>;
  const current = rows[0];
  if (!current) throw new Error("Quality case not found");
  if (current.version !== input.expectedVersion) throw new Error("Quality case changed; refresh before reviewing it again");
  const update = (await getSql().query(
    `
      update ask_sales_faq_quality_cases
      set status = $2, version = version + 1, reviewer_note = $3,
          reviewed_by = $4, reviewed_at = now(), updated_at = now()
      where id = $1 and version = $5
      returning version
    `,
    [input.caseId, target, sanitize(input.note || "", 2000) || null, input.actor, input.expectedVersion],
  )) as Array<{ version: number }>;
  if (!update.length) throw new Error("Quality case changed during review");
  await getSql().query(
    `
      insert into ask_sales_faq_quality_audit_log (
        case_id, event_type, actor, from_status, to_status, details
      ) values ($1,$2,$3,$4,$5,$6::jsonb)
    `,
    [input.caseId, input.action, input.actor, current.status, target, JSON.stringify({ note: sanitize(input.note || "", 2000) || null })],
  );
  return { id: input.caseId, status: target, version: update[0].version };
}

function normalizeEvaluation(value: AskSalesQualityAuditEvaluation) {
  if (!value?.messageId) return null;
  const verdicts: AskSalesQualityVerdict[] = ["looks_correct", "needs_review", "knowledge_gap", "runtime_issue", "needs_owner"];
  const issueTypes: AskSalesQualityIssueType[] = [
    "negative_feedback", "unnecessary_route", "knowledge_gap", "wrong_or_incomplete_answer",
    "stale_or_conflicting_policy", "conversation_context", "runtime_reliability", "presentation", "needs_owner",
  ];
  if (!verdicts.includes(value.verdict) || !issueTypes.includes(value.issueType)) return null;
  return {
    messageId: sanitize(value.messageId, 200),
    verdict: value.verdict,
    issueType: value.issueType,
    severity: ["low", "medium", "high"].includes(value.severity) ? value.severity : "medium",
    confidence: Math.max(0, Math.min(1, Number(value.confidence) || 0)),
    summary: sanitize(value.summary, 600) || "This exchange needs human quality review.",
    rationale: sanitize(value.rationale, 2000) || "The automated audit could not establish a safe final disposition.",
    expectedBehavior: sanitize(value.expectedBehavior || "", 2000) || null,
  } satisfies AskSalesQualityAuditEvaluation;
}

export function applyAskSalesQualityAuditGuardrails(
  evaluation: AskSalesQualityAuditEvaluation,
  message: Record<string, unknown>,
) {
  if (message.feedback_rating === "down") {
    return {
      ...evaluation,
      verdict: "needs_review" as const,
      issueType: "negative_feedback" as const,
      severity: evaluation.severity === "low" ? "medium" as const : evaluation.severity,
    };
  }
  if (isTechnicalRuntimeErrorClass(message.error_class)) {
    return {
      ...evaluation,
      verdict: "runtime_issue" as const,
      issueType: "runtime_reliability" as const,
      severity: "high" as const,
    };
  }
  if (evaluation.issueType === "negative_feedback") {
    return {
      ...evaluation,
      issueType: "wrong_or_incomplete_answer" as const,
    };
  }
  return evaluation;
}

function enforceDeterministicSignals(evaluation: AskSalesQualityAuditEvaluation, message: Record<string, unknown>) {
  return applyAskSalesQualityAuditGuardrails(evaluation, message);
}

export function validateAskSalesQualityReviewDecision(action: AskSalesQualityReviewAction, note?: string | null) {
  if (["knowledge_gap", "runtime_issue", "needs_owner"].includes(action) && !sanitize(note || "", 2000)) {
    throw new Error("Add a reviewer note before confirming a knowledge gap, runtime issue, or policy-owner decision");
  }
}

function isTechnicalRuntimeErrorClass(value: unknown) {
  if (typeof value !== "string" || !value) return false;
  return !["v3_grounding_rejected", "ai_grounding_rejected"].includes(value);
}

function qualityViewStatuses(value: AskSalesQualityCaseStatus | "active" | "resolved" | "all") {
  if (value === "active") return ["needs_review", "confirmed_knowledge_gap", "confirmed_runtime_issue", "needs_owner"];
  if (value === "resolved") return ["resolved_correct", "fixed", "ignored"];
  if (value === "all") return [];
  return [value];
}

function qualityActionTarget(action: AskSalesQualityReviewAction): AskSalesQualityCaseStatus {
  if (action === "answer_correct") return "resolved_correct";
  if (action === "knowledge_gap") return "confirmed_knowledge_gap";
  if (action === "runtime_issue") return "confirmed_runtime_issue";
  if (action === "needs_owner") return "needs_owner";
  if (action === "defer") return "deferred";
  if (action === "mark_fixed") return "fixed";
  return "ignored";
}

async function getRelatedRefreshCandidates(cases: AskSalesQualityCaseRow[]) {
  const result = new Map<string, Array<{ id: string; title: string; status: string }>>();
  if (!cases.length) return result;
  const candidates = (await getSql().query(
    `
      select c.id, c.title, c.proposed_policy, c.status, c.decision_key, c.product_scopes,
             coalesce(to_jsonb(c)->'policy_domains', '[]'::jsonb) as policy_domains,
             coalesce(to_jsonb(c)->'policy_actions', '[]'::jsonb) as policy_actions,
             coalesce(to_jsonb(c)->'policy_entities', '[]'::jsonb) as policy_entities,
             to_jsonb(c)->>'policy_object' as policy_object,
             to_jsonb(c)->>'policy_conditions' as policy_conditions
      from ask_sales_faq_refresh_candidates c
      where status in ('needs_review','needs_owner','approved_content','preparing_release')
      order by updated_at desc
      limit 250
    `,
  )) as Array<{
    id: string;
    title: string;
    proposed_policy: string;
    status: string;
    decision_key: string | null;
    product_scopes: string[];
    policy_domains: string[];
    policy_actions: string[];
    policy_entities: string[];
    policy_object: string | null;
    policy_conditions: string | null;
  }>;
  for (const item of cases) {
    const query = policyDecisionProfile({ text: `${item.title} ${item.question || ""}` });
    const matches = candidates
      .filter((candidate) =>
        candidate.policy_domains.length > 0 &&
        candidate.policy_actions.length > 0 &&
        candidate.policy_entities.length > 0,
      )
      .map((candidate) => ({
        candidate,
        match: classifyPolicyDecisionRelation(query, policyDecisionProfile({
          text: `${candidate.title} ${candidate.proposed_policy}`,
          decisionKey: candidate.decision_key,
          productScopes: candidate.product_scopes,
          domains: candidate.policy_domains,
          actions: candidate.policy_actions,
          entities: candidate.policy_entities,
          policyObject: candidate.policy_object,
          conditions: candidate.policy_conditions,
        })),
      }))
      .filter((candidate) => candidate.match.relation === "same_decision")
      .sort((left, right) => right.match.score - left.match.score)
      .slice(0, 3)
      .map(({ candidate }) => ({ id: candidate.id, title: candidate.title, status: candidate.status }));
    result.set(item.id, matches);
  }
  return result;
}

function qualityCaseTitle(issueType: AskSalesQualityIssueType, question: string) {
  const prefix: Record<AskSalesQualityIssueType, string> = {
    negative_feedback: "Negative feedback",
    unnecessary_route: "Possibly answerable question was routed",
    knowledge_gap: "Knowledge coverage gap",
    wrong_or_incomplete_answer: "Possibly wrong or incomplete answer",
    stale_or_conflicting_policy: "Possible stale or conflicting answer",
    conversation_context: "Conversation or follow-up issue",
    runtime_reliability: "Runtime or validation failure",
    presentation: "Answer presentation problem",
    needs_owner: "Policy owner decision needed",
  };
  const cleanQuestion = sanitize(question.replace(/\s+/g, " "), 100);
  return cleanQuestion ? `${prefix[issueType]}: ${cleanQuestion}` : prefix[issueType];
}

function policyProfile(policy: V3Policy) {
  return policyDecisionProfile({
    text: `${policy.title} ${policy.question_families.join(" ")} ${policy.decision}`,
    decisionKey: policy.decision_key,
    productScopes: policy.product_scopes,
    domains: policy.domains,
    actions: policy.actions,
    entities: policy.entities,
    policyObject: policy.title,
  });
}

function normalizeTopic(value: string) {
  return Array.from(tokens(value)).sort().slice(0, 20).join(" ") || value.toLowerCase().replace(/\s+/g, " ").trim();
}

function tokens(value: string) {
  return new Set(
    value.toLowerCase().replace(/[^a-z0-9$]+/g, " ").split(" ")
      .filter((token) => token.length > 2 && !STOPWORDS.has(token)),
  );
}

function looksLikeCorrection(value: string) {
  return /\b(?:not what i asked|that(?:'s| is) (?:not right|wrong)|are you sure|i mean|no[, ]|actually|still not|doesn(?:'t| not) answer)\b/i.test(value);
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function recentContextValue(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => objectValue(item))
    .filter((item) => (item.role === "user" || item.role === "assistant") && typeof item.content === "string")
    .map((item) => ({
      role: item.role as "user" | "assistant",
      content: sanitize(String(item.content), 4000),
    }))
    .filter((item) => item.content)
    .slice(-6);
}

function nullableString(value: unknown) {
  return typeof value === "string" && value ? value : null;
}

function sanitize(value: string, max: number) {
  return value.replace(/\u0000/g, "").replace(/\r\n?/g, "\n").trim().slice(0, max);
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function emptyOverview() {
  return {
    generatedAt: new Date().toISOString(),
    auditStart: QUALITY_AUDIT_START,
    knowledgeVersion: registry.knowledge_version,
    cases: [] as AskSalesQualityCaseRow[],
    summary: {
      needsReview: 0,
      confirmedKnowledgeGap: 0,
      confirmedRuntimeIssue: 0,
      needsOwner: 0,
      deferred: 0,
      resolved: 0,
      total: 0,
      audited: 0,
      looksCorrect: 0,
      lastAuditedAt: null as string | null,
    },
    filters: { status: "active" as const },
    pagination: { page: 1, pageSize: 12, total: 0, totalPages: 1 },
  };
}
