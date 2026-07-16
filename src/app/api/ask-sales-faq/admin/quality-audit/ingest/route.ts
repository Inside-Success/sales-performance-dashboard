import { z } from "zod";
import { isKnowledgeRefreshServiceToken } from "@/lib/ask-sales-faq/knowledge-refresh-store";
import {
  getPendingAskSalesQualityAuditPackets,
  recordAskSalesQualityAuditEvaluations,
} from "@/lib/ask-sales-faq/quality-review-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const evaluationSchema = z.object({
  messageId: z.string().min(1).max(200),
  verdict: z.enum(["looks_correct", "needs_review", "knowledge_gap", "runtime_issue", "needs_owner"]),
  issueType: z.enum([
    "negative_feedback",
    "unnecessary_route",
    "knowledge_gap",
    "wrong_or_incomplete_answer",
    "stale_or_conflicting_policy",
    "conversation_context",
    "runtime_reliability",
    "presentation",
    "needs_owner",
  ]),
  severity: z.enum(["low", "medium", "high"]),
  confidence: z.number().min(0).max(1),
  summary: z.string().min(1).max(600),
  rationale: z.string().min(1).max(2000),
  expectedBehavior: z.string().max(2000).nullable().optional(),
});

const resultSchema = z.object({
  model: z.string().min(1).max(120),
  evaluations: z.array(evaluationSchema).min(1).max(100),
});

function serviceToken(request: Request) {
  const authorization = request.headers.get("authorization");
  return request.headers.get("x-ask-sales-refresh-token") || authorization?.match(/^Bearer\s+(.+)$/i)?.[1] || null;
}

function unauthorized() {
  return Response.json({ error: "unauthorized", message: "A valid Ask Sales refresh service token is required." }, { status: 401 });
}

export async function GET(request: Request) {
  if (!isKnowledgeRefreshServiceToken(serviceToken(request))) return unauthorized();
  const limit = Number(new URL(request.url).searchParams.get("limit") || 50);
  try {
    const packets = await getPendingAskSalesQualityAuditPackets(limit);
    return Response.json({
      generatedAt: new Date().toISOString(),
      instructions: [
        "Judge only against the supplied current governed policies and the exact user question.",
        "A safe route is correct when no supplied policy answers the question; do not invent missing policy.",
        "Flag a route as unnecessary only when supplied policy directly answers the requested decision.",
        "Negative feedback always requires review even if the answer appears supportable.",
        "Return one evaluation for every packet and do not include prose outside the JSON object.",
      ],
      packets,
    });
  } catch (error) {
    console.error("Ask Sales quality audit fetch failed", safeError(error));
    return Response.json({ error: "service_unavailable", message: "Quality audit packets are temporarily unavailable." }, { status: 503 });
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
  const parsed = resultSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "validation_error", message: "Quality audit results failed schema validation." }, { status: 400 });
  }
  try {
    return Response.json(await recordAskSalesQualityAuditEvaluations(parsed.data));
  } catch (error) {
    console.error("Ask Sales quality audit recording failed", safeError(error));
    return Response.json({ error: "internal_error", message: "Quality audit results were not recorded." }, { status: 500 });
  }
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : String(error || "unknown error"))
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|token)["'\s:=]+[^\s"']+/gi, "secret=[redacted]")
    .slice(0, 500);
}
