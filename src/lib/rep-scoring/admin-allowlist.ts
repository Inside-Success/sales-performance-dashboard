import { normalizeAuthEmail } from "@/lib/auth-utils";

const DEFAULT_ADMIN_EMAIL = "syed.haider@insidesuccess.com";

export function getRepScoringAdminEmails() {
  const configured = process.env.REP_SCORING_ADMIN_EMAILS?.split(",")
    .map((email) => normalizeAuthEmail(email))
    .filter((email): email is string => Boolean(email));

  return new Set(configured?.length ? configured : [DEFAULT_ADMIN_EMAIL]);
}

export function isRepScoringAdmin(email: string | null | undefined) {
  const normalized = normalizeAuthEmail(email);
  return Boolean(normalized && getRepScoringAdminEmails().has(normalized));
}
