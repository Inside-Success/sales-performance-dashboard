import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import {
  KnowledgeRefreshConflictError,
  KnowledgeRefreshValidationError,
  transitionKnowledgeRefreshCandidatesBatch,
} from "@/lib/ask-sales-faq/knowledge-refresh-store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  candidates: z.array(z.object({
    candidateId: z.string().min(1).max(160),
    expectedVersion: z.number().int().positive(),
  })).min(1).max(100),
  action: z.enum(["reject", "defer", "needs_owner", "duplicate", "engineering_required"]),
  note: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "validation_error", message: "Batch review request is invalid." }, { status: 400 });
  }
  try {
    return Response.json(await transitionKnowledgeRefreshCandidatesBatch({ actor: access.viewerEmail, ...parsed.data }));
  } catch (error) {
    if (error instanceof KnowledgeRefreshConflictError) {
      return Response.json({ error: "conflict", message: error.message }, { status: 409 });
    }
    if (error instanceof KnowledgeRefreshValidationError) {
      return Response.json({ error: "validation_error", message: error.message }, { status: 400 });
    }
    console.error("Ask Sales knowledge refresh batch review failure", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "internal_error", message: "The batch decision failed safely. No production policy was changed." }, { status: 500 });
  }
}
