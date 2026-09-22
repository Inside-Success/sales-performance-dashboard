import { ArrowLeft, CalendarDays, Clock3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import welcomeStyles from "@/app/welcome.module.css";

const HOME_CARDS = [0, 1, 2];
const REPORT_SECTIONS = [0, 1, 2, 3, 4, 5];

export function LoadingProgress() {
  return (
    <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden bg-[#FEE2E2]" aria-hidden="true">
      <div className="loading-progress h-full bg-[#DC2626]" />
    </div>
  );
}

export function DashboardHomeLoading() {
  return (
    <main className={`magic-page relative ${welcomeStyles.page}`} aria-label="Loading dashboard" role="status">
      <LoadingProgress />
      <div className={welcomeStyles.container} aria-hidden="true">
        <section className={welcomeStyles.hero}>
          <Skeleton className="h-12 w-[min(100%,42rem)] bg-[#E7E7EB]" />
          <div className={welcomeStyles.process}>
            <Skeleton className="h-6 w-36 bg-[#E7E7EB]" />
            <div className="space-y-3">
              {[0, 1, 2, 3].map((step) => (
                <Skeleton key={step} className="h-7 w-full bg-[#E7E7EB]" />
              ))}
            </div>
          </div>
        </section>

        <section className={welcomeStyles.tools}>
          {[0, 1].map((tool) => (
            <div key={tool} className={`${welcomeStyles.tool} pointer-events-none`}>
              <div className="w-full space-y-3">
                <Skeleton className="h-4 w-36 max-w-full bg-[#E7E7EB]" />
                <Skeleton className="h-8 w-44 max-w-full bg-[#E7E7EB]" />
              </div>
              <Skeleton className="h-10 w-20 shrink-0 rounded-full bg-[#FEE2E2]" />
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

export function RepPageLoading() {
  return (
    <main className="magic-page relative" aria-label="Loading rep reports" role="status">
      <LoadingProgress />
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <section className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
            <ArrowLeft className="size-4" />
            <Skeleton className="h-4 w-16" />
          </div>
          <Skeleton className="h-9 w-56" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </section>
        <section className="grid gap-3">
          {HOME_CARDS.map((item) => (
            <CallCardSkeleton key={item} />
          ))}
        </section>
      </div>
    </main>
  );
}

export function ReportPageLoading() {
  return (
    <main className="magic-page relative" aria-label="Loading report" role="status">
      <LoadingProgress />
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-8">
        <article className="space-y-5">
          <section className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <ArrowLeft className="size-4" />
              <Skeleton className="h-4 w-16" />
            </div>
            <div className="flex gap-2">
              <Skeleton className="mt-4 h-5 w-16" />
              <Skeleton className="mt-4 h-5 w-44" />
            </div>
            <Skeleton className="mt-3 h-9 w-80 max-w-full" />
            <Skeleton className="mt-3 h-4 w-64 max-w-full" />
            <div className="mt-5 flex flex-wrap gap-2">
              <Skeleton className="h-8 w-36" />
              <Skeleton className="h-8 w-24" />
              <Skeleton className="h-8 w-28" />
            </div>
          </section>

          {REPORT_SECTIONS.map((item) => (
            <ReportSectionSkeleton key={item} />
          ))}
        </article>
      </div>
    </main>
  );
}

function CallCardSkeleton() {
  return (
    <Card className="dashboard-card rounded-lg border-border/80 bg-card/95">
      <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <Skeleton className="h-5 w-44" />
          <div className="flex flex-wrap items-center gap-2">
            <Clock3 className="size-3.5 text-muted-foreground" />
            <Skeleton className="h-4 w-40" />
            <CalendarDays className="size-3.5 text-muted-foreground" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
        <Skeleton className="h-7 w-24" />
      </CardContent>
    </Card>
  );
}

function ReportSectionSkeleton() {
  return (
    <section className="rounded-xl border bg-card/95 p-5">
      <div className="mb-5 flex items-center gap-2">
        <Skeleton className="size-7 rounded-md" />
        <Skeleton className="h-4 w-32" />
      </div>
      <Skeleton className="h-4 w-full" />
      <Skeleton className="mt-3 h-4 w-11/12" />
      <Skeleton className="mt-3 h-4 w-9/12" />
    </section>
  );
}
