import { z } from "zod";
import { auth } from "@/auth";
import {
  getAskSalesFaqAccess,
  isAskSalesFaqAdmin,
} from "@/lib/ask-sales-faq/access";
import { saveReview } from "@/lib/ask-sales-faq/admin/store";
export const dynamic = "force-dynamic";
const schema = z.object({
  reviewed: z.boolean(),
  note: z.string().trim().max(2000),
  version: z.number().int().min(0),
  through: z.string().datetime({ offset: true }),
});
export async function POST(
  request: Request,
  { params }: { params: Promise<{ conversationId: string }> },
) {
  const access = getAskSalesFaqAccess(await auth());
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail))
    return Response.json({ error: "Not found" }, { status: 404 });
  if (request.headers.get("origin") !== new URL(request.url).origin)
    return Response.json({ error: "Invalid origin" }, { status: 403 });
  const data = schema.safeParse(await request.json().catch(() => null));
  if (!data.success)
    return Response.json(
      { error: "Check the note and try again." },
      { status: 400 },
    );
  const { conversationId } = await params;
  try {
    const saved = await saveReview(
      conversationId,
      access.viewerEmail,
      data.data,
    );
    return Response.json(
      saved
        ? { ok: true }
        : {
            error:
              "This conversation changed or was reviewed elsewhere. Reload before saving.",
          },
      { status: saved ? 200 : 409 },
    );
  } catch {
    return Response.json(
      {
        error:
          "Could not save. Your changes have not been confirmed; please retry.",
      },
      { status: 503 },
    );
  }
}
