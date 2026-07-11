import type { V3Provider, V3ProviderAttempt, V3ProviderInput, V3ProviderResult } from "@/lib/ask-sales-faq/v3/types";

function sanitizeError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  return message
    .replace(/Bearer\s+\S+/gi, "Bearer [redacted]")
    .replace(/(?:api[_-]?key|x-api-key)["'\s:=]+[^\s"']+/gi, "api-key=[redacted]")
    .slice(0, 500);
}

function extractJsonObject(value: string) {
  const fenced = value.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const text = (fenced || value).trim();
  const start = text.indexOf("{");
  if (start < 0) return text;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const char = text[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') inString = !inString;
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return text;
}

async function fetchWithTimeout(url: string, init: RequestInit) {
  const configured = Number.parseInt(process.env.FAQ_MODEL_TIMEOUT_SECONDS || "", 10);
  const timeoutSeconds = Number.isFinite(configured) ? Math.max(15, Math.min(configured, 110)) : 75;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutSeconds * 1000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

async function parseResponseJson(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

async function deepSeekCall<T>(input: V3ProviderInput<T>, key: string, attempts: V3ProviderAttempt[]): Promise<V3ProviderResult<T>> {
  const model = process.env.FAQ_V3_DEEPSEEK_MODEL || process.env.FAQ_DEEPSEEK_MODEL || "deepseek-v4-pro";
  const thinkingEnabled = process.env.FAQ_DEEPSEEK_DISABLE_THINKING === "false";
  const temperature = /(?:semantic_recall|evidence_selection|grounding_validation)/.test(input.purpose) ? 0 : 0.2;
  const startedAt = Date.now();
  const response = await fetchWithTimeout("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${key}`, "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens,
      temperature,
      response_format: { type: "json_object" },
      thinking: { type: thinkingEnabled ? "enabled" : "disabled" },
      ...(thinkingEnabled ? { reasoning_effort: "high" } : {}),
      messages: [
        { role: "system", content: input.system },
        { role: "user", content: input.user },
      ],
    }),
  });
  const data = (await parseResponseJson(response)) as {
    choices?: Array<{ message?: { content?: string } }>;
    error?: { message?: string };
    usage?: { completion_tokens?: number; total_tokens?: number };
  } | null;
  const latencyMs = Date.now() - startedAt;
  if (!response.ok) {
    const error = data?.error?.message || `DeepSeek request failed with HTTP ${response.status}`;
    attempts.push({ provider: "deepseek", model, purpose: input.purpose, status: "failed", latencyMs, error: sanitizeError(error), reasoningMode: thinkingEnabled ? "enabled" : "disabled", temperature });
    throw new Error(error);
  }
  try {
    const content = data?.choices?.[0]?.message?.content || "";
    const output = input.parse(extractJsonObject(content));
    attempts.push({
      provider: "deepseek",
      model,
      purpose: input.purpose,
      status: "success",
      latencyMs,
      promptChars: input.system.length + input.user.length,
      completionTokens: data?.usage?.completion_tokens,
      totalTokens: data?.usage?.total_tokens,
      reasoningMode: thinkingEnabled ? "enabled" : "disabled",
      temperature,
    });
    return { output, provider: "deepseek" as const, model, attempts };
  } catch (error) {
    attempts.push({ provider: "deepseek", model, purpose: input.purpose, status: "failed", latencyMs, error: sanitizeError(error), reasoningMode: thinkingEnabled ? "enabled" : "disabled", temperature });
    throw error;
  }
}

async function anthropicCall<T>(input: V3ProviderInput<T>, key: string, attempts: V3ProviderAttempt[]): Promise<V3ProviderResult<T>> {
  const model = process.env.FAQ_V3_CLAUDE_MODEL || process.env.FAQ_CLAUDE_MODEL || "claude-sonnet-4-6";
  const startedAt = Date.now();
  const response = await fetchWithTimeout("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "x-api-key": key, "anthropic-version": "2023-06-01", "content-type": "application/json" },
    body: JSON.stringify({
      model,
      max_tokens: input.maxTokens,
      temperature: 0.1,
      system: input.system,
      messages: [{ role: "user", content: input.user }],
    }),
  });
  const data = (await parseResponseJson(response)) as {
    content?: Array<{ type?: string; text?: string }>;
    error?: { message?: string };
    usage?: { output_tokens?: number; input_tokens?: number };
  } | null;
  const latencyMs = Date.now() - startedAt;
  if (!response.ok) {
    const error = data?.error?.message || `Anthropic request failed with HTTP ${response.status}`;
    attempts.push({ provider: "anthropic", model, purpose: input.purpose, status: "failed", latencyMs, error: sanitizeError(error) });
    throw new Error(error);
  }
  try {
    const content = data?.content?.find((part) => part.type === "text")?.text || "";
    const output = input.parse(extractJsonObject(content));
    attempts.push({
      provider: "anthropic",
      model,
      purpose: input.purpose,
      status: "success",
      latencyMs,
      promptChars: input.system.length + input.user.length,
      completionTokens: data?.usage?.output_tokens,
      totalTokens: (data?.usage?.input_tokens || 0) + (data?.usage?.output_tokens || 0),
    });
    return { output, provider: "anthropic" as const, model, attempts };
  } catch (error) {
    attempts.push({ provider: "anthropic", model, purpose: input.purpose, status: "failed", latencyMs, error: sanitizeError(error) });
    throw error;
  }
}

