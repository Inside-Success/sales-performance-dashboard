import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { BRANDED_MAGIC_MIKE_ORIGIN } from "@/lib/magic-mike-origin";
import { MANUAL_PRODUCTION_ORIGIN } from "@/lib/manual-delivery";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("production Auth.js origin selection", () => {
  it.each([
    [BRANDED_MAGIC_MIKE_ORIGIN, "production", BRANDED_MAGIC_MIKE_ORIGIN],
    [MANUAL_PRODUCTION_ORIGIN, "production", MANUAL_PRODUCTION_ORIGIN],
    ["https://magicmike.insidesuccess.ai.example.com", "production", MANUAL_PRODUCTION_ORIGIN],
    [BRANDED_MAGIC_MIKE_ORIGIN, "preview", MANUAL_PRODUCTION_ORIGIN],
  ])("advertises the correct Google callback for %s in %s", async (requestOrigin, environment, authOrigin) => {
    vi.stubEnv("AUTH_URL", MANUAL_PRODUCTION_ORIGIN);
    vi.stubEnv("AUTH_SECRET", "test-only-session-secret");
    vi.stubEnv("AUTH_GOOGLE_ID", "test-google-client");
    vi.stubEnv("AUTH_GOOGLE_SECRET", "test-google-secret");
    vi.stubEnv("VERCEL_ENV", environment);
    const { handleAuthRequest } = await import("@/auth");
    const request = new NextRequest(`${requestOrigin}/api/auth/providers`, {
      headers: { "x-forwarded-host": "untrusted.example.com" },
    });

    const response = await handleAuthRequest(request);
    expect(response.status).toBe(200);
    const { google } = await response.json();
    expect(google.callbackUrl).toBe(`${authOrigin}/api/auth/callback/google`);
    expect(google.signinUrl).toBe(`${authOrigin}/api/auth/signin/google`);
  });
});
