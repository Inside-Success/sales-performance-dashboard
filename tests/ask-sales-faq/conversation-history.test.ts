import { describe, expect, it } from "vitest";
import {
  decodeAskSalesFaqConversationCursor,
  encodeAskSalesFaqConversationCursor,
} from "@/lib/ask-sales-faq/conversation-history";

describe("Ask Sales FAQ conversation history cursors", () => {
  it("round-trips a stable updated-at and id cursor", () => {
    const cursor = { updatedAt: "2026-07-09T22:13:51.010Z", id: "faq_example" };
    expect(decodeAskSalesFaqConversationCursor(encodeAskSalesFaqConversationCursor(cursor))).toEqual(cursor);
  });

  it("rejects malformed or incomplete cursors", () => {
    expect(decodeAskSalesFaqConversationCursor("not-a-cursor")).toBeNull();
    expect(
      decodeAskSalesFaqConversationCursor(
        Buffer.from(JSON.stringify({ updatedAt: "not-a-date", id: "faq_example" })).toString("base64url"),
      ),
    ).toBeNull();
  });
});
