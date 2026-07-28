import type {
  AskSalesFaqChatMessage,
  AskSalesFaqOutcome,
  AskSalesFaqRuntimeMetadata,
  AskSalesFaqSourceSummary,
} from "@/lib/ask-sales-faq/types";
import type { AskSalesFaqRuntimeResult } from "@/lib/ask-sales-faq/runtime";
import { sanitizeV4SensitiveText } from "@/lib/ask-sales-faq/v4/privacy";
import {
  generateV514ProductionJson,
  generateV514ProductionValidationJson,
} from "@/lib/ask-sales-faq/v4/provider";
import type { AskSalesFaqV4Result } from "@/lib/ask-sales-faq/v4/types";
import { runAskSalesFaqV514, v514PolicyById } from "@/lib/ask-sales-faq/v5-14/runtime";

function outcomeFor(result: AskSalesFaqV4Result): AskSalesFaqOutcome {
  if (result.lane === "conversation") return "conversation_reply";
  if (result.lane === "answer" && !result.needsRoute) return "answer_from_evidence";
  if (result.lane === "partial" || result.needsRoute) return "route_from_evidence";
  if (result.citations.length) return "route_from_evidence";
  return "low_confidence_route";
}

function sourceFor(result: AskSalesFaqV4Result): AskSalesFaqSourceSummary | null {
  if (!result.citations.length) return null;
  const confidenceScore = result.structuredAnswer.confidenceScore;
  return {
    label: result.citations.length === 1
      ? result.citations[0].title
      : `${result.citations.length} applicable policy records`,
    lastReviewed: result.citations.map((citation) => citation.lastReviewed).filter(Boolean).sort().at(-1) || "",
    approved: true,
    sourceMode: result.structuredAnswer.sourceMode,
    confidenceLabel: result.structuredAnswer.confidenceLabel,
    confidenceScore,
    expandableDetails: `Knowledge ${result.runtimeMetadata.knowledgeVersion}; selected policies: ${result.selectedPolicyIds.join(", ")}`,
  };
}

function productionMetadata(result: AskSalesFaqV4Result): AskSalesFaqRuntimeMetadata {
  return {
    pipelineVersion: "v5.14",
    knowledgeVersion: result.runtimeMetadata.knowledgeVersion,
    providerAttempts: result.runtimeMetadata.providerAttempts.map((attempt) => ({
      provider: attempt.provider,
      model: attempt.model,
      purpose: attempt.purpose,
      status: attempt.status,
      latencyMs: attempt.latencyMs,
      error: attempt.error,
      completionTokens: attempt.completionTokens,
      totalTokens: attempt.totalTokens,
    })),
    v5: {
      ...result.runtimeMetadata,
      production: {
        selectorVersion: "v5.14",
        authenticatedRoute: true,
        databasePersistence: true,
      },
    },
  };
}

export async function runAskSalesFaqV514Production(
  question: string,
  messages: AskSalesFaqChatMessage[] = [],
): Promise<AskSalesFaqRuntimeResult> {
  // Sanitize before dispatch so the deterministic direct lane and model-backed
  // lane have the same privacy boundary and logs never regain raw identifiers.
  const safeQuestion = sanitizeV4SensitiveText(question, 12_000);
  const safeMessages = messages.map((message) => {
    const sanitized = sanitizeV4SensitiveText(message.content, 12_000);
    return { role: message.role, content: sanitized.text, redactions: sanitized.redactions };
  });
  const result = await runAskSalesFaqV514(
    safeQuestion.text,
    safeMessages.map(({ role, content }) => ({ role, content })),
    {
      provider: generateV514ProductionJson,
      validatorProvider: generateV514ProductionValidationJson,
    },
  );
  const selectedPolicies = result.selectedPolicyIds
    .map(v514PolicyById)
    .filter((policy) => Boolean(policy));
  const matchedArticleId = selectedPolicies.find((policy) => policy?.source.article_id)?.source.article_id || null;
  const redactions = [...new Set([
    ...safeQuestion.redactions,
    ...safeMessages.flatMap((message) => message.redactions),
    ...result.redactions,
  ])];
  const failedAttempts = result.runtimeMetadata.providerAttempts.filter((attempt) => attempt.status === "failed");
  const successfulAttempts = result.runtimeMetadata.providerAttempts.filter((attempt) => attempt.status === "success");

  return {
    ok: true,
    conversationId: "",
    messageId: "",
    answer: result.answer,
    structuredAnswer: result.structuredAnswer,
    outcome: outcomeFor(result),
    source: sourceFor(result),
    model: result.model,
    provider: result.provider,
    needsRoute: result.needsRoute || ["partial", "clarify", "live_lookup", "artifact", "route"].includes(result.lane),
    routeReason: result.routeReason,
    redactions,
    latencyMs: result.latencyMs,
    sanitizedQuestion: safeQuestion.text,
    contextualQuestion: result.runtimeMetadata.turn.standaloneQuestion,
    matchedArticleId,
    errorClass: failedAttempts.length && !successfulAttempts.length ? "v5_14_provider_unavailable" : null,
    runtimeMetadata: productionMetadata(result),
  };
}
