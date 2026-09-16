export type Params = Record<string, string | string[] | undefined>;
export function scalar(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] || "" : v || "";
}
export function parseFilters(p: Params, now = new Date()) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
  const valid = (s: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(s) &&
    !Number.isNaN(Date.parse(s)) &&
    new Date(s).toISOString().slice(0, 10) === s;
  const days = scalar(p.days) === "7" ? 7 : 30;
  const defaultStart = new Date(Date.parse(today) - (days - 1) * 86400000)
    .toISOString()
    .slice(0, 10);
  let start = scalar(p.start),
    end = scalar(p.end);
  if (
    !valid(start) ||
    !valid(end) ||
    start > end ||
    end > today ||
    Date.parse(end) - Date.parse(start) > 365 * 86400000
  ) {
    start = defaultStart;
    end = today;
  }
  const filter = ["all", "attention", "down", "failed", "unanswered"].includes(
    scalar(p.filter),
  )
    ? scalar(p.filter)
    : "all";
  const review = ["all", "pending", "reviewed"].includes(scalar(p.review))
    ? scalar(p.review)
    : "all";
  return {
    start,
    end,
    q: scalar(p.q).trim().slice(0, 200),
    rep: scalar(p.rep).trim().toLowerCase().slice(0, 254),
    filter,
    review,
    includeAdmins: scalar(p.admins) === "1",
    page: Math.max(
      1,
      Math.min(10000, Number.parseInt(scalar(p.page), 10) || 1),
    ),
    usage: ["all", "used", "never"].includes(scalar(p.usage))
      ? scalar(p.usage)
      : "all",
    sort: ["questions", "days", "recent", "name"].includes(scalar(p.sort))
      ? scalar(p.sort)
      : "questions",
  };
}
export type Filters = ReturnType<typeof parseFilters>;
export function filterQuery(
  f: Filters,
  changes: Record<string, string | number> = {},
) {
  return new URLSearchParams({
    start: f.start,
    end: f.end,
    q: f.q,
    rep: f.rep,
    filter: f.filter,
    review: f.review,
    admins: f.includeAdmins ? "1" : "0",
    usage: f.usage,
    sort: f.sort,
    ...Object.fromEntries(
      Object.entries(changes).map(([k, v]) => [k, String(v)]),
    ),
  }).toString();
}
export function issueLabels(row: {
  failed?: boolean;
  unanswered?: boolean;
  down?: boolean;
}) {
  return [
    row.failed ? "Response failed" : null,
    row.unanswered ? "Could not fully answer" : null,
    row.down ? "Marked unhelpful" : null,
  ].filter(Boolean) as string[];
}
