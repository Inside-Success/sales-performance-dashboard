import { auth } from "@/auth";
import { isMagicMikeAdmin } from "@/lib/admin-access-policy";
import { getRepNoShowAnalytics } from "@/lib/rep-no-show";
import { NextResponse } from "next/server";
export const dynamic = "force-dynamic";
export async function GET() {
  const session = await auth();
  if (!session?.user?.email) return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  if (!isMagicMikeAdmin(session.user.email)) return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  const data = await getRepNoShowAnalytics(7);
  if (data.summary.error) return NextResponse.json({ error: "History unavailable" }, { status: 503 });
  return NextResponse.json({ calls: data.noShowLog, fetchedAt: data.summary.generatedAt }, { headers: { "Cache-Control": "private, no-store" } });
}
