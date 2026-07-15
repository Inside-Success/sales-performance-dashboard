import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { AskSalesAdminHeader } from "@/components/ask-sales-faq/admin-navigation";
import { KnowledgeRefreshConsole } from "@/components/ask-sales-faq/knowledge-refresh-console";
import { getAskSalesFaqAccess, isAskSalesFaqAdmin } from "@/lib/ask-sales-faq/access";
import { getKnowledgeRefreshOverview } from "@/lib/ask-sales-faq/knowledge-refresh-store";
import type { KnowledgeRefreshConflictLevel } from "@/lib/ask-sales-faq/knowledge-refresh-governance";
import type { KnowledgeRefreshSourceKind } from "@/lib/ask-sales-faq/knowledge-refresh-sources";
import type { KnowledgeRefreshQueueView } from "@/lib/ask-sales-faq/knowledge-refresh-store";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales Knowledge Refresh | Magic Mike Bot",
  robots: { index: false, follow: false },
};

export default async function AskSalesKnowledgeRefreshPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);
  if (!access.ok || !isAskSalesFaqAdmin(access.viewerEmail)) notFound();

  const params = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const viewValue = first(params.view);
  const sourceValue = first(params.source);
  const conflictValue = first(params.conflict);
  const view = (["actionable", "approved", "resolved", "stale", "all"] as const).includes(viewValue as KnowledgeRefreshQueueView)
    ? viewValue as KnowledgeRefreshQueueView
    : "actionable";
  const sourceKind = (["slack_channel", "google_doc", "google_sheet", "all"] as const).includes(sourceValue as KnowledgeRefreshSourceKind | "all")
    ? sourceValue as KnowledgeRefreshSourceKind | "all"
    : "all";
  const conflictLevel = (["none", "possible", "direct", "blocked", "all"] as const).includes(conflictValue as KnowledgeRefreshConflictLevel | "all")
    ? conflictValue as KnowledgeRefreshConflictLevel | "all"
    : "all";
  const overview = await getKnowledgeRefreshOverview({
    view,
    sourceKind,
    conflictLevel,
    query: first(params.q) || "",
    page: Number(first(params.page)) || 1,
  });

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
