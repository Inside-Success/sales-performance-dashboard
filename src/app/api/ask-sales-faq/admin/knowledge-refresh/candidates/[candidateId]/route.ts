import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import {
  KnowledgeRefreshConflictError,
  KnowledgeRefreshValidationError,
  transitionKnowledgeRefreshCandidate,
} from "@/lib/ask-sales-faq/knowledge-refresh-store";

export const dynamic = "force-dynamic";

const actionSchema = z.object({
  expectedVersion: z.number().int().positive(),
  action: z.enum(["approve_content", "reject", "defer", "needs_owner", "duplicate", "engineering_required"]),
  note: z.string().max(2000).nullable().optional(),
  editedPolicy: z.string().min(1).max(6000).nullable().optional(),
  conflictResolution: z.enum(["supersede", "scoped_coexistence", "existing_remains", "owner_needed", "historical_case", "engineering_required"]).nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ candidateId: string }> }) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) {
    return Response.json({ error: "not_found" }, { status: 404 });
  }
  const parsed = actionSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "validation_error", message: "Review action is invalid.", details: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    const { candidateId } = await context.params;
    return Response.json(await transitionKnowledgeRefreshCandidate({ candidateId, actor: access.viewerEmail, ...parsed.data }));
  } catch (error) {
    if (error instanceof KnowledgeRefreshConflictError) {
      return Response.json({ error: "conflict", message: error.message }, { status: 409 });
    }
    if (error instanceof KnowledgeRefreshValidationError) {
      return Response.json({ error: "validation_error", message: error.message }, { status: 400 });
    }
    console.error("Ask Sales knowledge refresh review failure", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "internal_error", message: "The review action failed safely. No production policy was changed." }, { status: 500 });
  }
}
