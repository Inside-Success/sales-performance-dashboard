import { Skeleton } from "@/components/ui/skeleton";

export default function RepNoShowLoading() {
  return (
    <main className="magic-page" aria-label="Loading rep no-show dashboard" role="status">
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-5 px-4 py-6 sm:px-6 lg:px-8">
        <div className="dashboard-card dashboard-hero rounded-2xl border bg-card/95 p-5 md:p-6">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="mt-5 h-10 w-full max-w-xl" />
          <Skeleton className="mt-3 h-5 w-full max-w-2xl" />
        </div>
        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-32 rounded-xl" />
          ))}
        </section>
        <section className="grid gap-5 lg:grid-cols-[minmax(0,0.95fr)_minmax(420px,1.05fr)]">
          <Skeleton className="h-80 rounded-xl" />
          <Skeleton className="h-80 rounded-xl" />
        </section>
        <Skeleton className="h-96 rounded-xl" />
      </div>
    </main>
  );
}
