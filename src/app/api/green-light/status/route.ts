import { NextRequest, NextResponse } from "next/server";
import { callWorkflow, requireGreenLightUser, workflowError } from "@/lib/green-light/server";
import { traceGreenLight } from "@/lib/green-light/trace-store";

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
      const draftText = typeof draft === "string" ? draft : "";
      const warnings = Array.isArray(payload.warnings) ? payload.warnings.filter((item) => typeof item === "string" && item.trim()) : [];
      // The letter exactly as the AI wrote it, before the rep touches it.
      traceGreenLight({
        event: "draft",
        job_id: jobId,
        rep_email: user.email,
        rep_name: user.name,
        show_type: typeof payload.show_type === "string" ? payload.show_type : "",
        prospect_name: typeof payload.guest_name === "string" ? payload.guest_name : "",
        doc_title: typeof payload.doc_title === "string" ? payload.doc_title : "",
        letter_text: draftText,
        detail: { warnings },
      });
      return NextResponse.json({
        ok: true,
        status: "complete",
        draft_text: draftText,
        show_type: payload.show_type,
        guest_name: payload.guest_name,
        doc_title: payload.doc_title,
        warnings,
      });
    }
    if (payload.status === "failed" || payload.ok === false) {
      const error = workflowError(payload, "The letter could not be generated.");
      traceGreenLight({ event: "failed", job_id: jobId, rep_email: user.email, rep_name: user.name, error });
      return NextResponse.json({ ok: true, status: "failed", error });
    }
    return NextResponse.json({ ok: true, status: "processing" });
  } catch {
    return NextResponse.json({ ok: false, code: "unreachable", error: "Status check did not answer." }, { status: 502 });
  }
}
