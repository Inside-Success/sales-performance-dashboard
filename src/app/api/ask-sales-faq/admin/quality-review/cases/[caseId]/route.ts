import { z } from "zod";
import { auth } from "@/auth";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import { transitionAskSalesQualityCase } from "@/lib/ask-sales-faq/quality-review-store";

export const dynamic = "force-dynamic";

const requestSchema = z.object({
  expectedVersion: z.number().int().positive(),
  action: z.enum(["answer_correct", "knowledge_gap", "runtime_issue", "wrong_answer", "wrong_policy", "correct_safe_route", "non_faq", "needs_owner", "defer", "mark_fixed", "ignore"]),
  note: z.string().max(2000).nullable().optional(),
});

export async function POST(request: Request, context: { params: Promise<{ caseId: string }> }) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok) return Response.json({ error: access.code, message: access.message }, { status: access.status });
  if (!isAskSalesFaqAdmin(access.viewerEmail)) return Response.json({ error: "not_found" }, { status: 404 });

  const parsed = requestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "validation_error", message: "Invalid quality-review decision." }, { status: 400 });
  try {
    const { caseId } = await context.params;
    return Response.json(await transitionAskSalesQualityCase({
      caseId,
      expectedVersion: parsed.data.expectedVersion,
      action: parsed.data.action,
      actor: access.viewerEmail,
      note: parsed.data.note,
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : "Quality-review decision failed safely.";
    return Response.json({ error: /changed/i.test(message) ? "conflict" : "validation_error", message }, { status: /changed/i.test(message) ? 409 : 400 });
  }
}
