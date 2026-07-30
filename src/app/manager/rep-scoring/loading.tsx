import { Skeleton } from "@/components/ui/skeleton";

export default function RepScoringLoading() {
  return <main className="magic-page"><div className="mx-auto grid w-full max-w-[84rem] gap-5 px-5 pb-16 pt-8 sm:px-8"><Skeleton className="h-52 rounded-3xl" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-40 rounded-2xl" />)}</div><Skeleton className="h-96 rounded-3xl" /></div></main>;
}
