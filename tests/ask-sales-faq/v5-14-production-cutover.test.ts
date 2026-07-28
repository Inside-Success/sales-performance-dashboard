import { afterEach, describe, expect, it, vi } from "vitest";

import { selectedAskSalesFaqRuntimeVersion } from "@/lib/ask-sales-faq/runtime-selector";
import { generateV514ProductionJson } from "@/lib/ask-sales-faq/v4/provider";
import { runAskSalesFaqV514Production } from "@/lib/ask-sales-faq/v5-14/production";

const originalRuntime = process.env.ASK_SALES_FAQ_RUNTIME_VERSION;
const originalKey = process.env.DEEPSEEK_API_KEY;
const originalModel = process.env.FAQ_DEEPSEEK_MODEL;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalRuntime === undefined) delete process.env.ASK_SALES_FAQ_RUNTIME_VERSION;
  else process.env.ASK_SALES_FAQ_RUNTIME_VERSION = originalRuntime;
  if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = originalKey;
  if (originalModel === undefined) delete process.env.FAQ_DEEPSEEK_MODEL;
  else process.env.FAQ_DEEPSEEK_MODEL = originalModel;
});

describe("Ask Sales V5.14 production cutover", () => {
  it.each([
    [undefined, "v3"],
    ["", "v3"],
    ["typo", "v3"],
    ["v3", "v3"],
    ["v2", "v2"],
    ["v5.14", "v5.14"],
  ])("selects %s as %s", (configured, expected) => {
    if (configured === undefined) delete process.env.ASK_SALES_FAQ_RUNTIME_VERSION;
    else process.env.ASK_SALES_FAQ_RUNTIME_VERSION = configured;
    expect(selectedAskSalesFaqRuntimeVersion()).toBe(expected);
  });

  it("maps a deterministic V5.14 answer into the existing production response contract", async () => {
    const result = await runAskSalesFaqV514Production(
      "Client name is Jane Doe. What are the Inside Success prices and payment plans?",
    );

    expect(result).toMatchObject({
      ok: true,
      outcome: "answer_from_evidence",
      needsRoute: false,
      provider: null,
      model: null,
      errorClass: null,
      runtimeMetadata: { pipelineVersion: "v5.14" },
    });
    expect(result.answer).toContain("Standard is $20,000");
    expect(result.sanitizedQuestion).not.toContain("Jane Doe");
    expect(result.redactions).toContain("person_name");
    expect(result.source?.approved).toBe(true);
  });

  it("uses the existing production DeepSeek credential without exposing it", async () => {
    process.env.DEEPSEEK_API_KEY = "production-test-key";
    process.env.FAQ_DEEPSEEK_MODEL = "deepseek-v4-pro";
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: '{"result":"ok"}' } }],
      usage: { completion_tokens: 3, total_tokens: 9 },
    }), { status: 200, headers: { "content-type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await generateV514ProductionJson({
      purpose: "production_cutover_test",
      system: "Return JSON only.",
      user: "Test",
      maxTokens: 100,
      parse: (content) => JSON.parse(content) as { result: string },
    });

    expect(result.output).toEqual({ result: "ok" });
    const request = fetchMock.mock.calls[0]?.[1] as RequestInit;
    expect((request.headers as Record<string, string>).authorization).toBe("Bearer production-test-key");
    expect(JSON.parse(String(request.body))).toMatchObject({
      model: "deepseek-v4-pro",
      thinking: { type: "disabled" },
      user_id: "ask-sales-v5-14-production",
    });
  });
});
