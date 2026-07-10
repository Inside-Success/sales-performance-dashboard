import { describe, expect, it } from "vitest";
import { APPROVED_CLAIMS, retrieveApprovedClaims } from "@/lib/ask-sales-faq/approved-claims";

describe("approved claim registry", () => {
  it("loads a broad, authority-tiered claim set", () => {
    expect(APPROVED_CLAIMS.length).toBeGreaterThan(450);
    expect(APPROVED_CLAIMS.some((claim) => claim.source_kind === "approved_article")).toBe(true);
    expect(APPROVED_CLAIMS.some((claim) => claim.source_kind === "trusted_slack_summary")).toBe(true);
    expect(APPROVED_CLAIMS.some((claim) => claim.source_kind === "curated_slack_summary")).toBe(true);
    expect(APPROVED_CLAIMS.some((claim) => claim.source_kind === "owner_approved_override")).toBe(true);
  });

  it.each([
    ["Can follower count disqualify a prospect?", "owner-social-followers-qualification-weight"],
    ["Can I run Fathom while Zoom is recording the sales call?", "owner-fathom-zoom-recording-prohibited"],
    ["May I text the payment link through Zoom Phone?", "owner-zoom-phone-payment-link-email-only"],
    ["Where do I fix a missing show name in Keap?", "owner-keap-missing-show-name-recovery"],
    ["Is the weekly six-month client training still included?", "owner-six-month-training-discontinued"],
    ["Who handles a scriptwriter call when there are no booking times?", "owner-scriptwriter-scheduling-fulfillment-route"],
    ["The client proposed 3000 now and 17000 later; may I offer that?", "owner-unlisted-payment-split-boundary"],
    ["Can a real published author qualify without forming another company?", "owner-authors-legitimate-book-business-fit"],
    ["Do I need to disclose recording on a 20 percent outbound call?", "owner-twenty-percent-recording-and-disclosure"],
    ["Does the network pay residuals or take money earned from the episode?", "owner-client-episode-revenue-boundary"],
    ["Is the podcast meant to generate leads and is Rudy always the interviewer?", "owner-podcast-purpose-and-current-format"],
    ["Does a hospital-employed doctor need to own the private practice?", "owner-hospital-employed-doctor-qualification"],
  ])("retrieves the current approved claim for %s", (question, expectedId) => {
    const matches = retrieveApprovedClaims(question, { limit: 8 });
    expect(matches.map((match) => match.claim.id)).toContain(expectedId);
  });

  it.each([
    ["Can a hospital-employed physician qualify without owning a private practice?", "Hospital-employed doctors and nurse distinction"],
    ["Can we film the full show in Spanish?", "Production Language And Translation Boundary: Answer"],
    ["Please give me the current TV show list", "Current Show Source: Latest Approved Show List"],
    ["Can Call 1 be done by phone instead of Zoom?", "Call 1 by phone instead of Zoom"],
  ])("retrieves existing organized knowledge for an unseen paraphrase: %s", (question, expectedTitle) => {
    const matches = retrieveApprovedClaims(question, { limit: 12 });
    expect(matches.map((match) => match.claim.title)).toContain(expectedTitle);
  });

  it("keeps unresolved, DM-only, and link-placeholder summaries out of live claims", () => {
    const liveText = APPROVED_CLAIMS.map((claim) => claim.approved_text).join("\n");
    expect(liveText).not.toMatch(/\[internal source\]|no visible (?:final )?answer|moved (?:the )?(?:answer|discussion)?\s*to dm/i);
  });

  it("keeps curated untrusted claims below trusted-author authority", () => {
    const curated = APPROVED_CLAIMS.filter((claim) => claim.source_kind === "curated_slack_summary");
    expect(curated.length).toBeGreaterThan(0);
    expect(curated.every((claim) => claim.authority < 90 && claim.approved_by.length === 1)).toBe(true);
  });

  it("does not retrieve policy authority for a greeting", () => {
    expect(retrieveApprovedClaims("Hey there, good morning!", { limit: 8 })).toEqual([]);
  });

  it("respects explicit product exclusions", () => {
    const matches = retrieveApprovedClaims("What payment plan applies to main ISTV, not DJ?", {
      scope: "main_istv",
      excludedScopes: ["dj_nlceo"],
      limit: 20,
    });

    expect(matches.every((match) => !match.claim.product_scopes.includes("dj_nlceo"))).toBe(true);
  });
});
