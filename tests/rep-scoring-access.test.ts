import { afterEach, describe, expect, it, vi } from "vitest";
import { isRepScoringAdmin } from "@/lib/rep-scoring/admin-allowlist";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Rep-scoring admin access", () => {
  it("keeps Syed as the safe default when no list is configured", () => {
    vi.stubEnv("REP_SCORING_ADMIN_EMAILS", "");
    expect(isRepScoringAdmin("syed.haider@insidesuccess.com")).toBe(true);
  });

  it("supports the production exact-email manager list", () => {
    vi.stubEnv(
      "REP_SCORING_ADMIN_EMAILS",
      "syed.haider@insidesuccess.com,tyler@mawercapital.com",
    );
    expect(isRepScoringAdmin(" TYLER@MAWERCAPITAL.COM ")).toBe(true);
    expect(isRepScoringAdmin("rep@mawercapital.com")).toBe(false);
  });
});
