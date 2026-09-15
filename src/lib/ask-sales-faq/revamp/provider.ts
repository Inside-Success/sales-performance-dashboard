import "server-only";
import { z } from "zod";
import { answerSchema, planSchema, type Attempt, type JsonProvider } from "./types";

export class RevampProviderError extends Error {
  constructor(public attempt: Attempt) { super(attempt.error); this.name = "RevampProviderError"; }
}

export function createRevampProvider(config: {
  provider: "openai" | "deepseek"; model: string; apiKey: string;
  timeoutMs?: number; fetcher?: typeof fetch;
  beforeCall?: (request: { promptChars: number; maxOutputTokens: number; purpose: string }) => Promise<void>;
  afterCall?: (attempt: Attempt) => Promise<void>;
}): JsonProvider {
  return async (system, input, purpose) => {
    const user = JSON.stringify(input);
    const maxOutputTokens = purpose === "plan" ? 1200 : 4800;
    const start = Date.now();
    const attempt: Attempt = { provider: config.provider, model: config.model, purpose, latencyMs: 0,
      status: "failed", inputTokens: 0, cachedTokens: 0, outputTokens: 0 };
    if (!config.apiKey) {
      attempt.error = "provider_not_configured";
      throw new RevampProviderError(attempt);
    }
    // Budget/accounting failures prevent dispatch and are not provider failures.
    await config.beforeCall?.({ promptChars: Buffer.byteLength(system + user, "utf8"), maxOutputTokens, purpose });
    let value: unknown;
    try {
      const response = await (config.fetcher || fetch)(config.provider === "openai"
        ? "https://api.openai.com/v1/chat/completions" : "https://api.deepseek.com/chat/completions", {
        method: "POST", headers: { "Authorization": `Bearer ${config.apiKey}`, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(config.timeoutMs ?? 18000),
        body: JSON.stringify({ model: config.model, messages: [{ role: "system", content: system }, { role: "user", content: user }],
          response_format: config.provider === "openai" ? {
            type: "json_schema", json_schema: { name: purpose === "plan" ? "intent_plan" : "sales_answer", strict: true,
              schema: z.toJSONSchema(purpose === "plan" ? planSchema : answerSchema, { target: "draft-7" }) },
          } : { type: "json_object" },
          ...(config.provider === "openai" ? { max_completion_tokens: maxOutputTokens, reasoning_effort: "medium", store: false }
            : { max_tokens: maxOutputTokens, thinking: { type: "disabled" }, temperature: 0 }),
        }),
      });
      // Do not log raw error bodies, request headers, keys, or provider echoes.
      if (!response.ok) throw new Error(response.status === 402 ? "provider_balance" : `provider_http_${response.status}`);
      const data = await response.json();
      attempt.inputTokens = data.usage?.prompt_tokens || 0;
      attempt.cachedTokens = data.usage?.prompt_tokens_details?.cached_tokens || data.usage?.prompt_cache_hit_tokens || 0;
      attempt.outputTokens = data.usage?.completion_tokens || 0;
      if (data.choices?.[0]?.finish_reason !== "stop") throw new Error("provider_incomplete_output");
      value = JSON.parse(data.choices[0].message.content);
      attempt.status = "success";
      attempt.latencyMs = Date.now() - start;

    } catch (error) {
      attempt.status = "failed";
      attempt.error = error instanceof Error && /^(provider_[a-z0-9_]+)$/.test(error.message)
        ? error.message : error instanceof Error && /timeout|abort/i.test(error.name) ? "provider_timeout" : "provider_invalid_response";
      attempt.latencyMs = Date.now() - start;
    }
    // Accounting runs once, outside the provider catch: a ledger failure must
    // never bill the same response twice or be mislabeled as a model failure.
    await config.afterCall?.(attempt);
    if (attempt.status === "failed") throw new RevampProviderError(attempt);
    return { value, attempt };
  };
}

export function configuredRevampProvider() {
  const provider = process.env.FAQ_REVAMP_PROVIDER === "openai" ? "openai" : "deepseek";
  return createRevampProvider({ provider,
    model: provider === "openai" ? (process.env.FAQ_REVAMP_OPENAI_MODEL || "gpt-5.6-luna") : (process.env.FAQ_DEEPSEEK_MODEL || "deepseek-v4-pro"),
    apiKey: provider === "openai" ? (process.env.OPENAI_API_KEY || "") : (process.env.DEEPSEEK_API_KEY || ""),
  });
}
