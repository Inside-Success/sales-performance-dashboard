import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import { recomputeActionableKnowledgeRefreshGovernance } from "@/lib/ask-sales-faq/knowledge-refresh-store";

export const dynamic = "force-dynamic";

const bodySchema = z.object({ action: z.literal("recompute_governance") });

export async function POST(request: Request) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "validation_error", message: "Maintenance request is invalid." }, { status: 400 });
  }
  try {
    return Response.json(await recomputeActionableKnowledgeRefreshGovernance({ actor: access.viewerEmail }));
  } catch (error) {
    console.error("Ask Sales knowledge refresh maintenance failure", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "internal_error", message: "Conflict labels were not refreshed. Candidate decisions and production knowledge were unchanged." }, { status: 500 });
  }
}
