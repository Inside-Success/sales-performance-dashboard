import { Skeleton } from "@/components/ui/skeleton";

export default function ComplianceLoading() {
  return (
    <main className="dashboard-page min-h-screen bg-background">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <Skeleton className="h-6 w-44" />
          <Skeleton className="mt-5 h-10 w-full max-w-xl" />
          <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
        </div>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </section>
        <Skeleton className="h-28 rounded-xl" />
        <section className="grid gap-5 xl:grid-cols-[minmax(0,1.15fr)_minmax(420px,0.85fr)]">
          <Skeleton className="h-[34rem] rounded-xl" />
          <Skeleton className="h-[34rem] rounded-xl" />
        </section>
      </div>
    </main>
  );
}
