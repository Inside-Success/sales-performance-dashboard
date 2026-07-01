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
    <main className="magic-page">
      <div className="mx-auto flex min-h-[calc(100vh-72px)] w-full max-w-[92rem] flex-col px-4 py-5 sm:px-6 lg:px-8">
        {access.ok ? (
          <div className="-mx-4 -my-5 sm:-mx-6 lg:-mx-8">
            <AskSalesFaqChat viewerName={access.viewerName || "Signed-in user"} viewerEmail={access.viewerEmail} />
          </div>
        ) : (
          <section className="grid min-h-[60vh] place-items-center">
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
