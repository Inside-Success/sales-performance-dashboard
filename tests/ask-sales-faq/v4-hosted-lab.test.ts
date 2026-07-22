import { readFileSync } from "node:fs";
import path from "node:path";
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
import nextConfig from "../../next.config";

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
  it("keeps encrypted history only in React memory and never resubmits rendered messages", () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/ask-sales-faq/ask-sales-v4-lab.tsx"), "utf8");

    expect(source).toContain("const [historyToken, setHistoryToken] = useState<string | null>(null)");
    expect(source).toContain("...(historyToken ? { historyToken } : {})");
    expect(source).toContain("setHistoryToken(data.historyToken)");
    expect(source).toContain("setHistoryToken(null)");
    expect(source).not.toContain("requestMessages");
    expect(source).not.toContain("localStorage");
    expect(source).not.toContain("sessionStorage");
    expect(source).not.toContain("body: JSON.stringify({ conversationId, messages:");
  });

  it("warns against real PII and applies clickjacking headers only to isolated lab paths", async () => {
    const source = readFileSync(path.join(process.cwd(), "src/components/ask-sales-faq/ask-sales-v4-lab.tsx"), "utf8");
    expect(source).toContain("Use fictional or already-redacted examples only");
    expect(source).toContain("Never enter real client names");

    const rules = await nextConfig.headers?.();
    expect(rules).toEqual(expect.arrayContaining([
      expect.objectContaining({ source: "/ask-sales-faq/v4-lab", headers: expect.arrayContaining([expect.objectContaining({ key: "X-Frame-Options", value: "DENY" })]) }),
      expect.objectContaining({ source: "/api/ask-sales-faq/v4-isolated", headers: expect.arrayContaining([expect.objectContaining({ key: "Content-Security-Policy", value: "frame-ancestors 'none'" })]) }),
      expect.objectContaining({ source: "/ask-sales-faq/v4-systemic-lab", headers: expect.arrayContaining([expect.objectContaining({ key: "X-Frame-Options", value: "DENY" })]) }),
      expect.objectContaining({ source: "/api/ask-sales-faq/v4-systemic-isolated", headers: expect.arrayContaining([expect.objectContaining({ key: "Content-Security-Policy", value: "frame-ancestors 'none'" })]) }),
    ]));
    expect(rules?.some((rule) => rule.source === "/:path*" || rule.source === "/")).toBe(false);
  });

  it("bypasses page auth only for the exact flagged preview path", () => {
    process.env.ASK_SALES_V4_ISOLATED = "true";
    process.env.VERCEL_ENV = "preview";

    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab")).toBe(true);
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-systemic-lab")).toBe(true);
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab/extra")).toBe(false);
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-systemic-lab/extra")).toBe(false);
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab-copy")).toBe(false);

    process.env.VERCEL_ENV = "production";
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-lab")).toBe(false);
    expect(isV4LabAuthBypassEnabled("/ask-sales-faq/v4-systemic-lab")).toBe(false);
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
