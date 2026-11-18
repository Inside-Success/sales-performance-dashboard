import { after, NextRequest, NextResponse } from "next/server";
import {
  badRequest,
  callWorkflow,
  logGreenLightEvent,
  multiClientFields,
  requireGreenLightUser,
  saveRequestSchema,
  unreachable,
  workflowError,
} from "@/lib/green-light/server";
import { googleDocPdfUrl } from "@/lib/green-light/shows";
import { recordGreenLightTrace } from "@/lib/green-light/trace-store";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function POST(request: NextRequest) {
  const user = await requireGreenLightUser();
  if (user instanceof NextResponse) return user;

  let input;
  try {
    input = saveRequestSchema.parse(await request.json());
  } catch (error) {
    return badRequest(error);
  }

  // The final text exactly as it goes to the Google Doc, kept in the trace log.
  const sent = {
    rep_email: user.email,
    rep_name: user.name,
    job_id: input.job_id,
    prospect_name: input.prospect_name,
    show_type: input.show,
    letter_text: input.draft_text,
    detail: { multi: input.multi?.enabled ? input.multi : null, warnings: input.warnings || [] },
  };

  try {
    const { ok, status, payload } = await callWorkflow("-save", {
      method: "POST",
      timeoutMs: 170000,
      body: {
        letter_text: input.draft_text,
        draft_text: input.draft_text,
        show_type: input.show,
        guest_name: input.guest_name || "",
        client_name: input.prospect_name,
        doc_title: input.doc_title || "",
        warnings: input.warnings || [],
        ...multiClientFields(input.multi, input.prospect_name),
        // The rep's folder comes from the signed-in Google account, never from the browser.
        editor_name: user.name,
        editorName: user.name,
        folder_group: "reps",
        requested_output: "v2_conditional_casting_approval_save",
        timestamp: new Date().toISOString(),
      },
    });
    const documentUrl = typeof payload.document_url === "string" ? payload.document_url : "";
    if (!ok || payload.ok === false || !documentUrl) {
      const error = workflowError(payload, `The letter could not be created (status ${status}). Try again.`);
      after(() => recordGreenLightTrace({ ...sent, event: "save_failed", error }));
      return NextResponse.json({ ok: false, error }, { status: ok ? 422 : 502 });
    }
    const docTitle = typeof payload.doc_title === "string" ? payload.doc_title : input.doc_title || "Green light letter";
    after(() => recordGreenLightTrace({ ...sent, event: "save", document_url: documentUrl, doc_title: docTitle }));
    after(() =>
      logGreenLightEvent({
        event: "save",
        rep_name: user.name,
        rep_email: user.email,
        prospect_name: input.prospect_name,
        show_type: input.show,
        multi_prospect: Boolean(input.multi?.enabled),
        job_id: input.job_id,
        doc_title: docTitle,
        document_url: documentUrl,
      }),
    );
    return NextResponse.json({ ok: true, document_url: documentUrl, pdf_url: googleDocPdfUrl(documentUrl), doc_title: docTitle, folder: user.name });
  } catch {
    after(() => recordGreenLightTrace({ ...sent, event: "save_failed", error: "The letter workflow did not answer." }));
    return unreachable("create the letter");
  }
}
