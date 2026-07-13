import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";

function sessionFor(email: string): Session {
  return {
    user: { email, name: "Test User" },
    expires: new Date(Date.now() + 60_000).toISOString(),
  };
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Ask Sales FAQ access", () => {
  it("requires a signed-in user", () => {
    vi.stubEnv("ASK_SALES_FAQ_ENABLED", "true");
    expect(getAskSalesFaqAccess(null)).toMatchObject({ ok: false, status: 401, code: "not_signed_in" });
  });

  it("retains the server-side emergency switch", () => {
    vi.stubEnv("ASK_SALES_FAQ_ENABLED", "false");
    expect(getAskSalesFaqAccess(sessionFor("rep@insidesuccess.com"))).toMatchObject({ ok: false, code: "feature_disabled" });
  });

  it("allows every authenticated user from an approved company domain", () => {
    vi.stubEnv("ASK_SALES_FAQ_ENABLED", "true");
    vi.stubEnv("AUTH_ALLOWED_DOMAINS", "insidesuccesstv.com,insidesuccess.com,mawercapital.com,nextlevelceotv.com");

    for (const email of [
      "rep@insidesuccesstv.com",
      "rep@insidesuccess.com",
      "rep@mawercapital.com",
      "rep@nextlevelceotv.com",
    ]) {
      expect(getAskSalesFaqAccess(sessionFor(email))).toMatchObject({ ok: true, viewerEmail: email });
    }
  });

  it("rejects accounts outside the approved company-domain policy", () => {
    vi.stubEnv("ASK_SALES_FAQ_ENABLED", "true");
    vi.stubEnv("AUTH_ALLOWED_DOMAINS", "insidesuccess.com");
    expect(getAskSalesFaqAccess(sessionFor("rep@example.com"))).toMatchObject({ ok: false, status: 403, code: "not_approved_domain" });
  });

  it("keeps administration on a separate exact-email allowlist", () => {
    vi.stubEnv("ASK_SALES_FAQ_ADMIN_EMAILS", "admin@insidesuccess.com");
    expect(isAskSalesFaqAdmin("admin@insidesuccess.com")).toBe(true);
    expect(isAskSalesFaqAdmin("rep@insidesuccess.com")).toBe(false);
  });
});
