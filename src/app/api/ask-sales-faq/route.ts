import { randomUUID } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess } from "@/lib/ask-sales-faq/access";
import { runAskSalesFaq } from "@/lib/ask-sales-faq/runtime";
import type { AskSalesFaqResponse } from "@/lib/ask-sales-faq/types";
import { ensureAskSalesFaqStorage, saveAskSalesFaqDiagnostic, saveAskSalesFaqExchange } from "@/lib/db";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_INBOUND_MESSAGES = 200;
const MAX_RUNTIME_MESSAGES = 10;
const MAX_RUNTIME_MESSAGE_CHARS = 2000;

const requestSchema = z.object({
  conversationId: z.string().trim().min(1).max(120).optional().nullable(),
  clientRequestId: z.string().trim().max(120).optional().nullable(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().trim().min(1).max(12000),
      }),
    )
    .min(1)
    .max(MAX_INBOUND_MESSAGES),
});

export async function POST(request: NextRequest) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);

  if (!access.ok) {
    return NextResponse.json({ ok: false, error: access.message, code: access.code }, { status: access.status });
  }

  let rawPayload: unknown;
  try {
    rawPayload = await request.json();
  } catch (error) {
    const conversationId = `faq_${randomUUID()}`;
    const assistantMessageId = `faq_assistant_${randomUUID()}`;
    await logDiagnostic({
      conversationId,
      viewerEmail: access.viewerEmail,
      viewerName: access.viewerName,
      eventType: "invalid_json",
      detail: "Request body was not valid JSON.",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return NextResponse.json(buildSafeValidationResponse(conversationId, assistantMessageId, "Request body was not valid JSON."));
  }

  const parsedPayload = requestSchema.safeParse(rawPayload);
  if (!parsedPayload.success) {
    const conversationId = extractConversationId(rawPayload) || `faq_${randomUUID()}`;
    const assistantMessageId = `faq_assistant_${randomUUID()}`;
    await logDiagnostic({
      conversationId,
      viewerEmail: access.viewerEmail,
      viewerName: access.viewerName,
      eventType: "validation_error",
      detail: "Request payload failed Ask Sales FAQ validation.",
      metadata: summarizePayloadIssue(rawPayload, parsedPayload.error),
    });
    return NextResponse.json(
      buildSafeValidationResponse(
        conversationId,
        assistantMessageId,
        "The message payload was too large or malformed. Ask the question again in a shorter form.",
      ),
    );
  }
  const payload = parsedPayload.data;

  const messages = normalizeRuntimeMessages(payload.messages);
  const lastMessage = messages.at(-1);

  if (!lastMessage || lastMessage.role !== "user") {
    return NextResponse.json(
      { ok: false, error: "Send a question before asking Ask Sales FAQ.", code: "validation_error" },
      { status: 400 },
    );
  }

  const conversationId = payload.conversationId || `faq_${randomUUID()}`;
  const userMessageId = `faq_user_${randomUUID()}`;
  const assistantMessageId = `faq_assistant_${randomUUID()}`;

  try {
    const storageReady = await ensureAskSalesFaqStorage();
    if (!storageReady) {
      return NextResponse.json(buildSafeConfiguredResponse(conversationId, assistantMessageId));
    }

    const result = await runAskSalesFaq(lastMessage.content, messages);
    const response: AskSalesFaqResponse = {
      ok: true,
      conversationId,
      messageId: assistantMessageId,
      answer: result.answer,
      structuredAnswer: result.structuredAnswer,
      outcome: result.outcome,
      source: result.source,
      model: result.model,
      provider: result.provider,
      needsRoute: result.needsRoute,
      routeReason: result.routeReason,
      redactions: result.redactions,
      latencyMs: result.latencyMs,
    };

    await saveAskSalesFaqExchange({
      conversationId,
      userMessageId,
      assistantMessageId,
      viewerEmail: access.viewerEmail,
      viewerName: access.viewerName,
      title: buildConversationTitle(result.sanitizedQuestion),
      questionRedacted: result.sanitizedQuestion,
      answerRedacted: result.answer,
      redactions: result.redactions,
      outcome: result.outcome,
      matchedArticleId: result.matchedArticleId,
      sourceLabel: result.source?.label || null,
      sourceLastReviewed: result.source?.lastReviewed || null,
      structuredAnswer: result.structuredAnswer,
      needsRoute: result.needsRoute,
      routeReason: result.routeReason,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
      errorClass: result.errorClass,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Ask Sales FAQ request failed", error);
    await logDiagnostic({
      conversationId,
      viewerEmail: access.viewerEmail,
      viewerName: access.viewerName,
      eventType: "runtime_error",
      detail: "Ask Sales FAQ request failed after validation.",
      metadata: { error: error instanceof Error ? error.message : "unknown" },
    });
    return NextResponse.json(buildSafeConfiguredResponse(conversationId, assistantMessageId));
  }
}

function normalizeRuntimeMessages(messages: z.infer<typeof requestSchema>["messages"]) {
  return messages
    .filter((message) => message.role === "user" || message.role === "assistant")
    .slice(-MAX_RUNTIME_MESSAGES)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, MAX_RUNTIME_MESSAGE_CHARS),
    }))
    .filter((message) => message.content.length > 0);
}

