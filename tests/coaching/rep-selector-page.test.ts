import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const getDashboardData = vi.hoisted(() => vi.fn());
vi.mock("@/lib/db", () => ({ getDashboardData }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));
vi.mock("@/components/dashboard/usage-tracker", () => ({ TrackUsageEvent: () => null, trackUsageEvent: vi.fn() }));
vi.mock("@/components/dashboard/call-card", () => ({ CallCard: ({ call }: { call: { id: number } }) => React.createElement("div", null, `Report ${call.id}`) }));
vi.mock("@/components/dashboard/report-filters", () => ({ ReportFilters: () => null }));
vi.stubGlobal("React", React);

import CoachingHome from "@/app/coaching/page";

const recent = { rep_name: "Current Rep", rep_slug: "current", call_count: 150, latest_call_date: new Date().toISOString() };
const archived = { rep_name: "Archived Rep", rep_slug: "archived", call_count: 50, latest_call_date: "2025-01-01T00:00:00Z" };

describe("selector filtering leaves historical report access intact", () => {
  beforeEach(() => getDashboardData.mockReset());

  it("filters choices only, while requesting an active rep's historical date unchanged", async () => {
    getDashboardData.mockResolvedValue({ reps: [recent, archived], calls: [{ id: 10, rep_name: recent.rep_name }], configured: true });
    const html = renderToStaticMarkup(await CoachingHome({ searchParams: Promise.resolve({ rep: "current", date: "2025-01-01" }) }));
    expect(getDashboardData).toHaveBeenCalledWith({ rep: "current", date: "2025-01-01", q: undefined, client: undefined, from: undefined, to: undefined });
    expect(html).toContain("Report 10");
    expect(html).toContain("Current Rep");
    expect(html).not.toContain("Archived Rep");
  });

  it("preserves the selected name and reports on an archived rep's bookmarked URL", async () => {
    getDashboardData.mockResolvedValue({ reps: [recent, archived], calls: [{ id: 20, rep_name: archived.rep_name }], configured: true });
    const html = renderToStaticMarkup(await CoachingHome({ searchParams: Promise.resolve({ rep: "archived" }) }));
    expect(html).toContain("Archived Rep");
    expect(html).toContain("Report 20");
    expect(html).not.toContain("Select a rep");
  });

  it("counts only eligible selector names on the unselected homepage", async () => {
    getDashboardData.mockResolvedValue({ reps: [recent, archived], calls: [], configured: true });
    const html = renderToStaticMarkup(await CoachingHome({ searchParams: Promise.resolve({}) }));
    expect(html).toContain("Search 1 sales reps by name");
    expect(getDashboardData).toHaveBeenCalledWith({});
  });
});
