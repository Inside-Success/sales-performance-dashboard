import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import {
  getAskSalesFaqAccess,
  isAskSalesFaqAdmin,
} from "@/lib/ask-sales-faq/access";
import { getAskSalesFaqUsageOverview } from "@/lib/db";
export const dynamic = "force-dynamic";
export default async function Page({
  params,
}: {
  params: Promise<{ repKey: string }>;
}) {
  const access = getAskSalesFaqAccess(await auth());
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();
  const { repKey } = await params;
  const usage = await getAskSalesFaqUsageOverview(30);
  const rep = usage.users.find((u) => u.repReviewKey === repKey);
  if (!rep) notFound();
  redirect("/ask-sales-faq/admin?rep=" + encodeURIComponent(rep.viewerEmail));
}
