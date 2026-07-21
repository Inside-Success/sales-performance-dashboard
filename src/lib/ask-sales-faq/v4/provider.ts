import { generateText, gateway, Output } from "ai";

import type { V3Provider, V3ProviderAttempt, V3ProviderInput, V3ProviderResult } from "@/lib/ask-sales-faq/v3/types";

const DEFAULT_GATEWAY_MODEL = "deepseek/deepseek-v4-pro";

export class V4ProviderExecutionError extends Error {
  readonly attempts: V3ProviderAttempt[];

  constructor(message: string, attempts: V3ProviderAttempt[]) {
    super(message);
    this.name = "V4ProviderExecutionError";
    this.attempts = attempts.map((attempt) => ({ ...attempt }));
  }
}

export function providerAttemptsFromV4Error(error: unknown) {
  return error instanceof V4ProviderExecutionError ? error.attempts.map((attempt) => ({ ...attempt })) : [];
}

function isGatewayEnabled() {
  return process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY === "true";
}

export function isV4ModelConfigured() {
  return getV4ProviderReadiness().modelConfigured;
}

export function getV4ProviderReadiness() {
  if (isGatewayEnabled()) {
    return {
      modelConfigured: Boolean(process.env.VERCEL_OIDC_TOKEN),
      provider: "deepseek" as const,
      model: process.env.FAQ_V4_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL,
      maxModelCallSeconds: 32,
      maxRequestSeconds: 96,
      deepSeekRetries: 0 as const,
      transport: "vercel_ai_gateway" as const,
    };
  }
  const modelConfigured = Boolean(process.env.DEEPSEEK_API_KEY);
  return {
    modelConfigured,
    provider: modelConfigured ? "deepseek" as const : null,
    model: modelConfigured ? process.env.FAQ_V4_DEEPSEEK_MODEL || "deepseek-v4-pro" : null,
    maxModelCallSeconds: directTimeoutSeconds(),
    maxRequestSeconds: 105,
    deepSeekRetries: 0 as const,
    transport: modelConfigured ? "direct" as const : null,
  };
}

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|x-api-key|oidc[_-]?token)["'\s:=]+[^\s"']+/gi, "credential=[redacted]")
    .slice(0, 500);
}

function directTimeoutSeconds() {
  const configured = Number.parseInt(process.env.FAQ_V4_MODEL_TIMEOUT_SECONDS || "", 10);
  return Number.isFinite(configured) ? Math.max(5, Math.min(configured, 35)) : 35;
}

async function responseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function directDeepSeekCall<T>(input: V3ProviderInput<T>): Promise<V3ProviderResult<T>> {
  const key = process.env.DEEPSEEK_API_KEY;
  if (!key) throw new V4ProviderExecutionError("No V4 isolated answer provider succeeded (no provider configured)", []);

  const model = process.env.FAQ_V4_DEEPSEEK_MODEL || "deepseek-v4-pro";
  const temperature = /(?:plan|validation)/.test(input.purpose) ? 0 : 0.1;
  const startedAt = Date.now();
  const attempts: V3ProviderAttempt[] = [];
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), directTimeoutSeconds() * 1000);
  try {
    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
      body: JSON.stringify({
        model,
        max_tokens: input.maxTokens,
        temperature,
        response_format: { type: "json_object" },
        thinking: { type: "disabled" },
        messages: [
          { role: "system", content: input.system },
          { role: "user", content: input.user },
        ],
      }),
      signal: controller.signal,
    });
    const data = (await responseJson(response)) as {
      choices?: Array<{ message?: { content?: string } }>;
      error?: { message?: string };
      usage?: { completion_tokens?: number; total_tokens?: number };
    } | null;
    if (!response.ok) throw new Error(data?.error?.message || `DeepSeek request failed with HTTP ${response.status}`);
    const output = input.parse(data?.choices?.[0]?.message?.content || "");
    attempts.push({
      provider: "deepseek",
      model,
      purpose: input.purpose,
      status: "success",
      latencyMs: Date.now() - startedAt,
      promptChars: input.system.length + input.user.length,
      completionTokens: data?.usage?.completion_tokens,
      totalTokens: data?.usage?.total_tokens,
      reasoningMode: "disabled",
      temperature,
    });
    return { output, provider: "deepseek", model, attempts };
  } catch (error) {
    attempts.push({
      provider: "deepseek",
      model,
      purpose: input.purpose,
      status: "failed",
      latencyMs: Date.now() - startedAt,
      error: sanitizeError(error),
      reasoningMode: "disabled",
      temperature,
    });
    throw new V4ProviderExecutionError(`V4 direct DeepSeek request failed: ${sanitizeError(error)}`, attempts);
  } finally {
    clearTimeout(timeout);
  }
}

async function gatewayDeepSeekCall<T>(input: V3ProviderInput<T>): Promise<V3ProviderResult<T>> {
  const model = process.env.FAQ_V4_GATEWAY_MODEL || DEFAULT_GATEWAY_MODEL;
  const temperature = /(?:plan|validation)/.test(input.purpose) ? 0 : 0.1;
  const startedAt = Date.now();
  const attempts: V3ProviderAttempt[] = [];

  try {
    const result = await generateText({
      model: gateway(model),
      system: input.system,
      prompt: input.user,
      maxOutputTokens: input.maxTokens,
      temperature,
      maxRetries: 0,
      timeout: 32_000,
      output: Output.json({ name: "ask_sales_v4_json" }),
      providerOptions: {
        gateway: {
          only: ["deepseek"],
          user: "ask-sales-v4-isolated",
          tags: ["feature:ask-sales-v4-isolated", "environment:preview"],
        },
      },
    });
    const latencyMs = Date.now() - startedAt;
    const output = input.parse(JSON.stringify(result.output));
    attempts.push({
      provider: "deepseek",
      model,
      purpose: input.purpose,
      status: "success",
      latencyMs,
      promptChars: input.system.length + input.user.length,
      completionTokens: result.usage.outputTokens,
      totalTokens: result.usage.totalTokens,
      reasoningMode: "disabled",
      temperature,
    });
    return { output, provider: "deepseek", model, attempts };
  } catch (error) {
    attempts.push({
      provider: "deepseek",
      model,
      purpose: input.purpose,
      status: "failed",
      latencyMs: Date.now() - startedAt,
      error: sanitizeError(error),
      reasoningMode: "disabled",
      temperature,
    });
    throw new V4ProviderExecutionError(`V4 Vercel AI Gateway request failed: ${sanitizeError(error)}`, attempts);
  }
}

export const generateV4Json: V3Provider = async <T>(input: V3ProviderInput<T>) => {
  if (isGatewayEnabled()) {
    if (!process.env.VERCEL_OIDC_TOKEN) throw new Error("V4 Vercel AI Gateway is enabled but its project OIDC token is unavailable");
    return gatewayDeepSeekCall(input);
  }
  return directDeepSeekCall(input);
};

export const generateV4ValidationJson: V3Provider = async <T>(input: V3ProviderInput<T>) => {
  if (isGatewayEnabled()) {
    if (!process.env.VERCEL_OIDC_TOKEN) throw new Error("V4 Vercel AI Gateway is enabled but its project OIDC token is unavailable");
    return gatewayDeepSeekCall(input);
  }
  return directDeepSeekCall(input);
};
