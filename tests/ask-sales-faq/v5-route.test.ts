import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({ run: vi.fn() }));

vi.mock("@/lib/ask-sales-faq/v5/runtime", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/ask-sales-faq/v5/runtime")>()),
  runAskSalesFaqV5: mocks.run,
}));

import { GET, POST } from "@/app/api/ask-sales-faq/v5-isolated/route";
import { verifyV4HistoryToken } from "@/lib/ask-sales-faq/v4/history-token";
import { getV5KnowledgeSnapshot } from "@/lib/ask-sales-faq/v5/knowledge";
import { getV51KnowledgeVersion } from "@/lib/ask-sales-faq/v5/runtime";

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
  process.env.ASK_SALES_V4_LAB_TOKEN = "a-secure-v5-token-123456789";
  process.env.ASK_SALES_V4_HISTORY_SIGNING_SECRET = "a-different-v5-history-secret-123456789";
  process.env.ASK_SALES_V4_DEEPSEEK_API_KEY = "test-key";
  process.env.ASK_SALES_V4_MODEL_ACCESS_CONFIRMED = "true";
  mocks.run.mockReset();
  mocks.run.mockImplementation(async (question: string) => ({
    ok: true,
    answer: "V5 source-backed answer.",
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

function request(body: unknown, token = "a-secure-v5-token-123456789") {
  return new NextRequest("https://preview.example.com/api/ask-sales-faq/v5-isolated", {
    method: "POST",
    headers: { "content-type": "application/json", "x-ask-sales-v4-token": token },
    body: JSON.stringify(body),
  });
}

describe("Ask Sales V5 isolated route", () => {
  it("reports the immutable persistence-free V5 snapshot", async () => {
    const snapshot = getV5KnowledgeSnapshot();
    const response = await GET();
    await expect(response.json()).resolves.toMatchObject({
      ok: true,
      ready: true,
      runtime: "v5.1-isolated",
      persistence: false,
      productionSelectorChanged: false,
      knowledgeVersion: getV51KnowledgeVersion(),
      sourceKnowledgeVersion: snapshot.sourceKnowledgeVersion,
      snapshotHash: snapshot.snapshotHash,
    });
    expect(response.headers.get("x-ask-sales-runtime")).toBe("v5.1-isolated");
  });

  it("calls only V5 and binds encrypted history to the exact snapshot", async () => {
    const response = await POST(request({ question: "Can this be answered?", conversationId: "v5_case" }));
    const data = await response.json() as { conversationId: string; historyToken: string; messageId: string };
    expect(response.status).toBe(200);
    expect(data).toMatchObject({
      conversationId: "v5_case",
      messageId: expect.stringMatching(/^v5_lab_assistant_/),
      historyToken: expect.stringMatching(/^v4h2\./),
    });
    expect(mocks.run).toHaveBeenCalledOnce();
    expect(mocks.run.mock.calls[0]?.[1]).toEqual([{ role: "user", content: "Can this be answered?" }]);
    const verified = verifyV4HistoryToken({
      token: data.historyToken,
      conversationId: "v5_case",
      knowledgeVersion: getV51KnowledgeVersion(),
    });
    expect(verified.messages).toEqual([
      { role: "user", content: "Can this be answered?" },
      { role: "assistant", content: "V5 source-backed answer." },
    ]);
  });

  it("fails closed without capability access or outside Preview", async () => {
    expect((await POST(request({ question: "Question" }, "wrong"))).status).toBe(401);
    process.env.VERCEL_ENV = "production";
    expect((await GET()).status).toBe(404);
    expect((await POST(request({ question: "Question" }))).status).toBe(404);
    expect(mocks.run).not.toHaveBeenCalled();
  });

  it("rejects oversized, malformed, and extra payload fields before execution", async () => {
    const oversized = request({ question: "x".repeat((70 * 1024) + 1) });
    oversized.headers.delete("content-length");
    expect((await POST(oversized)).status).toBe(413);
    const malformed = new NextRequest("https://preview.example.com/api/ask-sales-faq/v5-isolated", {
      method: "POST",
      headers: { "content-type": "application/json", "x-ask-sales-v4-token": "a-secure-v5-token-123456789" },
      body: "{broken",
    });
    expect((await POST(malformed)).status).toBe(400);
    expect((await POST(request({ question: "Valid?", messages: [] }))).status).toBe(400);
    expect(mocks.run).not.toHaveBeenCalled();
  });
});
