import { describe, it, expect } from "vitest";
import {
  parseFilters,
  filterQuery,
  issueLabels,
} from "../../src/lib/ask-sales-faq/admin/filters";
const now = new Date("2026-09-17T02:00:00Z");
describe("manager filters", () => {
  it("uses Miami calendar days and inclusive seven-day bounds", () => {
    expect(parseFilters({ days: "7" }, now)).toMatchObject({
      start: "2026-09-10",
      end: "2026-09-16",
      includeAdmins: false,
    });
  });
  it("rejects impossible dates, reversed dates, future dates and oversized ranges", () => {
    for (const [start, end] of [
      ["2026-02-30", "2026-03-01"],
      ["2026-09-17", "2026-09-16"],
      ["2026-09-01", "2026-09-18"],
      ["2020-01-01", "2026-09-16"],
    ])
      expect(parseFilters({ start, end }, now).start).toBe("2026-08-18");
  });
  it("retains valid custom dates and safely roundtrips search strings", () => {
    const f = parseFilters(
      {
        start: "2026-09-01",
        end: "2026-09-12",
        q: "$30,000 & VIP",
        admins: "1",
      },
      now,
    );
    expect(f.includeAdmins).toBe(true);
    expect(
      new URLSearchParams(filterQuery(f, { filter: "down" })).get("q"),
    ).toBe("$30,000 & VIP");
  });
  it("bounds pagination and search, rejects unknown filters", () => {
    expect(
      parseFilters({ page: "-7", filter: "anything", q: "x".repeat(500) }, now),
    ).toMatchObject({ page: 1, filter: "all", q: "x".repeat(200) });
  });
  it("distinguishes feedback from factual error", () => {
    expect(issueLabels({ down: true })).toEqual(["Marked unhelpful"]);
  });
});
