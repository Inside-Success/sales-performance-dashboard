import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  generateText: vi.fn(),
  gateway: vi.fn((model: string) => ({ model })),
}));

vi.mock("ai", () => ({
  generateText: mocks.generateText,
  gateway: mocks.gateway,
  Output: { json: vi.fn(() => ({ type: "json" })) },
}));
import { generateV4Json, generateV4ValidationJson, getV4ProviderReadiness, isV4ModelConfigured } from "@/lib/ask-sales-faq/v4/provider";

const original = {
  deepSeekKey: process.env.DEEPSEEK_API_KEY,
  gatewayFlag: process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY,
  oidc: process.env.VERCEL_OIDC_TOKEN,
  gatewayModel: process.env.FAQ_V4_GATEWAY_MODEL,
  directModel: process.env.FAQ_V4_DEEPSEEK_MODEL,
  directTimeout: process.env.FAQ_V4_MODEL_TIMEOUT_SECONDS,
  anthropicKey: process.env.ANTHROPIC_API_KEY,
};

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

function restore(name: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}

beforeEach(() => {
  delete process.env.DEEPSEEK_API_KEY;
  delete process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY;
  delete process.env.VERCEL_OIDC_TOKEN;
  delete process.env.FAQ_V4_GATEWAY_MODEL;
  delete process.env.FAQ_V4_DEEPSEEK_MODEL;
  delete process.env.FAQ_V4_MODEL_TIMEOUT_SECONDS;
  delete process.env.ANTHROPIC_API_KEY;
  mocks.generateText.mockReset();
  mocks.gateway.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
  restore("DEEPSEEK_API_KEY", original.deepSeekKey);
  restore("ASK_SALES_V4_USE_VERCEL_GATEWAY", original.gatewayFlag);
  restore("VERCEL_OIDC_TOKEN", original.oidc);
  restore("FAQ_V4_GATEWAY_MODEL", original.gatewayModel);
  restore("FAQ_V4_DEEPSEEK_MODEL", original.directModel);
  restore("FAQ_V4_MODEL_TIMEOUT_SECONDS", original.directTimeout);
  restore("ANTHROPIC_API_KEY", original.anthropicKey);
});

