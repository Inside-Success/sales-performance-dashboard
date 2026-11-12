import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ManagementOverview, managementSummary } from "@/app/manager/script-adherence/management-overview";
import type { AdherenceGroup } from "@/lib/script-adherence/data";
import { LEGACY_VERSION, UPDATED_VERSION } from "@/lib/script-adherence/versions";

const action = (id: string, complete: number, notComplete: number) =>
  ({ id, complete, notComplete, unknown: 80, notApplicable: 90, deferred: 10 });
const group = (rubricVersion: string, actions: AdherenceGroup["actions"]): AdherenceGroup =>
  ({ id: "reality_call_1", rubricVersion, actions });

describe("management overview", () => {
  it("uses weighted assessable actions and excludes unknown, deferred and not-required counts", () => {
    const [summary] = managementSummary([group(UPDATED_VERSION, [action("video_1", 1, 1), action("video_2", 90, 10)])]);
    expect(summary.complete).toBe(91);
    expect(summary.assessed).toBe(102);
    const html = renderToStaticMarkup(<ManagementOverview groups={[group(UPDATED_VERSION, [action("video_1", 1, 1), action("video_2", 90, 10)])]} />);
    expect(html).toContain("89%");
    expect(html).toContain("Not complete in 10 of 100 assessable calls (10%)");
    expect(html.indexOf("Video 2 — Show pitch")).toBeLessThan(html.indexOf("Video 1 — Introduction"));
  });
  it("keeps requirements and missed counts separate across saved script versions", () => {
    const groups = [group(UPDATED_VERSION, [action("video_1", 8, 2)]), group(LEGACY_VERSION, [action("video_1", 1, 9)])];
    const before = JSON.stringify(groups);
    const summaries = managementSummary(groups);
    expect(summaries).toHaveLength(2);
    expect(summaries.map((item) => item.versionLabel)).toEqual(["Earlier script", "Updated script"]);
    const html = renderToStaticMarkup(<ManagementOverview groups={groups} />);
    expect(html).toContain("Not complete in 9 of 10 assessable calls (90%)");
    expect(html).toContain("Not complete in 2 of 10 assessable calls (20%)");
    expect(JSON.stringify(groups)).toBe(before);
  });
  it("caps follow-ups at five and retains script context for identically named actions", () => {
    const html = renderToStaticMarkup(<ManagementOverview groups={[
      group(UPDATED_VERSION, [action("consent", 9, 1), action("purpose", 8, 2), action("business", 7, 3), action("video_1", 6, 4), action("video_2", 5, 5)]),
      { id: "documentary_call_2", rubricVersion: UPDATED_VERSION, actions: [action("video_1", 1, 6)] },
    ]} />);
    expect(html.match(/<li /g)).toHaveLength(5);
    expect(html).toContain("Video 1 — Studio tour");
    expect(html).toContain("Documentary · Call 2");
    expect(html).not.toContain("Recording consent");
  });
  it("shows unavailable denominators as a dash and distinguishes empty data from perfect completion", () => {
    expect(renderToStaticMarkup(<ManagementOverview groups={[]} />)).toContain("No assessable actions to compare yet.");
    const html = renderToStaticMarkup(<ManagementOverview groups={[group(UPDATED_VERSION, [action("video_1", 0, 0)])]} />);
    expect(html).toContain("—");
    expect(html).not.toContain("100%");
    expect(renderToStaticMarkup(<ManagementOverview groups={[group(UPDATED_VERSION, [action("video_1", 2, 0)])]} />)).toContain("No incomplete actions identified.");
  });
});
