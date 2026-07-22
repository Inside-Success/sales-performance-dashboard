import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import {
  isV4HistorySigningConfigured,
  mintV4HistoryToken,
  V4HistoryTokenError,
  verifyV4HistoryToken,
} from "@/lib/ask-sales-faq/v4/history-token";
import { assertV4IsolatedRuntime, isV4IsolatedRuntimeEnabled, isV4LabTokenAuthorized } from "@/lib/ask-sales-faq/v4/isolation";
import { generateV4Json, generateV4ValidationJson, getV4ProviderReadiness } from "@/lib/ask-sales-faq/v4/provider";
import { getV4SystemicKnowledgeVersion, getV4SystemicOperationalPolicyCount } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { runAskSalesFaqV4Systemic } from "@/lib/ask-sales-faq/v4/systemic/runtime";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BODY_BYTES = 70 * 1024;
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 20;
const CONCURRENT_MAX = 2;
// Deliberately instance-local and persistence-free. It limits accidental test
// bursts but is not represented as a deployment-wide quota or billing guard.
const requestWindows = new Map<string, { startedAt: number; count: number; active: number }>();

function reserveRequest(token: string) {
  const now = Date.now();
  const key = createHash("sha256").update(`systemic:${token}`).digest("hex");
  const existing = requestWindows.get(key);
  const state = !existing || now - existing.startedAt >= RATE_WINDOW_MS
    ? { startedAt: now, count: 0, active: 0 }
    : existing;
  requestWindows.set(key, state);
  if (state.count >= RATE_MAX) return { ok: false as const, reason: "rate" as const, retryAfterSeconds: Math.max(1, Math.ceil((state.startedAt + RATE_WINDOW_MS - now) / 1000)) };
  if (state.active >= CONCURRENT_MAX) return { ok: false as const, reason: "concurrency" as const, retryAfterSeconds: 5 };
  state.count += 1;
  state.active += 1;
  let released = false;
  return {
    ok: true as const,
    release() {
      if (released) return;
      released = true;
      state.active = Math.max(0, state.active - 1);
    },
  };
}

const requestSchema = z.object({
  question: z.string().trim().min(1).max(6000),
  historyToken: z.string().min(1).max(64 * 1024).optional(),
  conversationId: z.string().min(1).max(120).regex(/^[A-Za-z0-9][A-Za-z0-9_.:-]*$/).optional(),
}).strict();

function json(payload: unknown, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.headers.set("cache-control", "private, no-store, max-age=0");
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  response.headers.set("x-ask-sales-runtime", "v4-systemic-isolated");
  return response;
}

export async function GET() {
  if (!isV4IsolatedRuntimeEnabled()) return new NextResponse(null, { status: 404 });
  const provider = getV4ProviderReadiness();
  const accessTokenConfigured = (process.env.ASK_SALES_V4_LAB_TOKEN || "").length >= 24;
  const historySigningConfigured = isV4HistorySigningConfigured();
  const modelAccessConfirmed = process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED === "true";
  return json({
    ok: true,
    ready: accessTokenConfigured && historySigningConfigured && provider.modelConfigured && modelAccessConfirmed,
    runtime: "v4-systemic-isolated",
    persistence: false,
    productionSelectorChanged: false,
    operationalPolicyCount: getV4SystemicOperationalPolicyCount(),
    knowledgeVersion: getV4SystemicKnowledgeVersion(),
    accessTokenConfigured,
    historySigningConfigured,
    modelAccessConfirmed,
    ...provider,
  });
}

export async function POST(request: NextRequest) {
  if (!isV4IsolatedRuntimeEnabled()) return new NextResponse(null, { status: 404 });
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) {
    return json({ ok: false, error: "The isolated test request exceeds the 70 KB limit." }, 413);
  }
  const labToken = request.headers.get("x-ask-sales-v4-token");
  if (!isV4LabTokenAuthorized(labToken)) return json({ ok: false, error: "Invalid or missing V4 lab access token." }, 401);

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > MAX_BODY_BYTES) return json({ ok: false, error: "The isolated test request exceeds the 70 KB limit." }, 413);
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return json({ ok: false, error: "The isolated test request contains malformed JSON." }, 400);
  }

  try {
    assertV4IsolatedRuntime();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return json({ ok: false, error: "The isolated test request was malformed or too large." }, 400);
    const knowledgeVersion = getV4SystemicKnowledgeVersion();
    let conversationId = parsed.data.conversationId || `v4_systemic_lab_${randomUUID()}`;
    let verifiedMessages: Array<{ role: "user" | "assistant"; content: string }> = [];
    if (parsed.data.historyToken) {
      try {
        const verified = verifyV4HistoryToken({
          token: parsed.data.historyToken,
          knowledgeVersion,
          conversationId: parsed.data.conversationId,
        });
        conversationId = verified.conversationId;
        verifiedMessages = verified.messages;
      } catch (error) {
        if (error instanceof V4HistoryTokenError) {
          return json({ ok: false, error: "The isolated conversation history is invalid, expired, or no longer matches this knowledge release. Start a new case safely." }, 409);
        }
        throw error;
      }
    }
    if (process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED !== "true") {
      return json({ ok: false, error: "The isolated model transport is configured but has not passed a live access check." }, 503);
    }
    const readiness = getV4ProviderReadiness();
    if (!readiness.modelConfigured || !readiness.provider || !readiness.model || !readiness.transport) {
      return json({ ok: false, error: "The isolated model provider is not currently configured. No fallback answer was generated." }, 503);
    }

    const reservation = reserveRequest(labToken!);
    if (!reservation.ok) {
      const response = json({
        ok: false,
        error: reservation.reason === "rate"
          ? "The isolated lab reached its 20-request safety limit for this 10-minute window."
          : "The isolated lab already has two model requests in progress. Please retry shortly.",
      }, 429);
      response.headers.set("retry-after", String(reservation.retryAfterSeconds));
      return response;
    }

    try {
      const question = parsed.data.question;
      const result = await runAskSalesFaqV4Systemic(question, [...verifiedMessages, { role: "user", content: question }], {
        provider: generateV4Json,
        validatorProvider: generateV4ValidationJson,
      });
      const historyToken = mintV4HistoryToken({
        conversationId,
        knowledgeVersion,
        previousMessages: verifiedMessages,
        question: result.runtimeMetadata.turn.currentQuestion,
        answer: result.answer,
      });
      return json({ ...result, conversationId, historyToken, messageId: `v4_systemic_lab_assistant_${randomUUID()}` });
    } finally {
      reservation.release();
    }
  } catch (error) {
    console.error("Ask Sales V4 systemic isolated request failed", error instanceof Error ? error.message : "unknown error");
    return json({ ok: false, error: "The isolated systemic runtime failed safely. No production request or database write was attempted." }, 503);
  }
}
