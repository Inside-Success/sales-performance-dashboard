import { APPROVED_ADMIN_EMAILS } from "@/lib/approved-admin-emails";
import { normalizeAuthEmail } from "@/lib/auth-utils";

function configuredEmails(value: string | undefined) {
  return (value || "").split(",").map(normalizeAuthEmail)
    .filter((email): email is string => Boolean(email?.includes("@")));
}

export function getMagicMikeAdminEmails() {
  return new Set<string>([
    ...APPROVED_ADMIN_EMAILS,
    ...configuredEmails(process.env.REP_SCORING_ADMIN_EMAILS),
  ]);
}

export function isMagicMikeAdmin(email: string | null | undefined) {
  const normalized = normalizeAuthEmail(email);
  return Boolean(normalized && getMagicMikeAdminEmails().has(normalized));
}

export function getSalesFaqAdminEmails() {
  return new Set([
    ...getMagicMikeAdminEmails(),
    ...configuredEmails(process.env.ASK_SALES_FAQ_ADMIN_EMAILS),
  ]);
}

export function isSalesFaqAdmin(email: string | null | undefined) {
  const normalized = normalizeAuthEmail(email);
  return Boolean(normalized && getSalesFaqAdminEmails().has(normalized));
}

export function canAccessAdminDirectory(email: string | null | undefined) {
  return isMagicMikeAdmin(email) || isSalesFaqAdmin(email);
}
