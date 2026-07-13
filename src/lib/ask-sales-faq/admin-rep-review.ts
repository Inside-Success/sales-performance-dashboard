import { createHmac } from "node:crypto";
import { normalizeAuthEmail } from "@/lib/auth-utils";

const REP_REVIEW_KEY_PATTERN = /^rep_[A-Za-z0-9_-]{24}$/;

export type AskSalesFaqRepHistoryCursor = {
  createdAt: string;
  id: string;
};

export function buildAskSalesFaqRepReviewKey(
  email: string | null | undefined,
  secret = process.env.AUTH_SECRET,
) {
  const normalizedEmail = normalizeAuthEmail(email);
  if (!normalizedEmail || !secret) return null;

  const digest = createHmac("sha256", secret)
    .update(`ask-sales-rep-review:${normalizedEmail}`)
    .digest("base64url")
    .slice(0, 24);

  return `rep_${digest}`;
}

export function isAskSalesFaqRepReviewKey(value: string | null | undefined) {
  return Boolean(value && REP_REVIEW_KEY_PATTERN.test(value));
}

export function encodeAskSalesFaqRepHistoryCursor(cursor: AskSalesFaqRepHistoryCursor) {
  return Buffer.from(JSON.stringify(cursor), "utf8").toString("base64url");
}

export function decodeAskSalesFaqRepHistoryCursor(
  value: string | null | undefined,
): AskSalesFaqRepHistoryCursor | null {
  if (!value || value.length > 512) return null;

  try {
    const parsed = JSON.parse(Buffer.from(value, "base64url").toString("utf8")) as Partial<AskSalesFaqRepHistoryCursor>;
    const createdAt = typeof parsed.createdAt === "string" ? parsed.createdAt : "";
    const id = typeof parsed.id === "string" ? parsed.id : "";
    const timestamp = new Date(createdAt).getTime();

    if (!createdAt || !Number.isFinite(timestamp) || !id || id.length > 200) return null;
    return { createdAt, id };
  } catch {
    return null;
  }
}

export function normalizeAskSalesFaqRepHistoryDays(value: unknown): 7 | 30 | 90 | null {
  const candidate = Array.isArray(value) ? value[0] : value;
  if (candidate === "all" || candidate === undefined || candidate === null || candidate === "") return null;
  const parsed = typeof candidate === "string" ? Number.parseInt(candidate, 10) : Number(candidate);
  return parsed === 7 || parsed === 30 || parsed === 90 ? parsed : null;
}
