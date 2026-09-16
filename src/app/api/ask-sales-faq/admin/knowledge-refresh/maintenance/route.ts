import { auth } from "@/auth";
import {
  getAskSalesFaqAccess,
  isAskSalesFaqAdmin,
} from "@/lib/ask-sales-faq/access";
export const dynamic = "force-dynamic";
export async function POST() {
  const access = getAskSalesFaqAccess(await auth());
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail))
    return Response.json({ error: "not_found" }, { status: 404 });
  return Response.json(
    {
      error: "retired",
      message:
        "Knowledge updates are handled through the weekly review process. No changes were made.",
    },
    { status: 410 },
  );
}
