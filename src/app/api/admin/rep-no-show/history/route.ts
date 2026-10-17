import { auth } from "@/auth";
import { isMagicMikeAdmin } from "@/lib/admin-access-policy";
import { getRepNoShowAnalytics } from "@/lib/rep-no-show";
import { normalizeAttendanceDay } from "@/lib/rep-no-show-calendar";
import { NextRequest, NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.email)
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!isMagicMikeAdmin(session.user.email))
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );
  const day = normalizeAttendanceDay(request.nextUrl.searchParams.get("day"));
  const data = await getRepNoShowAnalytics(7, !day, day);
  if (data.summary.error)
    return NextResponse.json({ error: "History unavailable" }, { status: 503 });
  return NextResponse.json(
    { calls: data.noShowLog, fetchedAt: data.summary.generatedAt },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
