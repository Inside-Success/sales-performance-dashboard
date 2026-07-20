import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import {
  failQueuedKnowledgeRefreshReleaseAction,
  KnowledgeRefreshConflictError,
  KnowledgeRefreshValidationError,
  queueKnowledgeRefreshReleaseAction,
} from "@/lib/ask-sales-faq/knowledge-refresh-store";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const actionSchema = z.object({
  action: z.enum(["create_pull_requests", "publish_verified_release"]),
});

export async function POST(request: Request, context: { params: Promise<{ releaseId: string }> }) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) return Response.json({ error: "not_found" }, { status: 404 });
  const { releaseId } = await context.params;
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "validation_error", message: "Choose a valid governed release action." }, { status: 400 });

  let queued: Awaited<ReturnType<typeof queueKnowledgeRefreshReleaseAction>> | null = null;
  try {
    queued = await queueKnowledgeRefreshReleaseAction({ releaseId, action: parsed.data.action, actor: access.viewerEmail });
    const response = await fetch(queued.webhookUrl, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ releaseId, action: parsed.data.action, token: queued.token, attemptId: queued.attemptId }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error(`Inside Success publisher returned HTTP ${response.status}`);
    return Response.json({ releaseId, action: parsed.data.action, status: queued.status, queued: true });
  } catch (error) {
    if (queued) {
      await failQueuedKnowledgeRefreshReleaseAction({
        releaseId,
        action: parsed.data.action,
        actor: access.viewerEmail,
        message: error instanceof Error ? error.message : "The publisher could not be queued",
      }).catch(() => undefined);
    }
    if (error instanceof KnowledgeRefreshConflictError) return Response.json({ error: "conflict", message: error.message }, { status: 409 });
    if (error instanceof KnowledgeRefreshValidationError) return Response.json({ error: "validation_error", message: error.message }, { status: 400 });
    console.error("Ask Sales knowledge publisher queue failure", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "service_unavailable", message: "The governed publisher could not be queued. Production was not changed." }, { status: 503 });
  }
}
