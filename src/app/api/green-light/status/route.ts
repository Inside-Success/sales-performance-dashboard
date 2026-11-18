import { NextRequest, NextResponse } from "next/server";
import { callWorkflow, requireGreenLightUser, workflowError } from "@/lib/green-light/server";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const user = await requireGreenLightUser();
  if (user instanceof NextResponse) return user;

  const jobId = request.nextUrl.searchParams.get("job_id") || "";
  if (!/^v2_\d{10,16}_[a-z0-9]{1,12}$/.test(jobId)) {
    return NextResponse.json({ ok: false, code: "invalid", error: "Unknown letter job." }, { status: 400 });
  }

  try {
    const { ok, status, payload } = await callWorkflow("-status", {
      method: "GET",
      timeoutMs: 20000,
      query: { job_id: jobId, _: String(Date.now()) },
    });
    if (!ok) {
      // Temporary: the page keeps polling and only gives up after repeated failures.
      return NextResponse.json({ ok: false, code: "unreachable", error: workflowError(payload, `Status check failed (status ${status}).`) }, { status: 502 });
    }
    if (payload.status === "complete" || payload.mode === "draft") {
      const draft = [payload.draft_text, payload.preview, payload.letter_text].find((value) => typeof value === "string" && value.trim());
      return NextResponse.json({
        ok: true,
        status: "complete",
        draft_text: typeof draft === "string" ? draft : "",
        show_type: payload.show_type,
        guest_name: payload.guest_name,
        doc_title: payload.doc_title,
        warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((item) => typeof item === "string" && item.trim()) : [],
      });
    }
    if (payload.status === "failed" || payload.ok === false) {
      return NextResponse.json({ ok: true, status: "failed", error: workflowError(payload, "The letter could not be generated.") });
    }
    return NextResponse.json({ ok: true, status: "processing" });
  } catch {
    return NextResponse.json({ ok: false, code: "unreachable", error: "Status check did not answer." }, { status: 502 });
  }
}
