import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { requireRepScoringAdmin } from "@/lib/rep-scoring/access";

export default async function ManagerLayout({ children }: { children: ReactNode }) {
  await requireRepScoringAdmin();
  return <>
    <nav aria-label="Admin directory" className="shrink-0 bg-[#fbfafb]">
      <div className="mx-auto max-w-[84rem] px-5 pt-3 sm:px-8">
        <Link href="/admin" className="inline-flex min-h-11 items-center gap-2 rounded-lg text-sm font-semibold text-slate-600 hover:text-red-700 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-600">
          <ArrowLeft className="size-4" aria-hidden="true" />Back to Admin Insights
        </Link>
      </div>
    </nav>
    {children}
  </>;
}
