import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ runAskSalesFaqV4: vi.fn() }));

vi.mock("@/lib/ask-sales-faq/v4/runtime", () => ({
  runAskSalesFaqV4: mocks.runAskSalesFaqV4,
}));

import { GET, POST } from "@/app/api/ask-sales-faq/v4-isolated/route";

const original = {
  flag: process.env.ASK_SALES_V4_ISOLATED,
  vercel: process.env.VERCEL_ENV,
  token: process.env.ASK_SALES_V4_LAB_TOKEN,
  deepSeekKey: process.env.DEEPSEEK_API_KEY,
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
  process.env.DEEPSEEK_API_KEY = "test-deepseek-key";
  process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED = "true";
  mocks.runAskSalesFaqV4.mockResolvedValue({
    ok: true,
    answer: "Safe test answer.",
    provider: "deepseek",
    model: "deepseek-v4-pro",
    runtimeMetadata: {
      executionMode: {
        planning: "model",
        composition: "model",
        validation: "model_and_deterministic",
      },
      validation: { removedSentences: [] },
    },
  });
});

afterEach(() => {
  restoreEnv("ASK_SALES_V4_ISOLATED", original.flag);
  restoreEnv("VERCEL_ENV", original.vercel);
  restoreEnv("ASK_SALES_V4_LAB_TOKEN", original.token);
  restoreEnv("DEEPSEEK_API_KEY", original.deepSeekKey);
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
      modelConfigured: true,
      provider: "deepseek",
      model: "deepseek-v4-pro",
      deepSeekRetries: 0,
    });
    expect(data.maxModelCallSeconds).toBeLessThanOrEqual(35);
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
      body: JSON.stringify({ messages: [{ role: "user", content: "Question" }] }),
    });
    expect((await POST(missingToken)).status).toBe(401);

    process.env.VERCEL_ENV = "production";
    expect((await GET()).status).toBe(404);
    const productionRequest = new NextRequest("https://production.example.com/api/ask-sales-faq/v4-isolated", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ask-sales-v4-token": "a-secure-isolated-token-123456" },
      body: JSON.stringify({ messages: [{ role: "user", content: "Question" }] }),
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
      body: JSON.stringify({ messages: [{ role: "user", content: "What is the current ISTV price?" }] }),
    });

    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(mocks.runAskSalesFaqV4).toHaveBeenCalledOnce();
    const [question, messages, options] = mocks.runAskSalesFaqV4.mock.calls[0];
    expect(question).toBe("What is the current ISTV price?");
    expect(messages).toEqual([{ role: "user", content: "What is the current ISTV price?" }]);
    expect(options).toEqual({ provider: expect.any(Function), validatorProvider: expect.any(Function) });
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
      body: JSON.stringify({ messages: [{ role: "user", content: "What is the current ISTV price?" }] }),
    });
    const response = await POST(request);
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toMatchObject({ error: expect.stringMatching(/not passed a live access check/) });
    expect(mocks.runAskSalesFaqV4).not.toHaveBeenCalled();
  });
});
