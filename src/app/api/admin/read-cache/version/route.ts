import { auth } from "@/auth";
import { isRepScoringAdmin } from "@/lib/rep-scoring/admin-allowlist";
import { neon } from "@neondatabase/serverless";
import { complianceSnapshotSpec } from "@/lib/compliance-dashboard";
import { scorecardSnapshotSpec } from "@/lib/rep-scoring/v7-validation";
import { attendanceSnapshotSpec, attendanceDailySnapshotSpec } from "@/lib/rep-no-show";
import { miamiDayKey } from "@/lib/rep-no-show-calendar";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  const session = await auth();
  if (!isRepScoringAdmin(session?.user?.email)) return Response.json({error:"Forbidden"},{status:403});
  const params = new URL(request.url).searchParams;
  const scope = params.get("scope"), day = params.get("day");
  const key = scope === "compliance" ? complianceSnapshotSpec().key
    : scope === "scorecard" ? scorecardSnapshotSpec().key
    : scope === "attendance" ? (day === "today" || day === "yesterday" ? attendanceDailySnapshotSpec(day).key : attendanceSnapshotSpec().key) : null;
  if (!key) return Response.json({error:"Invalid source"},{status:400});
  try {
    const rows = await neon(process.env.DATABASE_URL!).query("select fetched_at::text from dashboard_read_snapshots where key=$1",[key]);
    return Response.json({fetchedAt:rows[0]?.fetched_at ?? null, day:miamiDayKey(new Date())},{headers:{"Cache-Control":"private, no-store"}});
  } catch { return Response.json({error:"Version unavailable"},{status:503}); }
}
