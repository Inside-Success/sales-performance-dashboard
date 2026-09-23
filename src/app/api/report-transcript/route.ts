import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getManualFeedbackReport, getPerformanceCall } from "@/lib/db";
import { resolveManualReportStatus } from "@/lib/manual-reports";
import { fetchManualTranscriptText, fetchTranscriptText } from "@/lib/report-chat";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Sign in to view this transcript." }, { status: 401 });
  }

  const reportType = request.nextUrl.searchParams.get("reportType");
  const reportId = request.nextUrl.searchParams.get("reportId")?.trim();
  if ((reportType !== "official" && reportType !== "manual") || !reportId || reportId.length > 100) {
    return NextResponse.json({ error: "Invalid transcript request." }, { status: 400 });
  }

  try {
    if (reportType === "manual") {
      const report = await getManualFeedbackReport(reportId);
      if (!report) return NextResponse.json({ error: "Report not found." }, { status: 404 });
      const resolvedReport = resolveManualReportStatus(report);
      if (resolvedReport.status !== "completed") {
        return NextResponse.json({ error: "Transcript is not available yet." }, { status: 404 });
      }
      const transcript = await fetchManualTranscriptText(resolvedReport);
      return transcriptResponse(transcript.text);
    }

    const call = await getPerformanceCall(reportId);
    if (!call) return NextResponse.json({ error: "Report not found." }, { status: 404 });
    const transcript = await fetchTranscriptText(call);
    return transcriptResponse(transcript.text);
  } catch {
    return NextResponse.json(
      { error: "The transcript could not be loaded. Use the source transcript link instead." },
      { status: 502, headers: { "Cache-Control": "private, no-store" } },
    );
  }
}

function transcriptResponse(text: string) {
  return NextResponse.json(
    { transcript: text },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
