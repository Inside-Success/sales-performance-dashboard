import { describe, it, expect } from "vitest";
import { buildSnapshot, field, categoryFor, sourceUrl } from "./collect";
import { libraryFilters } from "./schema";
const entry =
  "Message TS: 1792685120.162709\n*Sales Rep:* Alex Jones - Closer\n*Client Name:* Jane Smith\n*TV Show:* Next-Level CEO\n*Program:* Standard\n*Purchase Date:* 2026-10-22\n*Call Recording 1:* \n*Call Recording 2:* <https://us06web.zoom.us/rec/share/abc>\n";
const report = {
  id: 1,
  rep_name: "Alex Jones",
  client_name: "Jane Smith",
  call_date: "2026-10-21T12:00:00Z",
  meeting_link: "https://us06web.zoom.us/rec/share/abc?token=1",
  transcript_link: null,
  meeting_title: "Sales call",
  one_line_verdict: "Jane agreed to enroll.",
  close_section_type: "what_made_this_close_work",
};
describe("closed sales evidence boundaries", () => {
  it("does not consume the next field when a recording is blank", () => {
    expect(field(entry, "Call Recording 1")).toBe("");
    expect(field(entry, "Call Recording 2")).toContain("abc");
  });
  it("matches both people and the sale window, excludes onboarding", () => {
    const s = buildSnapshot(
      [entry],
      [
        report,
        { ...report, id: 2, rep_name: "Another Rep" },
        { ...report, id: 3, call_date: "2026-05-01T12:00:00Z" },
        { ...report, id: 4, meeting_title: "Onboarding call" },
      ],
      "2026-10-22T20:00:00Z",
      0,
    );
    expect(s.sales[0].reports.map((r) => r.id)).toEqual([1]);
    expect(s.sales[0].reports[0].match).toBe("recording");
  });
  it("does not call payment-only completion a closing example", () => {
    const s = buildSnapshot(
      [entry],
      [
        {
          ...report,
          one_line_verdict: "Payment troubleshooting after onboarding",
        },
      ],
      "2026-10-22T20:00:00Z",
      0,
    );
    expect(s.sales[0].reports[0].closingCandidate).toBe(false);
  });
  it("preserves unmatched recordings without inventing a closing report", () => {
    const s = buildSnapshot([entry], [], "2026-10-22T20:00:00Z", 0);
    expect(s.sales[0].recordings).toHaveLength(1);
    expect(s.sales[0].reports).toEqual([]);
  });
  it("groups repeated same-day entries but preserves source provenance", () => {
    const s = buildSnapshot(
      [entry, entry.replace("1792685120.162709", "1792685121.162709")],
      [],
      "2026-10-22T20:00:00Z",
      0,
    );
    expect(s.sales).toHaveLength(1);
    expect(s.sales[0].sources).toHaveLength(2);
  });
  it("labels DJ correctly and leaves unknown shows unclassified", () => {
    expect(categoryFor("Next-Level CEO")).toBe("DJ / NLCEO");
    expect(categoryFor("Other")).toBe("Other");
    expect(categoryFor("Mansion of Money")).toBe("Reality");
  });
  it("rejects unsafe links and malformed filters", () => {
    expect(sourceUrl("https://zoom.us.evil.test/rec/a")).toBeNull();
    expect(sourceUrl("javascript:alert(1)")).toBeNull();
    expect(
      libraryFilters({ page: "NaN", category: "invented", q: ["x"] }),
    ).toEqual({ page: 1, category: "", q: "", rep: "", reports: false });
  });
  it("retains missing client identities without merging unrelated entries", () => {
    const blank = entry.replace("Jane Smith", "");
    const s = buildSnapshot(
      [blank, blank.replace("1792685120.162709", "1792685121.162709")],
      [],
      "2026-10-22T20:00:00Z",
      0,
    );
    expect(s.sales).toHaveLength(2);
    expect(s.sales[0].client).toBe("Client name not supplied");
  });
  it("uses explicit corrections but never imports another client's forwarded recordings", () => {
    const threads = [
      {
        ts: "1792685120.162709",
        messages:
          "=== THREAD REPLIES (2 total) ===\n--- Reply 1 of 2 ---\nWrong call 2 recording here is correct recording:\n<https://zoom.us/rec/share/correct>\n--- Reply 2 of 2 ---\nForwarded message\n<https://zoom.us/rec/share/another-client>",
      },
    ];
    const s = buildSnapshot([entry], [], "2026-10-22T20:00:00Z", 1, threads);
    expect(s.sales[0].recordings).toEqual([
      {
        label: "Recording 2 (corrected in replies)",
        url: "https://zoom.us/rec/share/correct",
      },
    ]);
  });
});
