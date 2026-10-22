import { createHash } from "node:crypto";
import { snapshotSchema, type LibrarySale } from "./schema";

type ExistingReport = {
  id: string | number;
  rep_name: string | null;
  client_name: string | null;
  call_date: string;
  meeting_link: string | null;
  transcript_link: string | null;
  meeting_title: string | null;
  one_line_verdict: string | null;
  close_section_type: string | null;
};
export const normalize = (s: string | null) =>
  (s ?? "")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
export function field(text: string, key: string) {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return (
    new RegExp(`^\\*${escaped}:\\*[^\\S\\n]*(.*)$`, "m")
      .exec(text)?.[1]
      ?.trim() ?? ""
  );
}
export function sourceUrl(value: string) {
  const raw = /https:\/\/[^\s<>|]+/.exec(value)?.[0];
  if (!raw) return null;
  try {
    const u = new URL(raw.replace(/&amp;/g, "&"));
    if (u.username || u.password) return null;
    if (
      ![
        "docs.google.com",
        "drive.google.com",
        "istvoffical.slack.com",
        "zoom.us",
      ].includes(u.hostname) &&
      !u.hostname.endsWith(".zoom.us")
    )
      return null;
    return u.href;
  } catch {
    return null;
  }
}
function recordingKey(value: string | null) {
  if (!value) return "";
  try {
    let u = new URL(value);
    const original = u.searchParams.get("originRequestUrl");
    if (original && sourceUrl(original)) u = new URL(original);
    return `${u.hostname.endsWith("zoom.us") ? "zoom.us" : u.hostname}${u.pathname.replace(/\/$/, "")}`;
  } catch {
    return "";
  }
}
const reality = new Set([
  "entrepreneursisland",
  "mansionofmoney",
  "mansion",
  "businessrace",
  "millionairematchhouse",
  "startuplockdown",
]);
const documentary = new Set([
  "mompreneurs",
  "womeninpower",
  "legacymakers",
  "americasbestdoctors",
  "kingdomcreator",
  "operationceo",
  "bluecollaramerica",
  "americastopcontractors",
  "beyondsuccess",
  "loveexperts",
  "cleanthriving",
  "americasauthors",
  "americastopagents",
  "americasbestbuilders",
  "couplesempire",
  "projectbeauty",
  "madeitinamerica",
  "buildersofamerica",
  "lifechangers",
  "americastoplawyers",
  "madeinamerica",
  "impactmakers",
  "championsreborn",
  "americastopcoaches",
]);
export function categoryFor(show: string): LibrarySale["category"] {
  const n = normalize(show);
  if (/^(nextlevelceo|nlceo|daymondjohn|dj)$/.test(n)) return "DJ / NLCEO";
  if (reality.has(n)) return "Reality";
  if (documentary.has(n)) return "Documentary";
  return "Other";
}
export function buildSnapshot(
  entries: string[],
  reports: ExistingReport[],
  capturedAt: string,
  reviewedThreads: number,
  threads: Array<{ ts: string; messages: string }> = [],
) {
  const threadMap = new Map(threads.map((t) => [t.ts, t.messages]));
  const index = new Map<string, ExistingReport[]>();
  for (const r of reports) {
    if (!r.rep_name || !r.client_name) continue;
    const key = `${normalize(r.rep_name)}:${normalize(r.client_name)}`;
    index.set(key, [...(index.get(key) ?? []), r]);
  }
  const grouped = new Map<string, LibrarySale>();
  let sourceEntries = 0;
  for (const original of entries) {
    let entry = original;
    const ts = /Message TS: ([\d.]+)/.exec(entry)?.[1];
    if (!ts || !entry.includes("*Sales Rep:*")) continue;
    const thread = threadMap.get(ts) ?? "";
    const parent = thread.split("=== THREAD REPLIES")[0];
    if (parent.includes("*Sales Rep:*")) entry = parent;
    sourceEntries++;
    const rep =
      field(entry, "Sales Rep")
        .replace(/\s*-?\s*closer\s*$/i, "")
        .trim() || "Rep not supplied";
    const client = field(entry, "Client Name") || "Client name not supplied";
    const show = field(entry, "TV Show");
    const purchase = field(entry, "Purchase Date");
    const date =
      /^\d{4}-\d{2}-\d{2}$/.test(purchase) &&
      Number.isFinite(Date.parse(purchase))
        ? purchase
        : new Intl.DateTimeFormat("en-CA", {
            timeZone: "America/New_York",
          }).format(new Date(Number(ts) * 1000));
    const identityMissing =
      !field(entry, "Client Name") || !field(entry, "Sales Rep");
    const id = createHash("sha256")
      .update(
        `${normalize(rep)}:${normalize(client)}:${normalize(show)}:${date}:${identityMissing ? ts : ""}`,
      )
      .digest("hex")
      .slice(0, 24);
    const recordings: Array<{ label: string; url: string }> = [];
    for (let n = 1; n <= 4; n++) {
      const url = sourceUrl(field(entry, `Call Recording ${n}`));
      if (url && !recordings.some((r) => r.url === url))
        recordings.push({ label: `Recording ${n}`, url });
    }
    const replies = thread.includes("=== THREAD REPLIES")
      ? thread.split("=== THREAD REPLIES")[1]
      : "";
    for (const reply of replies.split(/--- Reply \d+ of \d+ ---/)) {
      // Quoted forms may belong to a different client; never import their links.
      if (
        /Forwarded message|\*Client Name:\*/i.test(reply) ||
        /welcome email|onboarding|scripting process|recording \d of the payment/i.test(
          reply,
        )
      )
        continue;
      for (const raw of reply.match(/https:\/\/[^\s<>|]+/g) ?? []) {
        const url = sourceUrl(raw);
        if (
          !url ||
          !new URL(url).hostname.endsWith("zoom.us") ||
          !new URL(url).pathname.startsWith("/rec/")
        )
          continue;
        if (recordings.some((r) => recordingKey(r.url) === recordingKey(url)))
          continue;
        const corrected =
          /wrong call 2 recording here is correct recording/i.test(reply);
        if (corrected) {
          const old = recordings.findIndex((r) => r.label === "Recording 2");
          if (old >= 0) recordings.splice(old, 1);
        }
        recordings.push({
          label: corrected
            ? "Recording 2 (corrected in replies)"
            : "Additional recording from replies",
          url,
        });
      }
    }
    const saleTime = Date.parse(`${date}T12:00:00Z`);
    const matched = (index.get(`${normalize(rep)}:${normalize(client)}`) ?? [])
      .filter((r) => {
        const age = (saleTime - Date.parse(r.call_date)) / 86400000;
        return (
          age >= -2 &&
          age <= 30 &&
          !/onboarding|script call|fulfillment|fulfilment/i.test(
            r.meeting_title ?? "",
          )
        );
      })
      .map((r) => ({
        id: Number(r.id),
        date: r.call_date,
        title: r.meeting_title ?? "Sales conversation",
        recording: sourceUrl(r.meeting_link ?? ""),
        transcript: sourceUrl(r.transcript_link ?? ""),
        outcome:
          r.one_line_verdict ?? "Open the report to review this conversation.",
        match: recordings.some(
          (v) => recordingKey(v.url) === recordingKey(r.meeting_link),
        )
          ? ("recording" as const)
          : ("identity" as const),
        closingCandidate:
          r.close_section_type === "what_made_this_close_work" &&
          !/card.issuer|payment troubleshooting|payment.only|already (?:paid|signed|enrolled)|welcome email|onboarding/i.test(
            r.one_line_verdict ?? "",
          ),
      }))
      .sort(
        (a, b) =>
          Number(b.closingCandidate) - Number(a.closingCandidate) ||
          b.date.localeCompare(a.date),
      );
    const source = `https://istvoffical.slack.com/archives/C07TQKSJ5J8/p${ts.replace(".", "")}`;
    const row: LibrarySale = {
      id,
      client,
      rep,
      show,
      category: categoryFor(show),
      package: field(entry, "Program"),
      date,
      sources: [source],
      recordings,
      reports: matched,
      reviewNote: matched.length
        ? "Related reports are listed with their existing call outcomes. Use the conversation where the sale was agreed, rather than a later payment or onboarding follow-up."
        : "These are the recordings supplied with the sale. No coaching report was matched confidently by rep, client name and sale date. The closing conversation has not been independently confirmed.",
    };
    if (
      /refunded|refund request|asked for a refund|wants? to cancel|wanted refund|stop work/i.test(
        replies,
      )
    )
      row.reviewNote =
        "Follow-up replies discuss a refund or cancellation. Check the sales entry for its latest status. " +
        row.reviewNote;
    const previous = grouped.get(id);
    if (previous) {
      previous.sources.push(source);
      for (const recording of recordings) {
        if (!previous.recordings.some((r) => r.url === recording.url))
          previous.recordings.push(recording);
      }
    } else grouped.set(id, row);
  }
  return snapshotSchema.parse({
    version: 1,
    capturedAt,
    from: "2026-04-22",
    through: "2026-10-22",
    sourceEntries,
    reviewedThreads,
    sales: [...grouped.values()].sort(
      (a, b) =>
        b.date.localeCompare(a.date) || a.client.localeCompare(b.client),
    ),
  });
}
