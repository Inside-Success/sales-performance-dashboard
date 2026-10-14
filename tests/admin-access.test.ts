import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { isAllowedAuthEmail } from "@/lib/auth-utils";
import { APPROVED_ADMIN_EMAILS } from "@/lib/approved-admin-emails";
import { canAccessAdminDirectory, isMagicMikeAdmin, isSalesFaqAdmin, getSalesFaqAdminEmails } from "@/lib/admin-access-policy";
import { getAskSalesFaqAccess } from "@/lib/ask-sales-faq/access";
import { isRepScoringAdmin } from "@/lib/rep-scoring/admin-allowlist";
import { ADMIN_DIRECTORY_LINKS } from "@/lib/admin-directory";

beforeEach(() => {
  vi.stubEnv("REP_SCORING_ADMIN_EMAILS", "legacy.manager@insidesuccess.com,gmail.com");
  vi.stubEnv("ASK_SALES_FAQ_ADMIN_EMAILS", "legacy.faq@insidesuccess.com");
  vi.stubEnv("AUTH_ALLOWED_DOMAINS", "insidesuccess.com");
  vi.stubEnv("AUTH_ALLOWED_EMAILS", "existing.owner@external.example");
  vi.stubEnv("ASK_SALES_FAQ_ENABLED", "true");
});
afterEach(() => vi.unstubAllEnvs());

describe("Approved leadership access", () => {
  it.each(APPROVED_ADMIN_EMAILS)("allows %s to sign in and open both admin families", email => {
    expect(isAllowedAuthEmail(email)).toBe(true);
    expect(isRepScoringAdmin(email)).toBe(true);
    expect(isSalesFaqAdmin(email)).toBe(true);
    expect(canAccessAdminDirectory(email)).toBe(true);
    expect(getAskSalesFaqAccess({ user: { email }, expires: "2099-01-01" })).toMatchObject({ ok: true });
  });
  it.each(["another@gmail.com", "another@rudysmarketing.com", "rudymawerllc+other@gmail.com"])("does not open an external domain to %s", email => {
    expect(isAllowedAuthEmail(email)).toBe(false);
    expect(isMagicMikeAdmin(email)).toBe(false);
    expect(isSalesFaqAdmin(email)).toBe(false);
  });
  it("preserves existing sign-in and admin grants without promoting FAQ-only admins", () => {
    expect(isAllowedAuthEmail("existing.owner@external.example")).toBe(true);
    expect(isMagicMikeAdmin("legacy.manager@insidesuccess.com")).toBe(true);
    expect(isSalesFaqAdmin("legacy.faq@insidesuccess.com")).toBe(true);
    expect(canAccessAdminDirectory("legacy.faq@insidesuccess.com")).toBe(true);
    expect(isMagicMikeAdmin("legacy.faq@insidesuccess.com")).toBe(false);
    expect(getSalesFaqAdminEmails().has("dagim.abate@insidesuccess.com")).toBe(true);
  });
  it("keeps regular company reps on coaching and FAQ, outside admin views", () => {
    const email = "rep@insidesuccess.com";
    expect(isAllowedAuthEmail(email)).toBe(true);
    expect(getAskSalesFaqAccess({ user: { email }, expires: "2099-01-01" })).toMatchObject({ ok: true });
    expect(canAccessAdminDirectory(email)).toBe(false);
    expect(isRepScoringAdmin(email)).toBe(false);
    expect(isSalesFaqAdmin(email)).toBe(false);
    expect(canAccessAdminDirectory(null)).toBe(false);
    expect(isMagicMikeAdmin("gmail.com")).toBe(false);
  });
  it("never treats Gmail as an approved domain even if legacy configuration lists it", () => {
    vi.stubEnv("AUTH_ALLOWED_DOMAINS", "gmail.com,insidesuccess.com");
    expect(isAllowedAuthEmail("another@gmail.com")).toBe(false);
    expect(isAllowedAuthEmail("rudymawerllc@gmail.com")).toBe(true);
  });
  it("normalizes exact account casing and whitespace", () => {
    expect(isMagicMikeAdmin(" DAGIM.ABATE@INSIDESUCCESS.COM ")).toBe(true);
  });
  it("keeps the external team link exact and all internal directory routes distinct", () => {
    expect(ADMIN_DIRECTORY_LINKS.at(-1)?.href).toBe("https://mockcallagent.insidesuccess.ai/admin/team");
    expect(new Set(ADMIN_DIRECTORY_LINKS.map(link => link.href)).size).toBe(9);
  });
});
