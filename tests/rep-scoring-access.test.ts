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
      "syed.haider@insidesuccess.com,tyler@mawercapital.com,jawad.saghir@insidesuccess.com,raul.rios@mawercapital.com,rich.allen@mawercapital.com,mike@insidesuccesstv.com",
    );
    expect(isRepScoringAdmin(" TYLER@MAWERCAPITAL.COM ")).toBe(true);
    expect(isRepScoringAdmin("jawad.saghir@insidesuccess.com")).toBe(true);
    expect(isRepScoringAdmin("raul.rios@mawercapital.com")).toBe(true);
    expect(isRepScoringAdmin("rich.allen@mawercapital.com")).toBe(true);
    expect(isRepScoringAdmin("mike@insidesuccesstv.com")).toBe(true);
    expect(isRepScoringAdmin("rep@mawercapital.com")).toBe(false);
  });
});
