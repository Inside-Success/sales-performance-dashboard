import { z } from "zod";
import {
  isKnowledgeRefreshServiceToken,
  listKnowledgeRefreshSources,
  recomputeActionableKnowledgeRefreshGovernance,
  recordKnowledgeRefreshCandidates,
  recordKnowledgeRefreshSnapshot,
  recordKnowledgeRefreshSourceFailure,
} from "@/lib/ask-sales-faq/knowledge-refresh-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const snapshotSchema = z.object({
  phase: z.literal("snapshot"),
  sourceId: z.string().min(1).max(160),
  label: z.string().max(180).optional(),
  sourceRevision: z.string().max(200).nullable().optional(),
  sourceUpdatedAt: z.string().max(80).nullable().optional(),
  content: z.string().min(1).max(300_000),
  metadata: z.record(z.string(), z.unknown()).optional(),
  cursor: z.record(z.string(), z.unknown()).optional(),
  runId: z.string().max(100).nullable().optional(),
});

const aiCandidateSchema = z.object({
  title: z.string().min(1).max(180),
  summary: z.string().min(1).max(1200),
  proposedPolicy: z.string().min(1).max(6000),
  rationale: z.string().min(1).max(2000),
  decisionKey: z.string().max(160).nullable().optional(),
  productScopes: z.array(z.string().min(1).max(80)).min(1).max(8),
  effectiveDate: z.string().max(30).nullable().optional(),
  evidenceQuotes: z.array(z.string().min(1).max(800)).min(1).max(8),
  confidence: z.number().min(0).max(1),
  candidateKind: z.enum(["new_rule", "rule_change", "conflict", "clarification", "knowledge_gap"]).optional(),
  domains: z.array(z.string().min(1).max(80)).max(8).optional(),
  actions: z.array(z.string().min(1).max(80)).max(8).optional(),
  entities: z.array(z.string().min(1).max(120)).max(16).optional(),
  policyObject: z.string().max(300).nullable().optional(),
  conditions: z.string().max(800).nullable().optional(),
  isDurable: z.boolean().optional(),
  isReusable: z.boolean().optional(),
  answerImpact: z.enum(["material", "possible", "none"]).optional(),
  sourceAuthority: z.enum(["owner_confirmed", "manager_guidance", "rep_answer", "rep_question", "unknown"]).optional(),
  authorityName: z.string().max(120).nullable().optional(),
  authorityBasis: z.string().max(600).nullable().optional(),
  atomicDecisionCount: z.number().int().min(1).max(20).optional(),
});

const candidatesSchema = z.object({
  phase: z.literal("candidates"),
  sourceId: z.string().min(1).max(160),
  snapshotId: z.string().min(1).max(160),
  snapshotHash: z.string().regex(/^[a-f0-9]{64}$/),
  sourceRevision: z.string().max(200).nullable().optional(),
  model: z.string().min(1).max(120),
  candidates: z.array(aiCandidateSchema).max(20),
});

const sourceErrorSchema = z.object({
  phase: z.literal("source_error"),
  sourceId: z.string().min(1).max(160),
  label: z.string().max(180).optional(),
  error: z.string().min(1).max(2000),
  cursor: z.record(z.string(), z.unknown()).optional(),
  runId: z.string().max(100).nullable().optional(),
});

const recomputeGovernanceSchema = z.object({
  phase: z.literal("recompute_governance"),
});

const requestSchema = z.discriminatedUnion("phase", [
  snapshotSchema,
  candidatesSchema,
  sourceErrorSchema,
  recomputeGovernanceSchema,
]);

function serviceToken(request: Request) {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
  return request.headers.get("x-ask-sales-refresh-token") || bearer;
}

function unauthorized() {
  return Response.json({ error: "unauthorized", message: "A valid Ask Sales knowledge-refresh service token is required." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isKnowledgeRefreshServiceToken(serviceToken(request))) return unauthorized();
  try {
    const sources = await listKnowledgeRefreshSources();
    return Response.json({
      generatedAt: new Date().toISOString(),
      schedule: { timezone: "America/New_York", hour: 21, minute: 0 },
      sources: sources.filter((source) => source.enabled),
    });
  } catch (error) {
    console.error("Ask Sales knowledge refresh source-list failure", safeError(error));
    return Response.json({ error: "service_unavailable", message: "The knowledge source registry is temporarily unavailable." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  if (!isKnowledgeRefreshServiceToken(serviceToken(request))) return unauthorized();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "validation_error", message: "Request body must be valid JSON." }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "validation_error", message: "Knowledge-refresh payload failed schema validation.", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }
  try {
    if (parsed.data.phase === "snapshot") {
      return Response.json(await recordKnowledgeRefreshSnapshot(parsed.data));
    }
    if (parsed.data.phase === "source_error") {
      await recordKnowledgeRefreshSourceFailure(parsed.data);
      return Response.json({ recorded: true });
    }
    if (parsed.data.phase === "recompute_governance") {
      return Response.json(await recomputeActionableKnowledgeRefreshGovernance({
        actor: "n8n:ask-sales-knowledge-refresh-maintenance",
      }));
    }
    return Response.json(await recordKnowledgeRefreshCandidates(parsed.data));
  } catch (error) {
    const message = safeError(error);
    const status = /unknown|stale|does not match|empty/i.test(message) ? 409 : 500;
    console.error("Ask Sales knowledge refresh ingest failure", message);
    return Response.json(
      { error: status === 409 ? "conflict" : "internal_error", message: status === 409 ? message : "Knowledge-refresh ingestion failed safely; no production policy was changed." },
      { status },
    );
  }
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "unknown error"))
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|token)["'\s:=]+[^\s"']+/gi, "secret=[redacted]")
    .slice(0, 500);
}