function shouldRetryDeepSeek(error: unknown) {
  const message = sanitizeError(error).toLowerCase();
  return !/(?:authentication|unauthorized|invalid api key|http 400|http 401|http 403)/.test(message);
}

async function deepSeekCallWithRetry<T>(input: V3ProviderInput<T>, key: string, attempts: V3ProviderAttempt[]) {
  try {
    return await deepSeekCall<T>(input, key, attempts);
  } catch (error) {
    if (!shouldRetryDeepSeek(error)) throw error;
    return deepSeekCall<T>(input, key, attempts);
  }
}

export const generateV3Json: V3Provider = async <T>(input: V3ProviderInput<T>): Promise<V3ProviderResult<T>> => {
  const attempts: V3ProviderAttempt[] = [];
  const errors: string[] = [];
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      return await deepSeekCallWithRetry<T>(input, process.env.DEEPSEEK_API_KEY, attempts);
    } catch (error) {
      errors.push(`deepseek: ${sanitizeError(error)}`);
    }
  }
  if (process.env.ANTHROPIC_API_KEY && process.env.FAQ_ALLOW_CLAUDE_FALLBACK === "true") {
    try {
      return await anthropicCall<T>(input, process.env.ANTHROPIC_API_KEY, attempts);
    } catch (error) {
      errors.push(`anthropic: ${sanitizeError(error)}`);
    }
  }
  throw new Error(`No V3 answer provider succeeded (${errors.join(" | ") || "no provider configured"})`);
};

export const generateV3ValidationJson: V3Provider = async <T>(input: V3ProviderInput<T>): Promise<V3ProviderResult<T>> => {
  const attempts: V3ProviderAttempt[] = [];
  const errors: string[] = [];
  if (process.env.DEEPSEEK_API_KEY) {
    try {
      return await deepSeekCallWithRetry<T>(input, process.env.DEEPSEEK_API_KEY, attempts);
    } catch (error) {
      errors.push(`deepseek: ${sanitizeError(error)}`);
    }
  }
  if (process.env.ANTHROPIC_API_KEY && process.env.FAQ_ALLOW_CLAUDE_FALLBACK === "true") {
    try {
      return await anthropicCall<T>(input, process.env.ANTHROPIC_API_KEY, attempts);
    } catch (error) {
      errors.push(`anthropic: ${sanitizeError(error)}`);
    }
  }
  throw new Error(`No V3 validation provider succeeded (${errors.join(" | ") || "no provider configured"})`);
};

export function parseV3Json<T>(content: string): T {
  return JSON.parse(extractJsonObject(content)) as T;
}
