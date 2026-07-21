import { createHash, randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runAskSalesFaqV4 } from "@/lib/ask-sales-faq/v4/runtime";
import { assertV4IsolatedRuntime, isV4IsolatedRuntimeEnabled, isV4LabTokenAuthorized } from "@/lib/ask-sales-faq/v4/isolation";
import { generateV4Json, generateV4ValidationJson, getV4ProviderReadiness } from "@/lib/ask-sales-faq/v4/provider";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;
const V4_MAX_BODY_BYTES = 70 * 1024;
const V4_RATE_WINDOW_MS = 10 * 60 * 1000;
const V4_RATE_MAX = 20;
const V4_CONCURRENT_MAX = 2;
const v4RequestWindows = new Map<string, { startedAt: number; count: number; active: number }>();

function reserveV4LabRequest(token: string) {
  const now = Date.now();
  const key = createHash("sha256").update(token).digest("hex");
  const existing = v4RequestWindows.get(key);
  const state = !existing || now - existing.startedAt >= V4_RATE_WINDOW_MS
    ? { startedAt: now, count: 0, active: 0 }
    : existing;
  v4RequestWindows.set(key, state);
  if (state.count >= V4_RATE_MAX) return { ok: false as const, reason: "rate" as const, retryAfterSeconds: Math.max(1, Math.ceil((state.startedAt + V4_RATE_WINDOW_MS - now) / 1000)) };
  if (state.active >= V4_CONCURRENT_MAX) return { ok: false as const, reason: "concurrency" as const, retryAfterSeconds: 5 };
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
  conversationId: z.string().trim().min(1).max(120).optional().nullable(),
  messages: z.array(z.object({
    role: z.enum(["user", "assistant"]),
    content: z.string().trim().min(1).max(6000),
  })).min(1).max(10),
});

function json(payload: unknown, status = 200) {
  const response = NextResponse.json(payload, { status });
  response.headers.set("cache-control", "private, no-store, max-age=0");
  response.headers.set("x-robots-tag", "noindex, nofollow, noarchive");
  response.headers.set("x-ask-sales-runtime", "v4-isolated");
  return response;
}

export async function GET() {
  if (!isV4IsolatedRuntimeEnabled()) return new NextResponse(null, { status: 404 });
  const provider = getV4ProviderReadiness();
  const accessTokenConfigured = (process.env.ASK_SALES_V4_LAB_TOKEN || "").length >= 24;
  const modelAccessConfirmed = process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED === "true";
  return json({
    ok: true,
    ready: accessTokenConfigured && provider.modelConfigured && modelAccessConfirmed,
    runtime: "v4-isolated",
    persistence: false,
    productionSelectorChanged: false,
    accessTokenConfigured,
    modelAccessConfirmed,
    ...provider,
  });
}

export async function POST(request: NextRequest) {
  if (!isV4IsolatedRuntimeEnabled()) return new NextResponse(null, { status: 404 });
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > V4_MAX_BODY_BYTES) {
    return json({ ok: false, error: "The isolated test request exceeds the 70 KB limit." }, 413);
  }
  const labToken = request.headers.get("x-ask-sales-v4-token");
  if (!isV4LabTokenAuthorized(labToken)) {
    return json({ ok: false, error: "Invalid or missing V4 lab access token." }, 401);
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (Buffer.byteLength(rawBody, "utf8") > V4_MAX_BODY_BYTES) {
      return json({ ok: false, error: "The isolated test request exceeds the 70 KB limit." }, 413);
    }
    body = JSON.parse(rawBody) as unknown;
  } catch {
    return json({ ok: false, error: "The isolated test request contains malformed JSON." }, 400);
  }

  try {
    assertV4IsolatedRuntime();
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return json({ ok: false, error: "The isolated test request was malformed or too large." }, 400);
    const messages = parsed.data.messages.map((message) => ({ role: message.role, content: message.content.trim() }));
    const last = messages.at(-1);
    if (!last || last.role !== "user") return json({ ok: false, error: "The final message must be a user question." }, 400);
    if (process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED !== "true") {
      return json({ ok: false, error: "The isolated model transport is configured but has not passed a live access check." }, 503);
    }

    const reservation = reserveV4LabRequest(labToken!);
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
      const result = await runAskSalesFaqV4(last.content, messages, {
        provider: generateV4Json,
        validatorProvider: generateV4ValidationJson,
      });
      return json({
        ...result,
        conversationId: parsed.data.conversationId || `v4_lab_${randomUUID()}`,
        messageId: `v4_lab_assistant_${randomUUID()}`,
      });
    } finally {
      reservation.release();
    }
  } catch (error) {
    console.error("Ask Sales V4 isolated request failed", error instanceof Error ? error.message : "unknown error");
    return json({
      ok: false,
      error: "The isolated V4 runtime failed safely. No production request or database write was attempted.",
    }, 503);
  }
}
