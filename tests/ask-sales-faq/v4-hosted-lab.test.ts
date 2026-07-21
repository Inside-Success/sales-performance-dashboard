import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  headers: vi.fn(),
  sessionAuth: vi.fn(),
}));

vi.mock("next/headers", () => ({ headers: mocks.headers }));
vi.mock("@/auth", () => ({
  auth: (handler?: unknown) => {
    if (typeof handler === "function") {
      return (request: unknown) => (handler as (value: unknown) => unknown)(request);
    }
    return mocks.sessionAuth();
  },
}));

import { AppHeader } from "@/components/dashboard/app-header";
import { isV4LabAuthBypassEnabled, proxy, V4_LAB_REQUEST_HEADER } from "@/proxy";

const originalFlag = process.env.ASK_SALES_V4_ISOLATED;
const originalVercelEnv = process.env.VERCEL_ENV;

afterEach(() => {
  if (originalFlag === undefined) delete process.env.ASK_SALES_V4_ISOLATED;
  else process.env.ASK_SALES_V4_ISOLATED = originalFlag;
  if (originalVercelEnv === undefined) delete process.env.VERCEL_ENV;
  else process.env.VERCEL_ENV = originalVercelEnv;
});

beforeEach(() => {
  mocks.headers.mockResolvedValue(new Headers());
  mocks.sessionAuth.mockResolvedValue({ user: { name: "Test User", email: "test@example.com" } });
});

describe("Ask Sales V4 hosted lab isolation", () => {
  it("bypasses page auth only for the exact flagged preview path", () => {
    process.env.ASK_SALES_V4_ISOLATED = "true";
    process.env.VERCEL_ENV = "preview";

    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab")).toBe(true);
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab/extra")).toBe(false);
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab-copy")).toBe(false);

    process.env.VERCEL_ENV = "production";
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab")).toBe(false);
    process.env.VERCEL_ENV = "development";
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab")).toBe(false);
  });

  it("marks the exact preview request for the server layout", async () => {
    process.env.ASK_SALES_V4_ISOLATED = "true";
    process.env.VERCEL_ENV = "preview";
    const response = await (proxy as unknown as (request: unknown) => Promise<Response> | Response)({
      nextUrl: new URL("https://preview.example.com/ask-sales-faq/v4-lab"),
      headers: new Headers(),
      auth: null,
    });

    expect(response.headers.get("x-middleware-next")).toBe("1");
    expect(response.headers.get(`x-middleware-request-${V4_LAB_REQUEST_HEADER}`)).toBe("1");
  });

  it("lets AppHeader return before its auth lookup for a marked lab request", async () => {
    mocks.headers.mockResolvedValue(new Headers({ [V4_LAB_REQUEST_HEADER]: "1" }));

    await expect(AppHeader()).resolves.toBeNull();
    expect(mocks.sessionAuth).not.toHaveBeenCalled();
  });
});
