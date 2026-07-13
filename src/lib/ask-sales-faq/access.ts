import type { Session } from "next-auth";
import { isAllowedAuthEmail, normalizeAuthEmail } from "@/lib/auth-utils";

export type AskSalesFaqAccess =
  | {
      ok: true;
      viewerEmail: string;
      viewerName: string | null;
    }
  | {
      ok: false;
      status: 401 | 403;
      code: "not_signed_in" | "feature_disabled" | "not_approved_domain";
      message: string;
    };

export function isAskSalesFaqEnabled() {
  return process.env.ASK_SALES_FAQ_ENABLED === "true";
}

export function parseEmailAllowlist(value: string | undefined) {
  return new Set(
    (value || "")
      .split(",")
      .map((item) => normalizeAuthEmail(item))
      .filter((item): item is string => Boolean(item)),
  );
}

export function isAskSalesFaqAdmin(email: string | null | undefined) {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return false;
  return parseEmailAllowlist(process.env.ASK_SALES_FAQ_ADMIN_EMAILS).has(normalized);
}

export function getAskSalesFaqAccess(session: Session | null): AskSalesFaqAccess {
  const viewerEmail = normalizeAuthEmail(session?.user?.email);
  const viewerName = session?.user?.name?.trim() || null;

  if (!viewerEmail) {
    return {
      ok: false,
      status: 401,
      code: "not_signed_in",
      message: "Sign in with your dashboard Google account to use Ask Sales FAQ.",
    };
  }

  if (!isAskSalesFaqEnabled()) {
    return {
      ok: false,
      status: 403,
      code: "feature_disabled",
      message: "Ask Sales FAQ is not enabled for testing yet.",
    };
  }

  if (!isAllowedAuthEmail(viewerEmail)) {
    return {
      ok: false,
      status: 403,
      code: "not_approved_domain",
      message: "Ask Sales FAQ is available only to approved company Google accounts.",
    };
  }

  return {
    ok: true,
    viewerEmail,
    viewerName,
  };
}
