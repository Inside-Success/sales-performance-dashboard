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
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <Link href="/" className={cn(buttonVariants({ variant: "ghost" }), "mb-4 px-0")}>
            <ArrowLeft className="size-4" />
            Home
          </Link>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-3xl font-semibold tracking-normal">{repName}</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                {calls.length} {calls.length === 1 ? "report" : "reports"} found.
              </p>
            </div>
            <Badge variant="outline" className="gap-1 rounded-md bg-background/70">
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
            <div className="rounded-xl border bg-card/80 p-8 text-center text-sm text-muted-foreground">
              {filters.q || filters.date ? "No reports match that search." : "No reports found for this rep."}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
