import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { refreshReadSnapshot } from "@/lib/dashboard-read-snapshot";
import { attendanceSnapshotSpec } from "@/lib/rep-no-show";
import { complianceSnapshotSpec } from "@/lib/compliance-dashboard";
import { scorecardVersion } from "@/lib/rep-scoring/scorer-version";
import { scorecardSnapshotSpec } from "@/lib/rep-scoring/v7-validation";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization") || "";
  const wanted = `Bearer ${expected || ""}`;
  if (!expected || Buffer.byteLength(actual) !== Buffer.byteLength(wanted) || !timingSafeEqual(Buffer.from(actual), Buffer.from(wanted)))
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (process.env.MAGIC_MIKE_READ_SNAPSHOTS_ENABLED === "false" && request.nextUrl.searchParams.get("bootstrap") !== "1") return NextResponse.json({ state: "disabled" });
  // Independent sources have separate leases; the two Airtable readers use different bases.
  const results: Record<string, string> = {};
  const specs = [["compliance", complianceSnapshotSpec()], ["scorecard", scorecardSnapshotSpec(scorecardVersion())], ["attendance", attendanceSnapshotSpec()]] as const;
  await Promise.all(specs.map(async ([name, spec]) => {
    try { results[name] = await refreshReadSnapshot<unknown>(spec); }
    catch { results[name] = "refresh_failed_previous_data_retained"; }
  }));
  return NextResponse.json({ results }, { status: Object.values(results).some(x => x.includes("failed")) ? 503 : 200 });
}
