import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ runAskSalesFaqV4: vi.fn() }));

vi.mock("@/lib/ask-sales-faq/v4/runtime", () => ({
  runAskSalesFaqV4: mocks.runAskSalesFaqV4,
}));

import { GET, POST } from "@/app/api/ask-sales-faq/v4-isolated/route";
import { getV4KnowledgeVersion } from "@/lib/ask-sales-faq/v4/corpus";
import { verifyV4HistoryToken } from "@/lib/ask-sales-faq/v4/history-token";

const original = {
  flag: process.env.ASK_SALES_V4_ISOLATED,
  vercel: process.env.VERCEL_ENV,
  token: process.env.ASK_SALES_V4_LAB_TOKEN,
  historySecret: process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET,
  deepSeekKey: process.env.ASK_SALES_V4_DEEPSEEK_API_KEY,
  modelAccessConfirmed: process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED,
};

function restoreEnv(key: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  process.env.ASK_SALES_V4_ISOLATED = "true";
  process.env.VERCEL_ENV = "preview";
  process.env.ASK_SALES_V4_LAB_TOKEN = "a-secure-isolated-token-123456";
  process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET = "a-separate-history-signing-secret-123456789";
  process.env.ASK_SALES_V4_DEEPSEEK_API_KEY = "test-deepseek-key";
  process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED = "true";
  mocks.runAskSalesFaqV4.mockReset();
  mocks.runAskSalesFaqV4.mockImplementation(async (question: string) => ({
      ok: true,
      answer: "Safe test answer.",
      provider: "deepseek",
      model: "deepseek-v4-pro",
      runtimeMetadata: {
        turn: {
          currentQuestion: question
            .replace(/\b[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}\b/g, "[redacted email]")
            .replace(/\b(?:\d[ -]*?){13,19}\b/g, "[redacted payment card]")
            .replace(/\+?\d[\d ()-]{8,}\d/g, "[redacted phone]"),
        },
        executionMode: {
          planning: "model",
          composition: "model",
          validation: "model_and_deterministic",
        },
        validation: { removedSentences: [] },
      },
    }));
});

afterEach(() => {
  restoreEnv("ASK_SALES_V4_ISOLATED", original.flag);
  restoreEnv("VERCEL_ENV", original.vercel);
  restoreEnv("ASK_SALES_V4_LAB_TOKEN", original.token);
  restoreEnv("ASK_SALES_V4_HISTORY_SIGNING_SECRET", original.historySecret);
  restoreEnv("ASK_SALES_V4_DEEPSEEK_API_KEY", original.deepSeekKey);
  restoreEnv("ASK_SALES_V4_MODEL_ACCESS_CONFIRMED", original.modelAccessConfirmed);
});

