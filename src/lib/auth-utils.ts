const DEFAULT_ALLOWED_DOMAINS = [
  "insidesuccesstv.com",
  "insidesuccess.com",
  "mawercapital.com",
  "nextlevelceotv.com",
];

const DEFAULT_ALLOWED_EMAILS = ["syed.haider@insidesuccess.com"];

export function normalizeAuthEmail(email: string | null | undefined) {
  const normalized = email?.trim().toLowerCase();
  return normalized || null;
}

export function getAuthEmailDomain(email: string | null | undefined) {
  const normalized = normalizeAuthEmail(email);
  if (!normalized || !normalized.includes("@")) return null;
  return normalized.split("@").pop() || null;
}

export function getAllowedAuthDomains() {
  const configured = process.env.AUTH_ALLOWED_DOMAINS?.split(",")
    .map((domain) => domain.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);

  return configured?.length ? configured : DEFAULT_ALLOWED_DOMAINS;
}

export function getAllowedAuthEmails() {
  const configured = process.env.AUTH_ALLOWED_EMAILS?.split(",")
    .map((email) => normalizeAuthEmail(email))
    .filter((email): email is string => Boolean(email));

  return new Set([...DEFAULT_ALLOWED_EMAILS, ...(configured || [])]);
}

export function isAllowedAuthEmail(email: string | null | undefined) {
  const normalized = normalizeAuthEmail(email);
  if (!normalized) return false;

  const domain = getAuthEmailDomain(normalized);
  return getAllowedAuthEmails().has(normalized) || Boolean(domain && getAllowedAuthDomains().includes(domain));
}