describe("Ask Sales V4 isolated provider", () => {
  it("uses project-scoped Vercel OIDC for one non-retrying DeepSeek Gateway call", async () => {
    process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY = "true";
    process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
    mocks.generateText.mockResolvedValue({
      output: { result: "ok" },
      usage: { outputTokens: 7, totalTokens: 19 },
    });

    const result = await generateV4Json({
      purpose: "v4_atomic_plan",
      system: "Return JSON only.",
      user: "Test",
      maxTokens: 200,
      parse: (content) => JSON.parse(content) as { result: string },
    });

    expect(isV4ModelConfigured()).toBe(true);
    expect(result.output).toEqual({ result: "ok" });
    expect(result.provider).toBe("deepseek");
    expect(result.model).toBe("deepseek/deepseek-v4-pro");
    expect(mocks.gateway).toHaveBeenCalledWith("deepseek/deepseek-v4-pro");
    expect(mocks.generateText).toHaveBeenCalledWith(expect.objectContaining({
      maxRetries: 0,
      timeout: 32_000,
      providerOptions: {
        gateway: expect.objectContaining({ only: ["deepseek"] }),
      },
    }));
    expect(getV4ProviderReadiness()).toMatchObject({
      provider: "deepseek",
      model: "deepseek/deepseek-v4-pro",
      maxModelCallSeconds: 32,
      deepSeekRetries: 0,
      transport: "vercel_ai_gateway",
    });
  });

  it("honors explicit Gateway transport even when a direct key is inherited", async () => {
    process.env.DEEPSEEK_API_KEY = "direct-key";
    process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY = "true";
    process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
    mocks.generateText.mockResolvedValue({
      output: { result: "gateway" },
      usage: { outputTokens: 7, totalTokens: 19 },
    });

    const result = await generateV4Json({
      purpose: "v4_atomic_plan",
      system: "Return JSON only.",
      user: "Test",
      maxTokens: 200,
      parse: (content) => JSON.parse(content) as { result: string },
    });

    expect(result.output).toEqual({ result: "gateway" });
    expect(mocks.generateText).toHaveBeenCalledOnce();
  });

  it("keeps direct V4 validation on the bounded non-retrying adapter", async () => {
    process.env.DEEPSEEK_API_KEY = "direct-key";
    process.env.FAQ_V4_DEEPSEEK_MODEL = "deepseek-v4-pro";
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({
      choices: [{ message: { content: '{"result":"validated"}' } }],
      usage: { completion_tokens: 4, total_tokens: 15 },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateV4ValidationJson({
      purpose: "v4_claim_validation",
      system: "Return JSON only.",
      user: "Test",
      maxTokens: 200,
      parse: (content) => JSON.parse(content) as { result: string },
    });

    expect(result.output).toEqual({ result: "validated" });
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(String(fetchMock.mock.calls[0]?.[0])).toBe("https://api.deepseek.com/chat/completions");
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "deepseek-v4-pro",
      response_format: { type: "json_object" },
      thinking: { type: "disabled" },
    });
    expect(mocks.generateText).not.toHaveBeenCalled();
    expect(getV4ProviderReadiness()).toMatchObject({
      provider: "deepseek",
      model: "deepseek-v4-pro",
      maxModelCallSeconds: 35,
      deepSeekRetries: 0,
      transport: "direct",
    });
  });

  it("fails closed without drifting to Gateway or Anthropic when Gateway use is not explicit", async () => {
    process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateV4Json({
      purpose: "v4_atomic_plan",
      system: "Return JSON only.",
      user: "Test",
      maxTokens: 200,
      parse: (content) => JSON.parse(content) as { result: string },
    })).rejects.toThrow(/no provider configured/);
    expect(isV4ModelConfigured()).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("fails closed instead of drifting to direct transport when explicit Gateway OIDC is missing", async () => {
    process.env.DEEPSEEK_API_KEY = "inherited-direct-key";
    process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY = "true";

    await expect(generateV4Json({
      purpose: "v4_atomic_plan",
      system: "Return JSON only.",
      user: "Test",
      maxTokens: 200,
      parse: (content) => JSON.parse(content) as { result: string },
    })).rejects.toThrow(/OIDC token is unavailable/);
    expect(getV4ProviderReadiness()).toMatchObject({ modelConfigured: false, transport: "vercel_ai_gateway" });
    expect(mocks.generateText).not.toHaveBeenCalled();
  });

  it("records one sanitized direct attempt and never retries", async () => {
    process.env.DEEPSEEK_API_KEY = "direct-key";
    process.env.FAQ_V4_MODEL_TIMEOUT_SECONDS = "999";
    const timeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: { message: "temporary failure" } }, 500));
    vi.stubGlobal("fetch", fetchMock);

    await expect(generateV4Json({
      purpose: "v4_atomic_plan",
      system: "Return JSON only.",
      user: "Test",
      maxTokens: 200,
      parse: (content) => JSON.parse(content) as { result: string },
    })).rejects.toMatchObject({
      attempts: [expect.objectContaining({ provider: "deepseek", status: "failed", error: "temporary failure" })],
    });

    expect(fetchMock).toHaveBeenCalledOnce();
    expect(timeoutSpy.mock.calls.filter((call) => call[1] === 35_000)).toHaveLength(1);
  });

  it("fails closed and preserves a sanitized attempt when Gateway JSON violates the stage parser", async () => {
    process.env.ASK_SALES_V4_USE_VERCEL_GATEWAY = "true";
    process.env.VERCEL_OIDC_TOKEN = "test-oidc-token";
    mocks.generateText.mockResolvedValue({
      output: { unexpected: true },
      usage: { outputTokens: 5, totalTokens: 10 },
    });

    await expect(generateV4Json({
      purpose: "v4_atomic_plan",
      system: "Return JSON only.",
      user: "Test",
      maxTokens: 200,
      parse: (content) => {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        if (parsed.result !== "ok") throw new Error("missing required result");
        return parsed;
      },
    })).rejects.toMatchObject({
      message: expect.stringMatching(/missing required result/),
      attempts: [expect.objectContaining({ provider: "deepseek", status: "failed", error: expect.stringMatching(/missing required result/) })],
    });
  });
});
