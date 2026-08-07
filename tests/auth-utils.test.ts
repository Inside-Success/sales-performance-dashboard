import { afterEach, describe, expect, it, vi } from "vitest";
import { isAllowedAuthEmail } from "@/lib/auth-utils";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Magic Mike authentication allowlist", () => {
  it("always permits the initial rep-scoring administrator", () => {
    vi.stubEnv("AUTH_ALLOWED_DOMAINS", "example.com");

    expect(isAllowedAuthEmail(" SYED.HAIDER@INSIDESUCCESS.COM ")).toBe(true);
  });

  it("supports additional exact-email entries without widening a domain", () => {
    vi.stubEnv("AUTH_ALLOWED_DOMAINS", "example.com");
    vi.stubEnv("AUTH_ALLOWED_EMAILS", "manager@another-company.com");

    expect(isAllowedAuthEmail("manager@another-company.com")).toBe(true);
    expect(isAllowedAuthEmail("rep@another-company.com")).toBe(false);
  });

  it("keeps Tyler approved through an exact entry even if domain policy changes", () => {
    vi.stubEnv("AUTH_ALLOWED_DOMAINS", "example.com");
    vi.stubEnv("AUTH_ALLOWED_EMAILS", "tyler@mawercapital.com");

    expect(isAllowedAuthEmail("TYLER@MAWERCAPITAL.COM")).toBe(true);
    expect(isAllowedAuthEmail("rep@mawercapital.com")).toBe(false);
  });

  it("retains approved company-domain access", () => {
    vi.stubEnv("AUTH_ALLOWED_DOMAINS", "insidesuccess.com");

    expect(isAllowedAuthEmail("rep@insidesuccess.com")).toBe(true);
    expect(isAllowedAuthEmail("rep@gmail.com")).toBe(false);
  });
});
