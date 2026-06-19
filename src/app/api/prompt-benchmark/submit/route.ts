import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { ZodError } from "zod";
import { promptBenchmarkSubmitSchema } from "@/lib/prompt-benchmark";
import { resolveZoomTranscript } from "@/lib/zoom-transcript";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const webhookUrl = process.env.PROMPT_BENCHMARK_WEBHOOK_URL;

  if (!webhookUrl) {
    return NextResponse.json(
      { ok: false, error: "PROMPT_BENCHMARK_WEBHOOK_URL is not configured" },
      { status: 500 },
    );
  }

  try {
    const body = await request.json();
    const payload = promptBenchmarkSubmitSchema.parse(body);
    const manualCaseId = `manual-${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    let transcriptText = payload.input_type === "transcript" ? payload.transcript_text : null;
    let transcriptLink: string | null = null;

    if (payload.input_type === "zoom_link" && payload.zoom_link) {
      const resolved = await resolveZoomTranscript(payload.zoom_link);
      transcriptText = resolved?.transcriptText || null;
      transcriptLink = resolved?.transcriptUrl || null;
    }

    if (!transcriptText || transcriptText.length < 80) {
      return NextResponse.json(
        { ok: false, error: "Could not resolve a usable transcript." },
        { status: 400 },
      );
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const headers: Record<string, string> = {
      "content-type": "application/json",
      "x-prompt-benchmark-source": "sales-performance-dashboard",
    };

    if (process.env.PROMPT_BENCHMARK_WEBHOOK_SECRET) {
      headers.authorization = `Bearer ${process.env.PROMPT_BENCHMARK_WEBHOOK_SECRET}`;
    }

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        source: "dashboard_submit",
        run_title: payload.title || "Manual Magic Mike prompt benchmark",
        dashboard_base_url: origin,
        cases: [
          {
            case_id: manualCaseId,
            case_label: payload.title || "Manual benchmark case",
            case_type: "manual",
            expected_call_status: "scored",
            rep_name: payload.rep_name,
            client_name: payload.client_name,
            transcript_text: transcriptText,
            transcript_link: transcriptLink,
            zoom_link: payload.input_type === "zoom_link" ? payload.zoom_link : null,
          },
        ],
      }),
      signal: AbortSignal.timeout(20000),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      return NextResponse.json(
        { ok: false, error: data.error || `Benchmark workflow returned HTTP ${response.status}` },
        { status: 502 },
      );
    }

    return NextResponse.json({
      ok: true,
      case_id: manualCaseId,
      run_id: data.run_id || null,
      sheet_url: data.sheet_url || null,
      dashboard_url: data.dashboard_url || null,
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { ok: false, error: "Invalid payload", details: error.flatten() },
        { status: 400 },
      );
    }

    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Benchmark submit failed" },
      { status: 400 },
    );
  }
}
