import { NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  callWorkflow,
  generateRequestSchema,
  logGreenLightEvent,
  multiClientFields,
  requireGreenLightUser,
  runAfterResponse,
  unreachable,
  workflowError,
} from "@/lib/green-light/server";
import { greenLightDeadlineText } from "@/lib/green-light/shows";
import { traceGreenLight } from "@/lib/green-light/trace-store";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  const user = await requireGreenLightUser();
  if (user instanceof NextResponse) return user;

  let input;
  try {
    input = generateRequestSchema.parse(await request.json());
  } catch (error) {
    return badRequest(error);
  }

  // Everything the rep gave for this letter, kept whole in the trace log.
  const given = {
    rep_email: user.email,
    rep_name: user.name,
    prospect_name: input.prospect_name,
    show_type: input.show,
    input_type: input.input_type,
    zoom_link: input.input_type === "zoom_link" ? input.zoom_link : undefined,
    focus_points: input.focus_points.join("\n"),
    transcript: input.transcript,
    detail: { multi: input.multi?.enabled ? input.multi : null },
  };

  try {
    const { ok, status, payload } = await callWorkflow("-start", {
      method: "POST",
      timeoutMs: 30000,
      body: {
        content: input.transcript,
        transcript: input.transcript,
        client_name: input.prospect_name,
        show_type: input.show,
        deadline_text: greenLightDeadlineText(input.show),
        requested_output: "v2_conditional_casting_approval",
        ...multiClientFields(input.multi, input.prospect_name),
        request_source: "rep",
        focus_points: input.focus_points,
        // No call transcript yet: the workflow writes the letter from the focus points alone.
        ...(input.input_type === "focus_points" ? { transcript_mode: "none" } : {}),
        timestamp: new Date().toISOString(),
      },
    });
    const jobId = typeof payload.job_id === "string" ? payload.job_id : "";
    if (!ok || !jobId) {
      const error = workflowError(payload, `Letter generation could not start (status ${status}).`);
      traceGreenLight({ ...given, event: "start_failed", error });
      return NextResponse.json({ ok: false, error }, { status: 502 });
    }
    traceGreenLight({ ...given, event: "generate", job_id: jobId });
    runAfterResponse(() =>
      logGreenLightEvent({
        event: "generate",
        rep_name: user.name,
        rep_email: user.email,
        prospect_name: input.prospect_name,
        show_type: input.show,
        input_type: input.input_type,
        // The log keeps the start of a long paste, not the whole thing.
        focus_points: input.focus_points.slice(0, 40).map((line) => line.slice(0, 500)),
        multi_prospect: Boolean(input.multi?.enabled),
        job_id: jobId,
      }),
    );
    return NextResponse.json({ ok: true, job_id: jobId });
  } catch {
    traceGreenLight({ ...given, event: "start_failed", error: "The letter workflow did not answer." });
    return unreachable("start the letter");
  }
}
