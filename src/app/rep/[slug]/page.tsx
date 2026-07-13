import Link from "next/link";
import { ArrowDownWideNarrow, ArrowLeft } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { CallCard } from "@/components/dashboard/call-card";
import { ReportFilters } from "@/components/dashboard/report-filters";
import { getDashboardData } from "@/lib/db";
import { readFilters, type RawSearchParams } from "@/lib/search-params";
import { cn } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function RepPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<RawSearchParams>;
}) {
  const { slug } = await params;
  const filters = readFilters(await searchParams, { rep: slug });
  const { calls, reps } = await getDashboardData(filters);
  const repName = reps.find((rep) => rep.rep_slug === slug)?.rep_name || calls[0]?.rep_name || "Rep";

  return (
    <main className="magic-page">
      <div className="magic-container flex flex-col gap-6">
        <div className="magic-card magic-hero p-5 md:p-7">
          <Link href="/coaching" className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "mb-4 rounded-full px-0 text-slate-500 hover:text-[#B91C1C]")}>
            <ArrowLeft className="size-4" />
            Home
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl font-semibold tracking-normal text-slate-950 md:text-5xl">{repName}</h1>
              <p className="mt-2 text-sm text-slate-500">
                {calls.length} {calls.length === 1 ? "report" : "reports"} found.
              </p>
            </div>
            <Badge variant="outline" className="gap-1 rounded-full bg-white/80 text-slate-600">
              <ArrowDownWideNarrow className="size-3.5" />
              Newest meetings first
            </Badge>
          </div>
        </div>

        <section className="grid gap-3">
          <ReportFilters action={`/rep/${slug}`} filters={filters} clearHref={`/rep/${slug}`} />
          {calls.length ? (
            calls.map((call) => <CallCard key={call.id} call={call} compact showRep={false} />)
          ) : (
            <div className="magic-card p-10 text-center text-sm text-slate-500">
              {filters.q || filters.date ? "No reports match that search." : "No reports found for this rep."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
