export type AskSalesFaqConversationCursor = {
  updatedAt: string;
  id: string;
};

export function encodeAskSalesFaqConversationCursor(cursor: AskSalesFaqConversationCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeAskSalesFaqConversationCursor(value: string | null | undefined): AskSalesFaqConversationCursor | null {
  if (!value || value.length > 500) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AskSalesFaqConversationCursor>;
    if (typeof parsed.updatedAt !== "string" || Number.isNaN(Date.parse(parsed.updatedAt))) return null;
    if (typeof parsed.id !== "string" || !parsed.id.trim() || parsed.id.length > 120) return null;
    return { updatedAt: parsed.updatedAt, id: parsed.id };
  } catch {
    return null;
  }
}
