import { describe, expect, it } from "vitest";
import {
  buildAskSalesFaqRepReviewKey,
  decodeAskSalesFaqRepHistoryCursor,
  encodeAskSalesFaqRepHistoryCursor,
  isAskSalesFaqRepReviewKey,
  normalizeAskSalesFaqRepHistoryDays,
} from "@/lib/ask-sales-faq/admin-rep-review";

describe("Ask Sales admin rep review", () => {
  it("builds a stable opaque key from a normalized email", () => {
    const secret = "test-only-secret-with-enough-entropy";
    const first = buildAskSalesFaqRepReviewKey(" Rep@Example.com ", secret);
    const second = buildAskSalesFaqRepReviewKey("rep@example.com", secret);

    expect(first).toBe(second);
    expect(first).toMatch(/^rep_[A-Za-z0-9_-]{24}$/);
    expect(isAskSalesFaqRepReviewKey(first)).toBe(true);
    expect(first).not.toContain("rep@example.com");
  });

  it("changes the opaque key when the identity or secret changes", () => {
    expect(buildAskSalesFaqRepReviewKey("one@example.com", "secret-one"))
      .not.toBe(buildAskSalesFaqRepReviewKey("two@example.com", "secret-one"));
    expect(buildAskSalesFaqRepReviewKey("one@example.com", "secret-one"))
      .not.toBe(buildAskSalesFaqRepReviewKey("one@example.com", "secret-two"));
  });

  it("fails closed when identity or auth secret is unavailable", () => {
    expect(buildAskSalesFaqRepReviewKey("", "secret")).toBeNull();
    expect(buildAskSalesFaqRepReviewKey("rep@example.com", "")).toBeNull();
    expect(isAskSalesFaqRepReviewKey("rep@example.com")).toBe(false);
  });

  it("round trips a valid pagination cursor", () => {
    const cursor = { createdAt: "2026-07-13T12:34:56.789456Z", id: "faq_answer_123" };
    expect(decodeAskSalesFaqRepHistoryCursor(encodeAskSalesFaqRepHistoryCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed cursors", () => {
    expect(decodeAskSalesFaqRepHistoryCursor("not-json")).toBeNull();
    expect(decodeAskSalesFaqRepHistoryCursor(Buffer.from(JSON.stringify({ createdAt: "bad", id: "x" })).toString("base64url"))).toBeNull();
    expect(decodeAskSalesFaqRepHistoryCursor(Buffer.from(JSON.stringify({ createdAt: "2026-07-13T00:00:00Z", id: "" })).toString("base64url"))).toBeNull();
  });

  it("supports bounded windows plus an all-time default", () => {
    expect(normalizeAskSalesFaqRepHistoryDays("7")).toBe(7);
    expect(normalizeAskSalesFaqRepHistoryDays(["90"])).toBe(90);
    expect(normalizeAskSalesFaqRepHistoryDays("all")).toBeNull();
    expect(normalizeAskSalesFaqRepHistoryDays("365")).toBeNull();
  });
});
