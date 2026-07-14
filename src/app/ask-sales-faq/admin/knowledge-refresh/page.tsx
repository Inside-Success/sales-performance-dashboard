import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AskSalesAdminHeader } from "@/components/ask-sales-faq/admin-navigation";
import { KnowledgeRefreshConsole } from "@/components/ask-sales-faq/knowledge-refresh-console";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import { getKnowledgeRefreshOverview } from "@/lib/ask-sales-faq/knowledge-refresh-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales Knowledge Refresh | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function AskSalesKnowledgeRefreshPage() {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();

  const overview = await getKnowledgeRefreshOverview();

  return (
    <main className="magic-page min-h-[calc(100dvh-72px)] bg-[#f8fafc]">
      <div className="mx-auto flex w-full max-w-[88rem] flex-col gap-5 px-5 pb-16 pt-8 sm:px-8">
        <AskSalesAdminHeader
          active="refresh"
          title="Knowledge refresh"
          description="Review daily Slack and Google source changes, resolve conflicts, and prepare governed releases. Nothing on this page changes the live chatbot by itself."
          generatedAt={overview.generatedAt}
        />
        <KnowledgeRefreshConsole overview={overview} />
      </div>
    </main>
  );
}
