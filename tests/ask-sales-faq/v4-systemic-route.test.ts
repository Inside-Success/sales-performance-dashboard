import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock("@/lib/ask-sales-faq/v4/systemic/runtime", () => ({
  runAskSalesFaqV4Systemic: mocks.run,
}));

import { GET, POST } from "@/app/api/ask-sales-faq/v4-systemic-isolated/route";
import { getV4SystemicKnowledgeVersion } from "@/lib/ask-sales-faq/v4/systemic/corpus";
import { verifyV4HistoryToken } from "@/lib/ask-sales-faq/v4/history-token";

const original = {
  flag: process.env.ASK_SALES_V4_ISOLATED,
  vercel: process.env.VERCEL_ENV,
  token: process.env.ASK_SALES_V4_LAB_TOKEN,
  history: process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET,
  key: process.env.ASK_SALES_V4_DEEPSEEK_API_KEY,
  confirmed: process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED,
};

function restore(key: keyof NodeJS.ProcessEnv, value: string | undefined) {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

beforeEach(() => {
  process.env.ASK_SALES_V4_ISOLATED = "true";
  process.env.VERCEL_ENV = "preview";
  process.env.ASK_SALES_V4_LAB_TOKEN = "a-secure-systemic-token-123456";
  process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET = "a-different-systemic-history-secret-123456";
  process.env.ASK_SALES_V4_DEEPSEEK_API_KEY = "test-key";
  process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED = "true";
  mocks.run.mockReset();
  mocks.run.mockImplementation(async (question: string) => ({
    ok: true,
    answer: "Systemic source-backed answer.",
    provider: "deepseek",
    model: "deepseek-v4-pro",
    runtimeMetadata: { turn: { currentQuestion: question } },
  }));
});

afterEach(() => {
  restore("ASK_SALES_V4_ISOLATED", original.flag);
  restore("VERCEL_ENV", original.vercel);
  restore("ASK_SALES_V4_LAB_TOKEN", original.token);
  restore("ASK_SALES_V4_HISTORY_SIGNING_SECRET", original.history);
  restore("ASK_SALES_V4_DEEPSEEK_API_KEY", original.key);
  restore("ASK_SALES_V4_MODEL_ACCESS_CONFIRMED", original.confirmed);
});

function request(body: unknown, token = "a-secure-systemic-token-123456") {
  return new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-systemic-isolated", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ask-sales-v4-token": token },
    body: JSON.stringify(body),
  });
}

describe("Ask Sales V4 systemic isolated route", () => {
  it("reports a persistence-free systemic runtime without changing production", async () => {
    const response = await GET();
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      ready: true,
      runtime: "v4-systemic-isolated",
      persistence: false,
      productionSelectorChanged: false,
      knowledgeVersion: getV4SystemicKnowledgeVersion(),
      operationalPolicyCount: expect.any(Number),
    });
    expect(response.headers.get("x-ask-sales-runtime")).toBe("v4-systemic-isolated");
  });

  it("calls only the systemic runtime and signs history against systemic knowledge", async () => {
    const response = await POST(request({ question: "Can this operational question be answered?", conversationId: "v4_systemic_case" }));
    const data = await response.json() as { conversationId: string; historyToken: string; messageId: string };

    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      conversationId: "v4_systemic_case",
      messageId: expect.stringMatching(/^v4_systemic_lab_assistant_/),
      historyToken: expect.stringMatching(/^v4h2\./),
    });
    expect(mocks.run).toHaveBeenCalledOnce();
    expect(mocks.run.mock.calls[0]?.[1]).toEqual([{ role: "user", content: "Can this operational question be answered?" }]);
    const verified = verifyV4HistoryToken({
      token: data.historyToken,
      conversationId: "v4_systemic_case",
      knowledgeVersion: getV4SystemicKnowledgeVersion(),
    });
    expect(verified.messages).toEqual([
      { role: "user", content: "Can this operational question be answered?" },
      { role: "assistant", content: "Systemic source-backed answer." },
    ]);
  });

  it("requires the capability token and is impossible to expose in production mode", async () => {
    expect((await POST(request({ question: "Question" }, "wrong"))).status).toBe(401);
    process.env.VERCEL_ENV = "production";
    expect((await GET()).status).toBe(404);
    expect((await POST(request({ question: "Question" }))).status).toBe(404);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("rejects oversized, malformed, and unrecognized payloads before model execution", async () => {
    const oversized = request({ question: "x".repeat((70 * 1024) + 1) });
    oversized.headers.delete("content-length");
    expect((await POST(oversized)).status).toBe(413);

    const malformed = new NextRequest("https://preview.example.com/api/ask-sales-faq/v4-systemic-isolated", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ask-sales-v4-token": "a-secure-systemic-token-123456" },
      body: "{broken",
    });
    expect((await POST(malformed)).status).toBe(400);
    expect((await POST(request({ question: "Valid?", messages: [] }))).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
