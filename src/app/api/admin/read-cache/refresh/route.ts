import { neon } from "@neondatabase/serverless";
import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { refreshReadSnapshot } from "@/lib/dashboard-read-snapshot";
import {
  attendanceDailySnapshotSpec,
  attendanceSnapshotSpec,
} from "@/lib/rep-no-show";
import { complianceSnapshotSpec } from "@/lib/compliance-dashboard";
import { scorecardVersion } from "@/lib/rep-scoring/scorer-version";
import { scorecardSnapshotSpec } from "@/lib/rep-scoring/v7-validation";
export const dynamic = "force-dynamic";
export const maxDuration = 300;
export async function GET(request: NextRequest) {
  const expected = process.env.CRON_SECRET;
  const actual = request.headers.get("authorization") || "";
  const wanted = `Bearer ${expected || ""}`;
  if (
    !expected ||
    Buffer.byteLength(actual) !== Buffer.byteLength(wanted) ||
    !timingSafeEqual(Buffer.from(actual), Buffer.from(wanted))
  )
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (request.nextUrl.searchParams.get("inspect") === "1") {
    if (!process.env.DATABASE_URL)
      return NextResponse.json(
        { error: "Storage unavailable" },
        { status: 503 },
      );
    const rows = await neon(process.env.DATABASE_URL)
      .query(`select split_part(key,':',1) as source, fetched_at::text, failed_at::text,
      last_requested_at::text, lease_until::text, octet_length(payload::text) as json_bytes,
      case when jsonb_typeof(payload)='array' then jsonb_array_length(payload) else null end as records
      from dashboard_read_snapshots order by key limit 20`);
    return NextResponse.json(
      { sources: rows },
      { headers: { "Cache-Control": "private, no-store" } },
    );
  }
  if (
    process.env.MAGIC_MIKE_READ_SNAPSHOTS_ENABLED === "false" &&
    request.nextUrl.searchParams.get("bootstrap") !== "1"
  )
    return NextResponse.json({ state: "disabled" });
  // Independent sources have separate leases; the two Airtable readers use different bases.
  const results: Record<string, string> = {};
  const specs = [
    ["compliance", complianceSnapshotSpec()],
    ["scorecard", scorecardSnapshotSpec(scorecardVersion())],
    ["attendance", attendanceSnapshotSpec()],
  ] as const;
  await Promise.all(
    specs.map(async ([name, spec]) => {
      if (name === "attendance") {
        // One reader at a time against the shared attendance base; do not cause a 429 storm.
        for (const day of ["today", "yesterday"] as const) {
          try {
            results[`attendance_${day}`] = await refreshReadSnapshot(
              attendanceDailySnapshotSpec(day),
              request.nextUrl.searchParams.get("bootstrap") !== "1",
            );
          } catch {
            results[`attendance_${day}`] =
              "refresh_failed_previous_data_retained";
          }
        }
      }
      try {
        results[name] = await refreshReadSnapshot<unknown>(
          spec,
          request.nextUrl.searchParams.get("bootstrap") !== "1",
        );
      } catch {
        results[name] = "refresh_failed_previous_data_retained";
      }
    }),
  );
  return NextResponse.json(
    { results },
    {
      status: Object.values(results).some((x) => x.includes("failed"))
        ? 503
        : 200,
    },
  );
}