function buildConversationTitle(question: string) {
  const words = question.replace(/\s+/g, " ").trim().split(" ").filter(Boolean).slice(0, 9);
  const title = words.join(" ");
  return title.length > 4 ? title : "Ask Sales FAQ chat";
}

function extractConversationId(payload: unknown) {
  if (!payload || typeof payload !== "object") return null;
  const value = (payload as { conversationId?: unknown }).conversationId;
  return typeof value === "string" && value.trim().length > 0 ? value.trim().slice(0, 120) : null;
}

function summarizePayloadIssue(payload: unknown, error: z.ZodError) {
  const messages = payload && typeof payload === "object" ? (payload as { messages?: unknown }).messages : undefined;
  const messageList = Array.isArray(messages) ? messages : [];
  const totalChars = messageList.reduce((sum, message) => {
    if (!message || typeof message !== "object") return sum;
    const content = (message as { content?: unknown }).content;
    return sum + (typeof content === "string" ? content.length : 0);
  }, 0);

  return {
    messageCount: messageList.length,
    totalChars,
    lastRole:
      messageList.length && typeof messageList.at(-1) === "object"
        ? (messageList.at(-1) as { role?: unknown }).role || null
        : null,
    issues: error.issues.map((issue) => ({
      path: issue.path.join("."),
      code: issue.code,
      message: issue.message,
    })),
  };
}

async function logDiagnostic(payload: {
  conversationId: string;
  viewerEmail: string;
  viewerName: string | null;
  eventType: string;
  detail: string;
  metadata: Record<string, unknown>;
}) {
  try {
    await saveAskSalesFaqDiagnostic({
      id: `diag_${randomUUID()}`,
      conversationId: payload.conversationId,
      viewerEmail: payload.viewerEmail,
      viewerName: payload.viewerName,
      eventType: payload.eventType,
      detail: payload.detail,
      metadata: payload.metadata,
    });
  } catch (error) {
    console.error("Ask Sales FAQ diagnostic logging failed", error);
  }
}

function buildSafeValidationResponse(conversationId: string, messageId: string, routeReason: string): AskSalesFaqResponse {
  return {
    ok: true,
    conversationId,
    messageId,
    answer:
      "I could not process that message cleanly. Please ask the question again in a shorter form, and do not guess from memory while this is being routed.",
    structuredAnswer: {
      summary:
        "I could not process that message cleanly. Please ask the question again in a shorter form, and do not guess from memory while this is being routed.",
      sections: [
        {
          title: "What to do",
          items: ["Ask the question again in a shorter form.", "If this is urgent, route it before replying to the prospect."],
          tone: "route",
        },
      ],
      confidenceLabel: "Low",
      confidenceScore: 0,
      sourceMode: "fallback",
    },
    outcome: "validation_error",
    source: null,
    model: null,
    provider: null,
    needsRoute: true,
    routeReason,
    redactions: [],
    latencyMs: 0,
  };
}

function buildSafeConfiguredResponse(conversationId: string, messageId: string): AskSalesFaqResponse {
  return {
    ok: true,
    conversationId,
    messageId,
    answer:
      "Ask Sales FAQ is not fully available right now, so do not rely on a generated answer. Route this to the current sales owner or the right help channel before replying.",
    structuredAnswer: {
      summary:
        "Ask Sales FAQ is not fully available right now, so do not rely on a generated answer. Route this to the current sales owner or the right help channel before replying.",
      sections: [
        {
          title: "What to do",
          items: ["Route this to the current sales owner or the right help channel.", "Do not guess before replying to the prospect."],
          tone: "route",
        },
      ],
      confidenceLabel: "Low",
      confidenceScore: 0,
      sourceMode: "fallback",
    },
    outcome: "safe_fallback",
    source: null,
    model: null,
    provider: null,
    needsRoute: true,
    routeReason: "Ask Sales FAQ storage or runtime configuration is not available.",
    redactions: [],
    latencyMs: 0,
  };
}
