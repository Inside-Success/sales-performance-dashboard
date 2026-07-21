import { afterEach, describe, expect, it } from "vitest";
import { assertV4IsolatedRuntime, isV4IsolatedRuntimeEnabled, isV4LabTokenAuthorized } from "@/lib/ask-sales-faq/v4/isolation";

const original = {
  flag: process.env.ASK_SALES_V4_ISOLATED,
  vercel: process.env.VERCEL_ENV,
  token: process.env.ASK_SALES_V4_LAB_TOKEN,
};

afterEach(() => {
  if (original.flag === undefined) delete process.env.ASK_SALES_V4_ISOLATED; else process.env.ASK_SALES_V4_ISOLATED = original.flag;
  if (original.vercel === undefined) delete process.env.VERCEL_ENV; else process.env.VERCEL_ENV = original.vercel;
  if (original.token === undefined) delete process.env.ASK_SALES_V4_LAB_TOKEN; else process.env.ASK_SALES_V4_LAB_TOKEN = original.token;
});

describe("Ask Sales V4 isolation gate", () => {
  it("refuses Vercel production even when the isolated flag is present", () => {
    process.env.ASK_SALES_V4_ISOLATED = "true";
    process.env.ASK_SALES_V4_LAB_TOKEN = "a-secure-isolated-token-123456";
    process.env.VERCEL_ENV = "production";
    expect(isV4IsolatedRuntimeEnabled()).toBe(false);
    expect(() => assertV4IsolatedRuntime()).toThrow(/explicit Vercel preview environment/);
  });

  it("requires an unpredictable capability token", () => {
    process.env.ASK_SALES_V4_ISOLATED = "true";
    process.env.VERCEL_ENV = "preview";
    process.env.ASK_SALES_V4_LAB_TOKEN = "short";
    expect(() => assertV4IsolatedRuntime()).toThrow(/at least 24/);
  });

  it("compares the supplied lab token exactly", () => {
    process.env.ASK_SALES_V4_LAB_TOKEN = "a-secure-isolated-token-123456";
    expect(isV4LabTokenAuthorized("a-secure-isolated-token-123456")).toBe(true);
    expect(isV4LabTokenAuthorized("a-secure-isolated-token-123457")).toBe(false);
  });
});
