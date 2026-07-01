import type { Metadata } from "next";
import { ShieldAlert, Sparkles } from "lucide-react";
import { auth } from "@/auth";
import { AskSalesFaqChat } from "@/components/ask-sales-faq/ask-sales-faq-chat";
import { Badge } from "@/components/ui/badge";
import { getAskSalesFaqAccess } from "@/lib/ask-sales-faq/access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Ask Sales FAQ | Magic Mike Bot",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function AskSalesFaqPage() {
  const session = await auth();
  const access = getAskSalesFaqAccess(session);

  return (
    <main className="magic-page h-[calc(100dvh-72px)] min-h-0 overflow-hidden">
      <div className="flex h-full min-h-0 w-full flex-col">
        {access.ok ? (
          <AskSalesFaqChat />
        ) : (
          <section className="grid h-full place-items-center px-4 py-6">
            <div className="w-full max-w-xl rounded-lg border border-slate-200 bg-white/90 p-6 shadow-sm">
              <div className="mb-4 flex items-center gap-2">
                <span className="grid size-9 place-items-center rounded-lg bg-[#FEF2F2] text-[#DC2626]">
                  <ShieldAlert className="size-5" />
                </span>
                <Badge variant="outline" className="border-slate-200 bg-white">
                  Hidden testing route
                </Badge>
              </div>
              <h1 className="text-2xl font-extrabold tracking-normal text-slate-950">Ask Sales FAQ</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600">{access.message}</p>
              <div className="mt-5 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
                <Sparkles className="size-4 text-[#DC2626]" />
                Access is controlled by the testing allowlist.
              </div>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
