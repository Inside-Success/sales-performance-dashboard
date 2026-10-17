import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("@/lib/source-read", () => ({
  readAirtablePage: (url: string) => fetch(url),
}));
vi.mock("next/cache", () => ({ unstable_cache: (fn: unknown) => fn }));
vi.mock("@/lib/dashboard-read-snapshot", () => ({
  getReadSnapshot: vi.fn(async (spec: { load: () => Promise<unknown> }) => ({
    data: await spec.load(),
    fetchedAt: new Date().toISOString(),
    stale: false,
    refreshFailed: false,
  })),
  snapshotWarning: () => undefined,
}));
import { getReadSnapshot } from "@/lib/dashboard-read-snapshot";
import {
  attendanceDailySnapshotSpec,
  buildAttendanceSnapshot,
  getRepNoShowAnalytics,
} from "@/lib/rep-no-show";
import {
  miamiMidnight,
  shiftCalendarDay,
  normalizeAttendanceDay,
} from "@/lib/rep-no-show-calendar";
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const record = (
  id: string,
  date: string,
  absent = true,
  rep = "Example Rep",
) => ({
  id,
  fields: {
    "Rep Name": rep,
    "Client Name": "Example Client",
    "Meeting ID": id,
    "Meeting Start Date": date,
    "Ingested At": date,
    "Call #": "Call 2+",
    "AI Decision Reason": `attendance_status=${absent ? "rep_no_show" : "present"}: evidence`,
  },
});
describe("Miami daily attendance and rep drilldown facts", () => {
  it("uses calendar midnights across 23-hour and 25-hour daylight saving days", () => {
    for (const [day, hours] of [
      ["2026-03-08", 23],
      ["2026-11-01", 25],
    ] as const) {
      expect(
        (miamiMidnight(shiftCalendarDay(day, 1)).getTime() -
          miamiMidnight(day).getTime()) /
          3600000,
      ).toBe(hours);
    }
    expect(miamiMidnight("2026-10-15").toISOString()).toBe(
      "2026-10-15T04:00:00.000Z",
    );
    expect(normalizeAttendanceDay("today")).toBe("today");
    expect(normalizeAttendanceDay("invalid")).toBeUndefined();
  });
  it("keeps midnight exclusivity, denominator, deduplication and daily evidence consistent", async () => {
    vi.stubEnv("AIRTABLE_API_KEY", "test");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-15T16:00:00Z"));
    const rows = [
      record("old", "2026-05-30T12:00:00Z"),
      record("before", "2026-10-15T03:59:59Z"),
      record("midnight", "2026-10-15T04:00:00Z"),
      record("present", "2026-10-15T10:00:00Z", false),
      record("yesterday", "2026-10-14T04:00:00Z"),
      record("prior", "2026-10-14T03:59:59Z"),
      record("future", "2026-10-16T04:00:00Z"),
    ];
    rows.push({ ...rows[2], id: "duplicate" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation(async () => Response.json({ records: rows })),
    );
    const today = await getRepNoShowAnalytics(7, false, "today");
    const yesterday = await getRepNoShowAnalytics(7, false, "yesterday");
    expect(today.summary.eligibleCalls).toBe(2);
    expect(today.summary.repNoShows).toBe(1);
    expect(today.summary.noShowRate).toBe(0.5);
    expect(today.noShowLog.map((call) => call.id)).toEqual(["midnight"]);
    expect(today.summary.comparisonAvailable).toBe(false);
    expect(yesterday.summary.eligibleCalls).toBe(2);
    expect(yesterday.summary.repNoShows).toBe(2);
    expect(yesterday.summary.previousRepNoShows).toBe(1);
    expect(yesterday.summary.comparisonAvailable).toBe(true);
    for (const data of [today, yesterday]) {
      expect(data.topReps.reduce((sum, rep) => sum + rep.noShows, 0)).toBe(
        data.noShowLog.length,
      );
      for (const rep of data.topReps)
        expect(
          data.noShowLog.filter((call) => call.repSlug === rep.repSlug),
        ).toHaveLength(rep.noShows);
    }
  });
  it("loads a complete yesterday independently of a partial prior-day history read", async () => {
    vi.stubEnv("AIRTABLE_API_KEY", "test");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T16:00:00Z"));
    const oldTime = "2026-10-15T18:00:00Z";
    const context = buildAttendanceSnapshot(
      [record("old", "2026-05-30T12:00:00Z")],
      new Date(oldTime),
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({
          records: [record("complete", "2026-10-16T22:00:00Z")],
        }),
      ),
    );
    vi.mocked(getReadSnapshot).mockImplementationOnce(async (spec) => ({
      data: await spec.load(),
      fetchedAt: new Date().toISOString(),
      stale: false,
      refreshFailed: false,
    }));
    vi.mocked(getReadSnapshot).mockResolvedValueOnce({
      data: context,
      fetchedAt: oldTime,
      stale: true,
      refreshFailed: false,
    });
    const result = await getRepNoShowAnalytics(7, false, "yesterday");
    expect(result.summary.error).toBeUndefined();
    expect(result.summary.calendarDate).toBe("2026-10-16");
    expect(result.summary.repNoShows).toBe(1);
    expect(result.noShowLog.map((c) => c.id)).toEqual(["complete"]);
    expect(result.weeklyReadAt).toBe(oldTime);
  });
  it("uses new date keys after inactivity and never reuses live data as completed yesterday", () => {
    const live = attendanceDailySnapshotSpec(
      "today",
      new Date("2026-10-15T20:00:00Z"),
    );
    const closed = attendanceDailySnapshotSpec(
      "yesterday",
      new Date("2026-10-16T05:00:00Z"),
    );
    const later = attendanceDailySnapshotSpec(
      "today",
      new Date("2026-10-17T20:00:00Z"),
    );
    expect(live.key).toContain("2026-10-15:live");
    expect(closed.key).toContain("2026-10-15:closed");
    expect(closed.key).not.toBe(live.key);
    expect(later.key).toContain("2026-10-17:live");
  });
  it("accepts a successful empty daily source, but rejects failed or malformed pages", async () => {
    vi.stubEnv("AIRTABLE_API_KEY", "test");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-17T16:00:00Z"));
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({ records: [] })),
    );
    const empty = await attendanceDailySnapshotSpec("today").load();
    expect(empty.summary.eligibleCalls).toBe(0);
    expect(empty.noShowLog).toEqual([]);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        Response.json({ error: { message: "Source failed" } }, { status: 503 }),
      ),
    );
    await expect(attendanceDailySnapshotSpec("today").load()).rejects.toThrow(
      "Source failed",
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Response.json({})),
    );
    await expect(attendanceDailySnapshotSpec("today").load()).rejects.toThrow(
      "invalid page",
    );
  });
  it("uses bounded Miami dates and reads every source page including late-ingested calls", async () => {
    vi.stubEnv("AIRTABLE_API_KEY", "test");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-02T16:00:00Z"));
    const page = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          records: [record("first", "2026-11-01T04:00:00Z")],
          offset: "next",
        }),
      )
      .mockResolvedValueOnce(
        Response.json({ records: [record("last", "2026-11-02T04:59:59Z")] }),
      );
    vi.stubGlobal("fetch", page);
    const data = await attendanceDailySnapshotSpec("yesterday").load();
    expect(data.summary.repNoShows).toBe(2);
    expect(data.noShowLog).toHaveLength(2);
    const formula = new URL(page.mock.calls[0][0]).searchParams.get(
      "filterByFormula",
    )!;
    expect(formula).toContain("2026-10-31T04:00:00.000Z");
    expect(formula).toContain("2026-11-02T05:00:00.000Z");
    expect(formula).toContain("IF({Meeting Start Date}");
    expect(formula).not.toContain("NOW()");
    expect(new URL(page.mock.calls[1][0]).searchParams.get("offset")).toBe(
      "next",
    );
  });
  it("retains reps after the first twelve and sorts their evidence newest first", () => {
    const rows = Array.from({ length: 20 }, (_, i) =>
      record(`rep${i}`, "2026-10-14T12:00:00Z", true, `Rep ${i}`),
    );
    const data = buildAttendanceSnapshot(
      rows,
      new Date("2026-10-15T16:00:00Z"),
    );
    expect(data.periods[7].topReps).toHaveLength(20);
    expect(data.daily?.["2026-10-14"].topReps).toHaveLength(20);
    expect(data.history).toHaveLength(20);
  });
});
