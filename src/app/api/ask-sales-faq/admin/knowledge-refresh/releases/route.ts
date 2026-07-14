import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import {
  KnowledgeRefreshConflictError,
  KnowledgeRefreshValidationError,
  prepareKnowledgeRefreshRelease,
} from "@/lib/ask-sales-faq/knowledge-refresh-store";

export const dynamic = "force-dynamic";

const releaseSchema = z.object({ candidateIds: z.array(z.string().min(1).max(160)).min(1).max(50) });

export async function POST(request: Request) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = releaseSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "validation_error", message: "Select valid content-approved candidates." }, { status: 400 });
  try {
    return Response.json(await prepareKnowledgeRefreshRelease({ candidateIds: parsed.data.candidateIds, actor: access.viewerEmail }));
  } catch (error) {
    if (error instanceof KnowledgeRefreshConflictError) return Response.json({ error: "conflict", message: error.message }, { status: 409 });
    if (error instanceof KnowledgeRefreshValidationError) return Response.json({ error: "validation_error", message: error.message }, { status: 400 });
    console.error("Ask Sales knowledge refresh release preparation failure", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "internal_error", message: "Release preparation failed safely. Production remains unchanged." }, { status: 500 });
  }
}
