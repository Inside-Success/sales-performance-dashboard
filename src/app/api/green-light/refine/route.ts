import { after, NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  callWorkflow,
  logGreenLightEvent,
  multiClientFields,
  refineRequestSchema,
  requireGreenLightUser,
  unreachable,
  workflowError,
} from "@/lib/green-light/server";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const user = await requireGreenLightUser();
  if (user instanceof NextResponse) return user;

  let input;
  try {
    input = refineRequestSchema.parse(await request.json());
  } catch (error) {
    return badRequest(error);
  }

  try {
    const { ok, status, payload } = await callWorkflow("-refine", {
      method: "POST",
      timeoutMs: 170000,
      body: {
        draft_text: input.draft_text,
        letter_text: input.draft_text,
        instructions: input.instructions,
        query: input.instructions,
        transcript: input.transcript,
        content: input.transcript,
        show_type: input.show,
        guest_name: input.guest_name || "",
        client_name: input.prospect_name,
        doc_title: input.doc_title || "",
        warnings: input.warnings || [],
        ...multiClientFields(input.multi, input.prospect_name),
        timestamp: new Date().toISOString(),
      },
    });
    const draft = [payload.draft_text, payload.preview].find((value) => typeof value === "string" && value.trim());
    if (!ok || payload.ok === false || typeof draft !== "string") {
      return NextResponse.json(
        { ok: false, error: workflowError(payload, `The change could not be applied (status ${status}). Your letter was not changed.`) },
        { status: ok ? 422 : 502 },
      );
    }
    after(() =>
      logGreenLightEvent({
        event: "refine",
        rep_name: user.name,
        rep_email: user.email,
        prospect_name: input.prospect_name,
        show_type: input.show,
        job_id: input.job_id,
        detail: input.instructions,
      }),
    );
    return NextResponse.json({
      ok: true,
      draft_text: draft,
      guest_name: payload.guest_name,
      doc_title: payload.doc_title,
      warnings: Array.isArray(payload.warnings) ? payload.warnings.filter((item) => typeof item === "string" && item.trim()) : input.warnings || [],
    });
  } catch {
    return unreachable("apply the change");
  }
}
