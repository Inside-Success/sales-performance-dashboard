import { redirect, notFound } from "next/navigation";
import { auth } from "@/auth";
import {
  getAskSalesFaqAccess,
  isAskSalesFaqAdmin,
} from "@/lib/ask-sales-faq/access";
export const dynamic = "force-dynamic";
export default async function Page() {
  const access = getAskSalesFaqAccess(await auth());
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();
  redirect("/ask-sales-faq/admin");
}
