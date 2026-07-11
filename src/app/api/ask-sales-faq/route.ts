import { createHash, randomUUID } from "crypto";
import { after, NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess } from "@/lib/ask-sales-faq/access";
import { runSelectedAskSalesFaq } from "@/lib/ask-sales-faq/runtime-selector";
import type { AskSalesFaqLogPayload, AskSalesFaqResponse } from "@/lib/ask-sales-faq/types";
import {
  checkAskSalesFaqRateLimit,
  completeAskSalesFaqRequest,
  ensureAskSalesFaqStorage,
  failAskSalesFaqRequest,
  reserveAskSalesFaqRequest,
  saveAskSalesFaqDiagnostic,
  saveAskSalesFaqExchange,
  type AskSalesFaqRateLimitStatus,
} from "@/lib/db";

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
  const clientRequestId = normalizeClientRequestId(payload.clientRequestId) || `server_${randomUUID()}`;
  const requestGuardId = buildRequestGuardId(access.viewerEmail, clientRequestId);

  try {
    const storageReady = await ensureAskSalesFaqStorage();
    if (!storageReady) {
      return NextResponse.json(buildSafeConfiguredResponse(conversationId, assistantMessageId));
    }

    const requestGuard = await reserveAskSalesFaqRequest({
      id: requestGuardId,
      viewerEmail: access.viewerEmail,
      conversationId,
      clientRequestId,
    });

    if (requestGuard.state === "existing") {
      if (requestGuard.response) {
        const replayed = NextResponse.json(requestGuard.response);
        replayed.headers.set("X-Ask-Sales-FAQ-Replayed", "true");
        if (requestGuard.status === "rate_limited") replayed.headers.set("Retry-After", "60");
        return replayed;
      }

      if (requestGuard.status === "failed") {
        return NextResponse.json(buildSafeConfiguredResponse(conversationId, assistantMessageId));
      }

      return NextResponse.json(buildDuplicateInProgressResponse(conversationId, assistantMessageId));
    }

    const rateLimit = await checkAskSalesFaqRateLimit(access.viewerEmail);
    if (rateLimit.limited) {
      const rateLimitedResponse = buildRateLimitedResponse(conversationId, assistantMessageId, rateLimit);
      await failAskSalesFaqRequest({
        id: requestGuardId,
        status: "rate_limited",
        assistantMessageId,
        response: rateLimitedResponse,
        errorClass: `rate_limited_${rateLimit.scope}`,
      });
      after(() =>
        logDiagnostic({
          conversationId,
          viewerEmail: access.viewerEmail,
          viewerName: access.viewerName,
          eventType: "rate_limited",
          detail: rateLimit.scope === "user" ? "Per-rep Ask Sales FAQ usage protection triggered." : "Global Ask Sales FAQ usage protection triggered.",
          metadata: {
            scope: rateLimit.scope,
            userCount: rateLimit.userCount,
            userLimit: rateLimit.userLimit,
            userWindowMinutes: rateLimit.userWindowMinutes,
            globalCount: rateLimit.globalCount,
            globalLimit: rateLimit.globalLimit,
            globalWindowSeconds: rateLimit.globalWindowSeconds,
          },
        }),
      );

      const limited = NextResponse.json(rateLimitedResponse);
      limited.headers.set("Retry-After", String(rateLimit.retryAfterSeconds));
      return limited;
    }

    const result = await runSelectedAskSalesFaq(lastMessage.content, messages);
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

    try {
      await completeAskSalesFaqRequest({
        id: requestGuardId,
        assistantMessageId,
        response,
      });
    } catch (error) {
      console.error("Ask Sales FAQ request guard completion failed", error);
    }

    scheduleExchangeSave({
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
      runtimeMetadata: result.runtimeMetadata,
    });

    return NextResponse.json(response);
  } catch (error) {
    console.error("Ask Sales FAQ request failed", error);
    await failAskSalesFaqRequest({
      id: requestGuardId,
      status: "failed",
      assistantMessageId,
      errorClass: error instanceof Error ? error.name : "runtime_error",
    }).catch((guardError) => {
      console.error("Ask Sales FAQ request guard failure update failed", guardError);
    });
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

function normalizeClientRequestId(value: string | null | undefined) {
  const normalized = (value || "").trim();
  if (!normalized) return null;
  return normalized.replace(/[^a-zA-Z0-9._:-]/g, "").slice(0, 120) || null;
}

function buildRequestGuardId(viewerEmail: string, clientRequestId: string) {
  const digest = createHash("sha256").update(`${viewerEmail}:${clientRequestId}`).digest("hex").slice(0, 48);
  return `askfaq_req_${digest}`;
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

function scheduleExchangeSave(payload: AskSalesFaqLogPayload) {
  after(async () => {
    try {
      await saveAskSalesFaqExchange(payload);
    } catch (error) {
      console.error("Ask Sales FAQ exchange logging failed after answer generation", error);
      await logDiagnostic({
        conversationId: payload.conversationId,
        viewerEmail: payload.viewerEmail,
        viewerName: payload.viewerName,
        eventType: "exchange_logging_failed",
        detail: "Ask Sales FAQ generated an answer, but message history logging failed.",
        metadata: {
          assistantMessageId: payload.assistantMessageId,
          outcome: payload.outcome,
          error: error instanceof Error ? error.message : "unknown",
        },
      });
    }
  });
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

function buildDuplicateInProgressResponse(conversationId: string, messageId: string): AskSalesFaqResponse {
  const answer =
    "I am already working on that question. Please wait for the current answer instead of sending it again.";
  return {
    ok: true,
    conversationId,
    messageId,
    answer,
    structuredAnswer: {
      summary: answer,
      sections: [
        {
          title: "What to do",
          items: ["Wait for the current answer to finish.", "If you typed another question, send it after this answer is done."],
          tone: "default",
        },
      ],
      confidenceLabel: "Low",
      confidenceScore: 0,
      sourceMode: "fallback",
    },
    outcome: "duplicate_in_progress",
    source: null,
    model: null,
    provider: null,
    needsRoute: false,
    routeReason: null,
    redactions: [],
    latencyMs: 0,
  };
}

function buildRateLimitedResponse(
  conversationId: string,
  messageId: string,
  rateLimit: Extract<AskSalesFaqRateLimitStatus, { limited: true }>,
): AskSalesFaqResponse {
  const answer =
    rateLimit.scope === "user"
      ? "You have sent a lot of questions in a short time. Please wait a few minutes and try again. If you are live with a prospect and this is urgent, route the question instead of guessing."
      : "Ask Sales FAQ is getting a lot of questions at once. Please wait a minute and try again. If you are live with a prospect and this is urgent, route the question instead of guessing.";
  return {
    ok: true,
    conversationId,
    messageId,
    answer,
    structuredAnswer: {
      summary: answer,
      sections: [
        {
          title: "What to do",
          items:
            rateLimit.scope === "user"
              ? ["Wait a few minutes before asking another question.", "Route urgent live-call questions instead of guessing."]
              : ["Wait a minute before trying again.", "Route urgent live-call questions instead of guessing."],
          tone: "route",
        },
      ],
      confidenceLabel: "Low",
      confidenceScore: 0,
      sourceMode: "fallback",
    },
    outcome: "rate_limited",
    source: null,
    model: null,
    provider: null,
    needsRoute: true,
    routeReason:
      rateLimit.scope === "user"
        ? "Temporary per-rep usage protection is active."
        : "Temporary company-wide usage protection is active.",
    redactions: [],
    latencyMs: 0,
  };
}

function buildSafeConfiguredResponse(conversationId: string, messageId: string): AskSalesFaqResponse {
  const answer =
    "Ask Sales FAQ is having trouble right now. Please try again in a few moments. If you are live with a prospect and this is urgent, route the question instead of guessing.";
  return {
    ok: true,
    conversationId,
    messageId,
    answer,
    structuredAnswer: {
      summary: answer,
      sections: [
        {
          title: "What to do",
          items: ["Try again in a few moments.", "Route urgent live-call questions instead of guessing."],
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
    routeReason: "Ask Sales FAQ is temporarily unavailable.",
    redactions: [],
    latencyMs: 0,
  };
}
