import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { generateV3Json } from "@/lib/ask-sales-faq/v3/provider";

const originalDeepSeekKey = process.env.DEEPSEEK_API_KEY;
const originalAnthropicKey = process.env.ANTHROPIC_API_KEY;
const originalFallbackFlag = process.env.FAQ_ALLOW_CLAUDE_FALLBACK;

function jsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json" } });
}

describe("Ask Sales FAQ V3 provider order", () => {
  beforeEach(() => {
    process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
    process.env.ANTHROPIC_API_KEY = "test-anthropic-key";
    process.env.FAQ_ALLOW_CLAUDE_FALLBACK = "true";
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    if (originalDeepSeekKey === undefined) delete process.env.DEEPSEEK_API_KEY;
    else process.env.DEEPSEEK_API_KEY = originalDeepSeekKey;
    if (originalAnthropicKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalAnthropicKey;
    if (originalFallbackFlag === undefined) delete process.env.FAQ_ALLOW_CLAUDE_FALLBACK;
    else process.env.FAQ_ALLOW_CLAUDE_FALLBACK = originalFallbackFlag;
  });

  it("retries DeepSeek structured output before considering Claude", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: "not-json" } }] }))
      .mockResolvedValueOnce(jsonResponse({ choices: [{ message: { content: '{"answer":"deepseek recovered"}' } }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateV3Json({
      purpose: "provider-order-test",
      system: "Return JSON.",
      user: "Test",
      maxTokens: 50,
      parse: (content) => JSON.parse(content) as { answer: string },
    });

    expect(result.provider).toBe("deepseek");
    expect(result.output.answer).toBe("deepseek recovered");
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls.every(([url]) => String(url).includes("api.deepseek.com"))).toBe(true);
    expect(result.attempts.map((attempt) => `${attempt.provider}:${attempt.status}`)).toEqual([
      "deepseek:failed",
      "deepseek:success",
    ]);
  });

  it("uses Claude only after both DeepSeek technical attempts fail", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({ error: { message: "temporary DeepSeek failure" } }, 500))
      .mockResolvedValueOnce(jsonResponse({ error: { message: "temporary DeepSeek failure" } }, 500))
      .mockResolvedValueOnce(jsonResponse({ content: [{ type: "text", text: '{"answer":"emergency fallback"}' }] }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateV3Json({
      purpose: "provider-order-test",
      system: "Return JSON.",
      user: "Test",
      maxTokens: 50,
      parse: (content) => JSON.parse(content) as { answer: string },
    });

    expect(result.provider).toBe("anthropic");
    expect(result.output.answer).toBe("emergency fallback");
    expect(fetchMock.mock.calls.map(([url]) => String(url))).toEqual([
      "https://api.deepseek.com/chat/completions",
      "https://api.deepseek.com/chat/completions",
      "https://api.anthropic.com/v1/messages",
    ]);
    expect(result.attempts.map((attempt) => `${attempt.provider}:${attempt.status}`)).toEqual([
      "deepseek:failed",
      "deepseek:failed",
      "anthropic:success",
    ]);
  });
});