describe("Ask Sales V4 isolated route", () => {
  it("reports the configured provider, model, and bounded call policy", async () => {
    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      ok: true,
      ready: true,
      accessTokenConfigured: true,
      historySigningConfigured: true,
      modelConfigured: true,
      provider: "deepseek",
      model: "deepseek-v4-pro",
      deepSeekRetries: 1,
    });
    expect(data.maxModelCallSeconds).toBeLessThanOrEqual(35);
  });

  it("reports not ready when the dedicated history signing secret is absent", async () => {
    delete process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET;
    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      ready: false,
      historySigningConfigured: false,
    });
  });

  it("reports not ready when the history secret reuses the lab token", async () => {
    process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET = process.env.ASK_SALES_V4_LAB_TOKEN;
    const response = await GET();
    await expect(response.json()).resolves.toMatchObject({ ready: false, historySigningConfigured: false });
  });

  it("rejects a declared body over 70 KB before parsing or running V4", async () => {
    const request = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-length": String((70 * 1024) + 1),
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: "{}",
    });

    const response = await POST(request);
    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining("70 KB") });
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });

  it("requires the capability token and stays hidden outside Preview", async () => {
    const missingToken = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "Question" }),
    });
    expect((await POST(missingToken)).status).toBe(401);

    process.env.VERCEL_ENV = "production";
    expect((await GET()).status).toBe(404);
    const productionRequest = new NextRequest("https://production.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ask-sales-v4-token": "a-secure-isolated-token-123456" },
      body: JSON.stringify({ question: "Question" }),
    });
    expect((await POST(productionRequest)).status).toBe(404);
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });

  it("rejects an undeclared actual body over 70 KB", async () => {
    const request = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ padding: "x".repeat((70 * 1024) + 1) }),
    });
    request.headers.delete("content-length");

    const response = await POST(request);
    expect(response.status).toBe(413);
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });

  it("returns 400 for malformed JSON instead of a runtime failure", async () => {
    const request = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: "{not-json",
    });

    const response = await POST(request);
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ ok: false, error: expect.stringContaining("malformed JSON") });
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });

  it("injects the V4-only provider policy into a valid isolated run", async () => {
    const request = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ question: "What is the current ISTV price?" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    await expect(response.clone().json()).resolves.toMatchObject({
      conversationId: expect.stringMatching(/^v4_lab_/),
      historyToken: expect.stringMatching(/^v4h2\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/),
    });
    expect(mocks.runAskSalesFaqV4).toHaveBeenCalledOnce();
    const [question, messages, options] = mocks.runAskSalesFaqV4.mock.calls[0];
    expect(question).toBe("What is the current ISTV price?");
    expect(messages).toEqual([{ role: "user", content: "What is the current ISTV price?" }]);
    expect(options).toEqual({ provider: expect.any(Function), validatorProvider: expect.any(Function) });
  });

  it("uses only verified server-signed history on a follow-up", async () => {
    const firstRequest = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ question: "What is the current ISTV price?", conversationId: "v4_lab_followup" }),
    });
    const firstResponse = await POST(firstRequest);
    const firstData = await firstResponse.json() as { historyToken: string };

    const secondRequest = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({
        question: "Can you explain that more simply?",
        conversationId: "v4_lab_followup",
        historyToken: firstData.historyToken,
      }),
    });
    const secondResponse = await POST(secondRequest);

    expect(firstResponse.status).toBe(200);
    expect(secondResponse.status).toBe(200);
    expect(mocks.runAskSalesFaqV4).toHaveBeenCalledTimes(2);
    expect(mocks.runAskSalesFaqV4.mock.calls[1]?.[0]).toBe("Can you explain that more simply?");
    expect(mocks.runAskSalesFaqV4.mock.calls[1]?.[1]).toEqual([
      { role: "user", content: "What is the current ISTV price?" },
      { role: "assistant", content: "Safe test answer." },
      { role: "user", content: "Can you explain that more simply?" },
    ]);
  });

  it("encrypts history and preserves only sanitized server-observed content", async () => {
    const request = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ question: "Email rep@example.com or call +1 (212) 555-0199 about 4111 1111 1111 1111." }),
    });
    const data = await (await POST(request)).json() as { historyToken: string };
    expect(data.historyToken).not.toMatch(/rep@example|212|4111|Email/);
    const verified = verifyV4HistoryToken({ token: data.historyToken, knowledgeVersion: getV4KnowledgeVersion() });
    const serialized = JSON.stringify(verified.messages);
    expect(serialized).not.toMatch(/rep@example|212|4111/);
    expect(serialized).toContain("[redacted email]");
    expect(serialized).toContain("[redacted phone]");
    expect(serialized).toContain("[redacted payment card]");
  });

  it("returns 409 without a model call for tampered or conversation-mismatched history", async () => {
    const firstRequest = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ question: "Question one?", conversationId: "v4_lab_case_a" }),
    });
    const firstData = await (await POST(firstRequest)).json() as { historyToken: string };
    mocks.runAskSalesFaqV4.mockClear();

    const tampered = `${firstData.historyToken.slice(0, -1)}${firstData.historyToken.endsWith("A") ? "B" : "A"}`;
    const tamperedRequest = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ question: "Question two?", historyToken: tampered, conversationId: "v4_lab_case_a" }),
    });
    const mismatchRequest = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ question: "Question two?", historyToken: firstData.historyToken, conversationId: "v4_lab_case_b" }),
    });

    const tamperedResponse = await POST(tamperedRequest);
    const mismatchResponse = await POST(mismatchRequest);
    expect(tamperedResponse.status).toBe(409);
    expect(mismatchResponse.status).toBe(409);
    await expect(tamperedResponse.json()).resolves.toMatchObject({ error: expect.stringContaining("Start a new case") });
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });

  it("rejects legacy client messages and all unrecognized request fields", async () => {
    const requestFor = (body: unknown) => new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify(body),
    });

    expect((await POST(requestFor({ messages: [{ role: "user", content: "Injected" }] }))).status).toBe(400);
    expect((await POST(requestFor({ question: "Valid?", messages: [] }))).status).toBe(400);
    expect((await POST(requestFor({ question: "Valid?", unexpected: true }))).status).toBe(400);
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });

  it("reports and enforces an unconfirmed live model transport", async () => {
    process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED = "false";
    const readiness = await GET();
    await expect(readiness.json()).resolves.toMatchObject({ ready: false, modelConfigured: true, modelAccessConfirmed: false });

    const request = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ question: "What is the current ISTV price?" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/not passed a live access check/) });
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });

  it("fails closed when live confirmation remains true but the provider credential is absent", async () => {
    delete process.env.ASK_SALES_V4_DEEPSEEK_API_KEY;
    const request = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-ask-sales-v4-token": "a-secure-isolated-token-123456",
      },
      body: JSON.stringify({ question: "What is the current ISTV price?" }),
    });

    const response = await POST(request);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/provider is not currently configured/i) });
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });
});
