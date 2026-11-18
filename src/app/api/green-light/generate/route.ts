import { after, NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  callWorkflow,
  generateRequestSchema,
  logGreenLightEvent,
  multiClientFields,
  requireGreenLightUser,
  unreachable,
  workflowError,
} from "@/lib/green-light/server";
import { greenLightDeadlineText } from "@/lib/green-light/shows";

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
      return NextResponse.json({ ok: false, error: workflowError(payload, `Letter generation could not start (status ${status}).`) }, { status: 502 });
    }
    after(() =>
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
    return unreachable("start the letter");
  }
}
